# 钱是怎么跑起来的

一本从零开始的金融世界说明书 · 俞孜扬 著 · 2026 年 8 月版

**在线阅读：** https://jayyuziyang-lang.github.io/how-money-moves/

全书五卷 **29 篇**，约 **11.2 万字**。每一篇独立成页，网页版是一个完整的阅读器。

| 卷 | 主题 | 回答的问题 |
|---|---|---|
| Ⅰ 地基篇 | 钱到底是什么 | 你钱包里那串数字，凭什么能换来一碗面 |
| Ⅱ 管道篇 | 这台机器怎么转 | 钱怎么被造出来、怎么流动、怎么定价 |
| Ⅲ 天气篇 | 潮汐、风暴与泡沫 | 风险如何被标价、被放大、被转移 |
| Ⅳ 落地篇 | 你在其中怎么活 | 这些跟你的钱包有什么关系 |
| Ⅴ 后记 | 合上书之后 | 一页地图 · 为什么不谈发财 · 给读者的信 |

## 两个版本

### 网页阅读器
打开 `index.html` 即可，无需构建、无需联网。功能：

- **每篇独立成页**，上一章 / 下一章、键盘 ← → 翻章、移动端左右滑动
- **书签**：任意位置加书签并自动记录摘录，书签面板可跳回
- **续读**：自动记住每篇的阅读位置，首页显示「继续阅读」
- **全书搜索**：懒加载索引，结果高亮并可跳到具体小节
- **目录抽屉**：四个标签页（全书目录 / 本章小节 / 书签 / 搜索），带已读与进度标记
- **阅读设置**：日间 / 米黄 / 夜间三套主题，五档字号，三档行距，三档版心，黑体 / 宋体切换
- **进度**：顶部进度条 + 底部浮动条显示「本章 x% · 全书 y%」

快捷键：`←` `→` 翻章 · `T` 目录 · `B` 书签 · `F` 搜索 · `S` 设置 · `J` `K` 滚动 · `Esc` 关闭

### LaTeX 书籍版
成品：`钱是怎么跑起来的（How money moves）.pdf` · A4 · 202 页

基于 **ElegantBook v4.7**，思源宋体正文 + 思源黑体标题 + 楷体引语，含手绘封面、扉页、版权页、自序、术语表、数据快照、延伸阅读、参考文献与索引。零 overfull 告警。

```bash
cd book
node ../book/html2tex.mjs     # 由章节 HTML 生成 LaTeX（已含拼音排序索引键）
node ../book/gen-appendix.mjs # 由附录页生成术语表
latexmk -xelatex main.tex     # 或 xelatex → biber → makeindex → xelatex ×2
```

首次编译前需下载中文字体（约 76MB，一次即可）：

```bash
node book/get-fonts.mjs      # 下载思源宋体 / 思源黑体
node book/render-cover.mjs   # 把封面 SVG 渲染成 300dpi 位图供 LaTeX 使用
```

**换封面**：把你生成的图命名为 `cover-art.png` 放进 `assets/`，重新执行上面两条命令并 `node build.mjs`，网站与 LaTeX 会自动优先使用它。提示词见 `cover-prompts.md`。

## 目录结构

```
index.html            书架首页（封面 / 统计 / 书签 / 全书目录）
part-1..5.html        五卷卷首页
ch-00..25.html        正文 26 篇
ep-1..3.html          后记 3 篇
glossary.html         附录：术语速查 + 2026 数据快照 + 原则清单
assets/style.css      设计系统
assets/reader.css     阅读器外壳（主题 / 抽屉 / 设置 / 书签）
assets/reader.js      阅读器逻辑
assets/book.js        书目数据（由 build.mjs 生成）
assets/search.js      全书搜索索引（由 build.mjs 生成）
content/*.html        各篇正文源文件（编辑这里）
build.mjs             组装网页阅读器
lint.mjs              文风与规范体检（禁用词 / 破折号 / 组件 / 标签闭合）
check.mjs             全站链接与结构校验
verify.mjs            无头 Chrome 功能验收（30 项断言）
BRIEF.md              写作总纲，含反 AI 腔守则与 2026 事实速查表
cover-prompts.md      封面生成提示词（浅色系 · 漫画手绘 · 三套方案）
assets/cover-art.svg  手绘矢量封面插画（网站直接用，也是 LaTeX 封面的来源）
book/                 LaTeX 书籍版工程
```

## 修改流程

```bash
node build.mjs    # 重新生成所有页面
node lint.mjs     # 文风与规范体检
node check.mjs    # 链接与结构校验
node verify.mjs   # 无头浏览器功能验收
```

## 数据口径

所有数据截至 2026 年 8 月，来源包括中国人民银行、美联储、欧洲央行、日本银行、国际金融协会（IIF）及公开财经报道。

## 免责声明

本书是通识科普读物，不构成任何投资建议。