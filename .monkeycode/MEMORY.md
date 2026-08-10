# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-08-10
- Context: Discovered by Agent while performing 断卦系统补全任务（R0-R4 已提交推送）
- Category: Build Methods & Testing Methods
- Instructions:
  - 验证模式：Node 用 `eval(读 shuju.js + 拼接 suanfa.js + 测试代码)` 直接跑，无需构建；阶段2/3 验证需先 `new Function('module','exports','require', lunar.js+';return 0;')(mod,mod.exports,require)` 加载 lunar.js 并把 `mod.exports.Solar/Lunar` 挂 `globalThis`。
  - 阶段验证脚本统一放 `/tmp/opencode/rN-verify.js`（r0~r5 已存在，改动后必须全量回归：r0、r1、r1-64gua、r2、r3、r3-e2e、r4、r5）。
  - **提交前回归入口：`node /workspace/test/regression.js`**（仓库内，R6-2 交付物，断言 64卦完整性/六冲六合全表/原案例/吉凶门类应期冒烟）。
  - 回归时序注意：两现取舍依赖 `kongType`，必须按 jiegua.html 真实顺序先算 月破→日破暗动→真空假空 再 `xuanYongShen`。
  - HTML 内联脚本语法检查：提取 `<script>...</script>` 块 `new Function(...)` 逐个校验。
  - 提交工作流：每个阶段用 `feat: 中文描述` 提交（含 suanfa.js + jiegua.html + 规格文档同步）并 `git push origin main`；规格文档位于 `.monkeycode/specs/2026-08-10-duan-gua-system-completion/{requirements.md, design.md}`，实现完成后需同步 design.md 的接口/Data Models/Error Handling 章节。
