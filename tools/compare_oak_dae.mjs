import fs from 'fs';

const dir = 'E:/CastawaySOL/island-game/public/models/plants/Model/PltTreeOak.Nin_NX_NVN/';
['PltTreeOak4.dae', 'PltTreeOak4Node.dae'].forEach(file => {
  const text = fs.readFileSync(dir + file, 'utf8');
  const geoms = [...text.matchAll(/<geometry id="([^"]+)"/g)].map(m => m[1]);
  console.log(`=== ${file} geoms (${geoms.length}):`);
  geoms.forEach(g => console.log('  ', g));
});
