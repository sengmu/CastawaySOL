import os
import numpy as np
from PIL import Image

pants_dir = "E:/CastawaySOL/island-game/public/models/player/Model/PlayerBottomsPantsNormal.Nin_NX_NVN"
os.makedirs(pants_dir, exist_ok=True)

S = 256
rng = np.random.default_rng(2026)

# 1. 经典探险工装短裤漫反射贴图 (Alb) - 质感深海蓝丹宁 #2b4566
base_color = np.array([43.0, 69.0, 102.0])
noise = rng.uniform(-8.0, 8.0, (S, S, 3))
fabric_arr = np.clip(base_color + noise, 0, 255).astype(np.uint8)
alb_img = Image.fromarray(fabric_arr, "RGB")
alb_img.save(os.path.join(pants_dir, "mBottoms_Alb.png"))
print("mBottoms_Alb.png created")

# 2. 标准平面法线贴图 (Nrm) - (128, 128, 255)
nrm_arr = np.zeros((S, S, 3), dtype=np.uint8)
nrm_arr[:, :] = [128, 128, 255]
nrm_img = Image.fromarray(nrm_arr, "RGB")
nrm_img.save(os.path.join(pants_dir, "mBottoms_Nrm.png"))
print("mBottoms_Nrm.png created")

# 3. 混合遮罩/高光粗糙度贴图 (Mix) - R: AO, G: Roughness, B: Metallic
mix_arr = np.zeros((S, S, 3), dtype=np.uint8)
mix_arr[:, :] = [255, 180, 0] # 适度粗糙度，纯非金属
mix_img = Image.fromarray(mix_arr, "RGB")
mix_img.save(os.path.join(pants_dir, "mBottoms_Mix.png"))
print("mBottoms_Mix.png created")
