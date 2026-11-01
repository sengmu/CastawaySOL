// CastawaySOL - Solana Web3 钱包管理系统与支付闭环自动化测试套件
import assert from 'node:assert/strict';
import { solanaBridge } from '../src/core/SolanaBridge.js';

console.log('🟣 开始执行 CastawaySOL 钱包连接与 Web3 支付全链路自动化测试套件...\n');

// 1. 测试提供商探测与可用钱包清单
console.log('▶ [1/6] 验证钱包提供商探测与清单格式...');
const wallets = solanaBridge.getAvailableWallets();
assert.ok(Array.isArray(wallets), '钱包列表必须为数组');
assert.ok(wallets.some(w => w.id === 'mwa'), '必须包含 MWA / Seed Vault 钱包');
assert.ok(wallets.some(w => w.id === 'phantom'), '必须包含 Phantom 钱包');
assert.ok(wallets.some(w => w.id === 'backpack'), '必须包含 Backpack 钱包');
assert.ok(wallets.some(w => w.id === 'guest'), '必须包含免钱包游客模式');
console.log(`  ✅ 成功探测到 ${wallets.length} 种钱包接入通道！`);

// 2. 测试网络切换功能 (Devnet / Testnet，严禁切换至 Mainnet-Beta)
console.log('\n▶ [2/6] 验证多网络切换功能与主网拦截...');
const initialNet = solanaBridge.network;
assert.equal(initialNet, 'devnet', '默认网络应为 devnet');
solanaBridge.setNetwork('testnet');
assert.equal(solanaBridge.network, 'testnet', '网络切换为 testnet 成功');
assert.throws(() => solanaBridge.setNetwork('mainnet-beta'), /主网已锁死/, '主网切换必须被严格拦截拒付');
assert.throws(() => solanaBridge.setNetwork('mainnet'), /主网已锁死/, '主网切换必须被严格拦截拒付');
solanaBridge.setNetwork('devnet');
assert.equal(solanaBridge.network, 'devnet', '网络切回 devnet 成功');
console.log('  ✅ 多网络环境配置与主网锁死拦截验证通过！');

// 3. 测试免钱包游客试玩接入与断开
console.log('\n▶ [3/6] 验证游客免钱包快速接入、沙盒余额与断开...');
const guestRes = await solanaBridge.connectWallet('guest');
assert.ok(guestRes.success, '游客连接必须成功');
assert.ok(solanaBridge.isConnected, '状态应标记为已连接');
assert.ok(solanaBridge.isGuest, '应标记为游客模式');
assert.ok(solanaBridge.walletAddress.startsWith('SEEKER_'), '游客地址前缀应为 SEEKER_');
assert.ok(solanaBridge.balance > 0, '游客应拥有初始测试余额');
console.log(`  ✅ 游客快速试玩接入正常 (地址: ${solanaBridge.walletAddress}, 余额: ${solanaBridge.balance} SOL)`);

// 4. 测试地址复制与安全方法
console.log('\n▶ [4/6] 验证钱包地址获取与复制逻辑...');
const copyRes = await solanaBridge.copyWalletAddress();
assert.ok(copyRes.success, '复制逻辑应正常执行');
console.log('  ✅ 钱包地址复制与对外接口封装正常！');

// 5. 测试支付交易 (sendPaymentTransaction) 游客沙盒扣费与边界防御
console.log('\n▶ [5/6] 验证支付交易构建、收款地址防线与沙盒安全扣费...');
// 未配置收款地址时必须严格拒绝支付
const noTreasuryPay = await solanaBridge.sendPaymentTransaction(1.2);
assert.equal(noTreasuryPay.success, false, '未配置收款地址时必须拒绝支付');
assert.ok(noTreasuryPay.message.includes('未配置'), '应提示官方收款地址未配置');

// 配置有效测试收款地址后方可支付
solanaBridge.setTreasuryAddress('11111111111111111111111111111111');
const initialBal = solanaBridge.balance;
const payRes = await solanaBridge.sendPaymentTransaction(1.2);
assert.ok(payRes.success, '支付扣费必须成功');
assert.equal(payRes.isGuest, true, '游客支付应标记 isGuest');
assert.ok(payRes.signature.startsWith('GUEST_TX_'), '应生成游客交易签名凭据');
assert.equal(solanaBridge.balance, initialBal - 1.2, '余额应准确扣减');

// 余额不足防御
const failPay = await solanaBridge.sendPaymentTransaction(999.0);
assert.equal(failPay.success, false, '余额不足时必须拦截支付');
assert.ok(failPay.message.includes('余额不足'), '应提示余额不足');
console.log('  ✅ 支付交易校验、收款地址防线、余额扣减与防超额透支边界测试通过！');

// 6. 测试生存打卡签名与证书存证生成
console.log('\n▶ [6/6] 验证生存打卡签名存证与断开连接...');
const checkinRes = await solanaBridge.signSurvivalCheckin(3, 420);
assert.ok(checkinRes.success, '签到存证必须成功');
assert.ok(checkinRes.record, '必须生成签到记录');
assert.equal(checkinRes.record.day, 3, '签到天数必须一致');

await solanaBridge.disconnect();
assert.equal(solanaBridge.isConnected, false, '断开后连接状态应为 false');
assert.equal(solanaBridge.walletAddress, null, '断开后地址应清空');
assert.equal(solanaBridge.balance, 0, '断开后余额应归零');
console.log('  ✅ 签到存证记录与断开清理流程验证通过！');

console.log('\n🎉🎉 [ALL WALLET TESTS PASSED] Solana Web3 钱包管理系统与支付闭环 100% 验证通过！');
