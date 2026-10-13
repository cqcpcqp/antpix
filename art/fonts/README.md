# 正式 UI 字体

`noto-NotoSansSC[wght].ttf` 来自 https://github.com/google/fonts/tree/main/ofl/notosanssc ，许可见 `noto-OFL.txt`。

`scripts/prepare-game-font.py` 从源字体取 700 字重并按当前文案生成 Ant Nest Heavy 子集；`scripts/prepare-bitmap-font.cjs` 再生成无描边白色位图字库，由运行时 Label 着色。源字体、许可、运行子集和位图文件均需保留。
