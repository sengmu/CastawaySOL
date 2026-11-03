import { solanaBridge } from './SolanaBridge.js';
import { SAVE_KEY_PRIMARY } from '../systems/SaveSystem.js';

export class AccountService {
  constructor(game) {
    this.game = game;
    this.baseUrl = (import.meta.env.VITE_ACCOUNT_API_URL || '').replace(/\/$/, '');
    this.token = null;
    this.address = null;
    this.revision = null;
    this.remoteRecord = null;
    this.uploading = false;
    this.pendingSnapshot = null;
    this.syncEnabled = false;
    window.addEventListener('solana-wallet-changed', () => {
      if (!solanaBridge.isConnected || solanaBridge.walletAddress !== this.address) this.disconnect();
    });
  }

  get configured() { return Boolean(this.baseUrl); }
  get linked() { return Boolean(this.token && this.address === solanaBridge.walletAddress); }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...options.headers }
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || '账号服务请求失败'), { status: response.status, data });
    return data;
  }

  async connect() {
    if (!this.configured) throw new Error('账号服务尚未配置');
    if (!solanaBridge.isConnected || solanaBridge.isGuest || !solanaBridge.walletAddress) throw new Error('请先连接真实钱包');
    const address = solanaBridge.walletAddress;
    const { message } = await this.request('/auth/challenge', { method: 'POST', body: JSON.stringify({ address }) });
    const signature = await solanaBridge.signAccountChallenge(message);
    if (solanaBridge.walletAddress !== address || !solanaBridge.isConnected) throw new Error('签名时钱包已切换');
    const { token } = await this.request('/auth/verify', { method: 'POST', body: JSON.stringify({ address, message, signature }) });
    this.token = token;
    this.address = address;
    const { record } = await this.request('/save');
    this.remoteRecord = record;
    this.revision = record?.revision || 0;
    this.syncEnabled = false;
    let local = null;
    try { local = JSON.parse(localStorage.getItem(SAVE_KEY_PRIMARY) || 'null'); } catch {}
    if (!record) {
      await this.upload(local && this.game.saveSystem.validateSaveData(local) ? local : this.game.saveSystem.createSnapshot());
    } else if (local?.saveSeed === record.snapshot?.saveSeed) {
      if (local.timestamp > record.snapshot.timestamp) await this.upload(local);
      else if (local.timestamp === record.snapshot.timestamp) this.syncEnabled = true;
    }
    return record;
  }

  disconnect() {
    this.token = null;
    this.address = null;
    this.revision = null;
    this.remoteRecord = null;
    this.pendingSnapshot = null;
    this.syncEnabled = false;
  }

  async upload(snapshot = this.game.saveSystem.createSnapshot()) {
    if (!this.linked || this.revision === null) throw new Error('请先绑定钱包账号');
    if (!this.game.saveSystem.validateSaveData(snapshot)) throw new Error('本地存档无效');
    const result = await this.request('/save', { method: 'PUT', body: JSON.stringify({ snapshot, expectedRevision: this.revision }) });
    this.revision = result.revision;
    this.remoteRecord = { revision: result.revision, updatedAt: result.updatedAt, snapshot };
    this.syncEnabled = true;
    return result;
  }

  async restore() {
    if (!this.linked || !this.remoteRecord?.snapshot) throw new Error('没有可恢复的云端存档');
    const result = this.game.saveSystem.importSave(JSON.stringify(this.remoteRecord.snapshot));
    if (!result.success) throw new Error(result.error || '云端存档校验失败');
    this.syncEnabled = true;
    return result;
  }

  queueUpload(snapshot) {
    if (this.linked && !this.remoteRecord && !this.syncEnabled) this.syncEnabled = true;
    if (!this.linked || this.revision === null || !this.syncEnabled) return;
    this.pendingSnapshot = snapshot;
    if (this.uploading) return;
    this.uploading = true;
    const run = async () => {
      while (this.pendingSnapshot && this.linked) {
        const next = this.pendingSnapshot;
        this.pendingSnapshot = null;
        try { await this.upload(next); }
        catch (error) {
          this.pendingSnapshot = next;
          if (error.status === 409 || error.status === 401) this.disconnect();
          break;
        }
      }
      this.uploading = false;
    };
    void run();
  }
}
