# Requirements Document

## Introduction

本规格将"以《增删卜易》为宗完善六爻占卜系统"的改进方案细化为可测试需求。系统现状：装卦（纳甲/世应/六亲/伏神/变卦）已验证完备；断卦法度（六冲六合/生旺墓绝/进退/反伏/回头生克/独发独静）缺失；分类占断仅一张粗映射表；应期仅"扫月支日支"无类型推导。本规格覆盖缺陷修复（R0）、排盘增强（R1）、吉凶判定引擎（R2）、应期引擎（R3）、分类占断知识库（R4）、AI 释卦增强（R5）、原案例回归（R6）。

## Glossary

- **装卦**：由爻结果排出本卦/变卦、纳甲、世应、六亲、六神、伏神的完整排盘过程
- **断卦法度**：可确定性计算的卦象要素，含六冲六合、生旺墓绝、进退神、反吟伏吟、回头生克、三合、三刑、动散、独发独静
- **断卦依据链**：由 `{判据, 结论, 依据}` 三元组构成的可解释吉凶判定结构
- **门类知识库**：按《增删卜易》各门类建模的 `{用神规则, 断法要点, 应期要点, 持世吉凶}` 条目集合
- **应期引擎**：由旬空/月破/入墓/被合/化进退化/独发等卦象特征推导应期类型与候选公历日期的模块
- **原案例**：《增删卜易》书中带有完整月日与断语原文的占例

## Requirements

### R0 既有缺陷修复

#### R0-1 释卦页用户输入转义

**User Story:** AS 求卦者, I want 姓名与所问之事在释卦页安全显示, so that 恶意输入不触发脚本执行

**Acceptance Criteria**

1. WHEN 释卦页将用户姓名或所问之事写入 DOM，系统 SHALL 先进行 HTML 转义
2. WHEN 姓名或所问之事包含 `<script>` 或事件属性，系统 SHALL 将其以纯文本显示
3. WHEN 历史回写复用同一渲染路径，系统 SHALL 使用与 history.html 等价的转义函数

#### R0-2 手动输卦日辰驱动六神

**User Story:** AS 复盘者, I want 手动选择日辰后六神依所选日辰排定, so that 六神与断卦旺衰使用同一日辰

**Acceptance Criteria**

1. WHEN 手动输卦模式且用户已选择日辰，系统 SHALL 以该日辰的日干排列六神
2. WHEN 六爻未全部填写，系统 SHALL 不注入任何时间信息
3. WHEN 六神渲染与月破日破计算，系统 SHALL 使用同一 `timeInfo.riChen` 来源

#### R0-3 婚姻用神按性别分流

**User Story:** AS 求卦者, I want 占婚时按性别取用神, so that 男占取妻财、女占取官鬼

**Acceptance Criteria**

1. WHEN 所问属婚姻类且求卦者为男性，系统 SHALL 取妻财为用神
2. WHEN 所问属婚姻类且求卦者为女性，系统 SHALL 取官鬼为用神
3. WHEN 性别未知，系统 SHALL 以官鬼为默认用神并注明假设

#### R0-4 用神两现取舍接入旺衰

**User Story:** AS 断卦者, I want 两现取舍考虑旺衰, so that 符合"舍其休囚用其旺相"次序

**Acceptance Criteria**

1. WHEN 用神两现且未命中原则，系统 SHALL 以旺衰评分较高者为用神
2. WHEN 旺衰评分相等，系统 SHALL 维持现有"近世爻"兜底规则
3. WHEN 两现取舍生效，系统 SHALL 在 reason 中标注所采用判据

### R1 排盘增强

#### R1-1 六冲六合卦标注

**User Story:** AS 断卦者, I want 起卦即知卦象为六冲或六合, so that 参照《增删卜易·六冲章/六合章》断吉凶

**Acceptance Criteria**

1. WHEN 本卦六爻地支两两相冲，系统 SHALL 标注 `guaXiang.liuChong=true`
2. WHEN 本卦六爻地支两两相合，系统 SHALL 标注 `guaXiang.liuHe=true`
3. WHEN 标注存在，系统 SHALL 输出对应卦名（如"八纯卦"、"六合卦"）供 UI 与 AI 使用

#### R1-2 生旺墓绝十二宫

**User Story:** AS 断卦者, I want 每爻长生十二宫状态可查, so that 判断入墓、临绝符合《增删卜易·生旺墓绝章》

**Acceptance Criteria**

1. WHEN 计算爻的生旺墓绝，系统 SHALL 按五行长生表（金长生在巳、木长生在亥、水土长生在申、火长生在寅）求十二宫状态
2. WHEN 爻临墓或临绝，系统 SHALL 标注 `ruMu=true` 或 `linJue=true`
3. WHEN 卦内有动爻化出之爻，系统 SHALL 一并计算化出爻对变卦宫的生旺墓绝

#### R1-3 回头生克与进退神

**User Story:** AS 断卦者, I want 动爻的回头生克与化进退化可查, so that 动爻吉凶方向明确

**Acceptance Criteria**

1. WHEN 动爻所化出之爻生扶本爻，系统 SHALL 标注 `回头生`
2. WHEN 动爻所化出之爻克制本爻，系统 SHALL 标注 `回头克`
3. WHEN 动爻化出同类五行之进神（寅化卯等阳进阴进），系统 SHALL 标注 `化进神`；反向标注 `化退神`
4. WHEN 化出之爻为空、破、墓、绝，系统 SHALL 分别标注 `化空/化破/化墓/化绝`

#### R1-4 反吟伏吟识别

**User Story:** AS 断卦者, I want 卦变反吟伏吟可识别, so that 参照《增删卜易·反伏章》处理

**Acceptance Criteria**

1. WHEN 本卦与变卦六爻地支逐一相冲，系统 SHALL 标注 `fanYin=true`
2. WHEN 本卦与变卦六爻地支逐一相同，系统 SHALL 标注 `fuYin=true`

#### R1-5 三合三刑与动散

**User Story:** AS 断卦者, I want 合局与刑、动爻逢冲为散可判定, so that 旺衰判定全面

**Acceptance Criteria**

1. WHEN 月、日、动爻地支可成申子辰/寅午戌/巳酉丑/亥卯未三合，系统 SHALL 标注所在爻 `sanHe`
2. WHEN 三合局中缺一爻待凑，系统 SHALL 标注 `缺'某'待凑` 形式
3. WHEN 动爻被日辰所冲，系统 SHALL 标注 `dongSan=true`（动散）

#### R1-6 独发独静识别

**User Story:** AS 断卦者, I want 独发独静可识别, so that 参照《增删卜易·独发章》重点断应

**Acceptance Criteria**

1. WHEN 仅一爻发动，系统 SHALL 标注 `duFa='独发'` 并指明爻位
2. WHEN 六爻安静，系统 SHALL 标注 `duFa='六爻安静'`
3. WHEN 独发存在，系统 SHALL 将独发爻列为应期与吉凶的第一参考

#### R1-7 太岁与岁破

**User Story:** AS 断卦者, I want 年支旺衰可参考, so that 判断久远之事时纳入太岁

**Acceptance Criteria**

1. WHEN 排盘存在年干支，系统 SHALL 计算年支对每爻的生克
2. WHEN 爻之支与年支相冲，系统 SHALL 标注 `nianPo=true`（岁破）
3. WHEN 旺衰评分计算，系统 SHALL 将太岁作为可选第 7 维权重（默认关闭且不影响既有评分）

#### R1-8 纳音与卦身（可选）

**User Story:** AS 求卦者, I want 爻纳音可显示, so that 装卦信息完整

**Acceptance Criteria**

1. WHEN 排盘完成，系统 SHALL 按六十甲子纳音为每爻标注纳音（默认显示）
2. WHEN 卦身选项启用，系统 SHALL 按《增删卜易》立场默认关闭并提供开关

### R2 吉凶判定引擎

#### R2-1 结构化断卦依据链

**User Story:** AS 断卦者, I want 吉凶判定可解释, so that 每一步判据结论依据可追溯

**Acceptance Criteria**

1. WHEN 判定吉凶，系统 SHALL 依序执行：定用神 → 察旺衰 → 观动静 → 审世应 → 看忌仇元神 → 察卦象（六冲六合/反伏/墓绝）→ 综合结论
2. WHEN 每步完成，系统 SHALL 输出 `{判据, 结论, 依据}` 三元组并入 `guaInfo.duanGua.chain`
3. WHEN 综合判定完成，系统 SHALL 输出 `duanGua.jiXiong ∈ {吉, 中, 凶}`
4. WHEN 判定过程中某爻数据缺失，系统 SHALL 跳过该判据并在依据中注明

### R3 应期引擎

#### R3-1 应期类型推导与候选日期

**User Story:** AS 断卦者, I want 由卦象特征推导应期, so that 符合《增删卜易》应期总注法则

**Acceptance Criteria**

1. WHEN 用神旬空，系统 SHALL 推导 `出空`（出旬值日）与 `冲空实空`（逢冲之日）两类候选
2. WHEN 用神月破，系统 SHALL 推导 `出月实破`（出月逢值）与 `逢合`（月破逢合）两类候选
3. WHEN 用神入墓，系统 SHALL 推导 `出墓`（冲墓之日）候选
4. WHEN 用神被合，系统 SHALL 推导 `冲合`（冲开合局之日）候选
5. WHEN 动爻化进/化退，系统 SHALL 推导 `临值`/`退神` 候选
6. WHEN 存在独发，系统 SHALL 以独发爻临值或临月建之日为候选
7. WHEN 候选日期确定，系统 SHALL 输出 `{类型, 依据, candidates:[{公历日, 干支}]}` 并入 `guaInfo.yingqi`

### R4 分类占断知识库

#### R4-1 十二门类知识库

**User Story:** AS 求卦者, I want 问事门类自动匹配用神与断法, so that 覆盖《增删卜易》主要门类

**Acceptance Criteria**

1. WHEN 识别门类，系统 SHALL 从知识库匹配以下 12 门类之一：婚姻、功名、求财、疾病、出行、行人归期、诉讼、失物、子嗣胎孕、家宅迁移、终身财福、趋避防灾
2. WHEN 门类命中，系统 SHALL 按该门类 `用神规则`（含性别/自占代占）推导用神
3. WHEN 门类命中，系统 SHALL 将 `断法要点`、`应期要点`、`持世吉凶` 并入断卦依据链与 AI 上下文
4. WHEN 门类未命中，系统 SHALL 回退至现有映射并注明"未命中知识库"

### R5 AI 释卦增强

#### R5-1 全要素并入提示词

**User Story:** AS 求卦者, I want AI 引用引擎结果解读, so that AI 只做文辞解读不自行推演

**Acceptance Criteria**

1. WHEN 构建 userPrompt，系统 SHALL 并入 R1/R2/R3 全部计算结果（卦象、墓绝、进退、反伏、独发、断卦链、应期候选）
2. WHEN AI 解读应期，系统 SHALL 要求 AI 引用 `guaInfo.yingqi` 候选日期，不得自行计算
3. WHEN 门类知识库命中，系统 SHALL 要求 AI 以该门类断法为框架
4. WHEN 现有六步框架更新，系统 SHALL 保持"AI 只解读、不计算"原则

### R6 原案例库与回归验证

#### R6-1 原案例库

**User Story:** AS 学习者, I want 起卦可对照野鹤原断, so that 验证系统与原著一致

**Acceptance Criteria**

1. WHEN 录入案例，系统 SHALL 以 `ly/anli.js` 存储，字段含卦名、月建、日辰、动爻、原断语
2. WHEN 用户所起卦与原案例同卦同时辰，系统 SHALL 提示对照并展示原断语

#### R6-2 自动化回归

**User Story:** AS 维护者, I want 核心算法受测试保护, so that 后续改动不破坏内核

**Acceptance Criteria**

1. WHEN 运行回归脚本，系统 SHALL 断言全部原案例的用神选取、空破判定、卦象标注与预期一致
2. WHEN 运行回归脚本，系统 SHALL 断言 64 卦纳甲、世应、卦序、五行仍为 0 错误
3. WHEN 新增或修改断卦法度函数，系统 SHALL 在提交前通过全部回归断言
