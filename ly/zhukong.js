// ============================================================
// zhukong.js - 主控层（DOM 操作 + 事件绑定 + 流程编排）
// 职责：串联 shuju.js 数据层与 suanfa.js 算法层，驱动界面交互
// 依赖：shuju.js（ALL_GUA_DATA / GUA_XIANG / GUA_SYMBOL）
//       suanfa.js（jiSuanLiuQin / paiLiuShen / paiPanDaiFuShen 等）
//       lunar.js（Solar.fromYmd 取日干）
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // 1. DOM 引用
    // ============================================================
    const coinEls = [
        document.getElementById('coin1'),
        document.getElementById('coin2'),
        document.getElementById('coin3')
    ];
    const shakeBtn = document.getElementById('shakeBtn');
    const completeBtn = document.getElementById('completeBtn');
    const interpretBtn = document.getElementById('interpretBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progressText = document.getElementById('progressText');
    const resultArea = document.getElementById('resultArea');

    // 模式切换相关
    const coinArea = document.getElementById('coinArea');
    const modeCoinBtn = document.getElementById('modeCoinBtn');
    const modeInputBtn = document.getElementById('modeInputBtn');
    const inputArea = document.getElementById('inputArea');
    const yaoInputContainer = document.getElementById('yaoInputContainer');

    // ============================================================
    // 2. 状态
    // ============================================================
    let yaoResults = [];      // 6元数组，1=阳 0=阴
    let dongStatus = [];      // 6元数组，true=动爻
    let currentStep = 0;      // 当前已摇爻数
    let isShaking = false;    // 防抖
    let isCoinMode = true;    // true=铜钱摇卦, false=手动输卦

    // ============================================================
    // 3. 爻象四象定义（手动输卦用）
    //    值遵循传统：6老阴（动） 7少阳（静） 8少阴（静） 9老阳（动）
    // ============================================================
    const YAO_OPTIONS = [
        { value: '6', text: '老阴（动）', symbol: '× × ×', yin: true,  dong: true  },
        { value: '7', text: '少阳（静）', symbol: '⚊',     yin: false, dong: false },
        { value: '8', text: '少阴（静）', symbol: '⚋',     yin: true,  dong: false },
        { value: '9', text: '老阳（动）', symbol: '○ ○ ○', yin: false, dong: true  }
    ];

    // ============================================================
    // 4. 摇卦
    // ============================================================
    function shakeOnce() {
        if (isShaking) return;
        if (currentStep >= 6) {
            shakeBtn.disabled = true;
            completeBtn.disabled = false;
            return;
        }

        isShaking = true;
        shakeBtn.disabled = true;

        // 三枚铜钱：1=阳面，0=阴面
        const coins = [
            Math.random() < 0.5 ? 1 : 0,
            Math.random() < 0.5 ? 1 : 0,
            Math.random() < 0.5 ? 1 : 0
        ];
        const sum = coins.reduce((a, b) => a + b, 0);

        // 三阳(3)→老阳(动)  三阴(0)→老阴(动)
        // 二阳一阴(2)→少阳  一阳二阴(1)→少阴
        let yao = 1;
        let isDong = false;
        if (sum === 3)      { yao = 1; isDong = true;  }
        else if (sum === 0) { yao = 0; isDong = true;  }
        else if (sum === 2) { yao = 1; isDong = false; }
        else if (sum === 1) { yao = 0; isDong = false; }

        yaoResults.push(yao);
        dongStatus.push(isDong);
        currentStep++;

        // 铜钱动画
        const coinSymbols = coins.map(c => c === 1 ? '⚊' : '⚋');
        coinEls.forEach((el, idx) => {
            el.textContent = coinSymbols[idx];
            el.className = 'coin flipping';
            el.classList.add(coins[idx] === 1 ? 'face-yang' : 'face-yin');
            setTimeout(() => el.classList.remove('flipping'), 500);
        });

        progressText.textContent = '第 ' + currentStep + ' / 6 爻';

        if (currentStep >= 6) {
            shakeBtn.disabled = true;
            completeBtn.disabled = false;
            progressText.textContent = '✅ 六爻具备';
            isShaking = false;
            return;
        }

        setTimeout(() => {
            shakeBtn.disabled = false;
            isShaking = false;
        }, 400);
    }

    // ============================================================
    // 5. 完成排盘
    // ============================================================
    function completeAndDisplay() {
        if (currentStep < 6) {
            alert('请先完成六爻摇卦！');
            return;
        }

        const benPattern = yaoToPattern(yaoResults);
        const bianPattern = getBianPattern(yaoResults, dongStatus);

        const benGua = getGuaByPattern(benPattern);
        const bianGua = getGuaByPattern(bianPattern);

        if (!benGua) {
            resultArea.innerHTML =
                '<div class="result-placeholder" style="color:#a55;">' +
                '⚠️ 未找到对应的本卦。<br>' +
                '<span style="font-size:12px;">摇出的六爻序列: [' + yaoResults.join(', ') + '] (0=阴, 1=阳)</span>' +
                '</div>';
            return;
        }

        if (!bianGua) {
            resultArea.innerHTML =
                '<div class="result-placeholder" style="color:#a55;">' +
                '⚠️ 未找到对应的变卦。<br>' +
                '<span style="font-size:12px;">变卦序列: [' + yaoResults.map((y, idx) => dongStatus[idx] ? (1 - y) : y).join(', ') + '] (0=阴, 1=阳)</span>' +
                '</div>';
            return;
        }

        renderFinalResult(benGua, bianGua, yaoResults, dongStatus);
        shakeBtn.disabled = true;
        completeBtn.disabled = true;
        interpretBtn.disabled = false;
    }

    // ============================================================
    // 6. 构建卦象 HTML（核心渲染函数）
    //    改造要点：六亲由 suanfa.js 实时计算，本卦显示伏神
    // ============================================================
    function buildGuaHtml(gua, yaoResultsArr, dongStatusArr, label, isBian, benWuXing, dayGan) {
        const shiYao = gua.世爻;
        const yingYao = gua.应爻;
        const liuShenArr = getLiuShenSeq(dayGan);

        // 获取增强排盘数据（含实时六亲 + 伏神）
        let panData;
        if (isBian) {
            // 变卦六亲铁律：以本卦宫位五行为"我"
            panData = paiPanBianGua(gua.卦名, benWuXing);
        } else {
            // 本卦：含伏神
            panData = paiPanDaiFuShen(gua.卦名);
        }

        if (!panData) return '<div>排盘数据异常</div>';

        let yaoHtml = '';
        for (let i = 0; i < 6; i++) {
            const yd = panData.yaoData[i];
            const yaoIdx = i;

            // 世应标签（变卦不显示）
            let tag = '';
            if (!isBian) {
                if ((yaoIdx + 1) === shiYao) tag = '世';
                else if ((yaoIdx + 1) === yingYao) tag = '应';
            }

            // 爻象符号：阳爻 ━━━，阴爻 ━ ━
            const yaoSymbol = yd.isYin ? '━ ━' : '━━━';

            // 纳甲（天干+地支+五行）
            const najia = yd.tianGan + yd.diZhi + (DIZHI_WUXING[yd.diZhi] || '');

            // 六亲（实时计算）
            const liuqin = yd.liuQin;

            // 六神
            const liuShen = liuShenArr[i];

            // 伏神小字（仅本卦显示）
            let fuShenHtml = '';
            if (!isBian && yd.fuShen) {
                fuShenHtml = '<span class="fu-shen">伏' + yd.fuShen.fuShenLiuQin + yd.fuShen.fuShenDizhi + '</span>';
            }

            // 动变标记
            let dongMark = '';
            const isDong = dongStatusArr ? dongStatusArr[yaoIdx] : false;
            if (!isBian && dongStatusArr && dongStatusArr[yaoIdx]) {
                dongMark = yaoResultsArr[yaoIdx] === 1 ? '○' : '×';
            }

            const dongClass = isDong ? 'dong' : '';

            yaoHtml +=
                '<div class="yao-row ' + dongClass + '">' +
                    '<span class="yao-liushen">' + liuShen + '</span>' +
                    '<span class="yao-yaoxiang">' + yaoSymbol + '</span>' +
                    '<span class="yao-najia">' + najia + '</span>' +
                    '<span class="yao-liuqin">' + liuqin + fuShenHtml + '</span>' +
                    '<span class="yao-shiying">' + tag + '</span>' +
                    '<span class="yao-dong-mark">' + dongMark + '</span>' +
                '</div>';
        }

        // 伏神提示行（仅本卦有伏神时显示）
        let fuShenTip = '';
        if (!isBian && panData.fuShenList && panData.fuShenList.length > 0) {
            const tips = panData.fuShenList.map(f =>
                '伏' + f.fuShenLiuQin + '(' + f.fuShenTianGan + f.fuShenDizhi + ')于' + f.fuShenYaoWei + '爻飞神下'
            ).join('；');
            fuShenTip = '<div style="font-size:11px;color:#8a6a4a;text-align:center;margin-top:4px;background:#ede3d7;padding:4px;border-radius:20px;">🔑 ' + tips + '</div>';
        }

        return (
            '<div style="background:#f8f1e8;border-radius:16px;padding:12px;border:1px solid #d5c6b4;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dacfc1;padding-bottom:8px;margin-bottom:10px;">' +
                    '<span style="font-weight:bold;font-size:18px;color:#3f2e1e;">' + label + '</span>' +
                    '<span style="font-size:13px;color:#7d6b58;background:#e6dbce;padding:0 14px;border-radius:30px;">' + gua.卦名 + ' · ' + gua.宫 + '</span>' +
                '</div>' +
                '<div class="yao-grid">' + yaoHtml + '</div>' +
                fuShenTip +
                '<div style="display:flex;gap:20px;justify-content:center;font-size:12px;color:#6b5844;margin-top:10px;background:#ede3d7;padding:6px;border-radius:30px;">' +
                    '<span>世：' + shiYao + '爻</span>' +
                    '<span>应：' + yingYao + '爻</span>' +
                '</div>' +
            '</div>'
        );
    }

    // ============================================================
    // 7. 渲染最终结果
    // ============================================================
    function renderFinalResult(benGua, bianGua, yaoResultsArr, dongStatusArr) {
        // 取日干（六神依日辰而定）
        const now = new Date();
        let dayGan = '甲';
        try {
            dayGan = Solar.fromYmd(now.getFullYear(), now.getMonth() + 1, now.getDate())
                .getLunar().getDayInGanZhi().charAt(0);
        } catch(e) {
            console.warn('取日干失败，使用默认值甲:', e);
        }

        const benHtml = buildGuaHtml(benGua, yaoResultsArr, dongStatusArr, '本卦', false, benGua.五行, dayGan);
        const bianHtml = buildGuaHtml(bianGua, null, null, '变卦', true, benGua.五行, dayGan);
        const hasDong = dongStatusArr.some(d => d === true);

        const benSymbol = GUA_SYMBOL[benGua.上卦] + GUA_SYMBOL[benGua.下卦];
        const bianSymbol = GUA_SYMBOL[bianGua.上卦] + GUA_SYMBOL[bianGua.下卦];

        let html =
            '<div class="gua-result">' +
                '<div class="gua-title">' +
                    '<span>📜 卦象 ' + benSymbol + ' → ' + bianSymbol + '</span>' +
                    '<span class="gua-sub">' + (hasDong ? '⚡ 动爻 · 事有变数' : '🌿 静爻 · 卦象不移') + '</span>' +
                '</div>' +
                '<div style="text-align:center;font-size:13px;color:#5a4632;margin-bottom:12px;letter-spacing:2px;">' +
                    '<span class="mapping-status">✅ 本卦：' + benGua.卦名 + '（' + benGua.宫 + '）</span>' +
                    '<span class="mapping-status" style="margin-left:14px;">✅ 变卦：' + bianGua.卦名 + '（' + bianGua.宫 + '）</span>' +
                '</div>' +
                '<div class="flex-row">' +
                    '<div class="gua-box">' + benHtml + '</div>' +
                    '<div class="gua-box">' + bianHtml + '</div>' +
                '</div>' +
                '<div style="margin-top:10px; font-size:13px; color:#7a6652; text-align:center; background:#ede3d7; padding:8px; border-radius:40px;">' +
                    '🧘 世应之爻，已标于卦中 · 动爻以 <span style="color:#b33;font-weight:bold;">红</span> 色高亮' +
                '</div>' +
            '</div>';
        resultArea.innerHTML = html;

        // ===== 保存卦象数据到 localStorage（供释卦页面使用）=====
        // 使用 paiPanDaiFuShen / paiPanBianGua 获取增强数据
        const benPan = paiPanDaiFuShen(benGua.卦名);
        const bianPan = paiPanBianGua(bianGua.卦名, benGua.五行);

        // 转换为与原版兼容的爻位格式（含六亲字段）
        const benYaoCompat = benPan.yaoData.map(y => ({
            爻: y.yaoWei,
            天干: y.tianGan,
            地支: y.diZhi,
            六亲: y.liuQin
        }));
        const bianYaoCompat = bianPan.yaoData.map(y => ({
            爻: y.yaoWei,
            天干: y.tianGan,
            地支: y.diZhi,
            六亲: y.liuQin
        }));

        const guaData = {
            // 基础信息
            benGuaName: benGua.卦名,
            benPalace: benGua.宫,
            bianGuaName: bianGua.卦名,
            bianPalace: bianGua.宫,
            dongYao: yaoResultsArr.map((y, idx) => dongStatusArr[idx] ? idx + 1 : null).filter(d => d !== null),
            yaoResults: yaoResultsArr,
            dongStatus: dongStatusArr,
            benYao: benYaoCompat,
            bianYao: bianYaoCompat,

            // 世应位置
            shiYao: benGua.世爻,
            yingYao: benGua.应爻,

            // 动爻详情（含变化后的地支和六亲）
            dongDetail: benPan.yaoData.map((yao, idx) => {
                if (dongStatusArr[idx]) {
                    const bianYaoInfo = bianPan.yaoData[idx];
                    return {
                        yaoIndex: idx + 1,
                        dizhi: yao.diZhi,
                        liuqin: yao.liuQin,
                        bianDizhi: bianYaoInfo ? bianYaoInfo.diZhi : '',
                        bianLiuqin: bianYaoInfo ? bianYaoInfo.liuQin : ''
                    };
                }
                return null;
            }).filter(d => d !== null),

            // 伏神信息（新增，供释卦页面增强使用）
            benFuShen: benPan.fuShenList,
            benMissingLiuQin: benPan.missingLiuQin,

            // 时间信息
            time: new Date().toLocaleString()
        };

        try {
            localStorage.setItem('currentGua', JSON.stringify(guaData));
            console.log('✅ 卦象数据已保存到 localStorage（含世应、动变详情、伏神）');
        } catch(e) {
            console.warn('保存卦象数据失败:', e);
        }


// 保存求卦者信息
const userInfo = {
    name: document.getElementById('userName').value || '',
    gender: document.getElementById('userGender').value || '男',
    birth: document.getElementById('userBirth').value || '',
    question: document.getElementById('userQuestion').value || ''
};

try {
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
} catch(e) {}

// 追加历史记录
try {
    const history = JSON.parse(localStorage.getItem('guaHistory') || '[]');
    // 去重：同一秒内重复排盘（同卦同变卦同时刻）不重复追加，防止历史膨胀
    const dup = history.some(h =>
        h.benGua === guaData.benGuaName
        && h.bianGua === guaData.bianGuaName
        && h.time === guaData.time
    );
    if (!dup) {
        history.push({
            benGua: guaData.benGuaName,
            bianGua: guaData.bianGuaName,
            dongYao: guaData.dongYao,
            question: (userInfo.name ? '【' + userInfo.name + '】' : '') + (userInfo.question || ''),
            time: guaData.time,
            userInfo: { 
                name: userInfo.name, 
                gender: userInfo.gender, 
                birth: userInfo.birth, 
                question: userInfo.question 
            },
            timeInfo: null,
            result: '',
            modelName: ''
        });
        localStorage.setItem('guaHistory', JSON.stringify(history));
    }
} catch(e) {
    console.warn('保存历史记录失败:', e);
        }
    }
    // ============================================================
    // 8. 重置
    // ============================================================
    function resetAll() {
        yaoResults = [];
        dongStatus = [];
        currentStep = 0;
        isShaking = false;

        coinEls.forEach(el => {
            el.textContent = '⚊';
            el.className = 'coin face-yang';
        });

        // 重置手动输卦下拉框（默认回到少阳·静，与初始一致）
        if (yaoInputContainer) {
            const defaultVal = YAO_OPTIONS[1].value; // '7' 少阳（静）
            yaoInputContainer.querySelectorAll('select').forEach(sel => {
                sel.value = defaultVal;
                const yaoIdx = sel.getAttribute('data-yao');
                const preview = yaoInputContainer.querySelector('[data-preview="' + yaoIdx + '"]');
                if (preview) {
                    const opt = YAO_OPTIONS.find(o => o.value === defaultVal);
                    preview.textContent = opt ? opt.symbol : '';
                }
            });
        }

        progressText.textContent = '第 0 / 6 爻';
        shakeBtn.disabled = false;
        completeBtn.disabled = isCoinMode ? (currentStep < 6) : false;
        interpretBtn.disabled = true;

        resultArea.innerHTML = '<div class="result-placeholder">静心凝神，摇动铜钱，以决疑事</div>';
    }

    // ============================================================
    // 9. 手动输卦
    // ============================================================
    function createYaoInputs() {
        yaoInputContainer.innerHTML = '';
        for (let i = 6; i >= 1; i--) {
            const row = document.createElement('div');
            row.className = 'yao-input-row';
            row.innerHTML =
                '<span class="yao-input-label">第' + i + '爻</span>' +
                '<select data-yao="' + i + '">' +
                    YAO_OPTIONS.map(o => '<option value="' + o.value + '"' + (o.value === '7' ? ' selected' : '') + '>' + o.text + '</option>').join('') +
                '</select>' +
                '<span class="yao-preview" data-preview="' + i + '">' + YAO_OPTIONS[1].symbol + '</span>';
            yaoInputContainer.appendChild(row);
        }
        // 绑定 change 事件：实时更新预览符号
        yaoInputContainer.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', function() {
                const yaoIdx = this.getAttribute('data-yao');
                const opt = YAO_OPTIONS.find(o => o.value === this.value);
                const preview = yaoInputContainer.querySelector('[data-preview="' + yaoIdx + '"]');
                if (preview && opt) preview.textContent = opt.symbol;
            });
        });
    }

    // 统一「排盘」入口
    function doPaiPan() {
        if (isCoinMode) {
            if (currentStep < 6) {
                alert('请先摇动铜钱 6 次，再点击「排盘」');
                return;
            }
            completeAndDisplay();
        } else {
            confirmInput();
            completeBtn.disabled = false;
        }
    }

    // 模式切换
    function switchMode(isCoin) {
        isCoinMode = isCoin;
        if (isCoinMode) {
            coinArea.style.display = '';
            inputArea.style.display = 'none';
            modeCoinBtn.classList.add('active');
            modeInputBtn.classList.remove('active');
            resetAll();
        } else {
            coinArea.style.display = 'none';
            inputArea.style.display = '';
            modeCoinBtn.classList.remove('active');
            modeInputBtn.classList.add('active');
            shakeBtn.disabled = true;
            completeBtn.disabled = false;
            interpretBtn.disabled = true;
        }
    }

    // 确认手动输卦排盘
    function confirmInput() {
        yaoResults = [];
        dongStatus = [];
        for (let i = 1; i <= 6; i++) {
            const sel = yaoInputContainer.querySelector('select[data-yao="' + i + '"]');
            const opt = YAO_OPTIONS.find(o => o.value === sel.value);
            if (!opt) { alert('第' + i + '爻选择有误，请重新选择'); return; }
            yaoResults.push(opt.yin ? 0 : 1);
            dongStatus.push(opt.dong);
        }
        currentStep = 6;
        progressText.textContent = '✅ 六爻具备';
        completeAndDisplay();
    }

    // ============================================================
    // 10. 事件绑定
    // ============================================================
    shakeBtn.addEventListener('click', shakeOnce);
    completeBtn.addEventListener('click', doPaiPan);
    interpretBtn.addEventListener('click', function() {
        const guaDataRaw = localStorage.getItem('currentGua');
        if (!guaDataRaw) {
            alert('请先排盘后再点击「释卦」！');
            return;
        }
        try { sessionStorage.setItem('currentGua', guaDataRaw); } catch(e) {} // 保留兜底兼容（供无 id 时回退）
        // rw9bd 第二刀：净化跳转——完整卦象藏 localStorage，URL 仅携带唯一 id
        // 釜底抽薪：杜绝 guaData 序列化塞入 URL 导致链接冗长与数据泄露
        const id = Date.now();
        try { localStorage.setItem('gua_' + id, guaDataRaw); } catch(err) {}
        window.location.href = 'jiegua.html?id=' + id;
    });
    resetBtn.addEventListener('click', resetAll);

    modeCoinBtn.addEventListener('click', function() { switchMode(true); });
    modeInputBtn.addEventListener('click', function() { switchMode(false); });

    // ============================================================
    // 11. 初始化
    // ============================================================
    resetAll();
    createYaoInputs();

    console.log('✅ 六爻排盘系统已加载（模块化版）');
    console.log('📊 共 ' + ALL_GUA_DATA.length + ' 个卦，' + Object.keys(patternToGua).length + ' 种唯一模式。');
})();
