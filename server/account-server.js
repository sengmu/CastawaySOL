import http from 'node:http';
import { randomBytes, createPublicKey, verify } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PublicKey } from '@solana/web3.js';

const host = process.env.ACCOUNT_HOST || '127.0.0.1';
const port = Number(process.env.ACCOUNT_PORT || 8787);
const dataDir = process.env.ACCOUNT_DATA_DIR || join(process.cwd(), 'account-data');
const origins = new Set((process.env.ACCOUNT_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
const challenges = new Map();
const sessions = new Map();
const writes = new Map();
const now = () => Date.now();

function json(req, res, status, body) {
  const allowOrigin = origins.has(req.headers.origin) ? req.headers.origin : null;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(allowOrigin ? { 'access-control-allow-origin': allowOrigin, 'vary': 'Origin' } : {}) });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 2_000_000) throw new Error('Payload too large');
  }
  return JSON.parse(text || '{}');
}

function publicKey(address) {
  const bytes = new PublicKey(address).toBytes();
  return createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(bytes)]), format: 'der', type: 'spki' });
}

function session(req) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  const value = sessions.get(token);
  if (!value || value.expires < now()) return null;
  return value;
}

function savePath(address) { return join(dataDir, `${address}.json`); }
async function readSave(address) {
  try { return JSON.parse(await readFile(savePath(address), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function locked(address, action) {
  const previous = writes.get(address) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  writes.set(address, current);
  await previous;
  try { return await action(); }
  finally { release(); if (writes.get(address) === current) writes.delete(address); }
}

await mkdir(dataDir, { recursive: true });
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    if (!origins.has(req.headers.origin)) return json(req, res, 403, { error: 'Origin denied' });
    res.writeHead(204, { 'access-control-allow-origin': req.headers.origin, 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'access-control-allow-headers': 'authorization,content-type', 'vary': 'Origin' });
    return res.end();
  }
  if (req.headers.origin && !origins.has(req.headers.origin)) return json(req, res, 403, { error: 'Origin denied' });
  try {
    if (req.url === '/health' && req.method === 'GET') return json(req, res, 200, { ok: true });
    if (req.url === '/auth/challenge' && req.method === 'POST') {
      const { address } = await body(req);
      publicKey(address);
      if (challenges.size > 10000) for (const [key, value] of challenges) if (value.expires < now()) challenges.delete(key);
      const nonce = randomBytes(24).toString('hex');
      const message = `CastawaySOL account login\nWallet: ${address}\nNonce: ${nonce}\nExpires: ${new Date(now() + 300000).toISOString()}`;
      challenges.set(address, { message, expires: now() + 300000 });
      return json(req, res, 200, { message });
    }
    if (req.url === '/auth/verify' && req.method === 'POST') {
      const { address, message, signature } = await body(req);
      const challenge = challenges.get(address);
      challenges.delete(address);
      if (!challenge || challenge.expires < now() || challenge.message !== message || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return json(req, res, 401, { error: 'Challenge invalid' });
      if (!verify(null, Buffer.from(message, 'utf8'), publicKey(address), Buffer.from(signature, 'base64'))) return json(req, res, 401, { error: 'Signature invalid' });
      const token = randomBytes(32).toString('hex');
      sessions.set(token, { address, expires: now() + 86400000 });
      return json(req, res, 200, { token, address, expiresAt: now() + 86400000 });
    }
    const auth = session(req);
    if (!auth) return json(req, res, 401, { error: 'Authentication required' });
    if (req.url === '/save' && req.method === 'GET') return json(req, res, 200, { record: await readSave(auth.address) });
    if (req.url === '/save' && req.method === 'PUT') {
      const { snapshot, expectedRevision } = await body(req);
      if (!snapshot || snapshot.schemaVersion !== 2 || !snapshot.saveSeed || !snapshot.player || !snapshot.survival || !snapshot.story || !snapshot.inventory || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json(req, res, 400, { error: 'Invalid save' });
      return locked(auth.address, async () => {
        const current = await readSave(auth.address);
        if ((current?.revision || 0) !== expectedRevision) return json(req, res, 409, { error: 'Revision conflict', revision: current?.revision || 0 });
        const record = { revision: expectedRevision + 1, updatedAt: new Date().toISOString(), snapshot };
        const target = savePath(auth.address);
        const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
        await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
        if (current) await copyFile(target, `${target}.bak`);
        await rename(temp, target);
        return json(req, res, 200, { revision: record.revision, updatedAt: record.updatedAt });
      });
    }
    return json(req, res, 404, { error: 'Not found' });
  } catch (error) {
    return json(req, res, error instanceof SyntaxError || error.message === 'Payload too large' ? 400 : 500, { error: error.message === 'Payload too large' ? error.message : 'Request failed' });
  }
}).listen(port, host, () => console.log(`CastawaySOL account API listening on ${host}:${port}`));
