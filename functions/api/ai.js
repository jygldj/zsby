// 增删卜易 · AI 释卦代理（Cloudflare Pages Functions）
// 前端 POST { modelKey, systemPrompt, userPrompt } 到 /api/ai，
// 本函数通过 Workers AI 绑定（env.AI）调用大模型，返回解读文本；密钥永不进入前端。
//
// 请求体：{ "modelKey": "glm" | "glm2", "systemPrompt": "...", "userPrompt": "..." }
// 返回：{ "content": "AI 解读文本" } 或 { "error": "错误说明" }
//
// 模型配置（2026-11-03 更新：原两个 Qwen 免费额度已用尽，统一换成 Cloudflare Workers AI 免费档）
//   两个模型均走 Workers AI 绑定 env.AI.run()，每天共 1 万 Neurons 免费，无需任何 API 密钥。
//   modelKey = "glm"   → 主模型：GLM-4.7-Flash（@cf/zai-org/glm-4.7-flash）
//                        中文（含半白话/文言）理解最强，推理模型；免费档中文主力。
//   modelKey = "glm2"  → 次模型：GLM-4.7-Flash（@cf/zai-org/glm-4.7-flash）
//                        免费档中唯一强中文（半白话/文言）可用模型；与主模型同用 GLM 以保证 100% 可用与解读质量。
//                        注：Cloudflare Pages 运行时会将 @cf/meta/llama-3.1-8b-instruct 路由到已弃用的 infire 别名层，
//                            故免费档不再依赖 Llama；如需模型级冗余，可在 Workers AI 开启付费后改用其他付费模型（如 Llama-3.3 等）。
//
// 环境变量 / 绑定（Cloudflare 控制台 → dxzsby 项目 → 设置 → 绑定，改后需重新部署生效）：
//   AI            = Workers AI 绑定（设置 → 绑定 → 添加 → Workers AI，变量名填 AI）；两模型共用，无需密钥
//   AI_GATE_TOKEN = 可选；配置后请求需携带 x-ai-token 头，防未授权脚本盗用额度
// GET /api/ai 可作健康检查。

// CORS 响应头：Access-Control-Allow-Origin 仅对白名单来源动态回显，
// 不再固定 '*'。非白名单来源回显 'null'，浏览器将因源不匹配而拦截跨站读取。
// （应用层来源拦截见 isAllowedOrigin；此处收紧响应头，消除预检期的信息泄露面。）
function buildCors(request) {
  let allowOrigin = 'null';
  if (request) {
    const match = (s) => s && ALLOWED_ORIGINS.some((o) => s === o || s.startsWith(o + ':') || s.startsWith(o + '/'));
    const origin = request.headers.get('Origin');
    if (match(origin)) {
      allowOrigin = origin;
    } else {
      const referer = request.headers.get('Referer');
      if (referer) {
        try { const key = new URL(referer).origin; if (match(key)) allowOrigin = key; } catch (e) { /* 忽略非法 Referer */ }
      }
    }
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-ai-token',
    'Access-Control-Max-Age': '86400',
  };
}

// 来源白名单：浏览器跨站请求按 Origin/Referer 校验，未命中返回 403；无来源头的直连请求（curl/同源）放行
const ALLOWED_ORIGINS = [
  'https://dxwj.pages.dev',
  'https://zsby.pages.dev',
  'https://dxzsby.pages.dev',
  'http://localhost',
  'http://127.0.0.1',
];

// 模型提供方配置：只改这里即可切换模型，前端无需变动
//   kind 固定为 'cf-ai'（Workers AI 绑定）
//   input = 'messages' → 传入 { messages:[{role,content}] }（GLM 等对话模型）
//   input = 'prompt'   → 传入 { prompt: "..." }（Llama 等文本模型，需把 system+user 合并为一段）
const PROVIDERS = {
  // 主模型：Cloudflare Workers AI 免费档 GLM-4.7-Flash（中文/半白话理解最强）
  glm: {
    kind: 'cf-ai',
    model: '@cf/zai-org/glm-4.7-flash',
    input: 'messages',
    label: 'GLM-4.7-Flash（Cloudflare Workers AI 免费档·主）',
  },
  // 次模型：Cloudflare Workers AI 免费档 GLM-4.7-Flash（与主模型同模型，保证可用性与中文半白话质量）
  glm2: {
    kind: 'cf-ai',
    model: '@cf/zai-org/glm-4.7-flash',
    input: 'messages',
    label: 'GLM-4.7-Flash（Cloudflare Workers AI 免费档·备援，同主模型）',
  },
};

function json(body, status, request, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    buildCors(request),
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

// 从 Workers AI 返回（{response} 或 {choices:[{message:{content}}]}）中统一抽取正文
function extractContent(r) {
  if (!r || typeof r !== 'object') return '';
  if (typeof r.response === 'string' && r.response) return r.response;
  const msg = r.choices && r.choices[0] && r.choices[0].message;
  if (msg && typeof msg.content === 'string' && msg.content) return msg.content;
  return '';
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

export async function onRequestOptions(request) {
  // 预检也必须先过来源校验：非白名单来源直接 403，不再回显 '*'
  if (!isAllowedOrigin(request)) {
    return new Response(null, { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(null, { headers: buildCors(request) });
}

export async function onRequestGet() {
  return json({
    ok: true,
    service: 'daoxuan-ai',
    models: {
      glm: PROVIDERS.glm.label,
      glm2: PROVIDERS.glm2.label,
    },
    ts: Date.now(),
  }, 200, null);
}

export async function onRequestPost(context) {
  return handle(context.request, context.env);
}

async function handle(request, env) {
  // 来源校验：第三方站点（含其他域名下嵌入的前端）一律拒绝
  if (!isAllowedOrigin(request)) {
    return json({ error: '禁止的请求来源' }, 403, request);
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
    return json({ error: '请求体不是合法 JSON' }, 400, request);
  }

  const modelKey = body.modelKey === 'glm2' ? 'glm2' : 'glm';
  const provider = PROVIDERS[modelKey];
  const systemPrompt = (body.systemPrompt || '').trim();
  const userPrompt = (body.userPrompt || '').trim();
  if (!systemPrompt || !userPrompt) {
    return json({ error: '缺少 systemPrompt 或 userPrompt' }, 400, request);
  }

  // 两个模型均走 Workers AI 绑定（env.AI.run）
  if (!env.AI) {
    return json({
      error: '服务端未配置 Workers AI 绑定（变量名 AI）。请在 Cloudflare 控制台为 dxzsby 项目添加 Workers AI 绑定（设置 → 环境 → 绑定 → 添加 → Workers AI，变量名 AI），重新部署后生效。',
    }, 500, request);
  }

  // 按模型要求构造输入：对话模型用 messages，文本模型用 prompt（system+user 合并）
  const inputs = provider.input === 'prompt'
    ? { prompt: systemPrompt + '\n\n' + userPrompt }
    : {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        // GLM-4.7-Flash 为推理模型；如想关闭思维链以省额度/提速，可取消下一行注释：
        // chat_template_kwargs: { enable_thinking: false },
      };

  try {
    const result = await env.AI.run(provider.model, inputs);
    const content = extractContent(result);
    if (!content) {
      return json({ error: '上游返回为空' }, 502, request);
    }
    return json({ content: content }, 200, request);
  } catch (e) {
    return json({ error: 'Cloudflare Workers AI 调用失败：' + e.message }, 502, request);
  }
}
