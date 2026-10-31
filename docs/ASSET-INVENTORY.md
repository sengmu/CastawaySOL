# 可复用素材盘点

盘点日期：2026-10-31。检查了实际文件、随包许可证与已有预览；尚未对每个模型做加载、面数、尺寸和贴图完整性验收。

素材根目录：E:/CastawaySOL/assets-archive/CastawaySOL-source-vc9-2026-10-30/assets_cc0

## 优先评估

- kenney_pirate-kit/extracted/Models/GLB format：72个GLB文件；ship-wreck、palm-detailed-bend、palm-detailed-straight、dock、ship-small、crate、crate-bottles、chest、barrel、mast、mast-ropes、structure-platform-dock等。优先船骸、沙滩箱桶、码头和棕榈。
- kenney_survival-kit/extracted/Models/GLB format：80个GLB文件；tent-canvas、tent、bedroll、bedroll-frame、campfire-pit、campfire-fishing-stand、box、barrel、bucket、bottle、workbench、resource-planks、resource-wood、resource-stone、tool-axe、tool-hammer、rock-sand-a/b/c。优先营地与资源可视化。
- kenney_nature-kit：递归发现329个GLB文件，另有FBX/OBJ与大量贴图；树、棕榈、灌木、岩石等。不要假设其子目录与其他包相同，用文件检索定位；数量是文件数，不保证独立造型数。
- quaternius_ultimate-nature/FBX：150个FBX文件，无GLB；WoodLog、TreeStump、Rock、Palm及多季节植物变体。需转换后评估浏览器加载。
- kenney_graveyard-kit：91个GLB文件，柱、墓室、石制构件可少量用于后期遗迹，开局不优先。

## 许可证据

上述五套均找到License.txt，标明CC0。Kenney许可随extracted目录，Quaternius在包根目录。保留许可证并记录所复制文件；本地许可检查不是对归档来源的完整外部审计。

当前public/models中的DAE角色/树木/家具另有来源，不能因放在同项目就视作CC0，商业发布前单独核查。

## 当前public已具备

plants、npcs、player、furniture、structures。家具含营火、长椅、桌、饮水设施、篮子、望远镜等；建筑有帐篷、木屋、机场。AssetRegistry只登记部分内容。不是所有文件都当前可见或适合海难开场。

## 推荐接入顺序

1. ship-wreck替代程序化船骸；crate/barrel点缀漂流区。
2. tent-canvas、bedroll、campfire-pit统一营地；workbench、资源堆为生产预留。
3. 同套棕榈、岩石、草簇统一开局风格；不要随机混用不同低模比例。
4. 模块化dock/platform支撑码头和后续扩张。

从归档复制选中资源到public的新目录，保留原档；GLB需核查外部依赖，沿用正确PBR材质，不要被ModelLoader统一发光/光泽改写。统一尺度、地表贴合、碰撞和手机性能后才替换正式场景。

## 已有预览

assets_cc0/previews/sheet_a_kenney_nature.png
assets_cc0/previews/sheet_b_kenney_mix.png
assets_cc0/previews/sheet_c_quaternius_pack.jpg
混合预览物体显示偏小，只适合辨认类别，不能据此判断细节质量。
