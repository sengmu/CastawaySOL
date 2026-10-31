// 验证 PlayerBody, PlayerHair00, PlayerBottomsPantsNormal 的同名骨骼映射
import fs from 'fs';

function extractBoneNames(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const boneMatches = [...content.matchAll(/<node[^>]+id="([^"]+)"[^>]+type="JOINT"/gi)];
  if (boneMatches.length > 0) {
    return boneMatches.map(m => m[1]);
  }
  // 兜底正则
  const nodeMatches = [...content.matchAll(/<node[^>]+name="([^"]+)"/gi)];
  return nodeMatches.map(m => m[1]);
}

const bodyBones = extractBoneNames('E:/CastawaySOL/island-game/public/models/player/Model/PlayerBody.Nin_NX_NVN/PlayerBody.dae');
const pantsBones = extractBoneNames('E:/CastawaySOL/island-game/public/models/player/Model/PlayerBottomsPantsNormal.Nin_NX_NVN/PlayerBottomsPantsNormal.dae');
const hairBones = extractBoneNames('E:/CastawaySOL/island-game/public/models/player/Model/PlayerHair00.Nin_NX_NVN/PlayerHair00.dae');

console.log('Body joint count:', bodyBones.length);
console.log('Pants joint count:', pantsBones.length);
console.log('Hair joint count:', hairBones.length);

const commonPants = pantsBones.filter(b => bodyBones.includes(b));
console.log('Common joints between Body & Pants:', commonPants);

const commonHair = hairBones.filter(b => bodyBones.includes(b));
console.log('Common joints between Body & Hair:', commonHair);
