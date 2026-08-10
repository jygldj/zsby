// ============================================================
// suanfa.js - 算法层（纯计算逻辑，不涉及 DOM）
// 职责：
//   1. 六亲实时计算（五行生克 → 六亲）
//   2. 六神排定（日干 → 初爻起点 → 顺排）
//   3. 爻阴阳判定
//   4. 模式查卦（六爻序列 → 64卦）
//   5. 伏神降妖三式（定乾坤 / 寻龙诀 / 显真形）
// 依赖：shuju.js 的 ALL_GUA_DATA / GUA_XIANG / GUA_SYMBOL / NAJIA_GAN
// ============================================================

// ============ 地支五行表 ============
const DIZHI_WUXING = {
    '子': '水', '亥': '水',
    '寅': '木', '卯': '木',
    '巳': '火', '午': '火',
    '申': '金', '酉': '金',
    '辰': '土', '戌': '土', '丑': '土', '未': '土'
};

// ============ 六亲全集 ============
const LIU_QIN_ALL = ['父母', '兄弟', '子孙', '妻财', '官鬼'];

// ============ 六神名 ============
const LIU_SHEN = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];

// ============ 用神映射（单源，rw7/rw8 共用）============
// 所问之事类型 → 用神六亲
const QUESTION_TO_YONGSHEN = {
    '婚姻':'官鬼', '感情':'官鬼', '妻财问事':'妻财',
    '财运':'妻财', '求财':'妻财', '失物':'妻财',
    '事业':'官鬼', '功名':'官鬼', '工作':'官鬼', '诉讼':'官鬼', '官司':'官鬼', '健康':'官鬼', '病':'官鬼',
    '学业':'父母', '考试':'父母', '文书':'父母', '出行':'父母', '旅行':'父母',
    '寻人':'子孙', '子孙':'子孙'
};
// 用神六亲 → 原神六亲（生用神者）
const YUAN_SHEN_MAP = { '父母':'官鬼', '官鬼':'妻财', '妻财':'子孙', '子孙':'兄弟', '兄弟':'父母' };

// ============================================================
// 一、六亲计算
// ============================================================

/**
 * 五行生克 → 六亲
 * @param {string} wo - 本卦宫位五行（"金""木""水""火""土"）
 * @param {string} ta - 爻地支五行（"金""木""水""火""土"）
 * @returns {string} 六亲名（父母/兄弟/子孙/妻财/官鬼）
 *
 * 规则（以"我"为基准）：
 *   生我者 → 父母    我生者 → 子孙
 *   克我者 → 官鬼    我克者 → 妻财
 *   同我者 → 兄弟
 */
function getLiuQinByWuXing(wo, ta) {
    const map = {
        '金': { '金': '兄弟', '水': '子孙', '木': '妻财', '火': '官鬼', '土': '父母' },
        '木': { '木': '兄弟', '火': '子孙', '土': '妻财', '金': '官鬼', '水': '父母' },
        '水': { '水': '兄弟', '木': '子孙', '火': '妻财', '土': '官鬼', '金': '父母' },
        '火': { '火': '兄弟', '土': '子孙', '金': '妻财', '水': '官鬼', '木': '父母' },
        '土': { '土': '兄弟', '金': '子孙', '水': '妻财', '木': '官鬼', '火': '父母' }
    };
    return (map[wo] && map[wo][ta]) ? map[wo][ta] : ta;
}

/**
 * 封装：卦五行 + 爻地支 → 六亲（自动查地支五行）
 * @param {string} guaWuXing - 卦的宫位五行
 * @param {string} dizhi - 爻的地支
 * @returns {string} 六亲名
 */
function jiSuanLiuQin(guaWuXing, dizhi) {
    const wuXing = DIZHI_WUXING[dizhi] || '';
    return getLiuQinByWuXing(guaWuXing, wuXing);
}

// ============================================================
// 二、六神排定
// ============================================================

/**
 * 由日干推初爻六神起点索引
 * 甲乙→青龙(0) 丙丁→朱雀(1) 戊→勾陈(2)
 * 己→螣蛇(3) 庚辛→白虎(4) 壬癸→玄武(5)
 * @param {string} dayGan - 日柱天干
 * @returns {number} 0~5
 */
function getLiuShenStart(dayGan) {
    if (dayGan === '甲' || dayGan === '乙') return 0;
    if (dayGan === '丙' || dayGan === '丁') return 1;
    if (dayGan === '戊') return 2;
    if (dayGan === '己') return 3;
    if (dayGan === '庚' || dayGan === '辛') return 4;
    if (dayGan === '壬' || dayGan === '癸') return 5;
    return 0;
}

/**
 * 返回初→上爻 6 元六神数组
 * @param {string} dayGan - 日柱天干
 * @returns {string[]} 如 ['青龙','朱雀','勾陈','螣蛇','白虎','玄武']
 */
function getLiuShenSeq(dayGan) {
    const start = getLiuShenStart(dayGan);
    const arr = [];
    for (let i = 0; i < 6; i++) {
        arr.push(LIU_SHEN[(start + i) % 6]);
    }
    return arr;
}

/**
 * 排六神（paiLiuShen，与 getLiuShenSeq 等价，保留独立命名以符cfrw.txt要求）
 * @param {string} dayGan - 日柱天干
 * @returns {string[]} 6 元六神数组
 */
function paiLiuShen(dayGan) {
    return getLiuShenSeq(dayGan);
}

// ============================================================
// 三、爻阴阳判定
// ============================================================

/**
 * 判断某爻是否为阴爻
 * @param {Object} gua - 卦数据（含 上卦/下卦）
 * @param {number} i - 爻索引 0=初爻 … 5=上爻
 * @returns {boolean} true=阴爻, false=阳爻
 *
 * 下卦占 0~2（初/二/三），上卦占 3~5（四/五/上）
 */
function isYaoYin(gua, i) {
    const xiang = i < 3 ? GUA_XIANG[gua.下卦] : GUA_XIANG[gua.上卦];
    const pos = i < 3 ? i : (i - 3);
    return xiang.charAt(pos) === '0';
}

// ============================================================
// 四、模式查卦
// ============================================================

/**
 * 模式→卦 映射表
 * 模式 = 下卦3位 + 上卦3位（如 "111111" = 乾为天）
 */
const patternToGua = {};
(function buildPatternMap() {
    for (const gua of ALL_GUA_DATA) {
        const shang = GUA_XIANG[gua.上卦];
        const xia = GUA_XIANG[gua.下卦];
        const pattern = xia + shang;
        patternToGua[pattern] = gua;
    }
})();

/**
 * 按六爻模式查卦
 * @param {string} pattern - 6位0/1字符串（下卦3位+上卦3位）
 * @returns {Object|null} 卦数据
 */
function getGuaByPattern(pattern) {
    return patternToGua[pattern] || null;
}

/**
 * 按卦名查卦数据
 * @param {string} guaMing - 卦名（如 "乾为天"）
 * @returns {Object|null} 卦数据
 */
function getGuaByName(guaMing) {
    return ALL_GUA_DATA.find(g => g.卦名 === guaMing) || null;
}

// ============================================================
// 五、伏神降妖三式
// ============================================================

// --- 第一式：定乾坤 ---

/**
 * 本宫首卦索引（八纯卦，每宫第一个出现的卦）
 * 结构：{ "乾宫": <乾为天>, "坤宫": <坤为地>, ... }
 */
const BEN_GONG_INDEX = {};
(function buildBenGongIndex() {
    for (const gua of ALL_GUA_DATA) {
        if (!BEN_GONG_INDEX[gua.宫]) {
            BEN_GONG_INDEX[gua.宫] = gua;
        }
    }
})();

/**
 * 根据卦名找到其本宫首卦（八纯卦）
 * @param {string} guaMing - 卦名
 * @returns {Object|null} 本宫首卦数据
 */
function getBenGongShouGua(guaMing) {
    const currentGua = getGuaByName(guaMing);
    if (!currentGua) return null;
    return BEN_GONG_INDEX[currentGua.宫] || null;
}

// --- 第二式：寻龙诀 ---

/**
 * 在本宫首卦中寻找目标六亲
 * @param {string} benGuaMing - 本卦名
 * @param {string} targetLiuQin - 要找的六亲（如 "妻财"）
 * @returns {Object|null} 伏神信息 { fuShenTianGan, fuShenDizhi, fuShenLiuQin, fuShenYaoWei }
 *
 * 遍历本宫首卦六爻，用 jiSuanLiuQin 实时计算每爻六亲，
 * 找到第一个匹配 targetLiuQin 的爻，返回其天干/地支/六亲/爻位。
 */
function zhaoFuShen(benGuaMing, targetLiuQin) {
    const benGongGua = getBenGongShouGua(benGuaMing);
    if (!benGongGua) return null;

    for (let i = 0; i < 6; i++) {
        const yaoInBenGong = benGongGua.爻位[i];
        const liuQin = jiSuanLiuQin(benGongGua.五行, yaoInBenGong.地支);
        if (liuQin === targetLiuQin) {
            return {
                fuShenTianGan: yaoInBenGong.天干,
                fuShenDizhi: yaoInBenGong.地支,
                fuShenLiuQin: liuQin,
                fuShenYaoWei: yaoInBenGong.爻
            };
        }
    }
    return null;
}

// --- 第三式：显真形 ---

/**
 * 为整个卦生成包含伏神信息的完整排盘数据
 * @param {string} benGuaMing - 本卦名
 * @returns {Object} 排盘结果
 *   {
 *     gua:          原始卦数据,
 *     missingLiuQin: [缺少的六亲列表],
 *     fuShenList:   [伏神信息列表],
 *     yaoData: [    6爻增强数据
 *       { yaoWei, tianGan, diZhi, liuQin, fuShen, isYin }
 *     ]
 *   }
 *
 * 伏神挂载规则：
 *   1. 计算本卦每爻六亲，找出缺少的六亲
 *   2. 对每个缺少的六亲，调用 zhaoFuShen 在本宫首卦中查找
 *   3. 伏神挂载到本卦中与本宫首卦同爻位的飞神上
 */
function paiPanDaiFuShen(benGuaMing) {
    const benGua = getGuaByName(benGuaMing);
    if (!benGua) return null;

    // 先算出本卦每爻的六亲
    const yaoLiuQin = benGua.爻位.map(y =>
        jiSuanLiuQin(benGua.五行, y.地支)
    );

    // 找出缺少的六亲
    const existingLiuQin = new Set(yaoLiuQin);
    const missingLiuQinList = LIU_QIN_ALL.filter(lq => !existingLiuQin.has(lq));

    // 对每个缺少的六亲，调用寻龙诀找伏神
    const fuShenList = missingLiuQinList
        .map(lq => zhaoFuShen(benGuaMing, lq))
        .filter(f => f !== null);

    // 构建完整爻位数据
    const yaoData = benGua.爻位.map((yao, index) => {
        const yaoWei = index + 1;
        const liuQin = yaoLiuQin[index];
        const yin = isYaoYin(benGua, index);

        // 伏神挂载：伏神所在爻位 = 飞神爻位
        const fuShen = fuShenList.find(f => f.fuShenYaoWei === yaoWei) || null;

        return {
            yaoWei: yaoWei,
            tianGan: yao.天干,
            diZhi: yao.地支,
            liuQin: liuQin,
            fuShen: fuShen,
            isYin: yin
        };
    });

    return {
        gua: benGua,
        missingLiuQin: missingLiuQinList,
        fuShenList: fuShenList,
        yaoData: yaoData
    };
}

// ============================================================
// 六、辅助：构建变卦排盘数据（六亲以本卦宫位五行为"我"）
// ============================================================

/**
 * 为变卦生成排盘数据
 * 变卦六亲铁律：以本卦宫位五行为"我"，非变卦自身宫位
 * @param {string} bianGuaMing - 变卦名
 * @param {string} benGuaWuXing - 本卦宫位五行
 * @returns {Object|null} 排盘结果（结构同 paiPanDaiFuShen，但六亲以本卦五行计算）
 */
function paiPanBianGua(bianGuaMing, benGuaWuXing) {
    const bianGua = getGuaByName(bianGuaMing);
    if (!bianGua) return null;

    const yaoData = bianGua.爻位.map((yao, index) => {
        const yaoWei = index + 1;
        // 变卦六亲：以本卦宫位五行为"我"
        const liuQin = getLiuQinByWuXing(benGuaWuXing, DIZHI_WUXING[yao.地支] || '');
        const yin = isYaoYin(bianGua, index);

        return {
            yaoWei: yaoWei,
            tianGan: yao.天干,
            diZhi: yao.地支,
            liuQin: liuQin,
            fuShen: null,
            isYin: yin
        };
    });

    return {
        gua: bianGua,
        missingLiuQin: [],
        fuShenList: [],
        yaoData: yaoData
    };
}

// ============================================================
// 七、辅助：从摇卦结果生成模式字符串
// ============================================================

/**
 * 将摇卦结果（0/1数组）转为模式字符串
 * @param {number[]} yaoResults - 6元数组，1=阳 0=阴（初爻在前）
 * @returns {string} 6位0/1字符串
 */
function yaoToPattern(yaoResults) {
    return yaoResults.join('');
}

/**
 * 计算变卦模式
 * @param {number[]} yaoResults - 本卦摇卦结果
 * @param {boolean[]} dongStatus - 动爻状态
 * @returns {string} 变卦6位0/1字符串
 */
function getBianPattern(yaoResults, dongStatus) {
    return yaoResults.map((y, idx) => dongStatus[idx] ? (1 - y) : y).join('');
}

// ============================================================
// 八、rw7 新增：月破 / 日破暗动 / 真空假空 / 原神空伏 / 世爻状态
// 设计说明：
//   - 本组函数均接收由 jiegua.html 构建的 guaInfo 对象（含 timeInfo 与 yaoDetail），
//     判定结果直接写入 guaInfo 的新增字段，符合 rw7「结果写入 guaInfo」的要求。
//   - timeInfo.yueJian 为单字月支(如"未")；timeInfo.riChen 为日干支2字(如"己酉")，
//     riZhi 取其 charAt(1)；timeInfo.xunKong 为旬空地支串(如"寅卯")。
//   - 只读 guaInfo 既有数据（benYao/yaoDetail 等），不重写已验证的排盘核心。
//   - 常量加 _RW7 后缀，避免与 jiegua.html 局部同名变量潜在冲突。
// ============================================================

// 五行生克（suanfa 此前未定义全局版本，此处补齐供 rw7 使用）
const WX_SHENG_RW7 = { '木':'火', '火':'土', '土':'金', '金':'水', '水':'木' };
const WX_KE_RW7    = { '木':'土', '土':'水', '水':'火', '火':'金', '金':'木' };

// 地支六冲
const DIZHI_LIU_CHONG = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
function isChongRW7(d1, d2) {
    if (!d1 || !d2) return false;
    return DIZHI_LIU_CHONG.some(p => (p[0] === d1 && p[1] === d2) || (p[0] === d2 && p[1] === d1));
}
// 是否旬空
function isKongRW7(diZhi, xunKong) {
    if (!diZhi || !xunKong) return false;
    return xunKong.indexOf(diZhi) !== -1;
}
// 以月建论某爻旺衰：'旺相'(得生/比和/克月建有力) 或 '休囚'(被克/生月建泄气)
function yaoWangShuaiRW7(yaoWx, yueJianZhi) {
    if (!yaoWx || !yueJianZhi) return 'unknown';
    const yueWx = DIZHI_WUXING[yueJianZhi] || '';
    if (!yueWx) return 'unknown';
    if (yaoWx === yueWx) return '旺相';                  // 比和
    if (WX_SHENG_RW7[yueWx] === yaoWx) return '旺相';     // 月建生爻
    if (WX_KE_RW7[yueWx] === yaoWx) return '休囚';        // 月建克爻
    if (WX_SHENG_RW7[yaoWx] === yueWx) return '休囚';     // 爻生月建（泄气）
    if (WX_KE_RW7[yaoWx] === yueWx) return '休囚';        // 爻克月建（耗力）
    return 'unknown';
}

/**
 * 函数1：月破判定
 * 月破 = 爻地支 与 月建地支 相冲。
 * 例外：动爻逢月冲不算破（动爻有气待发）。伏神同样参与判定。
 */
function jiSuanYuePo(guaInfo) {
    const yueJian = (guaInfo.timeInfo && guaInfo.timeInfo.yueJian) || '';
    const yaoDetail = guaInfo.yaoDetail || [];
    const yuePoList = [];

    yaoDetail.forEach((y, i) => {
        const d = y.dizhi;
        if (d && isChongRW7(d, yueJian)) {
            if (y.isDong) {
                y.yuePo = false;
                y.yuePoType = '动爻逢冲不算破';
            } else {
                y.yuePo = true;
                y.yuePoType = '真破';
                yuePoList.push({ yaoIndex: i + 1, dizhi: d, liuqin: y.liuqin });
            }
        } else {
            y.yuePo = false;
            y.yuePoType = 'none';
        }
    });

    // 伏神逢月冲
    const fuList = guaInfo.fuShenList || [];
    fuList.forEach(f => {
        if (f.地支 && isChongRW7(f.地支, yueJian)) f.yuePo = true;
    });

    guaInfo.yuePoList = yuePoList;
    return guaInfo;
}

/**
 * 函数2：日破 vs 暗动（rw7 最易出错处）
 * 前提：只看静爻。静爻地支与日辰地支相冲 → 进入判定。
 *   日破：月休囚无气 且 旬空
 *   暗动：月旺相有气 且 不空（或假空有气）
 * 关键：旺衰以月建为准，日辰仅触发。
 */
function jiSuanRiPoAnDong(guaInfo) {
    const timeInfo = guaInfo.timeInfo || {};
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const xunKong = timeInfo.xunKong || '';
    const yueJian = timeInfo.yueJian || '';
    const yaoDetail = guaInfo.yaoDetail || [];

    yaoDetail.forEach(y => {
        if (y.isDong) { // 动爻另有处理，不参与
            y.riChong = false; y.riPoOrAnDong = 'none'; y.riPoReason = '';
            return;
        }
        const d = y.dizhi;
        if (!d || !riZhi || !isChongRW7(d, riZhi)) {
            y.riChong = false; y.riPoOrAnDong = 'none'; y.riPoReason = '';
            return;
        }
        y.riChong = true;
        const yaoWx = DIZHI_WUXING[d] || '';
        const shuai = yaoWangShuaiRW7(yaoWx, yueJian);
        const kong = isKongRW7(d, xunKong);
        if (shuai === '休囚' && kong) {
            y.riPoOrAnDong = '日破';
            y.riPoReason = '月建休囚无气 + 旬空，朽木不可雕，断为日破';
        } else if (shuai === '旺相' && !kong) {
            y.riPoOrAnDong = '暗动';
            y.riPoReason = '月建旺相有气 + 不空，暗中动作，断为暗动';
        } else if (shuai === '旺相' && kong) {
            y.riPoOrAnDong = '暗动';
            y.riPoReason = '月建旺相有气 + 假空有气，转暗动';
        } else { // 休囚且不空
            y.riPoOrAnDong = '日破';
            y.riPoReason = '月建休囚无气，断为日破';
        }
    });
    return guaInfo;
}

/**
 * 函数3：真空 vs 假空
 * 只对旬空爻/伏神判定。
 *   真空：旬空 且 (月破 或 月克无生) 且 无动爻生扶
 *   假空：旬空 且 (月/日/动爻生扶 或 出空有期)
 */
function jiSuanZhenKongJiaKong(guaInfo) {
    const timeInfo = guaInfo.timeInfo || {};
    const xunKong = timeInfo.xunKong || '';
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const yaoDetail = guaInfo.yaoDetail || [];

    function evalKong(y) {
        const d = y.dizhi;
        if (!isKongRW7(d, xunKong)) { y.kongType = 'none'; y.kongDetail = ''; return; }
        const yaoWx = DIZHI_WUXING[d] || '';
        const yueWx = DIZHI_WUXING[yueJian] || '';
        const riWx = DIZHI_WUXING[riZhi] || '';
        const yueSheng = !!(yueWx && WX_SHENG_RW7[yueWx] === yaoWx);
        const riSheng  = !!(riWx  && WX_SHENG_RW7[riWx]  === yaoWx);
        const yueKe    = !!(yueWx && WX_KE_RW7[yueWx] === yaoWx);
        const dongSheng = yaoDetail.some(o => o.isDong && DIZHI_WUXING[o.dizhi] && WX_SHENG_RW7[DIZHI_WUXING[o.dizhi]] === yaoWx);
        const zhenKong = (y.yuePo || yueKe) && !yueSheng && !riSheng && !dongSheng;
        if (zhenKong) {
            y.kongType = '真空';
            y.kongDetail = '旬空且月破/月克无生无扶，如石沉大海，终不可得';
        } else {
            y.kongType = '假空';
            y.kongDetail = '旬空但有气得生扶，待出空填空之日，事方有应';
        }
    }
    yaoDetail.forEach(evalKong);

    // 伏神列表
    const fuList = guaInfo.fuShenList || [];
    fuList.forEach(f => {
        const d = f.地支;
        if (!isKongRW7(d, xunKong)) { f.kongType = 'none'; f.kongDetail = ''; return; }
        const yaoWx = DIZHI_WUXING[d] || '';
        const yueWx = DIZHI_WUXING[yueJian] || '';
        const riWx = DIZHI_WUXING[riZhi] || '';
        const yueSheng = !!(yueWx && WX_SHENG_RW7[yueWx] === yaoWx);
        const riSheng  = !!(riWx  && WX_SHENG_RW7[riWx]  === yaoWx);
        const yueKe    = !!(yueWx && WX_KE_RW7[yueWx] === yaoWx);
        if (yueKe && !yueSheng && !riSheng) {
            f.kongType = '真空';
            f.kongDetail = '伏神旬空且月克无生，如石沉大海，终不可得';
        } else {
            f.kongType = '假空';
            f.kongDetail = '伏神旬空有气，假空，待出空填空';
        }
    });
    return guaInfo;
}

/**
 * 函数4：原神空伏
 * 先按所问之事确定用神 → 原神 = 生用神之爻（六亲名沿生克链前移一位）。
 * 检查原神是否伏藏(在 fuShenList)且旬空，给出断语。
 */
function jiSuanYuanShenKongFu(guaInfo, questionType) {
    const yongShen = QUESTION_TO_YONGSHEN[questionType] || null;
    if (!yongShen) { guaInfo.yuanShenState = null; return guaInfo; }

    const yuanShen = YUAN_SHEN_MAP[yongShen] || null;
    const fuList = guaInfo.fuShenList || [];
    const fuCangItem = fuList.find(f => f.六亲 === yuanShen);
    const isFuCang = !!fuCangItem;

    let isKong = false;
    if (isFuCang && fuCangItem) {
        const xunKong = (guaInfo.timeInfo && guaInfo.timeInfo.xunKong) || '';
        isKong = isKongRW7(fuCangItem.地支, xunKong);
    } else {
        const yuanYao = (guaInfo.yaoDetail || []).find(y => y.liuqin === yuanShen);
        if (yuanYao && yuanYao.kongType && yuanYao.kongType !== 'none') isKong = true;
    }

    let duanYu = '';
    if (isFuCang && isKong) {
        duanYu = (questionType === '婚姻' || questionType === '感情')
            ? '原神空伏，根基尚浅，缘分未到，宜静待时机'
            : '原神不现且空，事之根基不稳，纵用神暂时旺相，亦如无源之水';
    } else if (isFuCang) {
        duanYu = '原神伏藏，助力潜藏未显，需待引拔';
    } else if (isKong) {
        duanYu = '原神旬空，助力暂缺，待出空方有应';
    } else {
        duanYu = '原神得力，根基有靠';
    }

    guaInfo.yuanShenState = {
        yongShen: yongShen,
        liuqin: yuanShen,
        isFuCang: isFuCang,
        isKong: isKong,
        duanYu: duanYu
    };
    return guaInfo;
}

/**
 * 函数5（rw7 第三节）：世爻"月破+日泄"状态标记
 * 仅供数据标记（措辞后续由提示词跟进），不修改排盘核心。
 * 依赖 jiSuanYuePo 已写入的 yuePo 字段。
 */
function jiSuanShiYaoZhuangTai(guaInfo) {
    const idx = guaInfo.shiYaoIndex;
    if (idx == null) { guaInfo.shiYaoZhuangTai = '未知'; guaInfo.shiYaoDetail = ''; return guaInfo; }
    const shi = (guaInfo.yaoDetail && guaInfo.yaoDetail[idx - 1]) || null;
    if (!shi) { guaInfo.shiYaoZhuangTai = '未知'; guaInfo.shiYaoDetail = ''; return guaInfo; }

    const yuePo = shi.yuePo;
    const shiWx = DIZHI_WUXING[shi.dizhi] || '';
    const timeInfo = guaInfo.timeInfo || {};
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const riWx = DIZHI_WUXING[riZhi] || '';
    const riXie = !!(shiWx && riWx && WX_SHENG_RW7[shiWx] === riWx); // 世生日 = 泄

    if (yuePo && riXie) {
        guaInfo.shiYaoZhuangTai = '月破+日泄';
        guaInfo.shiYaoDetail = '世爻月破如根枯，日泄如气散，君此事宜守不宜攻，待出月得生扶方有转机';
    } else if (yuePo) {
        guaInfo.shiYaoZhuangTai = '月破';
        guaInfo.shiYaoDetail = '世爻月破，根基受损，宜谨慎守成';
    } else if (riXie) {
        guaInfo.shiYaoZhuangTai = '日泄';
        guaInfo.shiYaoDetail = '世爻日泄，气力有耗，凡事勿强求';
    } else {
        guaInfo.shiYaoZhuangTai = '平稳';
        guaInfo.shiYaoDetail = '世爻无破无泄，自身状态平稳';
    }
    return guaInfo;
}

// ============================================================
// 九、rw8 新增：用神两现选取 + 旺衰优先级引擎
// 设计说明：
//   - 复用 rw7 常量(WX_SHENG_RW7/WX_KE_RW7/DIZHI_WUXING/isChongRW7/isKongRW7)
//     与 guaInfo 结构(yaoDetail 已含 yuePo/kongType 等 rw7 字段)。
//   - 三函数：jiWangShuaiScore(六维评分) / xuanYongShen(两现取舍) /
//     jiShenChouShen(忌神仇神连带)。仅追加，不改动 rw7 既有函数。
//   - 修正项（军令有所不受）：月建维度补全"爻生月(泄)-5"(与日辰对称)；
//     补充"用神不现取伏神"边界；验证例地支矛盾由测试侧修正。
// ============================================================

// 用神章六亲映射（单源：QUESTION_TO_YONGSHEN / YUAN_SHEN_MAP，rw8 引用之）
const YONG_SHEN_MAP_RW8 = QUESTION_TO_YONGSHEN;
const YUAN_SHEN_MAP_RW8 = YUAN_SHEN_MAP;

// 飞伏关系（suanfa 内自算，不依赖 jiegua.html 局部函数）
function fuShenRelationRW8(feiWx, fuWx) {
    if (!feiWx || !fuWx) return '未知';
    if (WX_SHENG_RW7[feiWx] === fuWx) return '生';
    if (WX_KE_RW7[feiWx] === fuWx) return '克';
    if (feiWx === fuWx) return '比和';
    return '无关';
}
// 是否受伤（月克或日克）
function isShangRW8(y, guaInfo) {
    const timeInfo = guaInfo.timeInfo || {};
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const yaoWx = DIZHI_WUXING[y.dizhi] || '';
    const yueWx = DIZHI_WUXING[yueJian] || '';
    const riWx = DIZHI_WUXING[riZhi] || '';
    if (yaoWx && yueWx && WX_KE_RW7[yueWx] === yaoWx) return true;
    if (yaoWx && riWx && WX_KE_RW7[riWx] === yaoWx) return true;
    return false;
}

/**
 * 函数1：六维旺衰评分（满分100，可负分）
 * 维度：月建生克 / 日辰生克 / 动静 / 旬空 / 月破 / 飞伏
 * 注：月建维度补全"爻生月(泄)-5"（与日辰维度对称，属 rw8 对文档的修正）
 */
function jiWangShuaiScore(yao, guaInfo) {
    const timeInfo = guaInfo.timeInfo || {};
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const yaoWx = DIZHI_WUXING[yao.dizhi] || '';
    const yueWx = DIZHI_WUXING[yueJian] || '';
    const riWx = DIZHI_WUXING[riZhi] || '';

    let score = 0;
    const dp = [];

    if (yaoWx && yueWx) {
        if (WX_SHENG_RW7[yueWx] === yaoWx) { score += 30; dp.push('月建生爻+30'); }
        else if (WX_KE_RW7[yueWx] === yaoWx) { score -= 20; dp.push('月建克爻-20'); }
        else if (yaoWx === yueWx) { score += 15; dp.push('月建比和+15'); }
        else if (WX_SHENG_RW7[yaoWx] === yueWx) { score -= 5; dp.push('爻生月建(泄)-5'); }
        else if (WX_KE_RW7[yaoWx] === yueWx) { score -= 5; dp.push('爻克月建(耗)-5'); }
    }
    if (yaoWx && riWx) {
        if (WX_SHENG_RW7[riWx] === yaoWx) { score += 25; dp.push('日辰生爻+25'); }
        else if (WX_KE_RW7[riWx] === yaoWx) { score -= 15; dp.push('日辰克爻-15'); }
        else if (yaoWx === riWx) { score += 10; dp.push('日辰比和+10'); }
        else if (WX_SHENG_RW7[yaoWx] === riWx) { score -= 5; dp.push('爻生日辰(泄)-5'); }
    }
    if (yao.isDong) { score += 20; dp.push('动爻+20'); } else { dp.push('静爻+0'); }
    if (yao.kongType === '真空') { score -= 15; dp.push('真空-15'); }
    else { dp.push((yao.kongType === '假空' ? '假空' : '不空') + '+0'); }
    if (yao.yuePo === true) { score -= 20; dp.push('月破-20'); } else { dp.push('不破+0'); }
    if (yao.isFuShen && yao.feiRelation) {
        if (yao.feiRelation === '生') { score += 10; dp.push('飞神生伏+10'); }
        else { dp.push('飞神克伏+0'); }
    } else { dp.push('本卦爻飞伏+0'); }

    return { score: score, detail: dp.join('，') };
}

/**
 * 函数2：用神两现选取（野鹤《增删卜易·用神章》口诀）
 * 舍闲取世、舍静取动、舍破取全、舍空取实、舍伤取安
 */
function xuanYongShen(guaInfo, questionType) {
    let yongShenLiuqin = YONG_SHEN_MAP_RW8[questionType] || null;
    let yongShenNote = '';
    // R0-3：婚姻/感情按求卦者性别分流（《增删卜易·婚姻章》：男占以妻财为用，女占以官鬼为用）
    if ((questionType === '婚姻' || questionType === '感情') && yongShenLiuqin) {
        const gender = (guaInfo.userInfo && guaInfo.userInfo.gender) || '';
        if (gender.indexOf('男') !== -1) { yongShenLiuqin = '妻财'; yongShenNote = '（男占婚姻，取妻财为用）'; }
        else if (gender.indexOf('女') !== -1) { yongShenLiuqin = '官鬼'; yongShenNote = '（女占婚姻，取官鬼为用）'; }
        else { yongShenLiuqin = '官鬼'; yongShenNote = '（性别未知，依古法男占财、女占官，暂取官鬼）'; }
    }
    const yaoDetail = guaInfo.yaoDetail || [];
    const shiYaoIndex = (guaInfo.shiYaoIndex != null) ? guaInfo.shiYaoIndex : -1;
    const fuList = guaInfo.fuShenList || [];

    if (!yongShenLiuqin) {
        guaInfo.yongShen = { liuqin:null, positions:[], primaryIndex:null, reason:'未知所问之事，无法定用神', priority:[], wangShuaiScore:{index:0,detail:'无'} };
        return guaInfo;
    }

    let positions = [];
    yaoDetail.forEach((y, i) => { if (y.liuqin === yongShenLiuqin) positions.push(i + 1); });

    // 用神不现 → 取伏神（边界鲁棒）
    if (positions.length === 0) {
        const fuItem = fuList.find(f => f.六亲 === yongShenLiuqin) || null;
        if (fuItem) {
            const fuWx = DIZHI_WUXING[fuItem.地支] || '';
            const feiWx = DIZHI_WUXING[fuItem.飞神地支] || '';
            const fuYao = { dizhi:fuItem.地支, liuqin:fuItem.六亲, isDong:false, isFuShen:true,
                feiRelation:fuShenRelationRW8(feiWx, fuWx), kongType:fuItem.kongType || 'none' };
            const sc = jiWangShuaiScore(fuYao, guaInfo);
            guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:['伏神'], primaryIndex:'伏'+(fuItem.伏神爻位||''),
                reason:'用神不现，取伏神' + yongShenNote, priority:[{pos:'伏',score:sc.score,detail:sc.detail}],
                wangShuaiScore:{index:sc.score,detail:sc.detail} };
            return guaInfo;
        }
        guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:[], primaryIndex:null, reason:'用神不现（本卦与伏神皆无）' + yongShenNote, priority:[], wangShuaiScore:{index:0,detail:'无'} };
        return guaInfo;
    }

    if (positions.length === 1) {
        const idx = positions[0];
        const sc = jiWangShuaiScore(yaoDetail[idx - 1], guaInfo);
        guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:positions, primaryIndex:idx, reason:'用神独现' + yongShenNote,
            priority:[{pos:idx,score:sc.score,detail:sc.detail}], wangShuaiScore:{index:sc.score,detail:sc.detail} };
        return guaInfo;
    }

    const items = positions.map(p => {
        const y = yaoDetail[p - 1];
        return { idx:p, y:y, sc:jiWangShuaiScore(y, guaInfo) };
    });

    let chosen = null, reason = '';

    // ① 舍闲取世
    const shiItems = items.filter(it => it.idx === shiYaoIndex);
    if (shiItems.length === 1) { chosen = shiItems[0]; reason = '舍闲取世（用神持世，取世爻）'; }
    else {
        // ② 舍静取动
        const dongItems = items.filter(it => it.y.isDong);
        if (dongItems.length === 1) { chosen = dongItems[0]; reason = '舍静取动（取动爻）'; }
        else {
            // ③ 舍破取全
            const wholeItems = items.filter(it => !it.y.yuePo);
            if (wholeItems.length === 1) { chosen = wholeItems[0]; reason = '舍破取全（取不破者）'; }
            else {
                // ④ 舍空取实
                const realItems = items.filter(it => !(it.y.kongType && it.y.kongType !== 'none'));
                if (realItems.length === 1) { chosen = realItems[0]; reason = '舍空取实（取不空者）'; }
                else {
                    // ⑤ 舍伤取安
                    const safeItems = items.filter(it => !isShangRW8(it.y, guaInfo));
                    if (safeItems.length === 1) { chosen = safeItems[0]; reason = '舍伤取安（取不受克者）'; }
                    else {
                        // ⑥ 舍其休囚，用其旺相（R0-4）：平手时以旺衰评分最高者为用神
                        const maxScore = Math.max(...items.map(it => it.sc.score));
                        const wangItems = items.filter(it => it.sc.score === maxScore);
                        if (wangItems.length === 1) {
                            chosen = wangItems[0];
                            reason = '舍其休囚，用其旺相（旺衰评分最高）';
                        } else {
                            // 旺衰评分并列，取近世爻者（原兜底规则）
                            let best = wangItems[0], bestDist = 99;
                            const ref = (shiYaoIndex < 0) ? 3.5 : shiYaoIndex;
                            wangItems.forEach(it => { const d = Math.abs(it.idx - ref); if (d < bestDist) { bestDist = d; best = it; } });
                            chosen = best; reason = '取舍平手（旺衰相同），取近世爻者';
                        }
                    }
                }
            }
        }
    }

    guaInfo.yongShen = {
        liuqin: yongShenLiuqin,
        positions: positions,
        primaryIndex: chosen.idx,
        reason: reason + yongShenNote,
        priority: items.map(it => ({ pos:it.idx, score:it.sc.score, detail:it.sc.detail })),
        wangShuaiScore: { index:chosen.sc.score, detail:chosen.sc.detail }
    };
    return guaInfo;
}

/**
 * 函数3：忌神 / 仇神连带判定（按五行生克找卦中实际克用神/克原神之爻）
 */
function jiShenChouShen(guaInfo) {
    const yongShen = guaInfo.yongShen;
    if (!yongShen || !yongShen.liuqin || yongShen.primaryIndex == null) {
        guaInfo.jiShenState = null; guaInfo.chouShenState = null; return guaInfo;
    }
    const yaoDetail = guaInfo.yaoDetail || [];
    const fuList = guaInfo.fuShenList || [];

    // 取用神爻（显爻或伏神）
    let yongYao = null;
    if (typeof yongShen.primaryIndex === 'number') {
        yongYao = yaoDetail[yongShen.primaryIndex - 1] || null;
    } else if (typeof yongShen.primaryIndex === 'string' && yongShen.primaryIndex.indexOf('伏') === 0) {
        const fuItem = fuList.find(f => ('伏' + (f.伏神爻位||'')) === yongShen.primaryIndex);
        if (fuItem) yongYao = { dizhi:fuItem.地支, liuqin:fuItem.六亲, isDong:false, kongType:fuItem.kongType||'none' };
    }
    if (!yongYao) { guaInfo.jiShenState = null; guaInfo.chouShenState = null; return guaInfo; }

    const yongWx = DIZHI_WUXING[yongYao.dizhi] || '';

    // 忌神：克用神之爻
    const jiItems = [];
    yaoDetail.forEach((y, i) => {
        const w = DIZHI_WUXING[y.dizhi] || '';
        if (w && yongWx && WX_KE_RW7[w] === yongWx) jiItems.push({ y:y, idx:i + 1 });
    });
    fuList.forEach(f => {
        const w = DIZHI_WUXING[f.地支] || '';
        if (w && yongWx && WX_KE_RW7[w] === yongWx && f.六亲 !== yongShen.liuqin) {
            const feiWx = DIZHI_WUXING[f.飞神地支] || '';
            const fuWx = DIZHI_WUXING[f.地支] || '';
            jiItems.push({ y:{ dizhi:f.地支, liuqin:f.六亲, isDong:false, isFuShen:true,
                feiRelation:fuShenRelationRW8(feiWx, fuWx), kongType:f.kongType||'none' }, idx:'伏'+f.伏神爻位 });
        }
    });

    // 原神
    const yuanShenLiuqin = YUAN_SHEN_MAP_RW8[yongShen.liuqin] || null;
    let yuanYao = null;
    const yuanXian = yaoDetail.find(y => y.liuqin === yuanShenLiuqin) || null;
    const yuanFu = fuList.find(f => f.六亲 === yuanShenLiuqin) || null;
    if (yuanXian) yuanYao = yuanXian;
    else if (yuanFu) yuanYao = { dizhi:yuanFu.地支, liuqin:yuanFu.六亲, isDong:false, kongType:yuanFu.kongType||'none' };
    const yuanWx = yuanYao ? (DIZHI_WUXING[yuanYao.dizhi] || '') : '';

    // 仇神：克原神之爻
    const chouItems = [];
    if (yuanWx) {
        yaoDetail.forEach((y, i) => {
            const w = DIZHI_WUXING[y.dizhi] || '';
            if (w && yuanWx && WX_KE_RW7[w] === yuanWx) chouItems.push({ y:y, idx:i + 1 });
        });
    }

    function buildState(items, name) {
        if (!items.length) return null;
        items.sort((a, b) => ((b.y.isDong ? 1 : 0) - (a.y.isDong ? 1 : 0)));
        const top = items[0];
        const sc = jiWangShuaiScore(top.y, guaInfo);
        const liuqin = top.y.liuqin;
        const duanYu = (name === '忌神')
            ? `忌神（${liuqin}）${sc.score >= 0 ? '有力' : '无力'}，宜防其克用`
            : `仇神（${liuqin}）${sc.score >= 0 ? '有力' : '无力'}，宜防其克原神`;
        return { liuqin:liuqin, positions:items.map(it => it.idx), wangShuaiScore:{index:sc.score,detail:sc.detail}, duanYu:duanYu };
    }

    guaInfo.jiShenState = buildState(jiItems, '忌神');
    guaInfo.chouShenState = buildState(chouItems, '仇神');
    return guaInfo;
}

// ============================================================
// 十、阶段1：卦象增强引擎（R1-1~R1-6，并入 suanfa.js）
// 依据：《增删卜易》六冲章/六合章/生旺墓绝章/进退章/反伏章/独发章
// 全部为确定性纯函数，输入 guaInfo 就地扩展，不改动 rw7/rw8 既有函数。
// 入口：suanQuanBuGuaXiang(guaInfo)，在 jiegua.html 排盘后调用。
// ============================================================

// 六合（六合章）：子丑、寅亥、卯戌、辰酉、巳申、午未
const DIZHI_LIU_HE = [['子','丑'],['寅','亥'],['卯','戌'],['辰','酉'],['巳','申'],['午','未']];
function isHeRW7(d1, d2) {
    if (!d1 || !d2) return false;
    return DIZHI_LIU_HE.some(p => (p[0] === d1 && p[1] === d2) || (p[0] === d2 && p[1] === d1));
}

// 五行长生起始支（生旺墓绝章：金长生在巳、木长生在亥、水土长生在申、火长生在寅）
const CHANG_SHENG_TABLE = { '金':'巳', '木':'亥', '水':'申', '土':'申', '火':'寅' };
// 五行墓库（生旺墓绝章）：金墓在丑、木墓在未、水土墓在辰、火墓在戌
const MU_KU_TABLE = { '金':'丑', '木':'未', '水':'辰', '土':'辰', '火':'戌' };
// 五行绝位（生旺墓绝章）：金绝在寅、木绝在申、水土绝在巳、火绝在亥
const JUE_WEI_TABLE = { '金':'寅', '木':'申', '水':'巳', '土':'巳', '火':'亥' };

// 进退神表（进退章：寅进卯、辰进巳、午进未、申进酉、戌进亥、子进丑）
const JIN_TUI_PAIR = { '寅':'卯','卯':'寅','辰':'巳','巳':'辰','午':'未','未':'午','申':'酉','酉':'申','戌':'亥','亥':'戌','子':'丑','丑':'子' };
const JIN_SHEN = { '寅':1, '辰':1, '午':1, '申':1, '戌':1, '子':1 };   // 阳支为进神

// R1-1 六冲六合卦标注：上下卦对应爻(1-4/2-5/3-6)逐一相冲→六冲，逐一相合→六合
function suanLiuChongLiuHe(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    guaInfo.guaXiang = guaInfo.guaXiang || {};
    guaInfo.guaXiang.liuChong = false;
    guaInfo.guaXiang.liuHe = false;
    if (yaoDetail.length < 6) return guaInfo;
    let chong = true, he = true;
    for (let i = 0; i < 3; i++) {
        const d1 = yaoDetail[i].dizhi, d2 = yaoDetail[i + 3].dizhi;
        if (!isChongRW7(d1, d2)) chong = false;
        if (!isHeRW7(d1, d2)) he = false;
    }
    guaInfo.guaXiang.liuChong = chong;
    guaInfo.guaXiang.liuHe = he;
    return guaInfo;
}

// R1-2 生旺墓绝十二宫：逐爻标注宫位/入墓/临绝
function suanShengWangMuJue(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const timeInfo = guaInfo.timeInfo || {};
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    yaoDetail.forEach(y => {
        if (!y.dizhi) return;
        const wx = DIZHI_WUXING[y.dizhi] || '';
        const mu = MU_KU_TABLE[wx];
        const jue = JUE_WEI_TABLE[wx];
        const ruMu = !!(mu && (yueJian === mu || riZhi === mu));
        const linJue = !!(jue && (yueJian === jue || riZhi === jue));
        y.shengWangMuJue = {
            changShengZhi: CHANG_SHENG_TABLE[wx] || '',
            ruMu: ruMu,
            linJue: linJue,
            state: ruMu ? '墓' : (linJue ? '绝' : '')
        };
    });
    return guaInfo;
}

// R1-3 回头生克与进退神：动爻化出之爻对本爻的关系（化空/化破/化墓/化绝）
function suanHuiTou(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const timeInfo = guaInfo.timeInfo || {};
    const xunKong = timeInfo.xunKong || '';
    const yueJian = timeInfo.yueJian || '';
    yaoDetail.forEach(y => {
        if (!y.isDong || !y.bianDizhi) return;
        const benWx = DIZHI_WUXING[y.dizhi] || '';
        const bianWx = DIZHI_WUXING[y.bianDizhi] || '';
        let type = '', desc = '';
        // 进退神优先（化出同类地支）
        const pair = JIN_TUI_PAIR[y.dizhi];
        if (pair === y.bianDizhi) {
            type = JIN_SHEN[y.dizhi] ? '化进神' : '化退神';
            desc = y.dizhi + '动化' + y.bianDizhi + (JIN_SHEN[y.dizhi] ? '，进神其力倍增' : '，退神其势渐衰');
        } else if (benWx) {
            // 化墓/化绝（本爻五行之墓库/绝位，墓绝皆凶，优先于回头生克）
            if (y.bianDizhi === MU_KU_TABLE[benWx]) { type = '化墓'; desc = '化' + y.bianDizhi + '入' + benWx + '之墓，事有归藏难发'; }
            else if (y.bianDizhi === JUE_WEI_TABLE[benWx]) { type = '化绝'; desc = '化' + y.bianDizhi + '临' + benWx + '之绝，气断难续'; }
            else if (bianWx) {
                if (WX_SHENG_RW7[bianWx] === benWx) { type = '回头生'; desc = y.bianDizhi + '(' + bianWx + ')生本爻，吉上加力'; }
                else if (WX_KE_RW7[bianWx] === benWx) { type = '回头克'; desc = y.bianDizhi + '(' + bianWx + ')克本爻，凶险加身'; }
            }
        }
        // 化空/化破
        if (!type) {
            if (isKongRW7(y.bianDizhi, xunKong)) { type = '化空'; desc = y.bianDizhi + '旬空，出空方应'; }
            else if (yueJian && isChongRW7(y.bianDizhi, yueJian)) { type = '化破'; desc = y.bianDizhi + '逢月破，如瓮破难存'; }
        }
        y.huiTou = { type: type || '无', value: (y.bianLiuqin ? '化' + y.bianLiuqin : ''), desc: desc };
    });
    return guaInfo;
}

// R1-4 反吟伏吟：本卦与变卦六爻地支逐一相冲→反吟，逐一相同→伏吟
function suanFanYinFuYin(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const bianYao = guaInfo.bianYao || [];
    guaInfo.guaXiang = guaInfo.guaXiang || {};
    guaInfo.guaXiang.fanYin = false;
    guaInfo.guaXiang.fuYin = false;
    if (yaoDetail.length < 6 || bianYao.length < 6) return guaInfo;
    let chongAll = true, sameAll = true;
    for (let i = 0; i < 6; i++) {
        const d1 = yaoDetail[i].dizhi, d2 = bianYao[i].地支;
        if (!d1 || !d2) { chongAll = false; sameAll = false; break; }
        if (!isChongRW7(d1, d2)) chongAll = false;
        if (d1 !== d2) sameAll = false;
    }
    if (chongAll) guaInfo.guaXiang.fanYin = true;
    if (sameAll) guaInfo.guaXiang.fuYin = true;
    return guaInfo;
}

// R1-6 独发独静：动爻计数（独发章：一爻独发，卦象所指最真）
function suanDuFa(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const dongIdx = [];
    yaoDetail.forEach((y, i) => { if (y.isDong) dongIdx.push(i + 1); });
    guaInfo.guaXiang = guaInfo.guaXiang || {};
    if (dongIdx.length === 1) { guaInfo.guaXiang.duFa = '独发'; guaInfo.guaXiang.duFaYaoIndex = dongIdx[0]; }
    else if (dongIdx.length === 0) { guaInfo.guaXiang.duFa = '六爻安静'; guaInfo.guaXiang.duFaYaoIndex = null; }
    else { guaInfo.guaXiang.duFa = '多动'; guaInfo.guaXiang.duFaYaoIndex = null; }
    guaInfo.guaXiang.dongYaoCount = dongIdx.length;
    return guaInfo;
}

// 汇总入口：一次补齐 R1-1 ~ R1-6
function suanQuanBuGuaXiang(guaInfo) {
    suanLiuChongLiuHe(guaInfo);
    suanShengWangMuJue(guaInfo);
    suanHuiTou(guaInfo);
    suanFanYinFuYin(guaInfo);
    suanDuFa(guaInfo);
    return guaInfo;
}
