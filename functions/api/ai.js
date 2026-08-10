// zsby/functions/api/ai.js（本仓库根，Cloudflare Pages Functions）
// 增删卜易 · AI 释卦代理（Cloudflare Pages Functions）
// 作用：前端把 { modelKey, systemPrompt, userPrompt } POST 到 /api/ai，
//       由本函数用服务端环境变量中的密钥调用阿里云百炼，返回解读文本。
//       密钥只存于 Cloudflare 环境变量，永不进入前端代码 / 浏览器。
//
// 部署：此文件位于本仓库 functions/api/ai.js（必须在仓库根），由 Cloudflare Pages 自动构建，无需额外配置。
// 路径：POST /api/ai（相对路径，随部署域名自动适配）
// 请求体：{ "modelKey": "qwen" | "qwen2", "systemPrompt": "...", "userPrompt": "..." }
// 返回：{ "content": "AI 解读文本" } 或 { "error": "错误说明" }
//
// ⚠️ 环境变量（必须在 Cloudflare 控制台配置，配置后需重新部署一次生效）：
//     Pages 项目（本仓库对应项目）→ Settings → Environment variables → Add variable：
//       QWEN_API_KEY   = 主力千问（qwen3.7-flash-2026-07-15）的 apiKey
//       QWEN2_API_KEY  = 备选千问（qwen3.7-flash）的 apiKey
//       AI_GATE_TOKEN  = 可选。配置后请求需携带 x-ai-token 请求头，用于防止
//                        未授权脚本盗用本代理消耗额度。
//     GET /api/ai 可作健康检查。
// 安全防护：来源白名单校验（Origin/Referer），第三方站点无法伪造浏览器来源，
//           无来源头的直连请求（curl 调试）仍放行。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ai-token',
  'Access-Control-Max-Age': '86400',
};

// 允许的来源白名单（浏览器跨站请求由 Origin 头判定，第三方站点无法伪造）
// 未命中时返回 403，防止他人盗用本代理消耗 API 额度。
// 无 Origin/Referer 的请求（如 curl 直连调试、同源发起）视为可信，放行。
// ⚠️ 部署到新域名（非 dxwj.pages.dev）时，须在此数组追加该域名，否则前端请求被 403。
const ALLOWED_ORIGINS = [
  'https://dxwj.pages.dev',
  'https://zsby.pages.dev',
  'https://dxzsby.pages.dev',
  'http://localhost',
  'http://127.0.0.1',
];

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// 模型名映射（只改这里即可切换模型，前端无需变动）
const MODELS = {
  qwen: 'qwen3.7-flash',
  qwen2: 'deepseek-v4-flash-0731',
};

function json(body, status, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    CORS,
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

// 上游错误友好化：把百炼的英文错误映射为可操作的中文提示（保留未知错误原文）
function friendlyError(message, status) {
  const m = (message || '').toString();
  if (/free quota|quota exhausted|quota insufficient|quota has been used up|quota exceeded/i.test(m)) {
    return '模型免费额度已用尽：请在阿里云百炼控制台关闭"仅免费额度"模式（开通按量付费）或充值后重试，或更换未欠费的 API Key';
  }
  if (/arrearage|arrears|欠费|no balance|insufficient balance/i.test(m)) {
    return '账户欠费或未开通按量付费：请在阿里云百炼控制台充值并开通按量付费后重试';
  }
  if (/invalidapikey|unauthorized|invalid api key|access denied/i.test(m)) {
    return 'API Key 无效或已失效：请核对服务端 QWEN_API_KEY / QWEN2_API_KEY 环境变量后重新部署';
  }
  if (/model.*(not.*exist|not found|not support)|invalid.*model|modelname/i.test(m)) {
    return '模型不存在或未开通访问权限：请确认百炼控制台已开通对应模型';
  }
  if (/throttl|rate.?limit|too many requests|slow down/i.test(m)) {
    return '请求过于频繁，已触发限流，请稍后重试';
  }
  if (status === 429) return '请求过多或额度受限（HTTP 429），请稍后重试';
  if (status === 401) return '身份认证失败（HTTP 401）：请检查 API Key 是否有效';
  return message;
}

// 判定请求来源是否可信：
// - 有 Origin 头（浏览器跨站请求）：须命中白名单前缀（含端口）
// - 有 Referer 头：取源（scheme+host）校验
// - 均无（curl 直连 / 同源）：放行，保留调试能力
function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin) {
    return ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ':') || origin.startsWith(o + '/'));
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const url = new URL(referer);
      const key = url.origin;
      return ALLOWED_ORIGINS.some((o) => key === o || key.startsWith(o + ':') || key.startsWith(o + '/'));
    } catch (e) {
      return false;
    }
  }
  return true;
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet() {
  return json({ ok: true, service: 'daoxuan-ai', ts: Date.now() });
}

export async function onRequestPost(context) {
  return handle(context.request, context.env);
}

async function handle(request, env) {
  // 来源校验：第三方站点（含其他域名下嵌入的前端）一律拒绝
  if (!isAllowedOrigin(request)) {
    return json({ error: '禁止的请求来源' }, 403);
  }

  // 可选令牌防护（纵深防御）：配置 AI_GATE_TOKEN 后需请求头携带 x-ai-token
  // 未配置该环境变量时跳过此校验，保持向后兼容
  if (env.AI_GATE_TOKEN) {
    const token = request.headers.get('x-ai-token');
    if (token !== env.AI_GATE_TOKEN) {
      return json({ error: '未授权访问' }, 403);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const modelKey = body.modelKey === 'qwen2' ? 'qwen2' : 'qwen';
  const systemPrompt = (body.systemPrompt || '').trim();
  const userPrompt = (body.userPrompt || '').trim();
  if (!systemPrompt || !userPrompt) {
    return json({ error: '缺少 systemPrompt 或 userPrompt' }, 400);
  }

  const apiKey = modelKey === 'qwen2' ? env.QWEN2_API_KEY : env.QWEN_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 ' + (modelKey === 'qwen2' ? 'QWEN2_API_KEY' : 'QWEN_API_KEY') + ' 环境变量' }, 500);
  }

  const model = MODELS[modelKey];

  try {
    const upstream = await fetch(BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 2048
      })
    });

    if (!upstream.ok) {
      let message = '上游 HTTP ' + upstream.status;
      try {
        const err = await upstream.json();
        if (err && err.error && err.error.message) message = err.error.message;
      } catch (e) { /* 忽略非 JSON 响应 */ }
      return json({ error: friendlyError(message, upstream.status) }, 502);
    }

    const data = await upstream.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    if (!content) {
      return json({ error: '上游返回为空' }, 502);
    }
    return json({ content: content });

  } catch (e) {
    return json({ error: '释卦服务异常：' + e.message }, 500);
  }
}
