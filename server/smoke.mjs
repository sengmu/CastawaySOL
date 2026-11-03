import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';

const dataDir = await mkdtemp(join(tmpdir(), 'castawaysol-account-'));
const port = 18000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [fileURLToPath(new URL('./account-server.js', import.meta.url))], {
  env: { ...process.env, ACCOUNT_PORT: String(port), ACCOUNT_DATA_DIR: dataDir }, stdio: 'ignore'
});
async function request(path, method = 'GET', payload, token) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  return { status: response.status, data: await response.json() };
}
try {
  for (let i = 0; i < 30; i++) {
    try { if ((await request('/health')).status === 200) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const address = new PublicKey(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)).toBase58();
  const challenge = await request('/auth/challenge', 'POST', { address });
  assert.equal(challenge.status, 200);
  const bad = await request('/auth/verify', 'POST', { address, message: challenge.data.message, signature: Buffer.alloc(64).toString('base64') });
  assert.equal(bad.status, 401);
  const challenge2 = await request('/auth/challenge', 'POST', { address });
  const signature = sign(null, Buffer.from(challenge2.data.message), privateKey).toString('base64');
  const login = await request('/auth/verify', 'POST', { address, message: challenge2.data.message, signature });
  assert.equal(login.status, 200);
  const token = login.data.token;
  assert.equal((await request('/save')).status, 401);
  assert.equal((await request('/save', 'GET', undefined, token)).data.record, null);
  const snapshot = { schemaVersion: 2, saveSeed: 'test', player: { position: [0, 0, 0] }, survival: { life: 100 }, story: { currentChapterId: 0 }, inventory: {} };
  assert.equal((await request('/save', 'PUT', { snapshot, expectedRevision: 0 }, token)).data.revision, 1);
  assert.equal((await request('/save', 'PUT', { snapshot, expectedRevision: 0 }, token)).status, 409);
  assert.equal((await request('/save', 'GET', undefined, token)).data.record.revision, 1);
  console.log('account smoke: challenge, signature, auth, save, conflict passed');
} finally {
  child.kill();
}
