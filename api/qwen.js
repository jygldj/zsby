// ============================================================
// 千问（通义千问）API 调用模块
// rw10 精炼版：锁死首句、取消段落标题、只留通俗断语 + 专业详解
// ============================================================

// 支持双模型：callQwen(guaInfo, 'qwen') 主力；callQwen(guaInfo, 'qwen2') 备选
// 密钥已移入服务端（functions/api/ai.js 代理），本文件不再包含任何密钥
async function callQwen(guaInfo, modelKey) {

    const userInfo = {
        name: guaInfo.userName || '',
        gender: guaInfo.userGender || '未填',
        birth: guaInfo.userBirth || '',
        question: guaInfo.userQuestion || '此事'
    };

    const timeInfo = guaInfo.timeInfo || {};

    const chenghu = userInfo.gender === '女' ? '女士'
                  : userInfo.gender === '男' ? '先生'
                  : '道友';

    const fixedOpening = `君有疑惑，询问${userInfo.question}，求得《${guaInfo.benGua}》之《${guaInfo.bianGua}》，今老夫为你释疑：`;

    function yaoDesc(y) {
        let desc = `${y.dizhi}${y.liuqin}`;
        const tags = [];
        if (y.isDong) tags.push('动');
        if (y.yuePo) tags.push('月破');
        if (y.riPoOrAnDong && y.riPoOrAnDong !== 'none') tags.push(y.riPoOrAnDong);
        if (y.kongType && y.kongType !== 'none') tags.push(y.kongType);
        return tags.length ? `${desc}（${tags.join('、')}）` : desc;
    }

    const yaoLines = (guaInfo.yaoDetail || [])
        .map((y, i) => `第${i + 1}爻：${yaoDesc(y)}${y.isDong && y.bianDizhi ? ' → 化' + y.bianDizhi + (y.bianLiuqin || '') : ''}`)
        .join('\n') || '无';

    const fuShenText = (guaInfo.fuShenList && guaInfo.fuShenList.length)
        ? guaInfo.fuShenList.map(f => {
            const base = `伏神${f.六亲 || ''}${f.地支 || ''}伏于第${f.飞神爻位 || '?'}爻${f.飞神地支 || ''}${f.飞神六亲 || ''}之下，${f.关系 || ''}`;
            const tags = [];
            if (f.kongType && f.kongType !== 'none') tags.push(f.kongType);
            return tags.length ? `${base}（${tags.join('、')}）` : base;
        }).join('；')
        : '无';

    function wsDesc(ws) {
        if (!ws || !ws.wangShuaiScore) return '未计算';
        const s = ws.wangShuaiScore;
        return `${s.index || 0}分（${s.detail || '无明细'}）`;
    }

    const yongShenText = guaInfo.yongShen
        ? `${guaInfo.yongShen.liuqin || ''}${typeof guaInfo.yongShen.primaryIndex === 'number' ? '（第' + guaInfo.yongShen.primaryIndex + '爻）' : ''}，选取理由：${guaInfo.yongShen.reason || ''}，旺衰：${wsDesc(guaInfo.yongShen)}`
        : '未计算';

    const jiShenText = guaInfo.jiShenState
        ? `${guaInfo.jiShenState.liuqin || ''}${guaInfo.jiShenState.positions && typeof guaInfo.jiShenState.positions[0] === 'number' ? '（第' + guaInfo.jiShenState.positions[0] + '爻）' : ''}，旺衰：${wsDesc(guaInfo.jiShenState)}，断语：${guaInfo.jiShenState.duanYu || ''}`
        : '无';

    const chouShenText = guaInfo.chouShenState
        ? `${guaInfo.chouShenState.liuqin || ''}${guaInfo.chouShenState.positions && typeof guaInfo.chouShenState.positions[0] === 'number' ? '（第' + guaInfo.chouShenState.positions[0] + '爻）' : ''}，旺衰：${wsDesc(guaInfo.chouShenState)}，断语：${guaInfo.chouShenState.duanYu || ''}`
        : '无';

    const yuanShenText = guaInfo.yuanShenState
        ? `${guaInfo.yuanShenState.liuqin || ''}（${guaInfo.yuanShenState.isFuCang ? '伏藏' : '显'}，${guaInfo.yuanShenState.isKong ? '旬空' : '不空'}）—— ${guaInfo.yuanShenState.duanYu || ''}`
        : '无';

    // ⭐ R5-1 全要素并入提示词：卦象/墓绝/进退反伏/独发/断卦链/应期/门类（已由引擎算定，AI 只引用不推演）
    const gx = guaInfo.guaXiang || {};
    const gxTags = [];
    if (gx.liuChong) gxTags.push('六冲');
    if (gx.liuHe) gxTags.push('六合');
    if (gx.fanYin) gxTags.push('反吟');
    if (gx.fuYin) gxTags.push('伏吟');
    if (gx.duFa === '独发' && gx.duFaYaoIndex) gxTags.push('独发第' + gx.duFaYaoIndex + '爻');
    if (gx.duFa === '六爻安静') gxTags.push('六爻安静');
    const guaXiangText = (gxTags.length ? gxTags.join('、') : '无特殊卦象') +
        (gx.dongYaoCount ? '（动爻' + gx.dongYaoCount + '个）' : '');

    const muJueText = (guaInfo.yaoDetail || [])
        .map((y, i) => y.shengWangMuJue && (y.shengWangMuJue.ruMu || y.shengWangMuJue.linJue)
            ? `第${i + 1}爻${y.dizhi}${y.liuqin || ''}${y.shengWangMuJue.ruMu ? '入墓' : ''}${y.shengWangMuJue.linJue ? '临绝' : ''}` : null)
        .filter(Boolean).join('；') || '无入墓临绝';
    const huiTouText = (guaInfo.yaoDetail || [])
        .map((y, i) => y.huiTou ? `第${i + 1}爻${y.dizhi}${y.liuqin || ''}动而${y.huiTou.type}` : null)
        .filter(Boolean).join('；') || '无化进退化回头生克';

    const dg = guaInfo.duanGua;
    const duanGuaText = dg && dg.chain && dg.chain.length
        ? dg.chain.map(c => `【${c.jueJu}】${c.jieLun}${c.yiJu ? '（' + c.yiJu + '）' : ''}`).join('\n')
        : '未计算';
    const yq = guaInfo.yingqi;
    const yingqiText = yq && yq.items && yq.items.length
        ? yq.items.map(it => `${it.type}：${it.yiJu || ''} → ${(it.candidates || []).map(c => c.solar).join('、') || '暂无候选'}`).join('\n')
        : '未计算';

    const mc = guaInfo.menleiContext;
    const menleiText = mc
        ? `门类：${mc.menlei}（以${mc.yongShen || '所问'}为用）　断法：${mc.duanFa.join('；')}　应期：${mc.yingqi.join('、')}　持世：${mc.chiShi}`
        : '未命中知识库门类';

    const systemPrompt = `你是一位精通《增删卜易》的六爻占卜专家，以老者口吻释卦，自称"老夫"。断语严谨客观，得古法精髓。

【输出格式铁律（务必遵守）】
1. 首句锁死：回复必须且只能以如下固定首句开头，不得增减、换行或加任何前缀（严禁"野鹤老人曰"等套语）：
   "${fixedOpening}"
2. 禁止任何段落标题（如"第一段""求卦者档案""专业详解"等标题行）。
3. 仅两段：首句后紧接通俗断语（120字内、无专业术语、亲切如面谈）；其后写标记【专业详解】（前后各空一行），再展开专业分析。
4. 释文不重复前端已展示的求卦者信息、起卦时间、月建日辰旬空；不出现姓名、性别、出生时辰、公历日期。
5. 时间仅用农历月建、日辰、旬空；旺衰评分须转古语（如"得月建生扶"），禁写代码字段名或数字算式。
6. 自称"老夫"，称对方"君"或"道友"；浅文言，古雅易懂。
7. 正文通体纯文本，不加粗不变色不倾斜；禁用 markdown/HTML 强调标签，样式由前端统一控制，你不得自行着色。

【断卦】重五行生克，轻卦辞；以用神为中心察旺衰；日月为纲；动变为机。
【数据】卦象数据已按古法算定，你只解读不推演；用神理由须原文复述；标注与判断冲突时以标注为准。
【应期】应期候选已由引擎推算，解读时必须引用【应期候选】中的日期，严禁自行推演干支计算。
【门类】当给出门类断法要点时，必须以该门类断法为分析框架。
【专业详解六步】用神取舍／月建影响／日辰影响／世应关系／动爻之变／综合断语与应期（应期引用候选日期）。`;

    const userPrompt = `【固定首句】
${fixedOpening}

【卦象数据（已排定，请直接使用，勿自行推演）】
本卦：${guaInfo.benGua}（${guaInfo.benPalace || ''}）
变卦：${guaInfo.bianGua}（${guaInfo.bianPalace || ''}）
月建：${timeInfo.yueJian || ''}月　日辰：${timeInfo.riChen || ''}日　旬空：${timeInfo.xunKong || ''}
世爻：${guaInfo.shiYao || ''}
应爻：${guaInfo.yingYao || ''}

${yaoLines}

伏神信息：${fuShenText}

用神：${yongShenText}
忌神：${jiShenText}
仇神：${chouShenText}
原神：${yuanShenText}

世爻状态：${guaInfo.shiYaoZhuangTai ? guaInfo.shiYaoZhuangTai + '：' + (guaInfo.shiYaoDetail || '') : '平稳'}

卦象标注：${guaXiangText}
入墓临绝：${muJueText}
化进化退回头生克：${huiTouText}

断卦依据链：
${duanGuaText}

应期候选：
${yingqiText}

门类断法：${menleiText}

请严格按 systemPrompt 格式输出：以固定首句开头，紧接通俗断语，再写【专业详解】标记并展开六步专业分析。`;

    try {
        const response = await fetch('/api/ai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modelKey: modelKey || 'qwen',
                systemPrompt: systemPrompt,
                userPrompt: userPrompt
            })
        });

        if (!response.ok) {
            let message = 'HTTP ' + response.status;
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) message = errorData.error;
            } catch (e2) { /* 非 JSON 错误体则用状态码 */ }
            throw new Error(message);
        }

        const data = await response.json();
        return data.content;

    } catch(error) {
        console.error('释卦 API 调用失败:', error);
        throw error;
    }
}
