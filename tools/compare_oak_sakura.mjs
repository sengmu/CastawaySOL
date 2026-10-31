import fs from 'fs';

const sakuraPath = 'E:/CastawaySOL/island-game/public/models/plants/Model/PltTreeOakSakura.Nin_NX_NVN/PltTreeOak4Sakura.dae';
const oakPath = 'E:/CastawaySOL/island-game/public/models/plants/Model/PltTreeOak.Nin_NX_NVN/PltTreeOak4.dae';

const sText = fs.readFileSync(sakuraPath, 'utf8');
const oText = fs.readFileSync(oakPath, 'utf8');

const sGeoms = [...sText.matchAll(/<geometry id="([^"]+)"/g)].map(m => m[1]);
const oGeoms = [...oText.matchAll(/<geometry id="([^"]+)"/g)].map(m => m[1]);

console.log('Sakura Geometries (', sGeoms.length, '):');
sGeoms.forEach(g => console.log('  ', g));

console.log('Oak Geometries (', oGeoms.length, '):');
oGeoms.forEach(g => console.log('  ', g));
