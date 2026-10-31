import os
import math
import random
import numpy as np
from PIL import Image, ImageDraw

OUT = "E:/CastawaySOL/island-game/public/textures"
os.makedirs(OUT, exist_ok=True)

# 1. 温暖金黄细沙滩贴图 (Sand)
def make_sand():
    S = 512
    # 纯正海岛色板：#EAC286 ~ #FCE29C
    base = np.array([238.0, 204.0, 148.0])
    rng = np.random.default_rng(42)
    noise = rng.uniform(-10.0, 10.0, (S, S, 3))
    # 细微风吹波纹纹理
    ys = np.arange(S)[:, None]
    xs = np.arange(S)[None, :]
    ripple = np.sin(ys / 16.0 + np.sin(xs / 32.0)) * 6.0
    arr = base + noise + ripple[:, :, None]
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    img.save(os.path.join(OUT, "sand.png"))
    print("sand.png done")

# 2. 海浪岸线白泡沫与波光水体 (Water Foam)
def make_water_caustics():
    S = 512
    # 清亮浅青绿水色 #63A5BC
    arr = np.zeros((S, S, 4), dtype=np.uint8)
    # 生成多重正弦波纹叠加的半透明波光
    for y in range(S):
        for x in range(S):
            v1 = math.sin(x / 18.0 + y / 24.0)
            v2 = math.sin(x / 28.0 - y / 16.0)
            v3 = math.sin(math.sqrt((x - S/2)**2 + (y - S/2)**2) / 12.0)
            val = (v1 + v2 + v3) / 3.0
            alpha = int(max(0, min(255, (val * 0.5 + 0.5) * 120 + 80)))
            arr[y, x] = [230, 250, 255, alpha]
    img = Image.fromarray(arr, "RGBA")
    img.save(os.path.join(OUT, "water_foam.png"))
    print("water_foam.png done")

# 3. 悬崖土层纹理 (Cliff Earth Striations)
def make_cliff_earth():
    S = 512
    # 棕褐土层 #B98A5A 与岩石条纹
    base = np.array([168.0, 122.0, 82.0])
    rng = np.random.default_rng(101)
    arr = np.zeros((S, S, 3))
    arr[:] = base[None, None, :]
    ys = np.arange(S)[:, None]
    # 水平地质层理
    layer = np.sin(ys / 12.0) * 18.0 + np.sin(ys / 28.0) * 14.0
    noise = rng.uniform(-12.0, 12.0, (S, S, 1))
    arr += layer[:, :, None] + noise
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")
    img.save(os.path.join(OUT, "cliff_earth.png"))
    print("cliff_earth.png done")

make_sand()
make_water_caustics()
make_cliff_earth()
