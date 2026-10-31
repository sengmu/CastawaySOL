import fs from 'fs';
import path from 'path';

const basePath = 'E:/CastawaySOL/island-game/public/models/plants/Model/';
const plants = [
  {
    name: 'PltTreePalm',
    dir: 'PltTreePalm.Nin_NX_NVN',
    leaves: { alb: 'mPltTreePalmLeaf_AlbGry.png', op: 'mPltTreePalmLeaf_OP.png', nrm: 'mPltTreePalmLeaf_Nrm.png' },
    trunk: { alb: 'mPltTreePalmTrunk_AlbGry.png', op: 'mPltTreePalmTrunk_OP.png', nrm: 'mPltTreePalmTrunk_Nrm.png' }
  },
  {
    name: 'PltTreeOak',
    dir: 'PltTreeOak.Nin_NX_NVN',
    leaves: { alb: 'mTreeOakLeaf_AlbGry.png', op: 'mTreeOakLeaf_OP.png', nrm: 'mTreeOakLeaf_Nrm.png' },
    trunk: { alb: 'mPltTreeOakTrunk_AlbGry.png', nrm: 'mPltTreeOakTrunk_Nrm.png' }
  },
  {
    name: 'PltTreeOakSakura',
    dir: 'PltTreeOakSakura.Nin_NX_NVN',
    bloom: { alb: 'mTreeOakSakuraBloom_Alb.png', op: 'mTreeOakSakuraBloom_OP.png', nrm: 'mTreeOakSakuraBloom_Nrm.png' },
    back: { alb: 'mTreeOakSakuraBack_Alb.png', op: 'mTreeOakSakuraBack_OP.png' },
    trunk: { alb: 'mTreeOakTrunkSakura_Alb.png', nrm: 'mTreeOakTrunkSakura_Nrm.png' }
  },
  {
    name: 'PltTreeCedar',
    dir: 'PltTreeCedar.Nin_NX_NVN',
    leaves: { alb: 'mPltTreeCedarLeaf_AlbGry.png', op: 'mPltTreeCedarLeaf_OP.png', nrm: 'mPltTreeCedarLeaf_Nrm.png' },
    trunk: { alb: 'mTreeCedarTrunk_AlbGry.png', nrm: 'mTreeCedarTrunk_Nrm.png' }
  }
];

plants.forEach(p => {
  console.log(`\n检查植物: ${p.name}`);
  const dir = path.join(basePath, p.dir);
  for (const part of Object.keys(p)) {
    if (part === 'name' || part === 'dir') continue;
    const textures = p[part];
    for (const [key, filename] of Object.entries(textures)) {
      const fullPath = path.join(dir, filename);
      const exists = fs.existsSync(fullPath);
      console.log(`  [${part}.${key}] ${filename} -> ${exists ? '✅ 存在' : '❌ 缺失'}`);
    }
  }
});
