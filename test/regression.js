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
assert(g.duanGua && g.duanGua.chain.length >= 8 && ['吉','中','凶'].indexOf(g.duanGua.jiXiong) !== -1, '冒烟 断卦链+吉凶判定');
assert(g.duanGua.chain.some(c => c.jueJu === '察门类'), '冒烟 断卦链含察门类步');
assert(g.yingqi === null || (g.yingqi.items && g.yingqi.items.length > 0), '冒烟 应期引擎结构合法');

console.log(fail ? ('回归失败 ' + fail + ' 项') : '回归全部通过');
process.exit(fail ? 1 : 0);
`;
eval(shuju + '\n' + suanfa + '\n' + test);
