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
    '疾病':'官鬼', '行人归期':'子孙', '子嗣胎孕':'子孙', '家宅迁移':'父母', '终身财福':'妻财', '趋避防灾':'官鬼',
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
    // 乙·疾病门代问亲属分流（第三批·三类）：父病→父母、妻病→妻财、子病→子孙为用；兄弟留第四批
    if (questionType === '疾病') {
        const daiWen = (guaInfo.userInfo && guaInfo.userInfo.daiWen) || '自己';
        if (daiWen === '父母') { yongShenLiuqin = '父母'; yongShenNote = '（代问父母病，取父母为用）'; }
        else if (daiWen === '妻财') { yongShenLiuqin = '妻财'; yongShenNote = '（代问配偶病，取妻财为用）'; }
        else if (daiWen === '子孙') { yongShenLiuqin = '子孙'; yongShenNote = '（代问子女病，取子孙为用）'; }
    }
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
        guaInfo.yongShen = { liuqin:null, positions:[], primaryIndex:null, dizhi:null, reason:'未知所问之事，无法定用神', priority:[], wangShuaiScore:{index:0,detail:'无'} };
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
            guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:['伏神'], primaryIndex:'伏'+(fuItem.伏神爻位||''), dizhi: fuItem.地支,
                reason:'用神不现，取伏神' + yongShenNote, priority:[{pos:'伏',score:sc.score,detail:sc.detail}],
                wangShuaiScore:{index:sc.score,detail:sc.detail} };
            return guaInfo;
        }
        guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:[], primaryIndex:null, dizhi:null, reason:'用神不现（本卦与伏神皆无）' + yongShenNote, priority:[], wangShuaiScore:{index:0,detail:'无'} };
        return guaInfo;
    }

    if (positions.length === 1) {
        const idx = positions[0];
        const sc = jiWangShuaiScore(yaoDetail[idx - 1], guaInfo);
        guaInfo.yongShen = { liuqin:yongShenLiuqin, positions:positions, primaryIndex:idx, dizhi:yaoDetail[idx - 1].dizhi,
            reason:'用神独现' + yongShenNote,
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
        dizhi: yaoDetail[chosen.idx - 1].dizhi,
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
            ? `忌神（${liuqin}）${sc.score > 0 ? '有力' : '无力'}，宜防其克用`
            : `仇神（${liuqin}）${sc.score > 0 ? '有力' : '无力'}，宜防其克原神`;
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

// 汇总入口：一次补齐 R1-1 ~ R1-8
function suanQuanBuGuaXiang(guaInfo) {
    suanLiuChongLiuHe(guaInfo);
    suanShengWangMuJue(guaInfo);
    suanHuiTou(guaInfo);
    suanFanYinFuYin(guaInfo);
    suanSanHeSanXing(guaInfo);
    suanDongSan(guaInfo);
    suanDuFa(guaInfo);
    suanTaiSui(guaInfo);
    suanNaYin(guaInfo);
    return guaInfo;
}

// R1-5 三合三刑（三合章/三刑章）：
//   三合：月支+日支+动爻地支凑齐申子辰/寅午戌/巳酉丑/亥卯未→成局；只差一支→记缺爻
//   三刑：月日动爻中寅巳申、丑戌未成三刑，子卯相刑，辰午酉亥自刑（同支重见）
const SAN_HE_GROUPS = [
    { name: '申子辰水局', dz: ['申','子','辰'] },
    { name: '寅午戌火局', dz: ['寅','午','戌'] },
    { name: '巳酉丑金局', dz: ['巳','酉','丑'] },
    { name: '亥卯未木局', dz: ['亥','卯','未'] }
];
const XING_GROUPS = [ ['寅','巳','申'], ['丑','戌','未'], ['子','卯'] ];
const ZI_XING = ['辰','午','酉','亥'];
function suanSanHeSanXing(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const timeInfo = guaInfo.timeInfo || {};
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const yueSet = yueJian ? [yueJian] : [];
    const riSet = riZhi ? [riZhi] : [];
    const dongSet = [];
    yaoDetail.forEach(y => { if (y.isDong && y.dizhi) dongSet.push(y.dizhi); });
    const pool = Array.from(new Set([].concat(yueSet, riSet, dongSet)));
    guaInfo.guaXiang = guaInfo.guaXiang || {};
    // 三合局：三支凑齐为成局；恰有两支（且含月支）记缺爻
    const heJu = [], queJu = [];
    SAN_HE_GROUPS.forEach(grp => {
        const inPool = grp.dz.filter(d => pool.indexOf(d) !== -1);
        if (inPool.length === 3) heJu.push(grp.name);
        else if (inPool.length === 2 && yueSet.some(m => inPool.indexOf(m) !== -1)) {
            const que = grp.dz.find(d => pool.indexOf(d) === -1);
            queJu.push({ group: grp.name, que: que });
        }
    });
    guaInfo.guaXiang.sanHe = heJu;
    guaInfo.guaXiang.sanHeQue = queJu;
    // 爻级 sanHe：动爻若属成局三支则标注
    yaoDetail.forEach(y => {
        if (!y.isDong) return;
        const hit = heJu.map(name => SAN_HE_GROUPS.find(g => g.name === name))
                        .filter(g => g && g.dz.indexOf(y.dizhi) !== -1);
        if (hit.length) y.sanHe = { group: hit[0].name, wan: true };
    });
    // 三刑
    const xingJu = [];
    XING_GROUPS.forEach(g => { if (g.every(d => pool.indexOf(d) !== -1)) xingJu.push(g.join('')); });
    const count = {};
    [].concat(yueSet, riSet, dongSet).forEach(d => { count[d] = (count[d] || 0) + 1; });
    ZI_XING.forEach(z => { if ((count[z] || 0) >= 2) xingJu.push(z + '自刑'); });
    guaInfo.guaXiang.xing = xingJu;
    yaoDetail.forEach(y => {
        const hits = xingJu.filter(x => x.indexOf(y.dizhi) !== -1);
        if (hits.length) y.xing = hits.join(',');
    });
    return guaInfo;
}

// R1-6 动散：动爻被日支冲为动散（如风吹火灭，散而不成）
function suanDongSan(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const riChen = (guaInfo.timeInfo || {}).riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    yaoDetail.forEach(y => {
        y.dongSan = false;
        if (y.isDong && riZhi && isChongRW7(y.dizhi, riZhi)) y.dongSan = true;
    });
    return guaInfo;
}

// R1-7 太岁岁破：年支冲爻为岁破（默认不改变既有评分，仅标注）
function suanTaiSui(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    const nianGanZhi = (guaInfo.timeInfo || {}).nianGanZhi || '';
    const nianZhi = nianGanZhi.length >= 2 ? nianGanZhi.charAt(1) : '';
    yaoDetail.forEach(y => {
        y.nianPo = false;
        if (y.dizhi && nianZhi && isChongRW7(y.dizhi, nianZhi)) y.nianPo = true;
    });
    return guaInfo;
}

// R1-8 纳音（六十甲子纳音表，逐爻干支查表）
const NA_YIN_60 = {
    '甲子':'海中金','乙丑':'海中金','丙寅':'炉中火','丁卯':'炉中火','戊辰':'大林木','己巳':'大林木',
    '庚午':'路旁土','辛未':'路旁土','壬申':'剑锋金','癸酉':'剑锋金','甲戌':'山头火','乙亥':'山头火',
    '丙子':'涧下水','丁丑':'涧下水','戊寅':'城头土','己卯':'城头土','庚辰':'白蜡金','辛巳':'白蜡金',
    '壬午':'杨柳木','癸未':'杨柳木','甲申':'泉中水','乙酉':'泉中水','丙戌':'屋上土','丁亥':'屋上土',
    '戊子':'霹雳火','己丑':'霹雳火','庚寅':'松柏木','辛卯':'松柏木','壬辰':'长流水','癸巳':'长流水',
    '甲午':'沙中金','乙未':'沙中金','丙申':'山下火','丁酉':'山下火','戊戌':'平地木','己亥':'平地木',
    '庚子':'壁上土','辛丑':'壁上土','壬寅':'金箔金','癸卯':'金箔金','甲辰':'覆灯火','乙巳':'覆灯火',
    '丙午':'天河水','丁未':'天河水','戊申':'大驿土','己酉':'大驿土','庚戌':'钗钏金','辛亥':'钗钏金',
    '壬子':'桑柘木','癸丑':'桑柘木','甲寅':'大溪水','乙卯':'大溪水','丙辰':'沙中土','丁巳':'沙中土',
    '戊午':'天上火','己未':'天上火','庚申':'石榴木','辛酉':'石榴木','壬戌':'大海水','癸亥':'大海水'
};
function suanNaYin(guaInfo) {
    const yaoDetail = guaInfo.yaoDetail || [];
    yaoDetail.forEach(y => {
        const gz = (y.tianGan || '') + (y.dizhi || '');
        y.naYin = NA_YIN_60[gz] || '';
    });
    return guaInfo;
}

// ============================================================
// 十二、阶段2：应期引擎（R3-1）
// 依据：《增删卜易·应期总注》
// 前置：须先经 xuanYongShen（定用神）与 suanQuanBuGuaXiang（卦象/墓绝/进退/独发）。
// 扫描未来 365 天（含当天，i>0 排除当天），逐日解析公历/干支/月支/旬空，
// 按用神空/破/墓/合与动爻进退、独发推导应期类型与候选公历日。
// 输出 guaInfo.yingqi = { items:[{type,yiJu,candidates:[{solar,riChen,monthZhi}]}], primaryType }
// ============================================================

function tuiYingQi(guaInfo, startDate) {
    const SolarApi = (typeof globalThis !== 'undefined' && globalThis.Solar) || (typeof Solar !== 'undefined' ? Solar : null);
    guaInfo.yingqi = null;
    if (!SolarApi) return guaInfo;
    try {
        const yaoDetail = guaInfo.yaoDetail || [];
        const guaXiang = guaInfo.guaXiang || {};
        const timeInfo = guaInfo.timeInfo || {};
        const yueJian = timeInfo.yueJian || '';
        const riChen = timeInfo.riChen || '';
        const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
        const xunKong = timeInfo.xunKong || '';
        const yongShen = guaInfo.yongShen || null;

        const now = (startDate && startDate.getTime) ? startDate : new Date();
        const days = [];
        for (let i = 0; i <= 365; i++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
            const solar = SolarApi.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
            const lunar = solar.getLunar();
            const dayGz = lunar.getDayInGanZhi();
            days.push({
                y: d.getFullYear(), m: d.getMonth() + 1, dd: d.getDate(),
                gz: dayGz,
                zhi: dayGz.charAt(1),
                xk: lunar.getDayXunKong(),
                mz: lunar.getMonthZhiExact ? lunar.getMonthZhiExact() : lunar.getMonthZhi()
            });
        }
        const items = [];
        function pushItem(type, yiJu, matchFn) {
            const cand = [];
            for (let i = 1; i < days.length && cand.length < 3; i++) {
                if (matchFn(days[i])) {
                    cand.push({ solar: days[i].y + '-' + String(days[i].m).padStart(2, '0') + '-' + String(days[i].dd).padStart(2, '0'), riChen: days[i].gz, monthZhi: days[i].mz });
                }
            }
            if (cand.length) items.push({ type: type, yiJu: yiJu, candidates: cand });
        }

        // 1. 用神旬空 → 出空（出旬逢值）/ 冲空实空（逢冲）
        if (yongShen && yongShen.dizhi && isKongRW7(yongShen.dizhi, xunKong)) {
            const yongZhi = yongShen.dizhi;
            pushItem('出空', '用神' + yongZhi + '旬空，出旬值日方应', day => day.zhi === yongZhi && day.xk.indexOf(yongZhi) === -1);
            const chongPair = DIZHI_LIU_CHONG.find(p => p[0] === yongZhi || p[1] === yongZhi);
            const chong = chongPair ? (chongPair[0] === yongZhi ? chongPair[1] : chongPair[0]) : '';
            if (chong) pushItem('冲空实空', '用神' + yongZhi + '旬空，逢' + chong + '冲实之日即应', day => day.zhi === chong);
        }

        // 2. 用神月破 → 出月实破（出月逢值）/ 逢合（月破逢合）
        if (yongShen && yongShen.dizhi && yueJian && isChongRW7(yongShen.dizhi, yueJian)) {
            const yongZhi = yongShen.dizhi;
            pushItem('出月实破', '用神' + yongZhi + '月破，出月逢值之日方应', day => day.zhi === yongZhi && day.mz !== yueJian);
            const hePair = DIZHI_LIU_HE.find(p => p[0] === yongZhi || p[1] === yongZhi);
            const he = hePair ? (hePair[0] === yongZhi ? hePair[1] : hePair[0]) : '';
            if (he) pushItem('逢合', '用神' + yongZhi + '月破，逢' + he + '合之日可解', day => day.zhi === he);
        }

        // 3. 用神入墓 → 出墓（冲墓之日）；4. 用神被合 → 冲合（冲开合局）
        if (yongShen && yongShen.dizhi) {
            const wx = DIZHI_WUXING[yongShen.dizhi] || '';
            const mu = MU_KU_TABLE[wx];
            const ruMu = !!(mu && (yueJian === mu || riZhi === mu));
            if (ruMu && mu) {
                const chongMuPair = DIZHI_LIU_CHONG.find(p => p[0] === mu || p[1] === mu);
                const chongMu = chongMuPair ? (chongMuPair[0] === mu ? chongMuPair[1] : chongMuPair[0]) : '';
                if (chongMu) pushItem('出墓', '用神入墓于' + mu + '，逢' + chongMu + '冲墓之日应', day => day.zhi === chongMu);
            }
            const heOther = [yueJian, riZhi].concat(yaoDetail.map(y => y.dizhi)).filter(Boolean)
                .find(d => d !== yongShen.dizhi && isHeRW7(yongShen.dizhi, d));
            if (heOther) {
                const chongPair = DIZHI_LIU_CHONG.find(p => p[0] === yongShen.dizhi || p[1] === yongShen.dizhi);
                const chong = chongPair ? (chongPair[0] === yongShen.dizhi ? chongPair[1] : chongPair[0]) : '';
                if (chong) pushItem('冲合', '用神' + yongShen.dizhi + '被' + heOther + '合住，逢' + chong + '冲开之日应', day => day.zhi === chong);
            }
        }

        // 5. 动爻化进/化退 → 临值/退神
        yaoDetail.forEach((y, idx) => {
            if (!y.huiTou || !y.huiTou.type) return;
            if (y.huiTou.type === '化进神' && y.bianDizhi) {
                pushItem('临值', '第' + (idx + 1) + '爻' + y.dizhi + '化进神，逢' + y.bianDizhi + '临值之日应', day => day.zhi === y.bianDizhi);
            } else if (y.huiTou.type === '化退神' && y.bianDizhi) {
                pushItem('退神', '第' + (idx + 1) + '爻' + y.dizhi + '化退神，应期以退神' + y.bianDizhi + '临值断', day => day.zhi === y.bianDizhi);
            }
        });

        // 6. 独发 → 独发爻临值或临月建
        if (guaXiang.duFa === '独发' && guaXiang.duFaYaoIndex) {
            const yao = yaoDetail[guaXiang.duFaYaoIndex - 1];
            if (yao && yao.dizhi) {
                pushItem('独发临值', '独发第' + guaXiang.duFaYaoIndex + '爻' + yao.dizhi + '，逢其临值之日应', day => day.zhi === yao.dizhi);
                pushItem('独发临月建', '独发第' + guaXiang.duFaYaoIndex + '爻' + yao.dizhi + '，逢' + yao.dizhi + '临月建之月应', day => day.mz === yao.dizhi);
            }
        }

        // 7. 就近排序 + 裁决 + 冲突标注（P0-3：最近优先排序 + 冲突标注）
        // 摊平所有类型的候选日为统一池，按公历日升序 → 最近优先
        const sortedCands = [];
        items.forEach(it => {
            (it.candidates || []).forEach(c => {
                sortedCands.push({ type: it.type, yiJu: it.yiJu, solar: c.solar, riChen: c.riChen, monthZhi: c.monthZhi });
            });
        });
        sortedCands.sort((a, b) => (a.solar < b.solar ? -1 : (a.solar > b.solar ? 1 : 0)));
        const solarCnt = {};
        sortedCands.forEach(s => { solarCnt[s.solar] = (solarCnt[s.solar] || 0) + 1; });
        sortedCands.forEach(s => { s.multi = solarCnt[s.solar] > 1; }); // 同日记多象 → 多法并应
        const primaryDate = sortedCands.length ? sortedCands[0].solar : null;
        const primaryRiChen = sortedCands.length ? sortedCands[0].riChen : null;
        const primaryTypeFinal = sortedCands.length ? sortedCands[0].type : (items.length ? items[0].type : null);

        // 冲突/印证标注：只标注「现象」，不臆断吉凶（旺相应近、休囚应远交由人工/AI察旺衰）
        const agreement = sortedCands.some(s => s.multi); // 多法并应：不同法则同指一日，事象确凿
        const NEAR_SET = ['出空', '冲空实空', '临值', '冲合', '独发临值'];   // 通常近应
        const FAR_SET = ['出月实破', '出墓', '独发临月建'];                    // 通常远应
        const nearFirst = sortedCands.find(s => NEAR_SET.indexOf(s.type) !== -1);
        const farFirst = sortedCands.find(s => FAR_SET.indexOf(s.type) !== -1);
        let divergent = false; // 远近两应：近象与远象并存，跨度大 → 须察旺衰定夺
        if (nearFirst && farFirst) {
            const dd = Math.abs((new Date(farFirst.solar) - new Date(nearFirst.solar)) / 86400000);
            if (dd > 40) divergent = true;
        }
        const unstable = !!(guaXiang && guaXiang.fanYin); // 反吟 → 事多反复，应期或迁延不定
        let weak = false; // 用神真空兼月破 → 应期当远，出月出旬方应
        if (yongShen && typeof yongShen.primaryIndex === 'number') {
            const ysYao = yaoDetail[yongShen.primaryIndex];
            if (ysYao && ysYao.kongType === '真空' && ysYao.yuePo) weak = true;
        }
        const flags = { agreement: agreement, divergent: divergent, unstable: unstable, weak: weak };
        const flagNotes = [];
        if (agreement) flagNotes.push('多法并应：不同应期法则同指一日，事象确凿');
        if (divergent) flagNotes.push('远近两应：近象与远象并存，须察用神旺衰定夺（旺相应近、休囚应远）');
        if (unstable) flagNotes.push('卦反吟：事多反复，应期或迁延不定');
        if (weak) flagNotes.push('用神真空兼月破：应期当远，出月出旬方应');

        guaInfo.yingqi = items.length
            ? { items: items, primaryType: primaryTypeFinal, primaryDate: primaryDate, primaryRiChen: primaryRiChen, sortedCandidates: sortedCands, flags: flags, flagsNote: flagNotes.join('；') }
            : null;
    } catch(e) {
        console.warn('应期引擎失败:', e);
        guaInfo.yingqi = null;
    }
    return guaInfo;
}

// ============================================================
// 十三、阶段3：吉凶判定引擎（R2-1 结构化断卦依据链）
// 依据：《增删卜易》用神章/旺衰章/动静章/世应章/忌仇神章/六冲六合章/反伏章/墓绝章
// 依序执行 7 步：定用神 → 察旺衰 → 观动静 → 审世应 → 看忌仇元神 → 察卦象 → 综合结论。
// 每步输出 {判据, 结论, 依据} 三元组并入 guaInfo.duanGua.chain；
// 计分制汇总 guaInfo.duanGua.jiXiong ∈ {吉,中,凶}；数据缺失跳过该判据并注明。
// 前置：须先经 xuanYongShen、jiShenChouShen、jiSuanYuanShenKongFu、
//       jiSuanShiYaoZhuangTai、suanQuanBuGuaXiang。
// ============================================================

// 策3 第二批 · 驿马引擎（年支起驿马）：申子辰→寅，亥卯未→巳，寅午戌→申，巳酉丑→亥
function suanYiMa(timeInfo) {
    const nianGanZhi = (timeInfo && timeInfo.nianGanZhi) || '';
    const nianZhi = nianGanZhi.length >= 2 ? nianGanZhi.charAt(1) : '';
    const MAP = { '申':'寅', '子':'寅', '辰':'寅', '亥':'巳', '卯':'巳', '未':'巳', '寅':'申', '午':'申', '戌':'申', '巳':'亥', '酉':'亥', '丑':'亥' };
    return MAP[nianZhi] || null;
}

function suanDuanGua(guaInfo) {
    const chain = [];
    const yaoDetail = guaInfo.yaoDetail || [];
    const guaXiang = guaInfo.guaXiang || {};
    const timeInfo = guaInfo.timeInfo || {};
    const yueJian = timeInfo.yueJian || '';
    const riChen = timeInfo.riChen || '';
    const riZhi = riChen.length >= 2 ? riChen.charAt(1) : '';
    const menlei = guaInfo.menlei || '';
    const daiWen = (guaInfo.userInfo && guaInfo.userInfo.daiWen) || '自己';
    const selfIll = (menlei === '疾病' && daiWen === '自己');
    const yiMa = suanYiMa(timeInfo);
    guaInfo.yiMa = yiMa;
    const jb = (guaInfo.userInfo && guaInfo.userInfo.jinBing) || '否';
    const yongShen = guaInfo.yongShen || null;
    let score = 0;

    function add(jueJu, jieLun, yiJu) {
        chain.push({ jueJu: jueJu, jieLun: jieLun || '', yiJu: yiJu || '数据缺失，跳过该判据' });
    }

    // 步1 定用神
    if (yongShen && yongShen.liuqin) {
        let pos = '卦中';
        if (typeof yongShen.primaryIndex === 'number') pos = '第' + yongShen.primaryIndex + '爻';
        else if (String(yongShen.primaryIndex || '').indexOf('伏') === 0) pos = '伏神';
        add('定用神', '取' + pos + ' ' + yongShen.liuqin + (yongShen.dizhi ? '(' + yongShen.dizhi + ')' : '') + '为用', yongShen.reason || '按门类映射取用');
    } else {
        add('定用神', '用神未定', '未命中门类映射或所问不明，后续判据受限');
    }

    const yongYao = (yongShen && typeof yongShen.primaryIndex === 'number' && yaoDetail[yongShen.primaryIndex - 1]) || null;

    // 步2 察旺衰
    if (yongYao) {
        const sc = jiWangShuaiScore(yongYao, guaInfo);
        const wangShuai = sc.score > 0 ? '旺相' : (sc.score < 0 ? '休囚' : '平');
        add('察旺衰', '用神' + yongYao.dizhi + ' ' + wangShuai + '(评分' + sc.score + ')', sc.detail || '月日生克综合');
        // P1 权重（用神为尊）：用神本体一等 ±2，月破/真空重罚
        const base = (sc.score > 0 ? 2 : (sc.score < 0 ? -2 : 0));
        score += (selfIll) ? -base : base;
        if (yongYao.yuePo) { add('察旺衰', '用神月破', '月建' + yueJian + '冲' + yongYao.dizhi + '，根枯难用'); if (menlei === '疾病' && (guaInfo.userInfo && guaInfo.userInfo.jinBing === '近病')) score += 2; else score -= 2; }
        if (menlei === '疾病' && jb === '近病') {
            if (yongYao.kongType !== 'none') { add('察旺衰', '用神旬空（近病）', '近病逢空即愈，不药而痊'); score += 1; }
        } else if (menlei === '疾病' && jb === '久病') {
            if (yongYao.kongType !== 'none') { add('察旺衰', '用神旬空（久病）', '久病逢空，元气难继，病势沉疴'); score -= 2; }
        } else if (yongYao.kongType === '真空') { add('察旺衰', '用神真空', '旬空且无生扶，如石沉大海终不可得'); score -= 2; }
        else if (yongYao.kongType === '假空') { add('察旺衰', '用神旬空', '逢空，事成须待出空'); score--; }
    } else if (yongShen && yongShen.dizhi) {
        add('察旺衰', '用神伏藏(' + yongShen.dizhi + ')', '伏神之旺衰以飞伏生克论');
    } else {
        add('察旺衰', '无法判定', '用神未定');
    }

    // 步3 观动静
    if (guaXiang.duFa === '独发' && guaXiang.duFaYaoIndex) {
        add('观动静', '独发第' + guaXiang.duFaYaoIndex + '爻为第一参考', '《独发章》：一爻独发，卦象所指最真');
    }
    if (yongYao) {
        if (yongYao.isDong) {
            const ht = yongYao.huiTou || null;
            if (ht && ht.type === '化进神') { add('观动静', '用神发动化进', '动而化进神，其力倍增'); score += 2; }
            else if (ht && ht.type === '回头生') { add('观动静', '用神发动回头生', '变爻生用神，动而有力'); score += 2; }
            else if (ht && (ht.type === '化退神' || ht.type === '回头克' || ht.type === '化墓' || ht.type === '化绝' || ht.type === '化破')) { add('观动静', '用神发动' + ht.type, ht.desc || '动而有损'); score -= 2; }
            else if (ht && ht.type === '化空') { add('观动静', '用神发动化空', '动而化空，待出空方可应'); }
            else { add('观动静', '用神发动', '动爻为事之机，随其生克而应'); }
        } else if (!(guaXiang.duFa === '独发' && yongShen.primaryIndex === guaXiang.duFaYaoIndex)) {
            add('观动静', '用神安静', '静以待时，看月日生扶');
        }
    } else if (guaXiang.duFa !== '独发') {
        add('观动静', '六爻安静', '事态未动，宜静观其变');
    }
    if (yongYao && yongYao.dongSan) { add('观动静', '用神动散', '动而被日冲散，事如风吹火灭'); score -= 2; }

    // 步4 审世应
    const shiIdx = guaInfo.shiYaoIndex;
    const yingIdx = guaInfo.yingYaoIndex;
    if (shiIdx != null && yingIdx != null) {
        const shiYao = yaoDetail[shiIdx - 1], yingYao = yaoDetail[yingIdx - 1];
        if (shiYao && yingYao && shiYao.dizhi && yingYao.dizhi) {
            if (isChongRW7(shiYao.dizhi, yingYao.dizhi)) { add('审世应', '世应相冲', '世应' + shiIdx + '/' + yingIdx + '爻相冲，主事有阻隔难成'); score--; }
            else if (isHeRW7(shiYao.dizhi, yingYao.dizhi)) { add('审世应', '世应相合', '世应' + shiIdx + '/' + yingIdx + '爻相合，主事易成，和合之象'); score++; }
            else { add('审世应', '世应无冲合', '世应' + shiIdx + '/' + yingIdx + '爻不冲不合，事无大碍'); }
        }
    }
    if (yongYao && shiIdx != null && yongShen.primaryIndex === shiIdx) {
        add('审世应', '用神持世', '用神临世爻，所求即在自身，主事易成'); score++;
    }
    if (yongYao && yingIdx != null && yongShen.primaryIndex === yingIdx) {
        add('审世应', '用神临应', '用神临应爻，所求在对方或事体');
    }
    if (guaInfo.shiYaoZhuangTai && guaInfo.shiYaoZhuangTai !== '平稳' && guaInfo.shiYaoZhuangTai !== '未知') {
        add('审世应', '世爻' + guaInfo.shiYaoZhuangTai, guaInfo.shiYaoDetail || '');
        if (guaInfo.shiYaoZhuangTai.indexOf('月破') !== -1) score--;
    }

    // 步5 看忌仇元神
    if (guaInfo.jiShenState && guaInfo.jiShenState.liuqin) {
        const js = guaInfo.jiShenState;
        add('看忌仇元神', '忌神' + js.liuqin + (js.positions.length ? ('在第' + js.positions.join('、') + '爻') : ''), js.duanYu || '');
        if (js.wangShuaiScore && js.wangShuaiScore.index > 0) { add('看忌仇元神', '忌神有力', '忌神旺相克用，防其害'); score += (selfIll ? 1 : -1); }
        else { add('看忌仇元神', '忌神无力', '忌神休囚，克用之力有限'); score += (selfIll ? -1 : 1); }
    } else {
        add('看忌仇元神', '忌神状态', '未构成明显忌神或数据缺失');
    }
    if (guaInfo.chouShenState && guaInfo.chouShenState.liuqin) {
        const cs = guaInfo.chouShenState;
        if (cs.wangShuaiScore && cs.wangShuaiScore.index > 0) {
            score--;
            let note = '仇神（' + cs.liuqin + '）旺相，事有阻滞';
            if (selfIll)
                note = '仇神（妻财）旺相，于疾病门中为双刃之象—既助药力（生子孙），亦耗元气（克父母原神），仍有牵制之虑';
            add('看忌仇元神', note, '仇神旺相克原神，防其牵制');
        } else {
            add('看忌仇元神', '仇神' + cs.liuqin, cs.duanYu || '');
        }
    }
    if (guaInfo.yuanShenState) {
        const ys = guaInfo.yuanShenState;
        const ysState = ys.isFuCang ? '伏藏' : (ys.isKong ? '旬空' : '得力');
        add('看忌仇元神', '原神' + (ys.liuqin || '') + ysState, ys.duanYu || '');
        if (ys.isKong || ys.isFuCang) score += (selfIll ? 1 : -1);
        else score += (selfIll ? -1 : 1);
    } else {
        add('看忌仇元神', '原神状态', '未计算或数据缺失');
    }

    // 步6 察卦象
    if (guaXiang.liuChong) { add('察卦象', '六冲卦', '六冲主散，占久远事不利，主快主凶'); score += (selfIll ? ((jb === '近病') ? 1 : -1) : -1); }
    if (guaXiang.liuHe) { add('察卦象', '六合卦', '六合主合和，占事多顺'); score++; }
    if (guaXiang.fanYin) { add('察卦象', '反吟', '卦反吟，事多反复，主劳而无功'); score--; }
    if (guaXiang.fuYin) { add('察卦象', '伏吟', '卦伏吟，事主呻吟迟滞，进退两难'); score--; }
    if (yongShen && yongShen.dizhi) {
        const wx = DIZHI_WUXING[yongShen.dizhi] || '';
        const mu = MU_KU_TABLE[wx];
        const ruMu = !!(mu && (yueJian === mu || riZhi === mu));
        if (ruMu) { add('察卦象', '用神入墓', '用神入墓于' + mu + '，事有归藏，待冲墓方出'); score--; }
        const jue = JUE_WEI_TABLE[wx];
        const linJue = !!(jue && (yueJian === jue || riZhi === jue));
        if (linJue) { add('察卦象', '用神临绝', '用神临' + jue + '之绝，气数已尽，事难成'); score--; }
    }
    if (guaXiang.duFa === '六爻安静') { add('察卦象', '六爻安静', '事未发动，吉凶未显，待时而动'); }

    // 步6.5 察门类（知识库命中时并入断法要点）
    if (guaInfo.menlei && guaInfo.menleiContext) {
        const mc = guaInfo.menleiContext;
        const yongShenText = mc.yongShen ? ('以' + mc.yongShen + '为用') : '用神按所问取';
        add('察门类', guaInfo.menlei + '门类：' + yongShenText,
            (mc.duanFa.length ? '断法：' + mc.duanFa.join('；') : '') +
            (mc.yingqi.length ? '　应期：' + mc.yingqi.join('、') : '') +
            (mc.chiShi ? '　持世：' + mc.chiShi : ''));
    }
    // 步6.6 四门专属计分（策3）+ 去重护栏
    const mlRes = applyMenLeiScoring(guaInfo, score);
    mlRes.entries.forEach(e => chain.push(e));
    score = mlRes.score;

    // 步7 综合结论（五档分级：大吉/吉/中/小凶/凶，警示适度不伤人）
    let jiXiong;
    if (score >= 3) jiXiong = '大吉';
    else if (score >= 1) jiXiong = '吉';
    else if (score === 0) jiXiong = '中';
    else if (score >= -2) jiXiong = '小凶';
    else jiXiong = '凶';
    add('综合结论', jiXiong + '（吉凶评分' + score + '）', chain.slice(0, chain.length - 1).map(c => c.jieLun).join('；'));

    guaInfo.duanGua = { chain: chain, jiXiong: jiXiong, score: score };
    return guaInfo;
}

// ============================================================
// 十、R4 门类知识库（13 门类，以《增删卜易》为纲：婚姻/学业/功名/求财/疾病/出行/行人归期/诉讼/失物/子嗣胎孕/家宅迁移/终身财福/趋避防灾）
// ============================================================
const MENLEI_ZHISHI = {
    '婚姻': {
        yongShen: '官鬼',
        duanFa: ['看财官世应生克', '看父母爻(翁姑)吉凶', '看子孙爻与胎位伏神'],
        yingqi: ['合住待冲', '空破待填实', '官财旺相主吉'],
        chiShi: '财持世吉，兄持世难求'
    },
    '功名': {
        yongShen: '官鬼',
        duanFa: ['看官鬼爻旺衰为功名主', '看父母爻(文书)', '看世爻身位'],
        yingqi: ['官星旺相逢生扶应期', '空破待出空出月'],
        chiShi: '官持世吉，财持世助官'
    },
    '学业': {
        yongShen: '父母',
        duanFa: ['看父母爻为文书学业', '看世爻身位', '科考功名兼看官鬼爻'],
        yingqi: ['父母旺相之时', '文书出现之日'],
        chiShi: '父母持世利学，官鬼持世利考'
    },
    '求财': {
        yongShen: '妻财',
        duanFa: ['看财爻旺衰', '看子孙爻(财源)', '看兄弟爻(劫财)'],
        yingqi: ['财逢空待出空', '财临值之日'],
        chiShi: '财持世易得，兄持世防耗'
    },
    '疾病': {
        yongShen: '官鬼',
        duanFa: ['看官鬼爻为病', '看子孙爻(医药)', '看用神(占何人病)'],
        yingqi: ['用神出空', '官爻受制之日'],
        chiShi: '世爻空破病难愈，官星旺相主病重'
    },
    '出行': {
        yongShen: '父母',
        duanFa: ['看世爻旺衰主自身', '看应爻为目的地', '看官鬼为阻隔'],
        yingqi: ['世爻旺相即行', '官爻克世防阻'],
        chiShi: '世旺可行，世空破不宜动'
    },
    '行人归期': {
        yongShen: '子孙',
        duanFa: ['看用神伏现', '看用神合冲', '看用神旬空'],
        yingqi: ['用神出空之日归', '逢冲之日归'],
        chiShi: '用神生世归速，克世主有阻'
    },
    '诉讼': {
        yongShen: '官鬼',
        duanFa: ['看官鬼为官府', '看世应谁克谁', '看文书父母爻'],
        yingqi: ['官旺之日', '世应合冲之日'],
        chiShi: '世克应我胜，应克世彼胜'
    },
    '失物': {
        yongShen: '妻财',
        duanFa: ['看财爻为失物', '看财爻旬空', '看玄武爻为窃盗'],
        yingqi: ['财爻出空可寻', '财爻冲合之日'],
        chiShi: '财持世易寻，兄持世难找'
    },
    '子嗣胎孕': {
        yongShen: '子孙',
        duanFa: ['看子孙爻旺衰', '看胎位伏神', '看官鬼为孕病'],
        yingqi: ['子孙旺相之时', '子孙临值之日'],
        chiShi: '子孙持世易得，官鬼持世防流产'
    },
    '家宅迁移': {
        yongShen: '父母',
        duanFa: ['看父母爻为宅', '看二爻为宅位', '看官鬼为祸患'],
        yingqi: ['父母旺相之时', '冲合父母之日'],
        chiShi: '父母持世宅安，官鬼持世防灾'
    },
    '终身财福': {
        yongShen: '妻财',
        duanFa: ['看财爻旺衰为财福', '看世爻终身', '看官父为寿'],
        yingqi: ['逢生扶之年月', '财爻旺相之时'],
        chiShi: '财持世福厚，世空破福薄'
    },
    '趋避防灾': {
        yongShen: '官鬼',
        duanFa: ['看官鬼为灾', '看世爻受克否', '看子孙为解神'],
        yingqi: ['官爻受制之日', '世爻得生之时'],
        chiShi: '子孙持世可解，官鬼持世防灾'
    }
};

// ============================================================
// 策3 · 四门专属计分规则（MENLEI_RULES）+ 去重护栏
// ============================================================
// 去重三档：overlap='tongyuan'（与通用机制同源，只显式化语义、不重复计分）
//           overlap='fugai'（非通用覆盖，门类特有语义，独立计分）
//           overlap='bufen'（部分去重，仅计门类特有差额）
// 疾病门第一批全部 score=0（吉凶方向反转牵动步2/步5，属第二批），仅显式化语义。
const MENLEI_RULES = [
    // ===== 求财门 =====
    { id:'求财-1', menlei:'求财', desc:'兄弟爻动（劫财之神）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const j=g.jiShenState; return !!(j && j.liuqin==='兄弟' && j.positions && j.positions.length>0); },
      reason:'兄弟即妻财忌神，与通用「忌神有力−1」同源→去重，不双计' },
    { id:'求财-2', menlei:'求财', desc:'妻财旺相得生扶', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='妻财' && typeof y.primaryIndex==='number'); },
      reason:'属用神旺相范畴→归位用神本体±2计分，去重' },
    { id:'求财-3', menlei:'求财', desc:'财爻伏藏不现（难求）', direction:'凶', overlap:'fugai', score:-1,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='妻财' && typeof y.primaryIndex==='string' && y.primaryIndex.indexOf('伏')===0); },
      reason:'非通用机制覆盖（伏神法度）→可独立计' },
    { id:'求财-4', menlei:'求财', desc:'财爻克世/冲世（财来就我）', direction:'吉', overlap:'fugai', score:1,
      check:(g)=>{
        const y=g.yongShen, shiIdx=g.shiYaoIndex;
        if (!y || !y.dizhi || shiIdx==null) return false;
        const shi=(g.yaoDetail||[])[shiIdx-1];
        if (!shi || !shi.dizhi) return false;
        const yongWx=DIZHI_WUXING[y.dizhi]||'', shiWx=DIZHI_WUXING[shi.dizhi]||'';
        return (yongWx && shiWx && WX_KE_RW7[yongWx]===shiWx) || isChongRW7(y.dizhi, shi.dizhi);
      },
      reason:'非通用机制覆盖（财与世爻生克，求财门「财克世为吉」反转）→可独立计' },
    { id:'求财-5', menlei:'求财', desc:'子孙动生财（财有根源）', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yuanShenState; return !!(y && y.liuqin==='子孙' && !y.isKong && !y.isFuCang); },
      reason:'子孙即妻财原神，与通用「原神得力+1」同源→去重' },
    { id:'求财-6', menlei:'求财', desc:'父爻动克子孙（伤财之原神）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yuanShenState; return !!(y && y.liuqin==='子孙' && (y.isKong || y.isFuCang)); },
      reason:'父克子孙=伤原神，与通用原神机制同源→去重' },

    // ===== 功名门 =====
    { id:'功名-1', menlei:'功名', desc:'子孙爻动（克官之神）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const j=g.jiShenState; return !!(j && j.liuqin==='子孙' && j.positions && j.positions.length>0); },
      reason:'子孙即官鬼忌神，与通用「忌神有力−1」同源→去重' },
    { id:'功名-2', menlei:'功名', desc:'官鬼旺相得生扶', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='官鬼' && typeof y.primaryIndex==='number'); },
      reason:'属用神旺相范畴→归位用神本体±2计分，去重' },
    { id:'功名-3', menlei:'功名', desc:'父母爻动（文书）生官', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yuanShenState; return !!(y && y.liuqin==='父母' && !y.isKong && !y.isFuCang); },
      reason:'父母即官鬼原神，与通用「原神得力+1」同源→去重' },
    { id:'功名-4', menlei:'功名', desc:'财动生官（纳粟成名）', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='官鬼'); },
      reason:'财生官=用神得生，归位用神旺相范畴→去重' },
    { id:'功名-5', menlei:'功名', desc:'官星持世', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen, s=g.shiYaoIndex; return !!(y && y.liuqin==='官鬼' && typeof y.primaryIndex==='number' && y.primaryIndex===s); },
      reason:'属世爻与用神关系，与通用「持世+1」同源→去重' },
    { id:'功名-7', menlei:'功名', desc:'财局会局生官生世', direction:'吉', overlap:'bufen', score:1,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='官鬼' && g.guaXiang && g.guaXiang.sanHe && g.guaXiang.sanHe.length); },
      reason:'三合财局生官为门类特有，通用三合未精确计财局生官→部分去重，计差额+1' },

    // ===== 婚姻门 =====
    { id:'婚姻-1', menlei:'婚姻', desc:'财官相生', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && (y.liuqin==='妻财' || y.liuqin==='官鬼')); },
      reason:'属用神旺相范畴（财官互动即用神得生）→归位计分，去重' },
    { id:'婚姻-2', menlei:'婚姻', desc:'世应相生相合', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const s=g.shiYaoIndex, y=g.yingYaoIndex; if(s==null||y==null) return false;
        const a=(g.yaoDetail||[])[s-1], b=(g.yaoDetail||[])[y-1]; return !!(a&&b&&a.dizhi&&b.dizhi&&isHeRW7(a.dizhi,b.dizhi)); },
      reason:'与通用「世应相合+1」同源→去重' },
    { id:'婚姻-3', menlei:'婚姻', desc:'世应冲克', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const s=g.shiYaoIndex, y=g.yingYaoIndex; if(s==null||y==null) return false;
        const a=(g.yaoDetail||[])[s-1], b=(g.yaoDetail||[])[y-1]; return !!(a&&b&&a.dizhi&&b.dizhi&&isChongRW7(a.dizhi,b.dizhi)); },
      reason:'与通用「世应相冲−1」同源→去重' },
    { id:'婚姻-4', menlei:'婚姻', desc:'财动化凶（化退/回头克/化墓/化绝/化破）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&a.isDong&&a.huiTou&&['化退神','回头克','化墓','化绝','化破'].indexOf(a.huiTou.type)!==-1); },
      reason:'属用神化凶范畴，与通用「用神化退/回头克/化墓绝−2」同源→去重' },
    { id:'婚姻-5', menlei:'婚姻', desc:'兄弟持世克妻财', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const s=g.shiYaoIndex, y=g.yongShen; if(s==null||!y||y.liuqin!=='妻财') return false;
        const a=(g.yaoDetail||[])[s-1]; return !!(a&&a.liuqin==='兄弟'); },
      reason:'兄弟=妻财忌神持世，与通用「忌神有力−1」同源→去重' },
    { id:'婚姻-6', menlei:'婚姻', desc:'用神空破墓绝', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&(a.kongType==='真空'||a.yuePo)); },
      reason:'属用神旺衰范畴，与通用「用神空破−2」同源→去重' },
    { id:'婚姻-7', menlei:'婚姻', desc:'用神暗动（心去难留）', direction:'凶', overlap:'fugai', score:-1,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&a.riPoOrAnDong==='暗动'); },
      reason:'非通用覆盖（暗动心去难留为婚姻门特有）' },
    { id:'婚姻-8', menlei:'婚姻', desc:'用神临驿马（缘分或婚事有变动之机）', direction:'中', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.dizhi && g.yiMa && y.dizhi===g.yiMa); },
      reason:'驿马主变动，婚姻门用神临驿马为门类特有语义（suanYiMa 计算），仅显式化不双计' },

    // ===== 疾病门（第一批：语义显式化，全部 score=0，方向反转属第二批）=====
    { id:'疾病-1', menlei:'疾病', desc:'子孙制鬼（医药/解忧）', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ const j=g.jiShenState; return !!(j && j.liuqin==='子孙'); },
      reason:'疾病门子孙兼为医药/解忧之神，吉凶方向反转属第二批→本批仅显式化语义' },
    { id:'疾病-2', menlei:'疾病', desc:'官鬼旺相（病重）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; return !!(y && y.liuqin==='官鬼' && y.wangShuaiScore && y.wangShuaiScore.index>0); },
      reason:'病旺=凶方向反转牵动步2，属第二批→本批仅显式化语义' },
    { id:'疾病-3', menlei:'疾病', desc:'近病用神旬空（逢空即愈）', direction:'吉', overlap:'fugai', score:0,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&a.kongType!=='none'); },
      reason:'近病逢空即愈须步2跳过空亡扣分，属第二批→本批仅显式化语义' },
    { id:'疾病-4', menlei:'疾病', desc:'久病用神空破（不治）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&(a.kongType==='真空'||a.yuePo)); },
      reason:'与通用「用神空破−2」同源→去重' },
    { id:'疾病-5', menlei:'疾病', desc:'六冲卦近病即愈', direction:'吉', overlap:'tongyuan', score:0,
      check:(g)=>{ return !!(g.guaXiang && g.guaXiang.liuChong); },
      reason:'近病逢冲即愈与通用「六冲−1」方向相反，属第二批→本批仅显式化语义' },
    { id:'疾病-6', menlei:'疾病', desc:'六冲卦久病不治', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ return !!(g.guaXiang && g.guaXiang.liuChong); },
      reason:'与通用「六冲−1」同源→去重' },
    { id:'疾病-7', menlei:'疾病', desc:'鬼变用神/用神化鬼（慎防不测）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen; if(!y||typeof y.primaryIndex!=='number') return false;
        const a=(g.yaoDetail||[])[y.primaryIndex-1]; return !!(a&&a.isDong&&a.huiTou&&a.huiTou.value==='化官鬼'); },
      reason:'与通用「用神化鬼−2」同源→去重' },
    { id:'疾病-8', menlei:'疾病', desc:'代占官鬼持世（忧神非病）', direction:'中', overlap:'tongyuan', score:0,
      check:(g)=>{ const y=g.yongShen, s=g.shiYaoIndex; return !!(y && y.liuqin==='官鬼' && typeof y.primaryIndex==='number' && y.primaryIndex===s); },
      reason:'代占官鬼持世为忧神非病，门类特有语义→仅显式化，不计分' },
    { id:'疾病-9', menlei:'疾病', desc:'忌神动生元神生用神（化吉为凶）', direction:'凶', overlap:'tongyuan', score:0,
      check:(g)=>{ const j=g.jiShenState, y=g.yuanShenState; return !!(j&&j.positions&&j.positions.length>0&&y&&!y.isKong&&!y.isFuCang); },
      reason:'连生=子孙生父母生官鬼=病得连环生助，实为化吉为凶，方向判定属第二批→本批仅显式化' }
];

/**
 * 策3 · 去重护栏主函数：在 suanDuanGua 步6.5「察门类」后调用。
 * @param {object} guaInfo - 已含 menlei/yongShen/jiShenState/yuanShenState/guaXiang/yaoDetail/shiYaoIndex/yingYaoIndex
 * @param {number} score - 当前累计分值
 * @returns {{score:number, entries:Array}} entries 为门类专属判据（由调用方 push 入 chain）
 */
function applyMenLeiScoring(guaInfo, score) {
    const entries = [];
    const menlei = guaInfo.menlei;
    if (!menlei) return { score: score, entries: entries };
    const daiWen = (guaInfo.userInfo && guaInfo.userInfo.daiWen) || '自己';
    const selfIll = (menlei === '疾病' && daiWen === '自己');
    const rules = MENLEI_RULES.filter(r => r.menlei === menlei && (menlei !== '疾病' || selfIll));
    for (const r of rules) {
        let triggered = false;
        try { triggered = r.check(guaInfo); } catch (e) { triggered = false; }
        if (!triggered) continue;
        if (r.overlap === 'tongyuan') {
            entries.push({ jueJu: '察门类·' + menlei, jieLun: r.desc + '（已归位通用机制计分，门类不双计）', yiJu: r.reason });
        } else {
            score += r.score;
            entries.push({ jueJu: '察门类·' + menlei, jieLun: r.desc + '（门类专属计分 ' + (r.score > 0 ? '+' : '') + r.score + '）', yiJu: r.reason });
        }
    }
    return { score: score, entries: entries };
}

// 门类关键词表（严格以《增删卜易》门目为纲；长词/专词优先，避免"官/子/找"等单字误判）
// 用神取法谨遵古法：婚姻男财女官、功名官鬼、求财妻财、疾病官鬼、出行父母、
// 行人子孙、诉讼官鬼、失物妻财、子嗣子孙、家宅父母、终身财福妻财、趋避官鬼、学业父母。
// 特别约定：前程（升选/中第/在任古法皆取官鬼）归入功名，不作"终身财福"泛指。
const MENLEI_KEYWORDS = [
    ['婚姻', ['婚姻', '嫁', '娶']],
    ['学业', ['上学', '考试', '进修']],
    ['功名', ['功名', '仕途', '升职', '求职', '前程']],
    ['求财', ['财运', '生意', '股票', '投资', '买卖', '交易', '开张']],
    ['疾病', ['疾病', '康复', '求医', '治病']],
    ['出行', ['出行', '旅游', '出差']],
    ['行人归期', ['归期']],
    ['诉讼', ['诉讼', '官司']],
    ['失物', ['失物', '遗失', '丢失']],
    ['子嗣胎孕', ['怀孕', '求子', '生子', '得子', '子女', '子孙']],
    ['家宅迁移', ['住宅', '搬家', '买房', '建房', '风水', '装修']],
    ['终身财福', ['终身', '命运', '财福']],
    ['趋避防灾', ['防灾', '避祸', '避灾', '平安', '破灾']]
];

/**
 * R4-1 门类推断：问辞 → 13 门类之一（收敛旧 inferQuestionType 的关键词判定）
 * @param {string} question - 用户所问之事
 * @returns {string|null} 门类名；未命中返回 null
 */
function inferMenLei(question) {
    if (!question) return null;
    const q = question.toLowerCase();
    for (const [menlei, words] of MENLEI_KEYWORDS) {
        for (const w of words) {
            if (q.indexOf(w) !== -1) return menlei;
        }
    }
    return null;
}

/**
 * R4-2 门类用神：返回门类定义的用神六亲（婚姻/感情按性别分流）
 * @param {object} guaInfo - 卦信息（需含 userInfo.gender）
 * @param {string} menlei - 门类名
 * @returns {string|null}
 */
function getYongShenByMenLei(guaInfo, menlei) {
    const entry = MENLEI_ZHISHI[menlei];
    if (!entry) return QUESTION_TO_YONGSHEN[menlei] || null;
    if (menlei === '疾病') {
        const daiWen = (guaInfo.userInfo && guaInfo.userInfo.daiWen) || '自己';
        if (daiWen === '父母') return '父母';
        if (daiWen === '妻财') return '妻财';
        if (daiWen === '子孙') return '子孙';
    }
    if (menlei === '婚姻' || menlei === '感情') {
        const gender = (guaInfo.userInfo && guaInfo.userInfo.gender) || '';
        if (gender.indexOf('男') !== -1) return '妻财';
        if (gender.indexOf('女') !== -1) return '官鬼';
    }
    return entry.yongShen || QUESTION_TO_YONGSHEN[menlei] || null;
}

/**
 * R4-3 门类上下文：断法要点/应期要点/持世吉凶并入 guaInfo.menleiContext，
 *        供 suanDuanGua 察门类步骤与 AI 上下文使用
 * @param {object} guaInfo
 * @returns {object} guaInfo
 */
function applyMenLeiContext(guaInfo) {
    const ml = guaInfo.menlei;
    if (!ml) {
        guaInfo.menleiContext = null;
        return guaInfo;
    }
    const entry = MENLEI_ZHISHI[ml];
    if (!entry) {
        guaInfo.menleiContext = null;
        return guaInfo;
    }
    guaInfo.menleiContext = {
        menlei: ml,
        yongShen: getYongShenByMenLei(guaInfo, ml),
        duanFa: entry.duanFa || [],
        yingqi: entry.yingqi || [],
        chiShi: entry.chiShi || ''
    };
    return guaInfo;
}

// ============================================================
// 十一、R6 原案例库（《增删卜易》占例，并入 suanfa.js 供对照与回归）
// ============================================================
// 案例库：专收《增删卜易》中「不常见」卦例（两现/月破/旬空/独发等法度照顾不到的边缘），
// 逐字转录野鹤原断语 + 标章句出处，供对照验断与回归基线。杜撰比不录更糟，故仅录可核原文。
const ANLI = [
    {
        gua: '风天小畜', yue: '未', ri: '庚子', dong: [],
        source: '两现章',
        duan: '应临月建之财以克世，许之必得。彼问何日到手？余以次日辛丑冲动未土必得，后却得于辰土出空之日，此乃舍其不空而用旬空也。',
        yongShen: '妻财', yongShenIndex: 4, yingqiIndex: 3,
        note: '取用=应爻未土（不空临月建，与算法"舍空取实"一致）；应期应验于辰土出空之日（3爻），"舍其不空而用旬空"乃应期法度，非取用分歧'
    },
    {
        gua: '地水师', yue: '未', ri: '甲午', dong: ['寅木', '午火'],
        source: '两现章',
        duan: '世爻极旺，既临日建，又得月令作官星而合世，但卦中两现官星，一空一破，至辰年辰土之官出空，一定高擢。然反吟于外卦，每得验者去而复来。',
        yongShen: '官鬼', yongShenIndex: 2
    },
    {
        gua: '兑为泽', yue: '亥', ri: '己丑', dong: ['巳火'],
        source: '月破章',
        duan: '官动而生世，世动化进神，显然有官之象。但官逢月破，世遇旬空；冲空则实不为空，而破者又无日辰动爻之生，占以日建亦生不起。命之再占，前卦官临月破，定于实破之年，果于巳年承袭长房世职。',
        yongShen: '官鬼', yongShenIndex: 1
    },
    {
        gua: '乾为天', yue: '辰', ri: '戊子', dong: ['戌土'],
        source: '月破章',
        duan: '父母持世，破而化空，既无日生又无动助。余不以此论，竟断朱雀临父动而持世，卯日有信，午未日必归。果于卯日得信，乙未日到家。应卯日者破而逢合之日，应未日者父化未土旬空出空之日也。',
        yongShen: '父母', yongShenIndex: 6
    },
    {
        gua: '风火家人', yue: '辰', ri: '乙卯', dong: ['巳火'],
        source: '旬空章',
        duan: '丑财持世遇旬空，虽有巳火之生，巳火又化回头之克，不能生丑土之财，此财既无生扶当主难求。又因三月之丑土财还有气，古法有气不为空，不敢竟断，命之再占。合前卦而决之，竟断财无气矣，不必劳心，后果毫厘未获。',
        yongShen: '妻财', yongShenIndex: 2
    },
    {
        gua: '风地观', yue: '寅', ri: '辛卯', dong: ['未土'],
        source: '旬空章',
        duan: '父遇真空，日月伤克，虽则动不为空，疑其伤之太重，命之再占。得履之中孚，又是父动逢空，幸得日月生父，许甲午乙未日必到，果于未日返舍。神无二理，前卦未父持世目下旬空，出空而见父也。',
        yongShen: '父母', yongShenIndex: 4
    },
    {
        gua: '火天大有', yue: '辰', ri: '甲午', dong: ['寅木'],
        source: '独发章',
        duan: '父爻持世，被寅木一爻独发克制，乃身不能动，父灵亦不能动也。欲身动而见父灵，必待冲开寅木之年月。迟旬余再请一卦合而决之，前卦应冲开寅木者申也，后果应申年请准、酉年迎灵而归。此两卦俱是独发，岂可执独发而断？',
        yongShen: '父母', yongShenIndex: 3
    },
    {
        gua: '天火同人', yue: '午', ri: '甲申', dong: ['戌土'],
        source: '独发章',
        duan: '戌土子孙一爻独发，友人谓昨日丙戌定应大晴，如何犹雨？余曰：尔忧麦被水冲，神以子孙发动克去身边之鬼，令尔勿忧，非应晴也；决不至于涨水，阴晴亦在卯日方大晴（动而逢合之日）。果于卯日大晴。',
        yongShen: '子孙', yongShenIndex: 6
    },
    // ==== 策3 扩库 · 求财门 ====
    { gua:'泽火革', yue:'酉', ri:'戊午', dong:[], source:'求财章·父兄爻动无殊缘木求鱼条',
      duan:'断曰：卦中财爻不现，亥水兄爻持世，父临月建，生助兄爻，如缘木以求鱼也。',
      yongShen:'妻财', yongShenIndex:null, yingqiIndex:null,
      note:'财伏不现+兄爻持世+父临月建生兄=缘木求鱼（凶）' },
    { gua:'火水未济', yue:'巳', ri:'丙辰', dong:['巳火','寅木'], source:'求财章·兄如太过反不克财条',
      duan:'断曰：此卦月建世爻，动变之爻，俱是兄弟，占时顺遂，至九月，兄爻入墓，因奸破耗，岂可谓之兄爻太过反不劫其财耶？！',
      yongShen:'妻财', yongShenIndex:4, yingqiIndex:null,
      note:'兄爻太过仍劫财，入墓之日（戌月）破耗' },
    { gua:'火地晋', yue:'未', ri:'丁卯', dong:[], source:'求财章·世遇兄临必难求望条',
      duan:'断曰：兄爻持世，固曰无财，但喜卯日，即是财星。古以财爻克世、冲世者必得；况应爻未土旺而生世，明日必获。果得于辰日。',
      yongShen:'妻财', yongShenIndex:3, yingqiIndex:null,
      note:'兄持世本忌，但日辰卯木作财冲克世，应爻未土旺而生世，反许得财' },
    { gua:'火天大有', yue:'寅', ri:'庚戌', dong:[], source:'求财章·寅月庚戌日占求财',
      duan:'断曰：寅木财爻为用神，临月建而旺相，财爻克世，此财必得。但目下尚空，要到甲寅日出空可得。果于甲寅得之。',
      yongShen:'妻财', yongShenIndex:2, yingqiIndex:2,
      note:'财旺临月+财克世=必得；财爻旬空（寅卯空），出空应期甲寅日' },
    { gua:'水火既济', yue:'巳', ri:'丁巳', dong:['子水','丑土','亥水','卯木'], source:'求财章·世遇兄临条',
      duan:'断曰：若占久远之财，则无财也。若问目下之财，明日戊午必得。其故何也？盖兄临世爻，日破月破，不克变出之财，况日月俱作财来冲世，只因应爻逢空，明日冲实，定送财来。果于次日送来。',
      yongShen:'妻财', yongShenIndex:null, yingqiIndex:null,
      note:'本卦无财，财在变爻/日月。兄临世日破月破+日月作财冲世=目下得财；久远则无' },
    // ==== 功名门 ====
    { gua:'地火明夷', yue:'辰', ri:'乙未', dong:['丑土'], source:'终身功名有无章·鬼财摇发纳粟成名条',
      duan:'此公原是武荫，巳任卑官，因病告退，即无官矣。问将来还有功名否？此卦丑土官星持世，化出午火，财旺生官之兆。卯年占，巳年援例，连连加纳，官至府佐。未年出仕，戌年升任黄堂。',
      yongShen:'官鬼', yongShenIndex:4, yingqiIndex:null,
      note:'官星持世化财回头生=财旺生官成名（吉）' },
    { gua:'泽水困', yue:'戌', ri:'壬子', dong:['寅木'], source:'终身功名有无章·鬼财摇发条',
      duan:'寅财持世，化出官星，终身功名以财而得，但六合变六冲，有始无终之象，恐不能出仕。占后援例考职，双目失明。',
      yongShen:'官鬼', yongShenIndex:3, yingqiIndex:null,
      note:'财化官本吉，但六合（困）变六冲（兑）有始无终=凶' },
    { gua:'山风蛊', yue:'戌', ri:'戊辰', dong:[], source:'终身功名有无章·独旺于官立功建业条',
      duan:'日月作财生世，白虎临金官持世，若入文途，必以援例；若入武途，可以立功。后随营破寨，奋勇当先，主帅嘉之，即以职官。不出五载，连建奇功，官至元戎将军。',
      yongShen:'官鬼', yongShenIndex:3, yingqiIndex:null,
      note:'官星持世+日月生之=立功成名（吉）' },
    { gua:'艮为山', yue:'卯', ri:'甲申', dong:['子水','申金','辰土'], source:'乡试会试章·三合无冲联登甲第条',
      duan:'寅木旺官持世，申日冲之暗动，又得日辰会成财局，不惟不克世爻，反来生世，一定高捷。果得及第。',
      yongShen:'官鬼', yongShenIndex:6, yingqiIndex:null,
      note:'旺官持世+日辰暗动+日辰会财局生世=高捷及第（吉）' },
    // ==== 婚姻门 ====
    { gua:'地火明夷', yue:'未', ri:'己未', dong:['丑土'], source:'婚姻章·男卜女姻财要旺条',
      duan:'断曰：丑官持世，虽临月破日破，幸得动化财爻回头之生，目下虽破，终有不破之时。明岁丑年，定逢佳偶。果次年四月得配良姻。',
      yongShen:'妻财', yongShenIndex:null, yingqiIndex:4,
      note:'本卦无财，财在变爻（世化财回头生）。官持世化财回头生=财来生世/官（吉）；世爻月破日破，出破之年应佳偶' },
    { gua:'雷风恒', yue:'子', ri:'癸酉', dong:['戌土'], source:'婚姻章·子月癸酉日自占婚',
      duan:'断曰：酉官持世，戌土财爻动而生之，又得世应相生，戌土虽值旬空，动不为空，明日出空之日，求之必允。果于次日巳时允婚，夫妇白头相守，儿女成行。',
      yongShen:'妻财', yongShenIndex:6, yingqiIndex:6,
      note:'财爻戌土动而生世（官）+世应相生=白头偕老（吉）' },
    { gua:'地泽临', yue:'寅', ri:'丙午', dong:['亥水','丑土'], source:'婚姻章·财值休囚破散条',
      duan:'觉子曰：女家占男，以官为用，以应爻为男家，此古法也，亦死法也。此一卦也，关乎男女二人，财被回头克，又逢丑土之克，如何能生卯木之官？男女不能相合相生，婚姻虽成，亦当有变。后果聘定于四月，未及成婚，被贼兵于四月内劫去。',
      yongShen:'官鬼', yongShenIndex:2, yingqiIndex:null,
      note:'女家代占男，官持世婚必成，但财被回头克+丑土克=男女不相生，成而有变（凶）' },
    { gua:'地天泰', yue:'酉', ri:'辛巳', dong:[], source:'夫妇章·财旺兄衰终须反目条',
      duan:'兄爻持世，以克妻财，幸亥水财爻，酉月生之，财旺，难于克害。余曰：巳日冲动亥水，又临驿马，妻财临马而暗动，心去难留，生离之象也。后竟生离。',
      yongShen:'妻财', yongShenIndex:5, yingqiIndex:null,
      note:'兄持世克财+财临马暗动（心去难留）=生离（凶）' },
    // ==== 疾病门 ====
    { gua:'水雷屯', yue:'午', ri:'甲寅', dong:['子水','寅木'], source:'医占往治章·弟占兄病',
      duan:'余即笑而言曰：列位放心，今日半夜退灾，明日卯日即起床矣。此卦中之子孙爻者，是药耶？是解忧之神耶？盖此人虽是险症，其实乃近病，子水兄爻值旬空，近病逢空即愈，值半夜子时而不空也。果于子时退灾，次日起床。',
      yongShen:'兄弟', yongShenIndex:6, yingqiIndex:6,
      note:'弟占兄病，用神兄子水旬空+近病逢空即愈+子孙解忧=半夜退灾（吉）' },
    { gua:'雷风恒', yue:'申', ri:'庚寅', dong:['酉金'], source:'疾病章·用化鬼鬼化用慎防不测条',
      duan:'断曰：鬼变子孙，夭折之兆，幸子孙临旬空，近病即愈，恐其难过午年。果在出空之日而愈。辰年占卦，至午年痘症而死。',
      yongShen:'子孙', yongShenIndex:4, yingqiIndex:4,
      note:'占子近病，鬼变子孙本夭折兆，幸子孙旬空近病即愈（先吉），午年出空犯鬼死（后凶）' },
    { gua:'天山遁', yue:'申', ri:'壬子', dong:[], source:'疾病章·鬼持世病虽轻而难疗条',
      duan:'断曰：令郎今日即愈。彼问：何以知之？余曰：官鬼持世，尔之忧也，今日子日，冲去忧心，管许立愈。果愈于本日。',
      yongShen:'子孙', yongShenIndex:null, yingqiIndex:null,
      note:'代占子病，子孙伏初爻辰下（本卦无子孙）。官鬼持世=忧神非病，子日冲去忧心立愈（吉）' },
    { gua:'坤为地', yue:'寅', ri:'乙未', dong:['巳火','卯木'], source:'痘疹章·占女儿痘',
      duan:'酉金子孙，虽则春令休囚，得日辰生之，二爻巳火动而克金，得未日冲动丑土，火动生土，土动生金，花虽密而无妨，今日未申时有救。果于申时得明医救治。',
      yongShen:'子孙', yongShenIndex:6, yingqiIndex:null,
      note:'占女儿痘，用神子孙酉金休囚得日生+忌神父巳火动克，火生土土生金=有救（吉）' }
];

/**
 * R6-1 原案例匹配：同卦同时辰（或同卦）命中返回原例，否则 null
 * @param {string} guaMing - 本卦卦名
 * @param {string} riChen - 日辰干支（如"庚子"）
 * @param {string} [yueJian] - 月建地支（可选，二次限定）
 * @returns {object|null}
 */
function findAnli(guaMing, riChen, yueJian) {
    if (!guaMing || !riChen) return null;
    return ANLI.find(a => a.gua === guaMing && a.ri === riChen && (!yueJian || a.yue === yueJian)) || null;
}
