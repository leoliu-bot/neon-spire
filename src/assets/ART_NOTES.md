# 霓虹之井 · 图像制作说明

版本 2.1.0 · 2026-09-21

本目录用于游戏的原创城市与驾驶员图像。这些画面通过 Codex 内置 imagegen 工具生成，再作为游戏场景资产集成；并非从参考游戏截图裁切提取。

## 参考与用途

用户提供的项目文件 `H:/Tower/nikke.png`、`H:/Tower/coin pusher.png` 及基地剖面截图用于理解视觉组织和交互要求：近景角色借助掩体向远处敌人射击、完整层叠推币台，以及可建造的多房间剖面。参考图本身没有作为发行资产嵌入，不对用户提供参考图的版权归属作额外声明。

游戏中的角色、城市和机台使用原创设计，不使用 NIKKE 或其他参考作品的角色形象、商标或截图贴图。

## 最终采用的图像

| 发行源码资产 | 内容及用途 | imagegen 生成文件 ID |
| --- | --- | --- |
| `src/assets/city.png` | 原创废墟城市，作为战场远景底图；前景角色、掩体及可交互敌人单独渲染 | `exec-c6d11315-d3e4-4625-bd3f-398845d4ce1c.png` |
| `src/assets/operator.png` | 原创成年白发战术驾驶员，背向镜头举枪；作为掩体后的前景角色 | `exec-840bd040-3b15-4915-ba4f-0d7a8a539d48.png` |

两张原始生成文件来自本次任务的本机生成目录：`C:/Users/liou/.codex/generated_images/01a09f55-a6cb-7f71-8e10-b267063bd605/`。发行源码自带上述两张 PNG，运行不依赖该本机目录；单文件游戏将它们内嵌到 HTML。试作中未采用的灰色背景角色变体不属于最终资产。

## 采用的生成提示方向

以下保留最终提示的内容，空格及标点经过整理；属于规范化提示描述，不宣称是工具调用的逐字转录。

**城市背景 / city.png**

Production game asset: a richly detailed, original anime science-fiction ruined city battlefield matte painting for a portrait over-the-shoulder cover shooter. Portrait 2:3 canvas. Ground-level, eye-level camera looking straight toward the distance; never isometric or bird's-eye. Dramatic depth: shattered contemporary towers and broken elevated highway in the upper third, hazy warm ivory overcast sky, deserted wrecked street, overgrown concrete barricades, rust-red abandoned vehicles at the sides in the middle distance. Empty, clear center street with scattered rubble for animated enemy targets. Lower third: dark street and rubble for a separate foreground character and cover. Muted, desaturated olive, blue-gray and rust, with small teal accents. High-budget Japanese anime environment, painterly realistic material detail, cinematic atmosphere, crisp foreground and hazy distance. Original world. No people, monsters, guns, UI, text, logos or watermarks.

**前景驾驶员 / operator.png**

A single 2D anime game character sprite on a completely flat bright magenta pink background, RGB (255, 0, 255), chroma-key background, solid pink edge to edge, no gradients and no shadows. Background occupies at least 40 percent of the image. An adult silver-haired female science-fiction rifle operator in an ivory tactical jacket and black armored trousers. Viewed from behind, aiming a rifle to the upper right. Full body, clear separated limbs. Original Japanese anime game illustration, crisp detailed linework and high-quality cel shading. All around and between the character's hair, weapon, arms and legs, use the same flat saturated magenta pink. No scenery, gray or black backdrop, floor, framing or text. Portrait 2:3.

## 场景合成

`operator.png` 保留生成时的品红背景。游戏在 Three.js 材质着色器中根据品红色差生成透明度，同时抑制轮廓的品红溢色，完成运行时色键合成；PNG 本身并非已经抠好的透明素材。城市图、角色平面、实体掩体、敌人与射线分别绘制。驾驶员随射击和隐蔽状态升降，掩体通过场景深度遮挡角色下部；瞄准方向也会影响角色朝向及枪口连接位置。角色显示尺寸、遮挡和动画由游戏代码控制，而非背景图中的静态合成。

## 其他可见资产

基地房间、设备、推币机外壳、工作台、硬币、敌机、射线和粒子主要由 Three.js 程序生成。硬币币面使用程序绘制的 `SPIRE MINT` 图案。声音由 Web Audio 合成。开源程序依赖及其许可另见项目根目录 `THIRD_PARTY_LICENSES.txt`。v4 将上方两个工作台替换为横移倍率装置，仅保留底层实体推币台。

2.1.0 沿用上表两张生成图像，新增细节由代码绘制：六房间分别配置控制台、能源柜、武器架、护甲检测台、铸币压机和反应堆，并配合活动机构、分段卷门及等级设备。推币机移除了旧版顶部陈列筹码塔和两侧装饰金条，侧面改为传动机壳；台面上的三组叠币来自同一批物理硬币，能够碰撞、倒塌和结算。战场增加精英机体细节、核心过载状态与命中标记，瞬时点射也同步定位枪口。

## 本轮角色动作补充

继续使用内置 imagegen 编辑模式，原始 `operator.png` 是角色身份与比例参考，未覆盖。新资产已保存到项目 `src/assets/`，最终单文件游戏内嵌这两张 PNG：

| 新增素材 | 动作用途 | 最终生成文件 ID |
| --- | --- | --- |
| `operator-reload-remove-v3.png` | 左手抽出弹匣，步枪保持在另一手中 | `exec-99ec21ed-21d0-45c2-8349-4f8a913348f7.png` |
| `operator-reload-insert-v3.png` | 左手把弹匣送回弹匣井 | `exec-68061439-93cb-4b4f-90ea-57f8e2f9c5aa.png` |

项目内绝对路径分别为 `C:/Users/liou/Documents/Codex/2026-09-14/files-mentioned-by-the-user-3d/work/neon-spire/src/assets/operator-reload-remove-v3.png` 与 `C:/Users/liou/Documents/Codex/2026-09-14/files-mentioned-by-the-user-3d/work/neon-spire/src/assets/operator-reload-insert-v3.png`。生成文件的原始备份目录为 `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/`，运行不依赖它。

本轮提示词组（内置工具，保留最终使用内容；空格及标点整理）：

1. 插匣姿态：Use case: identity-preserve. Asset type: alternate reload animation sprite for the SAME adult female tactical operator in the attached edit target. Preserve the exact original canvas 1024x1536 portrait, camera angle from behind, character scale, silhouette and positions of boots, black armored trousers, hips, waist belt, white jacket, silver high ponytail and face. Change ONLY the arms and gun action: this is the magazine insertion key pose of reloading. The RIGHT hand securely holds the same tan-and-black rifle at the grip, the rifle is lowered diagonally across her chest toward the upper right, muzzle around x=950 y=270 instead of the original y=80. Her LEFT gloved hand visibly holds a new dark curved magazine JUST BELOW the empty magazine well and is pushing it into the rifle. Show a small clear gap between magazine and well. Elbows bend naturally, shoulders relax during reload. Preserve all body proportions, appearance and original high-quality anime linework/cel shading. No motion lines, no added effects or additional weapons. The background must remain exactly flat saturated RGB(255,0,255) magenta edge to edge and between limbs, no gradient/shadow/scenery/text/watermark. This must be one single consistent full-body sprite on magenta, suitable to blend with the original at the waist.
2. 插匣姿态背景修正：Precise background edit. Replace ALL gray/black/background areas in this exact image with completely flat RGB(255,0,255) bright saturated pure magenta pink, including between hair strands, between legs, and around hands and gun. Keep the operator, rifle, magazine, hands, body, face, hair, clothing and boots exactly unchanged. Solid MAGENTA chroma-key background only. No gray, no dark halo, no shading, no checkerboard, no transparency, no smoke, no gradients. This image is a cutout sprite on vivid electric hot pink color, not an illustration with environment. Same 1024x1536 portrait canvas.
3. 抽匣姿态：Animation keyframe edit of this exact game sprite. Change ONLY the LEFT forearm, LEFT gloved hand and magazine. Keep every other pixel/part as closely matching as possible, especially all boots/legs/waist/head/hair and the exact same rifle position. This is the preceding magazine removal keyframe: left elbow still bent but left forearm lowered 15 centimeters, holding the same dark curved magazine below and to the right of the rifle, with a wide clearly visible 15cm gap to the empty magazine well. Hand with magazine should be beside her waist belt at image x=750 y=600. Right hand stays on rifle grip. Natural arms/anatomy. Preserve original adult character. Entire background MUST remain flat saturated bright pure MAGENTA PINK RGB(255,0,255); no gray/black gradients, shadows or scenery. Single fullbody sprite same 1024x1536 canvas.

换弹只混合腰部以上的绘制姿态，腿与腰部轮廓仍来自原图。角色改为 48×72 细分网格，根据实际开火脉冲分别计算肩部、持枪手臂、髋部与马尾的延迟响应；脚部保持稳定。枪口位置经过同一套网格变形后再定位，避免射线与枪口脱节。换弹分为压枪、抽匣、插匣、拉栓与重新举枪，弹匣容量与可开火时点仍由战斗逻辑控制。抠图和两张姿态的预乘透明度混合由 `battle-scene.js` 统一管理。

## v4 四角度持枪素材 · 2026-09-22

四张素材均使用 Codex 内置 `image_gen.imagegen` 的编辑模式逐张生成，未使用 CLI、外部 API 或参考游戏截图裁切。原始 `operator.png` 保留未覆盖。30° 图以原始角色为编辑目标；45°、60°、75° 分别以本轮 30° 生成结果为编辑目标，独立调用，以统一人物比例、腰腿位置和画风。

所有最终 PNG 均为 1024×1536、品红色键背景。为容纳接近竖直的完整长枪，提示把身体缩至原图约 75%，脚底仍靠近画布底边，头发顶点约在 y=330～360；上方空白属于资产画布，不表示角色在游戏中缩小。

| 发行源码资产 | 标称持枪方向 | 原始生成文件 |
| --- | --- | --- |
| `src/assets/operator-aim-30-v4.png` | 向右上 30° | `exec-596ec711-3971-4181-a8d9-97e322d19f89.png` |
| `src/assets/operator-aim-45-v4.png` | 向右上 45° | `exec-3ee7d32c-3497-4bcb-bd10-2a7c9b006e7b.png` |
| `src/assets/operator-aim-60-v4.png` | 向右上 60° | `exec-ce1cbfcb-31fb-4f33-b585-fddded5e70ac.png` |
| `src/assets/operator-aim-75-v4.png` | 向右上 75° | `exec-91f2e288-8fa9-47b9-9147-bd0f55ce66e4.png` |

项目内资产根目录：`C:/Users/liou/Documents/Codex/2026-09-14/files-mentioned-by-the-user-3d/work/neon-spire/src/assets/`。上表四个 `operator-aim-*-v4.png` 文件均已复制至此，运行不依赖生成缓存。四张原始生成文件的完整路径为：

- `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/exec-596ec711-3971-4181-a8d9-97e322d19f89.png`
- `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/exec-3ee7d32c-3497-4bcb-bd10-2a7c9b006e7b.png`
- `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/exec-ce1cbfcb-31fb-4f33-b585-fddded5e70ac.png`
- `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/exec-91f2e288-8fa9-47b9-9147-bd0f55ce66e4.png`

30° 输入源图：`C:/Users/liou/Documents/Codex/2026-09-14/files-mentioned-by-the-user-3d/work/neon-spire/src/assets/operator.png`。其余三个角度的输入源图均为上表 30° 原始生成文件 `exec-596ec711-3971-4181-a8d9-97e322d19f89.png`。

### 本轮实际生成提示词

以下四段来自本轮工具调用中保存的完整提示词，各段对应一次独立调用。

**向右上 30°**

Use case: identity-preserve. Edit the attached original adult silver-haired female tactical operator into a production game sprite for a directional aiming set. This FIRST keyframe aims her rifle UP AND RIGHT at exactly 30 degrees ABOVE HORIZONTAL (barrel rises about 1 unit for 1.73 units right). Keep the same adult identity, ivory jacket, black armor trousers, ponytail, boots, equipment, rifle design, and rear camera view. Move ONLY shoulders, elbows, forearms, hands and rifle to form a physically plausible shouldered aiming pose. The left hand supports the fore-end; right hand holds trigger grip; stock meets shoulder. IMPORTANT CANVAS LAYOUT: 1024x1536 portrait, fully show the character AND whole rifle. Scale the character uniformly to 75% of the original height, keep boots at y=1490, putting TOP OF HER HAIR near y=360 and waist near y=800; this leaves a large empty upper third for later higher aiming poses. Character's pelvis center x=500. Do not enlarge her or crop the gun. Natural proportions and original cel-shaded high-quality anime game style. Background must be ENTIRELY FLAT PURE BRIGHT MAGENTA PINK RGB(255,0,255), including all gaps; NO gray, no black, no gradient, no shadows, no scenery, no transparent checkerboard. One full-body character only, no panels, no arrows, no labels, no text.

**向右上 45°**

Precise game-animation keyframe edit of this exact full-body sprite. Change ONLY her shoulders, elbows, forearms, both hands, and the angle of the same rifle, with a slight neck adjustment to sight along it. The rifle is raised UP AND RIGHT at 45 DEGREES ABOVE THE HORIZONTAL: a clear one-to-one diagonal, up one unit for every one unit right. The straight barrel direction must visibly match that angle. Buttstock stays against her shoulder, right hand on trigger grip, left hand supports the raised fore-end; natural anatomical arm pose. Keep the SAME adult silver-haired character, exact head scale, hair identity, white jacket, belt, hips, black armored trousers, legs and boots, same rear camera and canvas placement. Do not rotate the whole body or shift feet. Keep her hair top near y=340 and boots near y=1480 in the same 1024x1536 portrait canvas. Show the ENTIRE rifle including muzzle using the empty upper margin, no crop. Background must remain entirely FLAT PURE VIVID MAGENTA RGB(255,0,255), between hair/arms/legs and around gun, no gray, black, gradients, shadows, scenery, transparency checkerboard or text. One single production anime sprite, no comparison panels, no labels.

**向右上 60°**

Precise game-animation keyframe edit of this exact full-body sprite. Change ONLY her shoulders, elbows, forearms, both hands, and the angle of the same rifle, with a slight neck adjustment to sight along it. The rifle is raised UP AND RIGHT at 60 DEGREES ABOVE THE HORIZONTAL: steep upward diagonal, up 1.73 units for every one unit right. The straight barrel direction must visibly match that angle. Buttstock stays against her shoulder, right hand on trigger grip, left hand supports the raised fore-end; natural anatomical arm pose. Keep the SAME adult silver-haired character, exact head scale, hair identity, white jacket, belt, hips, black armored trousers, legs and boots, same rear camera and canvas placement. Do not rotate the whole body or shift feet. Keep her hair top near y=340 and boots near y=1480 in the same 1024x1536 portrait canvas. Show the ENTIRE rifle including muzzle using the empty upper margin, no crop. Background must remain entirely FLAT PURE VIVID MAGENTA RGB(255,0,255), between hair/arms/legs and around gun, no gray, black, gradients, shadows, scenery, transparency checkerboard or text. One single production anime sprite, no comparison panels, no labels.

**向右上 75°**

Precise game-animation keyframe edit of this exact full-body sprite. Change ONLY her shoulders, elbows, forearms, both hands, and the angle of the same rifle, with a slight neck adjustment to sight along it. The rifle is raised UP AND RIGHT at 75 DEGREES ABOVE THE HORIZONTAL: almost vertical, only 15 degrees to the right of vertical, up 3.73 units for every one unit right. The straight barrel direction must visibly match that angle. Buttstock stays against her shoulder, right hand on trigger grip, left hand supports the raised fore-end; natural anatomical arm pose. Keep the SAME adult silver-haired character, exact head scale, hair identity, white jacket, belt, hips, black armored trousers, legs and boots, same rear camera and canvas placement. Do not rotate the whole body or shift feet. Keep her hair top near y=340 and boots near y=1480 in the same 1024x1536 portrait canvas. Show the ENTIRE rifle including muzzle using the empty upper margin, no crop. Background must remain entirely FLAT PURE VIVID MAGENTA RGB(255,0,255), between hair/arms/legs and around gun, no gray, black, gradients, shadows, scenery, transparency checkerboard or text. One single production anime sprite, no comparison panels, no labels.

### 图像标定与已知限制

角度文件名表示要求的关键姿态方向，生成图并非工程角度标尺。逐图观察枪管外露直段后，采用下面的像素中心线锚点；坐标原点是 PNG 左上角，y 向下。游戏根据实际锚点连续校准枪械局部角度，再从同一变形结果定位枪口，而非假定图片角度等于文件名。

| 图 | 枪管直段起点 (px) | 枪口中心 (px) | 从该中心线估计的仰角 |
| --- | --- | --- | --- |
| 30° | (808, 321) | (899, 261) | 约 33.4° |
| 45° | (820, 156) | (931, 49) | 约 43.9° |
| 60° | (739, 137) | (815, 29) | 约 54.9° |
| 75° | (673, 159) | (712, 25) | 约 73.8° |

这些手工观察锚点存在约 1.5° 的画面测量不确定度；程序中锚点射线误差小，不等于对位图每个像素做了零误差测量。四图的长枪都保留在画布内，但 45°/60°/75° 枪口接近上边缘，显示网格或纹理映射必须保留额外的上方范围。与旧角色/换弹画布对齐时，初步身体锚点拟合是 `newTextureUV ≈ oldBodyUV * 0.75 + (0.14, 0.043)`，这是渲染适配参数，并非对生成过程精确位移的承诺。

左向关键姿态在运行时镜像这四张右向素材。镜像会同时反转装备细节与肩侧；它不是额外四张独立绘制的角色转身图。各关键帧的头发与夹克细节有细小生成差异，局部网格连续校正用于连接角度。已有两张 v3 换弹图保持独立，不计入这四张持枪图。

v4 实际显示网格扩大为 64×88 段并向上扩展，保留高角度枪口的画布空间。原图、四张瞄准图和两张换弹图均由同一个材质管理；瞄准姿态使用归一化身体 UV 对齐，换弹仍只混合上半身。局部臂枪变形绕肩点在实测枪管轴线上的投影旋转，保留腰胯、头发后坐响应与固定脚部。近距离目标会有限缩短枪的纵向投影，保证弹道向前；点射事件在渲染帧之前同步更新可见网格与枪口。程序对纹理画布以外区域设为透明，避免高抬枪网格的边缘拉伸。

## v5 原创驾驶员与招募头像 · 2026-09-23

本轮使用 Codex 内置 `image_gen.imagegen`，新增两位原创成年女性驾驶员，保留火花原有角色和 v4 八方向枪械姿态。每个最终文件均已保存至项目 `C:/Users/liou/Documents/Codex/2026-09-14/files-mentioned-by-the-user-3d/work/neon-spire/src/assets/`；不会覆盖旧版图像。

| 最终资产 | 用途 | 实际 PNG 尺寸 | 最终生成文件 |
| --- | --- | --- | --- |
| `operator-ember-v5.png` | 余烬：橙色战术服、肩扛火箭筒、背侧全身战斗图 | 1024×1536 | `exec-b9438e7c-67fc-4e90-be53-54145928db09.png` |
| `operator-volt-v5.png` | 雷霆：深蓝长辫、蓝色装甲、六管加特林、背侧全身战斗图 | 1024×1536 | `exec-b1957635-8af4-4c85-a863-5f2db7fd0887.png` |
| `portrait-spark-v5.png` | 火花正面招募头像 | 1254×1254 | `exec-26a49621-fae3-4c65-bc39-51163a04292b.png` |
| `portrait-ember-v5.png` | 余烬正面招募头像 | 1254×1254 | `exec-857482a6-c690-4fbb-9b78-d20742874d71.png` |
| `portrait-volt-v5.png` | 雷霆正面招募头像 | 1254×1254 | `exec-ff9219c3-c1e9-46ef-bdca-5caa55947018.png` |

上表原始生成文件位于 `C:/Users/liou/.codex/generated_images/01a0c1c5-3f24-7fd2-a315-430d335d753e/`。工程和交付源码自带最终图片，运行不依赖此缓存目录。肖像提示要求 1024×1024，工具实际返回 1254×1254；保留原始返回尺寸，未另行重采样。

两张战斗图以 `operator-aim-30-v4.png` 作为画风、后方战斗视角与构图参考，生成了不同身份、发型、服装配色和武器的原创角色。初次生成返回灰黑渐变背景（余烬 `exec-f8466f25-58c2-4b54-b3ab-ce1bd837da67.png`；雷霆 `exec-d38af193-d4cf-42a3-b993-afe5b5c053f7.png`），因此各使用一次内置图像编辑把背景修正为品红，采用上表最终结果。灰底草稿不纳入发行资产。

余烬和雷霆的肖像分别以上表各自最终战斗图为身份参考；火花肖像以 `operator.png` 为身份参考。火花肖像首次调用未得到输出，后续只重试了该文件，没有重复生成已有两张肖像。

### v5 实际提示词组

**ember 战斗图（参考源：operator-aim-30-v4.png）**

Use case: stylized-concept. Create a NEW original adult female military science-fiction anime operator, code name EMBER. The supplied image is ONLY a reference for polished cel-shaded rendering, rear battle-camera angle, full-body scale and flat magenta sprite background; do not copy that woman's identity or rifle. EMBER has copper-red hair in a thick short ponytail, bronze/orange headset, a burnt-orange cropped tactical jacket over a black armored suit, charcoal fitted tactical trousers with sturdy thigh armor and dark boots. She is an adult combat professional. THREE-QUARTER REAR VIEW, face turned slightly right. She braces a LARGE SHOULDER-FIRED SCI-FI ROCKET LAUNCHER on her right shoulder, clearly a bulky thick cylindrical tube with large round open front muzzle, dark steel with warm orange armored panels. Both gloved hands grip its handles, aiming diagonally UP RIGHT about 35 degrees above horizontal. Show entire launcher and both boots. Shoulder-held launcher shape must be unambiguous, no rifle. Fullbody on 1024x1536 portrait canvas, TOP OF HAIR near y=335, boots near y=1480, pelvis near x=490 y=820; large empty top margin so weapon remains fully visible. Clean readable silhouette, detailed original anime illustration, natural athletic proportions and plausible arm anatomy. Background ENTIRELY FLAT PURE VIVID MAGENTA PINK RGB(255,0,255) edge to edge and in all gaps, no gray/black, no shadows, gradients, scenery, text, watermark, panels or additional people.

**volt 战斗图（参考源：operator-aim-30-v4.png）**

Use case: stylized-concept. Create a NEW original adult female military science-fiction anime operator, code name VOLT. The supplied image is ONLY a reference for polished cel-shaded rendering, rear battle-camera angle, full-body scale and flat magenta sprite background; do not copy that woman's identity or rifle. VOLT has deep navy blue hair in a long thick braid, a blue steel headset, an ice-blue/steel-blue tactical jacket with dark navy heavy armor, black armored trousers and chunky combat boots. She is an adult heavy-weapons specialist with a strong athletic build. THREE-QUARTER REAR VIEW, face turned slightly right. She holds a HUGE SIX-BARREL ROTARY GATLING GUN at upper waist/chest height with a solid handle in each gloved hand and a dark blue ammunition drum, aiming diagonally UP RIGHT about 30 degrees above horizontal. Six distinct parallel steel barrels with circular front plate and six round bores, substantial barrel cluster, cyan accent lights. Entire weapon and both boots visible. The gun must unmistakably be a heavy minigun, no rifle, no rocket launcher. Fullbody on 1024x1536 portrait canvas, TOP OF HAIR near y=335, boots near y=1480, pelvis near x=490 y=820; large empty top margin. Clean readable silhouette, detailed original anime cel shading, plausible anatomy. Background ENTIRELY FLAT PURE VIVID MAGENTA PINK RGB(255,0,255) edge to edge and all gaps, no gray/black, no shadows, gradients, scenery, text, watermark, panels or extra people.

**两张战斗图背景修正（分别输入对应灰底草稿）**
Precise background-only edit: remove every part of the black/gray vignette and replace it with entirely solid hot MAGENTA PINK, exact RGB(255,0,255). The background must be vivid flat pink across the complete canvas and between all hair strands, limbs, and weapon gaps. Keep the exact same original adult anime character and entire heavy weapon completely unchanged, same position, same colors, same details, same 1024x1536 canvas. Do not repaint the subject. No gray or black halo, no gradient, no shadow, no transparency checkerboard. A single game sprite on SOLID BRIGHT MAGENTA.

**spark 招募头像（输入对应人物参考图）**

Use case: identity-preserve. Create a FRONT-FACING RECRUITMENT PORTRAIT of the exact SAME ORIGINAL ADULT WOMAN from the supplied combat sprite: SPARK, silver-white high ponytail, ivory tactical jacket with black armor and tiny red accents, gray-blue eyes, black communications headset, attentive composed expression. Preserve her recognizable hairstyle, equipment colors and anime identity. Frame head and shoulders to upper chest, face LARGE and centered, both eyes visible, three-quarter turn of no more than 10 degrees, looking toward viewer. This is a compact game squad-selection portrait that must remain legible at 48 pixels. Polished high-detail Japanese anime military science-fiction cel shading, realistic adult proportions. Subtle rim light in the character's color. Background deep charcoal military hangar, softly blurred, restrained colored atmospheric light; no bright magenta, no busy objects. Square 1024x1024 image. No weapon obscuring face, no text, no name, no logos, no border, no frame, no panels, no watermark.

**ember 招募头像（输入对应人物参考图）**

Use case: identity-preserve. Create a FRONT-FACING RECRUITMENT PORTRAIT of the exact SAME ORIGINAL ADULT WOMAN from the supplied combat sprite: EMBER, copper-red short ponytail, burnt-orange tactical jacket, amber eyes, orange-and-bronze communications headset, confident focused expression. Preserve her recognizable hairstyle, equipment colors and anime identity. Frame head and shoulders to upper chest, face LARGE and centered, both eyes visible, three-quarter turn of no more than 10 degrees, looking toward viewer. This is a compact game squad-selection portrait that must remain legible at 48 pixels. Polished high-detail Japanese anime military science-fiction cel shading, realistic adult proportions. Subtle rim light in the character's color. Background deep charcoal military hangar, softly blurred, restrained colored atmospheric light; no bright magenta, no busy objects. Square 1024x1024 image. No weapon obscuring face, no text, no name, no logos, no border, no frame, no panels, no watermark.

**volt 招募头像（输入对应人物参考图）**

Use case: identity-preserve. Create a FRONT-FACING RECRUITMENT PORTRAIT of the exact SAME ORIGINAL ADULT WOMAN from the supplied combat sprite: VOLT, deep navy blue long braid, steel-blue armored jacket, cool blue eyes, blue-black communications headset, calm determined expression. Preserve her recognizable hairstyle, equipment colors and anime identity. Frame head and shoulders to upper chest, face LARGE and centered, both eyes visible, three-quarter turn of no more than 10 degrees, looking toward viewer. This is a compact game squad-selection portrait that must remain legible at 48 pixels. Polished high-detail Japanese anime military science-fiction cel shading, realistic adult proportions. Subtle rim light in the character's color. Background deep charcoal military hangar, softly blurred, restrained colored atmospheric light; no bright magenta, no busy objects. Square 1024x1024 image. No weapon obscuring face, no text, no name, no logos, no border, no frame, no panels, no watermark.

### 三人美术接入与动画范围

`battle-scene.js` 为火花、余烬和雷霆分别维护可见网格、枪口、后坐脉冲与换弹状态。场景中没有装饰假队友：只有 `setSquad` 指定的角色会显示，主控角色居中，另两名实际队员分列左右；`setActiveOperator` 立即交换站位。所有射击按角色 ID 请求对应可见武器枪口。每人的 `shots`、`exposed` 和 `reloadProgress` 来自真实小队战斗快照，支援队员的射击不会触发其他人的后坐动画。

余烬和雷霆各使用一张战斗关键姿态，连续瞄准通过臂部与武器区域的局部网格变形完成，没有生成额外八方向关键帧。实际武器中心线标定（像素原点在图片左上角）为：余烬管身 (789,337) → 炮口 (948,252)，约 28.1°；雷霆管束 (725,444) → 管口 (940,316)，约 30.8°。这些手工图像锚点估计存在约 1.5° 测量不确定度。测试插值真实渲染三角网格中的同一中心线点，对照目标方向与射击起点；程序几何误差不等于图片像素测量零误差。

余烬的低频重后坐和雷霆的高频轻后坐使用不同强度；雷霆另有枪口旋转机构的程序提示。新武器换弹使用压低武器、退回掩体，以及靠近武器装填位置移动的火箭弹/弹鼓程序机构。它们不是额外绘制的逐帧手部换弹动画。火花继续使用已有两张换弹关键图、分区后坐与 v4 八方向校准。

独立测试 `tests/operator-art.test.js` 覆盖真实上阵可见性、主控/支援站位互换、两把重武器在各站位向左/向右/近目标的实际网格中心线与枪口、独立后坐、换弹机构可见性及撤下角色隐藏。浏览器独立渲染核对记录为 `work/qa/v5-operator-render.json`，三种主控与两种重武器换弹截图为 `work/qa/v5-operators-*.png`。
