# 增删卜易 · 六爻占卜系统

基于《增删卜易》的六爻占卜 Web 应用，含起卦（铜钱摇卦 + 手动输卦双模式）、排盘、AI 释卦、历史记录、万年历。

> 本系统原为"道玄文集"网站（`F:\github-dx\wx\`）的六爻子系统，现已独立为仓库 **`jygldj/zsby`**，自包含运行，不依赖文集仓库。代码按"结构 / 数据 / 算法 / 主控 / 样式"五层拆分于 `ly/`，后端 AI 代理置于仓根 `functions/api/`（Cloudflare Pages 约定：函数目录须在仓库根）。

## 一、目录结构（本仓库根目录 F:\github-dx\zsby\，已独立运行）

> 维护要点：静态页面在仓根；排盘逻辑按"结构 / 数据 / 算法 / 主控 / 样式"五层拆分于 `ly/`；后端 AI 代理须在仓根 `functions/api/`（Cloudflare Pages 约定：函数目录须在仓库根）。

```
F:\github-dx\zsby\                              # 增删卜易独立仓库根（Cloudflare Pages 项目根）
├── .gitignore           # Git 忽略规则
├── README.md            # 本文件
├── 测试仓库.txt         # 仓库初始化占位文件（零字节，保留）
├── index.html           # 子系统门户（导航至下列各页；卡片装入系统风格容器）
├── jiegou.html          # 【起卦】主页面（结构层）：铜钱摇卦 + 手动输卦双模式 + 八宫纳甲排盘
│                        #         仅含 DOM 容器与交互按钮，逻辑全部委托给 ly/ 模块
├── jiegua.html          # 【释卦】AI 解读页面（含可编辑"求卦者信息"区，解决传输不稳定）
├── wnl.html             # 万年历排盘（农历查询、真太阳时、断卦参数）
├── history.html         # 占卜历史（localStorage，目录折叠式）
├── help.html            # 使用指南
├── ly/                  # 六爻排盘模块化拆分目录（职责分离，五层架构）
│   ├── lunar.js         # 农历/干支/节气/旬空计算库（已归入本仓库，不再依赖父目录）
│   ├── shuju.js         # 【数据层】ALL_GUA_DATA：64 卦完整数据，每爻含天干+地支，六亲不写死
│   ├── suanfa.js        # 【算法层】六亲实时计算、六神排定、伏神"降妖三式"、模式查卦
│   ├── zhukong.js       # 【主控层】摇卦/排盘/渲染/事件绑定/手动输卦/跳转释卦
│   └── yangshi.css      # 【样式层】古风排版、爻象绘制、六神颜色、伏神样式、响应式三档
├── api/
│   └── qwen.js          # 通义千问 API 调用模块（双模型 callQwen，密钥在服务端）
└── functions/           # Cloudflare Pages 后端（必须在仓库根）
    └── api/
        └── ai.js        # AI 释卦代理：前端经 /api/ai 调用，密钥存服务端环境变量
```

## 二、模块化架构（ly/ 五层职责）

| 层 | 文件 | 职责 | 关键导出 |
|----|------|------|----------|
| 结构层 | `jiegou.html` | 纯 HTML 容器 + 交互按钮，引入 `ly/lunar.js` + `ly/` 模块 | — |
| 数据层 | `ly/shuju.js` | 64 卦原始数据（浑天甲子纳甲：每爻补全天干，六亲留空由算法算） | `ALL_GUA_DATA`、`GUA_XIANG`、`GUA_SYMBOL`、`NAJIA_GAN` |
| 算法层 | `ly/suanfa.js` | 排盘核心算法，全部"实时计算"不写死 | `jiSuanLiuQin`（六亲）、`paiLiuShen`（六神）、`paiPanDaiFuShen`（伏神）、`paiPanBianGua`（变卦）、`getGuaByPattern` |
| 主控层 | `ly/zhukong.js` | 串联流程：取日干 → 排盘 → 渲染 → 绑定按钮 → 跳转释卦 | `shakeOnce`、`completeAndDisplay`、`renderFinalResult`、`createYaoInputs`、`doPaiPan` |
| 样式层 | `ly/yangshi.css` | 古风视觉、爻象等宽对齐、六神配色、伏神小字、手机/平板/桌面三档响应式 | `.yao-*`、`.liushen-*`、`.fu-shen` 等 |

**关键算法约定**
- **六亲实时计算**：六亲不再写死数据中，由 `getLiuQinByWuXing(我五行, 他五行)` 按五行生克（生我者父母、我生者子孙、克我者官鬼、我克者妻财、同我者兄弟）动态得出。
- **变卦六亲铁律**：变卦六亲以**本卦之宫五行**为"我"，而非变卦自身宫。
- **伏神降妖三式**：① 定乾坤（按 `BEN_GONG_INDEX` 取本宫首卦八纯卦）→ ② 寻龙诀（`zhaoFuShen` 在本宫首卦中找本卦缺失的某六亲所在爻）→ ③ 显真形（`paiPanDaiFuShen` 将伏神挂到本卦同爻位"飞神"之下）。
- **六神起法**：日干定初爻六神起点（甲乙→青龙、丙丁→朱雀、戊→勾陈、己→螣蛇、庚辛→白虎、壬癸→玄武），自下而上顺排。

## 三、核心数据流

1. **起卦**（`jiegou.html` + `ly/zhukong.js`）：支持两种起卦模式
   - **铜钱摇卦**：三枚铜钱六次摇卦 → 生成 `yaoResults`/`dongStatus`
   - **手动输卦**：为六爻逐个选择"少阳/少阴/老阳/老阴"（**默认少阳·静**，避免一上来全动）→ 生成与摇卦**格式完全一致**的数据
   - 两种模式均调用同一 `completeAndDisplay()` 排盘 → 保存 `guaData` 至 `localStorage.currentGua`
   - `guaData` 含：本卦/变卦名与宫、`shiYao`/`yingYao`（世应爻序）、`dongDetail`（动爻变化详情）、六爻地支六亲、`dongYao`/`dongStatus`/`yaoResults`、`time`
2. **释卦**（`jiegua.html`）：读取 `currentGua` → 构建 `guaInfo`（世应文本化、`yaoDetail` 含动变、用户信息字段）→ 调用 `callQwen(guaInfo)` / `callQwen2(guaInfo)`
   - **求卦者信息双保险**：页面加载时从 `localStorage/sessionStorage` 回填四个输入框（姓名/性别/出生时辰/所问之事），点"释卦"时**优先从输入框读取**，即使 localStorage 传输丢失用户也可手动补填
3. **AI 解读**：`systemPrompt` 固化断卦口吻 + 六步框架 + 数据使用规则；`userPrompt` 结构化传入"已排定"数据，**AI 只解读、不计算**
4. **历史**（`history.html`）：读取 `localStorage.guaHistory`，目录折叠式展示，含求卦者资料与 AI 解读回写

## 四、模型说明

释卦页提供两个模型，均来自阿里云百炼平台（千问同源），密钥存于服务端环境变量，前端 `api/qwen.js` 经 `functions/api/ai.js` 代理调用：

| 模型 | 服务端环境变量 | 实际模型名 | 页面标注 | 角色 |
|---|---|---|---|---|
| 千问 3.7 | `QWEN_API_KEY` | `qwen3.7-flash` | 千问 3.7 | **默认主力**（默认选中） |
| 千问备选 | `QWEN2_API_KEY` | `deepseek-v4-flash-0731` | 千问备选 | 备选 |

两模型提示词完全一致（断卦口吻 + 核心断卦原则 + 六步框架 + 数据使用规则 + 特别断卦规则 + 断卦铁律），确保解读风格与准确性统一。

## 五、改动记录

### 模块化拆分（cfrw 批次）
- 将日益庞大的单文件 `liuyao_divine.html` 拆分为 `jiegou.html`（结构）+ `ly/` 四模块（数据/算法/主控/样式）
- 六亲由"数据写死"改为"算法实时计算"；新增**伏神降妖三式**（定乾坤/寻龙诀/显真形）
- `jiegou.html` 引用本仓库 `ly/lunar.js` 与 `ly/*.js`；释卦跳转改为同目录 `jiegua.html?data=`

### 起卦页体验修正
- **手动输卦默认"少阳（静）"**：原默认"老阴（动）"导致初次排盘六爻全动、本卦变卦相差巨大；现默认全静，仅主动选老阴/老阳才变卦
- **重启联动手动输入**：`resetAll()` 现会清空手动输卦下拉框并回到默认"少阳"，旧版完全未碰手动下拉框

### 文件迁移与改名
- 5 个页面 + `api/` 位于本仓库根；各页"文集"按钮指向 `https://dxwj.pages.dev/index1.html`
- 释卦页 `jiegu.html` → **`jiegua.html`**（全站导航与跳转同步更新）
- `index1.html` 的"增删卜易"按钮改为**红色高亮**，指向本仓库 `jiegou.html`

### 释卦页优化
- 新增可编辑"求卦者信息"区（姓名/性别/出生时辰/所问之事），文字与格式对齐起卦页，手机端/电脑端一致
- 第一卡片"当前卦象"：动爻移至分割线之上，删除重复的本卦/变卦行与风格线

### 手动输卦模式
- `jiegou.html` 顶部模式切换按钮（`.mode-switch-bar` / `.mode-btn`），铜钱区下方手动输入面板（`#inputArea`，默认隐藏）
- 每爻可选"少阳/少阴/老阳/老阴"四象（`YAO_OPTIONS`），含实时符号预览
- `confirmInput()` 读取六爻选择 → 生成与摇卦格式一致的 `yaoResults`/`dongStatus` → 复用 `completeAndDisplay()` 排盘
- **零侵入**：仅在输入层增加数据来源，未改动排盘/解卦/存储核心

### 固化 AI 提示词
- `api/qwen.js` 的 `systemPrompt` 统一：断卦口吻 + 核心断卦原则 + 六步框架 + **数据使用规则**（禁止 AI 自行推演世应/动变/六亲）
- 含【⚠️ 特别断卦规则】（月破、日破、用神持世、应爻旬空、动爻化出之爻参与生克）与【📜 断卦铁律】（旺衰总纲、合起为旺、动爻虚实、吉凶权衡、结论导向）
- `userPrompt` 结构化传入：求卦者信息、卦象数据（世应、六爻排列含动变）、时间信息（月建/日辰/旬空）

### 起卦保存完整排盘数据
- `guaData` 新增 `shiYao`、`yingYao`、`dongDetail` 字段，直接取自排盘结果

### 模型替换历史
1. **智谱 GLM → DeepSeek-V4-Pro**：因智谱断卦错误较多，替换为 DeepSeek
2. **DeepSeek-V4-Pro → 千问备选（qwen3.7-flash）**：经实测 DeepSeek 释卦错误仍较多，改用千问同源备选
   - 删除 `api/deepseek.js`，`api/qwen.js` 承载双模型（`callQwen`/`callQwen2`），提示词完全一致
   - 密钥迁入服务端环境变量（`QWEN_API_KEY`/`QWEN2_API_KEY`），前端经 `functions/api/ai.js` 代理调用
   - 释卦页模型选择：千问 3.7（默认主力）/ 千问备选；模型名映射 `qwen → 千问 3.7`、`qwen2 → 千问备选`

### 独立仓库剥离（jygldj/zsby 批次）
- 从原 `wx` 仓库整体迁出，成为独立仓库；`lunar.js` 自父目录归入本仓库 `ly/lunar.js`，各页引用由 `../lunar.js` 改为 `./ly/lunar.js`
- 后端代理 `functions/api/ai.js` 归入本仓库根（Cloudflare Pages 要求函数目录在仓根），前端仍经相对路径 `/api/ai` 调用
- 各页"文集"返回链接由 `../index1.html` 改为道玄文集真实地址 `https://dxwj.pages.dev/index1.html`
- 新增 `index.html` 门户页，统一导航至各功能页

## 六、验证方法

1. **手动输卦**：切换到"手动输卦"模式，为六爻选择四象（默认少阳·静）→ 点"排盘" → 本卦/变卦/世应/动爻标记准确 → 点"释卦"跳转 `jiegua.html` 并出解读
2. **模式切换**：在铜钱摇卦与手动输卦之间来回切换，界面与状态均正常
3. **排盘数据保存**：起卦后 F12 控制台 `JSON.parse(localStorage.getItem('currentGua'))`，确认含 `shiYao`、`yingYao`、`dongDetail`
4. **AI 提示词数据**：释卦时控制台查看传入 `callQwen` 的 `guaInfo`，确认含 `yaoDetail`、求卦者信息字段
5. **AI 解读结果**：解读文本中世爻/动爻/六亲与排盘一致（无 AI 自行推演）、以"吾"自称、以"君/道友"称呼求卦者、含应期提示、遵循六步结构
6. **路径联通**：从 `index.html` 进各功能页；各页点"文集"返回道玄文集首页；起卦页点"释卦"跳 `jiegua.html`
7. **伏神验证**：选一缺六亲之卦（如天风姤缺妻财）→ 排盘后该六亲以伏神小字挂于对应飞神爻位之下
8. **模型切换**：释卦页可切换"千问 3.7"与"千问备选"，两者均正常出解读

## 七、依赖与存储

- `lunar.js`：农历/干支/节气/旬空计算（约 435KB），现归入本仓库 `ly/lunar.js`，各页引用 `./ly/lunar.js`，不再依赖外部仓库
- API 密钥：存于 Cloudflare Pages 环境变量（`QWEN_API_KEY`/`QWEN2_API_KEY`），前端经 `functions/api/ai.js` 代理调用，密钥永不进入前端代码
- 数据存储：`localStorage`（`currentGua`、`userInfo`、`guaHistory`），仅本地浏览器，换设备/清缓存会丢失

## 八、技术约束（不可改动）

- `ly/suanfa.js` 排盘核心算法（六亲实时计算 `getLiuQinByWuXing`、`jiSuanLiuQin`；六神 `paiLiuShen`；伏神三式 `paiPanDaiFuShen`；变卦 `paiPanBianGua`；八宫纳甲数据）
- `ly/zhukong.js` 主控流程（`completeAndDisplay`、`renderFinalResult`、`buildGuaHtml`）
- `ly/lunar.js` 时间计算核心逻辑
- `api/qwen.js` 的 `fetch` / `try-catch` / 响应处理基本结构，以及 `systemPrompt` 的断卦口吻与断卦铁律

---

以《增删卜易》为宗 · 仅供传统文化研究参考
