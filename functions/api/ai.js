// 增删卜易 · AI 释卦代理（Cloudflare Pages Functions）
// 前端 POST { modelKey, systemPrompt, userPrompt } 到 /api/ai，
// 本函数以服务端环境变量中的密钥调用阿里云百炼，返回解读文本；密钥永不进入前端。
//
// 请求体：{ "modelKey": "qwen" | "qwen2", "systemPrompt": "...", "userPrompt": "..." }
// 返回：{ "content": "AI 解读文本" } 或 { "error": "错误说明" }
//
// 环境变量（Cloudflare 控制台配置，改后需重新部署生效）：
//   QWEN_API_KEY  = 主力（qwen-max）的 apiKey
//   QWEN2_API_KEY = 备选（qwen3.7-flash）的 apiKey
//   AI_GATE_TOKEN = 可选；配置后请求需携带 x-ai-token 头，防未授权脚本盗用额度
// GET /api/ai 可作健康检查。

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ai-token',
  'Access-Control-Max-Age': '86400',
};

// 来源白名单：浏览器跨站请求按 Origin/Referer 校验，未命中返回 403；无来源头的直连请求（curl/同源）放行
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
  qwen: 'qwen-max',
  qwen2: 'qwen3.7-flash',
};

function json(body, status, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    CORS,
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

// 上游错误如实呈现（原文 + HTTP 状态码），仅对可明确判定的类别附客观说明，不臆测原因
function friendlyError(message, status) {
  const m = (message || '').toString().trim();
  const fact = '上游返回（HTTP ' + (status || '?') + '）：' + (m || '无错误详情');
  if (status === 401 || /invalidapikey|unauthorized|invalid api key|access denied/i.test(m)) {
    return fact + ' —— API Key 认证失败，请核对环境变量 QWEN_API_KEY / QWEN2_API_KEY';
  }
  if (/model.*(not.*exist|not found|not support)|invalid.*model|modelname/i.test(m)) {
    return fact + ' —— 模型名称无效或不存在，请核对百炼控制台实际模型名';
  }
  if (status === 429 || /throttl|rate.?limit|too many requests|slow down/i.test(m)) {
    return fact + ' —— 触发限流，请稍后重试';
  }
  return fact;
}

// 来源判定：有 Origin 头按白名单校验；无 Origin 有 Referer 取源校验；均无则放行（curl 调试）
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
