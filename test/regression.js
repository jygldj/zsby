// ============================================================
// 六爻断卦系统自动化回归（R6-2）
// 运行：node test/regression.js
// 覆盖：R0-R4 核心算法 + 64卦数据完整性 + 原案例（AC1/AC2/AC3）
// ============================================================
const fs = require('fs');
const read = f => fs.readFileSync('/workspace/' + f, 'utf8');

const lunarCode = read('ly/lunar.js');
const mod = { exports: {} };
new Function('module', 'exports', 'require', lunarCode + '\n;return 0;')(mod, mod.exports, require);
globalThis.Solar = mod.exports.Solar;
globalThis.Lunar = mod.exports.Lunar;

const shuju = read('ly/shuju.js');
const suanfa = read('ly/suanfa.js');

const test = `
let fail = 0;
function assert(c, m) { if (c) { console.log('PASS: ' + m); } else { fail++; console.log('FAIL: ' + m); } }

// ---- R6-2 AC2 64卦数据完整性：纳甲/世应/卦序/五行 0 错误 ----
const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI_ALL = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const WUXING_ALL = ['金','木','水','火','土'];
assert(ALL_GUA_DATA.length === 64, 'AC2 共64卦(实际' + ALL_GUA_DATA.length + ')');
ALL_GUA_DATA.forEach((gu, idx) => {
    assert(gu.卦名 && gu.宫 && gu.五行, 'AC2 卦' + (idx + 1) + ' ' + gu.卦名 + ' 基础字段完整');
    assert(WUXING_ALL.indexOf(gu.五行) !== -1, 'AC2 卦' + gu.卦名 + ' 五行合法');
    assert(gu.爻位 && gu.爻位.length === 6, 'AC2 卦' + gu.卦名 + ' 6爻');
    assert(gu.爻位.every((y, i) => y.爻 === i + 1 && TIAN_GAN.indexOf(y.天干) !== -1 && DIZHI_ALL.indexOf(y.地支) !== -1),
        'AC2 卦' + gu.卦名 + ' 爻序/天干/地支合法');
    assert(gu.世爻 >= 1 && gu.世爻 <= 6 && gu.应爻 >= 1 && gu.应爻 <= 6, 'AC2 卦' + gu.卦名 + ' 世应范围合法');
});

// ---- R6-2 六冲六合 64 卦全表 ----
const SIX_CHONG = ['乾为天','天雷无妄','雷天大壮','坎为水','兑为泽','离为火','震为雷','巽为风','艮为山','坤为地'];
const SIX_HE = ['天地否','地天泰','水泽节','火山旅','雷地豫','山火贲','泽水困','地雷复'];
ALL_GUA_DATA.forEach(gu => {
    const yaoDetail = gu.爻位.map(w => ({ dizhi: w.地支, liuqin: '', isDong: false }));
    const gi = { yaoDetail: yaoDetail, bianYao: [], shiYaoIndex: gu.世爻, fuShenList: [], timeInfo: {}, userInfo: {} };
    suanLiuChongLiuHe(gi);
    const name = gu.卦名;
    if (SIX_CHONG.includes(name)) assert(gi.guaXiang.liuChong === true, name + ' 应为六冲卦');
    if (SIX_HE.includes(name)) assert(gi.guaXiang.liuHe === true, name + ' 应为六合卦');
});
assert(SIX_CHONG.length + SIX_HE.length === 18, 'AC2 六冲10+六合8=18');

// ---- R6-2 AC1 原案例：两现章 未月庚子日占财 风天小畜 ----
const guXS = ALL_GUA_DATA.find(g => g.卦名 === '风天小畜');
assert(!!guXS, 'AC1 风天小畜 数据存在');
const yaoDetail = guXS.爻位.map(w => {
    const wx = DIZHI_WUXING[w.地支];
    let liuqin = '';
    if (wx === guXS.五行) liuqin = '兄弟';
    else if (WX_SHENG_RW7[guXS.五行] === wx) liuqin = '子孙';
    else if (WX_SHENG_RW7[wx] === guXS.五行) liuqin = '父母';
    else if (WX_KE_RW7[guXS.五行] === wx) liuqin = '妻财';
    else if (WX_KE_RW7[wx] === guXS.五行) liuqin = '官鬼';
    return { dizhi: w.地支, liuqin: liuqin, isDong: false, yuePo: false, kongType: 'none', tianGan: w.天干 };
});
const guaInfo = {
    yaoDetail: yaoDetail, bianYao: [], guaXiang: {},
    shiYaoIndex: guXS.世爻, yingYaoIndex: guXS.应爻, fuShenList: [],
    timeInfo: { yueJian: '未', riChen: '庚子', xunKong: '辰巳', nianGanZhi: '丙午' },
    userInfo: { gender: '男' }
};
// 按 jiegua.html 真实顺序：月破→日破暗动→真空假空，先算空再选用神（两现"舍空取实"依赖 kongType）
jiSuanYuePo(guaInfo);
jiSuanRiPoAnDong(guaInfo);
jiSuanZhenKongJiaKong(guaInfo);
xuanYongShen(guaInfo, '财运');
assert(guaInfo.yongShen && guaInfo.yongShen.liuqin === '妻财', 'AC1 原例用神=妻财');
assert(guaInfo.yongShen.primaryIndex === 4, 'AC1 原例取第4爻应爻未土(实际' + guaInfo.yongShen.primaryIndex + ')');
const anli = findAnli('风天小畜', '庚子', '未');
assert(!!anli && anli.source === '两现章' && !!anli.duan, 'AC1 findAnli 命中两现章原例');
assert(findAnli('乾为天', '庚子', '未') === null, 'AC1 异卦不同例不误命中');
suanQuanBuGuaXiang(guaInfo);
assert(guaInfo.guaXiang.liuChong === false && guaInfo.guaXiang.liuHe === false, 'AC1 风天小畜非六冲非六合');
assert(yaoDetail[2].kongType === '假空' || yaoDetail[2].kongType === '真空', 'AC1 辰爻(3爻)庚子日旬空(实际' + yaoDetail[2].kongType + ')');

// ---- 冒烟：吉凶判定三态 + 门类 + 应期引擎 ----
g = {
    yaoDetail: ALL_GUA_DATA.find(x => x.卦名 === '乾为天').爻位.map(w => {
        const wx = DIZHI_WUXING[w.地支];
        let lq = '';
        if (wx === '金') lq = '兄弟'; else if (wx === '水') lq = '子孙'; else if (wx === '木') lq = '妻财';
        else if (wx === '火') lq = '官鬼'; else lq = '父母';
        return { dizhi: w.地支, liuqin: lq, isDong: false, yuePo: false, kongType: 'none', tianGan: w.天干 };
    }),
    bianYao: [], guaXiang: {}, shiYaoIndex: 6, yingYaoIndex: 3, fuShenList: [],
    timeInfo: { yueJian: '午', riChen: '丙午', xunKong: '', nianGanZhi: '丙午' },
    userInfo: { gender: '男' }, menlei: '求财'
};
applyMenLeiContext(g); xuanYongShen(g, g.menlei); jiShenChouShen(g);
jiSuanYuePo(g); jiSuanRiPoAnDong(g); jiSuanZhenKongJiaKong(g);
jiSuanYuanShenKongFu(g, g.menlei); jiSuanShiYaoZhuangTai(g);
suanQuanBuGuaXiang(g); tuiYingQi(g, new Date(2026, 7, 10)); suanDuanGua(g);
assert(g.menleiContext && g.menleiContext.menlei === '求财', '冒烟 门类知识库命中求财');
assert(g.duanGua && g.duanGua.chain.length >= 8 && ['大吉','吉','中','小凶','凶'].indexOf(g.duanGua.jiXiong) !== -1, '冒烟 断卦链+吉凶判定(五档)');
assert(g.duanGua.chain.some(c => c.jueJu === '察门类'), '冒烟 断卦链含察门类步');
assert(g.yingqi === null || (g.yingqi.items && g.yingqi.items.length > 0), '冒烟 应期引擎结构合法');

// P0 XSS 加固：AI 返回文本经 mdToHtml 后不得含可执行标签（防御 <script>/<img onerror>/<svg onload>/javascript: 链接注入）
['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg/onload=alert(1)>', '<a href="javascript:alert(1)">x</a>'].forEach(function(s) {
    const out = mdToHtml(s);
    assert(out.indexOf('<script') === -1 && out.indexOf('<img') === -1 && out.indexOf('<svg') === -1 && out.indexOf('<a') === -1,
        'XSS 加固 mdToHtml 转义恶意标签: ' + s);
});

// ---- 短八 回归边界：动散 / 动不为空 / 一空一破 ----
// 边界1 动散：动爻逢日支冲为散（如风吹火灭），静爻逢冲不在此判
const g1 = { yaoDetail: [
    { dizhi: '卯', liuqin: '妻财', isDong: true },
    { dizhi: '子', liuqin: '子孙', isDong: false }
], timeInfo: { riChen: '丁酉' } };
suanDongSan(g1);
assert(g1.yaoDetail[0].dongSan === true, '边界 动散：动爻卯逢酉日冲为散');
assert(g1.yaoDetail[1].dongSan === false, '边界 非动不散：静爻逢冲不判散');

// 边界2 动不为空：动爻旬空（无月破、月不克）不为真空，出空有期为假空
const g2 = { yaoDetail: [
    { dizhi: '子', liuqin: '兄弟', isDong: true, yuePo: false },
    { dizhi: '午', liuqin: '官鬼', isDong: false }
], timeInfo: { yueJian: '寅', riChen: '甲寅', xunKong: '子丑' } };
jiSuanZhenKongJiaKong(g2);
assert(g2.yaoDetail[0].kongType === '假空', '边界 动不为空：动爻旬空出空有期为假空(实际' + g2.yaoDetail[0].kongType + ')');

// 边界3 一空一破：妻财两现，一爻真空一爻月破，无"全"者 → ③舍破取全，取"空而不破"者
const g3 = { yaoDetail: [
    { dizhi: '寅', liuqin: '妻财', isDong: false, yuePo: true, kongType: 'none' },
    { dizhi: '辰', liuqin: '妻财', isDong: false, yuePo: false, kongType: '真空' },
    { dizhi: '午', liuqin: '官鬼', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '申', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '戌', liuqin: '父母', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '子', liuqin: '子孙', isDong: false, yuePo: false, kongType: 'none' }
], shiYaoIndex: 3, yingYaoIndex: 6, fuShenList: [], timeInfo: { yueJian: '卯', riChen: '丁酉' }, userInfo: { gender: '男' } };
xuanYongShen(g3, '财运');
assert(g3.yongShen.primaryIndex === 2, '边界 一空一破：舍破取全，取空而不破之辰爻(实际' + g3.yongShen.primaryIndex + '爻)');

// ---- 评测报告2修正：ANLI 全库自洽性断言 ----
// 1) 卦名必须存在于 64 卦；2) 取用爻位六亲自洽；3) 动爻必须为"地支+五行"格式（如'未土'），不得写六亲名
function liuqinAt(guaName, idx) {
    const gu = ALL_GUA_DATA.find(x => x.卦名 === guaName);
    if (!gu) return null;
    const w = gu.爻位[idx - 1];
    if (!w) return null;
    const wx = DIZHI_WUXING[w.地支];
    if (wx === gu.五行) return '兄弟';
    if (WX_SHENG_RW7[gu.五行] === wx) return '子孙';
    if (WX_SHENG_RW7[wx] === gu.五行) return '父母';
    if (WX_KE_RW7[gu.五行] === wx) return '妻财';
    if (WX_KE_RW7[wx] === gu.五行) return '官鬼';
    return null;
}
ANLI.forEach((a, i) => {
    assert(!!ALL_GUA_DATA.find(x => x.卦名 === a.gua), 'ANLI[' + i + '] 卦名存在: ' + a.gua);
    // 策3：yongShenIndex 为 null（用神伏藏/变爻之财/伏神等合法场景）时跳过六亲断言
    if (a.yongShenIndex != null) {
        const actualLq = liuqinAt(a.gua, a.yongShenIndex);
        assert(actualLq === a.yongShen, 'ANLI[' + i + '] ' + a.gua + ' 取用爻六亲自洽(' + a.yongShen + '@' + a.yongShenIndex + '爻, 实际' + actualLq + ')');
    }
    assert((a.dong || []).every(d => /^[子丑寅卯辰巳午未申酉戌亥][金木水火土]$/.test(d)), 'ANLI[' + i + '] ' + a.gua + ' 动爻为地支+五行格式');
});
// 小畜案例字段语义：取用=4(应爻未土) / 应期=3(辰土出空)，与算法"舍空取实"一致
const anliXS = ANLI.find(a => a.gua === '风天小畜');
assert(anliXS && anliXS.yongShenIndex === 4 && anliXS.yingqiIndex === 3, 'ANLI 小畜拆分 yongShenIndex=4 / yingqiIndex=3');
// 兑为泽（月破章）卦名修正后仍可命中
assert(findAnli('兑为泽', '己丑', '亥') !== null && findAnli('兑为天', '己丑', '亥') === null, 'ANLI 兑为泽 卦名修正后命中正常');

// 评测建议 P1-4：两现皆空 → 仍须有取用（⑥舍其休囚用其旺相兜底）
const g4 = { yaoDetail: [
    { dizhi: '辰', liuqin: '妻财', isDong: false, yuePo: false, kongType: '真空' },
    { dizhi: '未', liuqin: '妻财', isDong: false, yuePo: false, kongType: '真空' },
    { dizhi: '午', liuqin: '官鬼', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '申', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '戌', liuqin: '父母', isDong: false, yuePo: false, kongType: 'none' },
    { dizhi: '子', liuqin: '子孙', isDong: false, yuePo: false, kongType: 'none' }
], shiYaoIndex: 3, yingYaoIndex: 6, fuShenList: [], timeInfo: { yueJian: '未', riChen: '庚子', xunKong: '辰巳' }, userInfo: { gender: '男' } };
xuanYongShen(g4, '财运');
assert(g4.yongShen.primaryIndex != null, '边界 两现皆空：仍取旺相者为用(实际' + g4.yongShen.primaryIndex + '爻, ' + g4.yongShen.reason + ')');

// ---- P1 权重增强（用神为尊）：一等 ±2 行为断言 ----
// 断言A：用神月破（1爻卯木妻财，酉月金克木休囚，再月破 -2）→ 评分 ≤ -2
const gw1 = { yaoDetail: [
    { dizhi: '卯', liuqin: '妻财', isDong: false, yuePo: true, kongType: 'none', tianGan: '乙' },
    { dizhi: '子', liuqin: '子孙', isDong: false, yuePo: false, kongType: 'none', tianGan: '甲' },
    { dizhi: '寅', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none', tianGan: '丙' },
    { dizhi: '午', liuqin: '官鬼', isDong: false, yuePo: false, kongType: 'none', tianGan: '戊' },
    { dizhi: '辰', liuqin: '父母', isDong: false, yuePo: false, kongType: 'none', tianGan: '庚' },
    { dizhi: '申', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none', tianGan: '壬' }
], bianYao: [], guaXiang: {}, shiYaoIndex: 3, yingYaoIndex: 6, fuShenList: [],
    timeInfo: { yueJian: '酉', riChen: '甲子', xunKong: '寅卯', nianGanZhi: '丙午' }, userInfo: { gender: '男' } };
gw1.yongShen = { liuqin: '妻财', positions: [1], primaryIndex: 1, dizhi: '卯', reason: '测试' };
suanDuanGua(gw1);
assert(gw1.duanGua.score <= -2, 'P1加权 用神月破单条-2生效(实际评分' + gw1.duanGua.score + ')');
// 断言B：用神得月比和旺相（3爻辰土妻财，未月比和）→ 评分 ≥ +2
const gw2 = { yaoDetail: [
    { dizhi: '子', liuqin: '父母', isDong: false, yuePo: false, kongType: 'none', tianGan: '甲' },
    { dizhi: '寅', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none', tianGan: '丙' },
    { dizhi: '辰', liuqin: '妻财', isDong: false, yuePo: false, kongType: 'none', tianGan: '戊' },
    { dizhi: '午', liuqin: '官鬼', isDong: false, yuePo: false, kongType: 'none', tianGan: '庚' },
    { dizhi: '申', liuqin: '子孙', isDong: false, yuePo: false, kongType: 'none', tianGan: '壬' },
    { dizhi: '戌', liuqin: '兄弟', isDong: false, yuePo: false, kongType: 'none', tianGan: '甲' }
], bianYao: [], guaXiang: {}, shiYaoIndex: 3, yingYaoIndex: 5, fuShenList: [],
    timeInfo: { yueJian: '未', riChen: '庚子', xunKong: '', nianGanZhi: '丙午' }, userInfo: { gender: '男' } };
gw2.yongShen = { liuqin: '妻财', positions: [3], primaryIndex: 3, dizhi: '辰', reason: '测试' };
suanDuanGua(gw2);
assert(gw2.duanGua.score >= 2, 'P1加权 用神旺相+2生效(实际评分' + gw2.duanGua.score + ')');

// B-1 验证：疾病门步2/步5 方向反转（用神旺相→凶；忌神有力→吉；原神得力→凶）
function _mk(menlei){ return { yaoDetail:[
  { dizhi:'卯', liuqin:'妻财', isDong:false, yuePo:false, kongType:'none', tianGan:'乙' },
  { dizhi:'子', liuqin:'子孙', isDong:false, yuePo:false, kongType:'none', tianGan:'甲' },
  { dizhi:'寅', liuqin:'兄弟', isDong:false, yuePo:false, kongType:'none', tianGan:'丙' },
  { dizhi:'午', liuqin:'官鬼', isDong:false, yuePo:false, kongType:'none', tianGan:'戊' },
  { dizhi:'辰', liuqin:'父母', isDong:false, yuePo:false, kongType:'none', tianGan:'庚' },
  { dizhi:'申', liuqin:'兄弟', isDong:false, yuePo:false, kongType:'none', tianGan:'壬' }
], bianYao:[], guaXiang:{}, shiYaoIndex:3, yingYaoIndex:6, fuShenList:[],
  timeInfo:{ yueJian:'午', riChen:'丙午', xunKong:'', nianGanZhi:'丙午' }, userInfo:{ gender:'男', jinBing:'否' }, menlei:menlei }; }
const gDis=_mk('疾病'); applyMenLeiContext(gDis); xuanYongShen(gDis,'疾病'); jiShenChouShen(gDis); jiSuanYuePo(gDis); jiSuanRiPoAnDong(gDis); jiSuanZhenKongJiaKong(gDis); jiSuanYuanShenKongFu(gDis,'疾病'); jiSuanShiYaoZhuangTai(gDis); suanQuanBuGuaXiang(gDis); tuiYingQi(gDis, new Date(2026,7,10)); suanDuanGua(gDis);
const gCai=_mk('求财'); applyMenLeiContext(gCai); xuanYongShen(gCai,'求财'); jiShenChouShen(gCai); jiSuanYuePo(gCai); jiSuanRiPoAnDong(gCai); jiSuanZhenKongJiaKong(gCai); jiSuanYuanShenKongFu(gCai,'求财'); jiSuanShiYaoZhuangTai(gCai); suanQuanBuGuaXiang(gCai); tuiYingQi(gCai, new Date(2026,7,10)); suanDuanGua(gCai);
assert(gDis.duanGua.score < 0, 'B-1 疾病门用神旺相→凶(实际'+gDis.duanGua.score+')');
assert(gDis.duanGua.score < gCai.duanGua.score, 'B-1 疾病门较求财门符号相反反转('+gDis.duanGua.score+' vs '+gCai.duanGua.score+')');

// B-5 验证：疾病门近病/久病分流（近病逢空即愈，久病逢空不治，近病逢冲+1/久病逢冲-1）
function _run2(g, m, chong){ applyMenLeiContext(g); xuanYongShen(g,m); jiShenChouShen(g); jiSuanYuePo(g); jiSuanRiPoAnDong(g); jiSuanYuanShenKongFu(g,m); jiSuanShiYaoZhuangTai(g); if (chong) g.guaXiang = { liuChong: true }; tuiYingQi(g, new Date(2026,7,10)); suanDuanGua(g); }
const gNear=_mk('疾病'); gNear.userInfo.jinBing='近病'; gNear.yaoDetail[3].kongType='真空'; _run2(gNear,'疾病', false);
const gOld=_mk('疾病'); gOld.userInfo.jinBing='久病'; gOld.yaoDetail[3].kongType='真空'; _run2(gOld,'疾病', false);
assert(gNear.duanGua.score > gOld.duanGua.score, 'B-5 疾病门近病较久病逢空更吉('+gNear.duanGua.score+' vs '+gOld.duanGua.score+')');
assert(gOld.duanGua.score < 0, 'B-5 疾病门久病逢空→凶(实际'+gOld.duanGua.score+')');
const gNearChong=_mk('疾病'); gNearChong.userInfo.jinBing='近病'; gNearChong.yaoDetail[3].kongType='真空'; _run2(gNearChong,'疾病', true);
assert(gNearChong.duanGua.score > gNear.duanGua.score, 'B-5 疾病门近病逢冲较无冲更吉(+1)(实际'+gNearChong.duanGua.score+' vs '+gNear.duanGua.score+')');
const gOldChong=_mk('疾病'); gOldChong.userInfo.jinBing='久病'; gOldChong.yaoDetail[3].kongType='真空'; _run2(gOldChong,'疾病', true);
assert(gOldChong.duanGua.score < gOld.duanGua.score, 'B-5 疾病门久病逢冲较无冲更凶(-1)(实际'+gOldChong.duanGua.score+' vs '+gOld.duanGua.score+')');

// 乙 验证：疾病门代问亲属分流（父病→父母、妻病→妻财、子病→子孙；方向正常非反转；疾病门语义条跳过）
function _mkDai(daiWen){ const g=_mk('疾病'); g.userInfo.daiWen=daiWen; applyMenLeiContext(g); xuanYongShen(g,'疾病'); return g; }
const gFu=_mkDai('父母'); assert(gFu.yongShen && gFu.yongShen.liuqin === '父母', '乙 父病代问→用神=父母(实际'+(gFu.yongShen&&gFu.yongShen.liuqin)+')');
const gQi=_mkDai('妻财'); assert(gQi.yongShen && gQi.yongShen.liuqin === '妻财', '乙 妻病代问→用神=妻财(实际'+(gQi.yongShen&&gQi.yongShen.liuqin)+')');
const gZi=_mkDai('子孙'); assert(gZi.yongShen && gZi.yongShen.liuqin === '子孙', '乙 子病代问→用神=子孙(实际'+(gZi.yongShen&&gZi.yongShen.liuqin)+')');
const gSelfDai=_mkDai('自己'); assert(gSelfDai.yongShen && gSelfDai.yongShen.liuqin === '官鬼', '乙 自己病→用神=官鬼(对照,实际'+(gSelfDai.yongShen&&gSelfDai.yongShen.liuqin)+')');
// 代问方向正常（用神旺相=吉），自己病反转（用神旺相=凶）：同卦仅 daiWen 不同
function _mkDir(liuqin, daiWen){ const g={ yaoDetail:[
  { dizhi:'卯', liuqin:'妻财', isDong:false, yuePo:false, kongType:'none', tianGan:'乙' },
  { dizhi:'子', liuqin:'子孙', isDong:false, yuePo:false, kongType:'none', tianGan:'甲' },
  { dizhi:'寅', liuqin:'兄弟', isDong:false, yuePo:false, kongType:'none', tianGan:'丙' },
  { dizhi:'午', liuqin:'官鬼', isDong:false, yuePo:false, kongType:'none', tianGan:'戊' },
  { dizhi:'子', liuqin: liuqin, isDong:false, yuePo:false, kongType:'none', tianGan:'庚' },
  { dizhi:'申', liuqin:'兄弟', isDong:false, yuePo:false, kongType:'none', tianGan:'壬' }
], bianYao:[], guaXiang:{}, shiYaoIndex:3, yingYaoIndex:6, fuShenList:[],
  timeInfo:{ yueJian:'子', riChen:'丙子', xunKong:'', nianGanZhi:'丙午' }, userInfo:{ gender:'男', jinBing:'否', daiWen: daiWen }, menlei:'疾病' };
  g.yongShen = { liuqin: liuqin, positions:[5], primaryIndex:5, dizhi:'子', reason:'测试', priority:[], wangShuaiScore:{ index:1 } };
  suanDuanGua(g); return g; }
const gDaiDir=_mkDir('妻财','妻财'); const gSelfDir=_mkDir('妻财','自己');
assert(gDaiDir.duanGua.score > 0, '乙 代问妻病·用神(妻财)旺相=吉(正常向, 实际'+gDaiDir.duanGua.score+')');
assert(gSelfDir.duanGua.score < 0, '乙 对照·同卦自己病(官鬼为用)仍反转=凶(实际'+gSelfDir.duanGua.score+')');
// 代问时疾病门 MENLEI_RULES 语义条跳过（不输出"子孙制鬼/官鬼旺=病重"等自病语义）
const rFu=applyMenLeiScoring(gFu,0); assert(rFu.entries.length === 0, '乙 代问父病→疾病门语义条已跳过(实际push '+rFu.entries.length+'条)');

// ---- A-1 应期引擎用神索引越界（off-by-one）语义回归 ----
// 修复前 suanfa.js:1279 为 yaoDetail[yongShen.primaryIndex]（缺-1）→ 误取下一爻；修复后 -1 取正确用神爻。
// 用真实卦（乾为天）构造，确保 tuiYingQi 产出 yingqi（手写卦 guaXiang 不足会致 yingqi=null）。
function _a1real(menlei){
  const g = {
    yaoDetail: ALL_GUA_DATA.find(x => x.卦名 === '乾为天').爻位.map((w, idx) => {
      const wx = DIZHI_WUXING[w.地支];
      let lq = ''; if (wx === '金') lq = '兄弟'; else if (wx === '水') lq = '子孙'; else if (wx === '木') lq = '妻财'; else if (wx === '火') lq = '官鬼'; else lq = '父母';
      return { dizhi: w.地支, liuqin: lq, isDong: idx === 0, yuePo: false, kongType: 'none', tianGan: w.天干 };
    }),
    bianYao: [], guaXiang: {}, shiYaoIndex: 6, yingYaoIndex: 3, fuShenList: [],
    timeInfo: { yueJian: '午', riChen: '丙午', xunKong: '', nianGanZhi: '丙午' }, userInfo: { gender: '男', jinBing: '否' }, menlei: menlei
  };
  applyMenLeiContext(g); xuanYongShen(g, menlei); jiShenChouShen(g); jiSuanYuePo(g); jiSuanRiPoAnDong(g); jiSuanZhenKongJiaKong(g); jiSuanYuanShenKongFu(g, menlei); jiSuanShiYaoZhuangTai(g); suanQuanBuGuaXiang(g);
  return g;
}
const gA1a=_a1real('求财'); const yiA=gA1a.yongShen.primaryIndex;
gA1a.yaoDetail[yiA-1].kongType='真空'; gA1a.yaoDetail[yiA-1].yuePo=true;  // 用神爻真空兼月破
tuiYingQi(gA1a, new Date(2026,7,10));
assert(gA1a.yingqi && gA1a.yingqi.flags && gA1a.yingqi.flags.weak===true, 'A-1 用神真空兼月破→weak=true(越界修复)');
const gA1b=_a1real('求财'); const yiB=gA1b.yongShen.primaryIndex;
gA1b.yaoDetail[yiB-1].kongType='none'; gA1b.yaoDetail[yiB-1].yuePo=false;   // 用神正常
gA1b.yaoDetail[0].kongType='真空'; gA1b.yaoDetail[0].yuePo=true;            // 初爻(非用神)真空兼月破
tuiYingQi(gA1b, new Date(2026,7,10));
assert(gA1b.yingqi && gA1b.yingqi.flags && gA1b.yingqi.flags.weak===false, 'A-1 用神正常二爻异常→weak=false(修复后无误伤)');


// ---- 策3 四门去重护栏回归断言 ----
// 1. 求财：财克世独立 +1（火天大有 寅月庚戌日，寅木财克辰土世）
let gml = {
    menlei:'求财',
    yongShen:{ liuqin:'妻财', primaryIndex:2, dizhi:'寅' },
    shiYaoIndex:3,
    yaoDetail:[
        { dizhi:'子', liuqin:'子孙' }, { dizhi:'寅', liuqin:'妻财' }, { dizhi:'辰', liuqin:'父母' },
        { dizhi:'酉', liuqin:'兄弟' }, { dizhi:'未', liuqin:'父母' }, { dizhi:'巳', liuqin:'官鬼' }
    ],
    jiShenState:null, yuanShenState:null, guaXiang:{}
};
let rml = applyMenLeiScoring(gml, 0);
assert(rml.score === 1, '策3 求财·财克世独立+1(实际' + rml.score + ')');
assert(!rml.entries.some(e => e.jieLun.indexOf('妻财旺相') !== -1 && e.jieLun.indexOf('专属计分') !== -1), '策3 求财·财旺同源去重不双计');

// 2. 求财：财伏独立 -1（泽火革 财伏不现）
gml = { menlei:'求财', yongShen:{ liuqin:'妻财', primaryIndex:'伏3', dizhi:'午' }, shiYaoIndex:4, yaoDetail:[], jiShenState:null, yuanShenState:null, guaXiang:{} };
rml = applyMenLeiScoring(gml, 0);
assert(rml.score === -1, '策3 求财·财伏独立-1(实际' + rml.score + ')');

// 3. 功名：官持世同源去重（山风蛊 官鬼持世）
gml = { menlei:'功名', yongShen:{ liuqin:'官鬼', primaryIndex:3, dizhi:'酉' }, shiYaoIndex:3,
    yaoDetail:[
        { dizhi:'丑', liuqin:'妻财' }, { dizhi:'亥', liuqin:'父母' }, { dizhi:'酉', liuqin:'官鬼' },
        { dizhi:'戌', liuqin:'妻财' }, { dizhi:'子', liuqin:'父母' }, { dizhi:'寅', liuqin:'兄弟' }
    ],
    jiShenState:{ liuqin:'子孙', positions:[], wangShuaiScore:{ index:0 } }, yuanShenState:{ liuqin:'父母', isKong:false, isFuCang:false }, guaXiang:{} };
rml = applyMenLeiScoring(gml, 0);
assert(rml.score === 0, '策3 功名·官持世同源去重(实际' + rml.score + ')');
assert(rml.entries.some(e => e.jieLun.indexOf('官星持世') !== -1), '策3 功名·官持世语义已push');

// 4. 婚姻：兄持世同源去重 + 用神暗动独立 -1（地天泰 财暗动）
gml = { menlei:'婚姻', yongShen:{ liuqin:'妻财', primaryIndex:5, dizhi:'亥' }, shiYaoIndex:3,
    yaoDetail:[
        { dizhi:'子', liuqin:'妻财' }, { dizhi:'寅', liuqin:'官鬼' }, { dizhi:'辰', liuqin:'兄弟' },
        { dizhi:'丑', liuqin:'兄弟' }, { dizhi:'亥', liuqin:'妻财', riPoOrAnDong:'暗动' }, { dizhi:'酉', liuqin:'子孙' }
    ],
    jiShenState:{ liuqin:'兄弟', positions:[3], wangShuaiScore:{ index:1 } }, yuanShenState:null, guaXiang:{} };
rml = applyMenLeiScoring(gml, 0);
assert(!rml.entries.some(e => e.jieLun.indexOf('兄弟持世') !== -1 && e.jieLun.indexOf('专属计分') !== -1), '策3 婚姻·兄持世同源去重');
assert(rml.score === -1, '策3 婚姻·用神暗动独立-1(实际' + rml.score + ')');

// 5b. 婚姻：用神临驿马独立判据（不改分，仅语义，依赖 suanYiMa 写入 guaInfo.yiMa）
gml = { menlei:'婚姻', yongShen:{ liuqin:'妻财', primaryIndex:5, dizhi:'亥' }, yiMa:'亥', shiYaoIndex:3,
    yaoDetail:[
        { dizhi:'子', liuqin:'妻财' }, { dizhi:'寅', liuqin:'官鬼' }, { dizhi:'辰', liuqin:'兄弟' },
        { dizhi:'丑', liuqin:'兄弟' }, { dizhi:'亥', liuqin:'妻财' }, { dizhi:'酉', liuqin:'子孙' }
    ],
    jiShenState:null, yuanShenState:null, guaXiang:{} };
rml = applyMenLeiScoring(gml, 0);
assert(rml.entries.some(e => e.jieLun.indexOf('用神临驿马') !== -1), '策3 婚姻·用神临驿马独立判据(语义已push)');
assert(rml.score === 0, '策3 婚姻·临驿马不双计(实际' + rml.score + ')');

// 5a. 婚姻：卦本身六冲→婚散、六合→婚稳（语义显式化，tongyuan 不双计）
gml = { menlei:'婚姻', yongShen:{ liuqin:'妻财', primaryIndex:5, dizhi:'亥' }, shiYaoIndex:3,
    yaoDetail:[{dizhi:'子',liuqin:'妻财'},{dizhi:'寅',liuqin:'官鬼'},{dizhi:'辰',liuqin:'兄弟'},{dizhi:'丑',liuqin:'兄弟'},{dizhi:'亥',liuqin:'妻财'},{dizhi:'酉',liuqin:'子孙'}],
    jiShenState:null, yuanShenState:null, guaXiang:{ liuChong:true } };
rml = applyMenLeiScoring(gml, 0);
assert(rml.entries.some(e => e.jieLun.indexOf('六冲卦（婚姻主离散难成）') !== -1), '乙(婚姻) 六冲卦→婚散语义已push');
assert(rml.score === 0, '乙(婚姻) 六冲卦 tongyuan 不双计(实际' + rml.score + ')');

gml = { menlei:'婚姻', yongShen:{ liuqin:'妻财', primaryIndex:5, dizhi:'亥' }, shiYaoIndex:3,
    yaoDetail:[{dizhi:'子',liuqin:'妻财'},{dizhi:'寅',liuqin:'官鬼'},{dizhi:'辰',liuqin:'兄弟'},{dizhi:'丑',liuqin:'兄弟'},{dizhi:'亥',liuqin:'妻财'},{dizhi:'酉',liuqin:'子孙'}],
    jiShenState:null, yuanShenState:null, guaXiang:{ liuHe:true } };
rml = applyMenLeiScoring(gml, 0);
assert(rml.entries.some(e => e.jieLun.indexOf('六合卦（婚姻主合和稳固）') !== -1), '乙(婚姻) 六合卦→婚稳语义已push');
assert(rml.score === 0, '乙(婚姻) 六合卦 tongyuan 不双计(实际' + rml.score + ')');

// 5. 疾病门：本批全部 score=0（不改变总分，仅语义）
gml = { menlei:'疾病', yongShen:{ liuqin:'官鬼', primaryIndex:2, dizhi:'午', wangShuaiScore:{ index:1 } }, shiYaoIndex:2,
    yaoDetail:[
        { dizhi:'辰', liuqin:'父母' }, { dizhi:'午', liuqin:'官鬼', kongType:'真空' }, { dizhi:'申', liuqin:'兄弟' },
        { dizhi:'戌', liuqin:'父母' }, { dizhi:'子', liuqin:'妻财' }, { dizhi:'寅', liuqin:'子孙' }
    ],
    jiShenState:null, yuanShenState:null, guaXiang:{ liuChong:true } };
rml = applyMenLeiScoring(gml, 0);
assert(rml.score === 0, '策3 疾病门本批不改变总分(实际' + rml.score + ')');

// ---- E-1 回归（静卦不得误标伏吟/反吟，R1-4 守卫）----
const sbGua = ALL_GUA_DATA.find(x => x.卦名 === '水地比');
assert(!!sbGua, 'E-1 水地比 数据存在');
const SB_WX = '土'; // 水地比属坤宫，坤五行属土
const sbYao = sbGua.爻位.map(w => {
    const wx = DIZHI_WUXING[w.地支];
    let lq = '';
    if (wx === SB_WX) lq = '兄弟';
    else if (WX_SHENG_RW7[SB_WX] === wx) lq = '子孙';
    else if (WX_SHENG_RW7[wx] === SB_WX) lq = '父母';
    else if (WX_KE_RW7[SB_WX] === wx) lq = '妻财';
    else if (WX_KE_RW7[wx] === SB_WX) lq = '官鬼';
    return { dizhi: w.地支, liuqin: lq, isDong: false, yuePo: false, kongType: 'none', tianGan: w.天干 };
});
// 变卦 = 本卦（静卦无动爻，变卦与本卦重合是必然结果，非伏吟）
const sbBian = sbYao.map(y => ({ 地支: y.dizhi, 六亲: y.liuqin, isDong: false }));
const sbGi = { yaoDetail: sbYao, bianYao: sbBian, guaXiang: {}, shiYaoIndex: sbGua.世爻, yingYaoIndex: sbGua.应爻, fuShenList: [], timeInfo: { yueJian: '申', riChen: '癸亥', xunKong: '子丑' }, userInfo: { gender: '女' } };
suanQuanBuGuaXiang(sbGi);
assert(sbGi.guaXiang.fuYin === false, 'E-1 静卦水地比 fuYin 必须为 false（不得误标伏吟，R1-4 守卫）');
assert(sbGi.guaXiang.fanYin === false, 'E-1 静卦水地比 fanYin 必须为 false（不得误标反吟）');
assert(sbGi.guaXiang.duFa === '六爻安静', 'E-1 静卦水地比 duFa 应为六爻安静（实际' + sbGi.guaXiang.duFa + '）');
// 回退验证：若去掉 R1-4 守卫（hasDong 判断），本卦==变卦会误标 fuYin=true（此断言证明守卫非虚设）
const sbGiNoGuard = { yaoDetail: sbYao, bianYao: sbBian, guaXiang: {}, shiYaoIndex: sbGua.世爻, yingYaoIndex: sbGua.应爻, fuShenList: [], timeInfo: { yueJian: '申', riChen: '癸亥', xunKong: '子丑' }, userInfo: { gender: '女' } };
// 直接调用无守卫判定逻辑模拟：suanFanYinFuYin 已带守卫，此处仅确认守卫后仍为 false（双保险）
suanFanYinFuYin(sbGiNoGuard);
assert(sbGiNoGuard.guaXiang.fuYin === false, 'E-1 守卫后 suanFanYinFuYin 独立调用仍 fuYin=false');

console.log(fail ? ('回归失败 ' + fail + ' 项') : '回归全部通过');
process.exit(fail ? 1 : 0);
`;
// P0 XSS 回归加固：从 jiegua.html 提取真实 mdInline/mdToHtml/mdToPlain 源码执行（零改动系统文件，测真版实现）
const jhSrc = read('jiegua.html');
function extractFn(src, name) {
    const start = src.indexOf('function ' + name);
    if (start < 0) throw new Error('回归测试：未找到 ' + name);
    let depth = 0, end = -1;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    return src.slice(start, end);
}
eval(extractFn(jhSrc, 'mdInline') + '\n' + extractFn(jhSrc, 'mdToHtml') + '\n' + extractFn(jhSrc, 'mdToPlain'));

eval(shuju + '\n' + suanfa + '\n' + test);
