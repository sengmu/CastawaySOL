import fs from 'fs';
import path from 'path';

// 读取 AssetRegistry.js
const assetFile = fs.readFileSync('E:/CastawaySOL/island-game/src/core/AssetRegistry.js', 'utf8');

const matches = assetFile.match(/path:\s*['"]([^'"]+)['"]/g) || [];
const paths = matches.map(m => m.match(/path:\s*['"]([^'"]+)['"]/)[1]);

console.log(`Checking ${paths.length} asset paths...`);
const missing = [];
paths.forEach(p => {
  const fullPath = path.join('E:/CastawaySOL/island-game/public', p);
  if (!fs.existsSync(fullPath)) {
    missing.push(p);
  }
});

console.log('Missing assets count:', missing.length);
if (missing.length > 0) {
  console.log('Missing paths:', missing);
}
