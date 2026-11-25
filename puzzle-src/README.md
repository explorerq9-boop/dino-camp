# 恐龙拼图 · 壁纸渲染源码

- `render.html`：three.js 场景（地形、河/海/湖、天空、云、灯光），加载 Quaternius 的 CC0 模型（放在 `glb/` 目录，可从 `grow-assets/` 或 Quaternius 官网获取，文件名见 `scenes.mjs`）。
- `scenes.mjs`：8 张壁纸的构图、恐龙配色和摆放。
- `drive.mjs`：用无头 Chrome 渲染出 1600×1000 的 PNG：`node drive.mjs scenes.mjs out`
- `puzzle_template.html`：游戏模板，图片转成 webp 后替换 `__IMAGES__` 得到 `../puzzle.html`。
