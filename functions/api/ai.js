// 增删卜易 · AI 释卦代理（Cloudflare Pages Functions）
// 前端 POST { modelKey, systemPrompt, userPrompt } 到 /api/ai，
// 本函数通过 Workers AI 绑定（env.AI）调用大模型，返回解读文本；密钥永不进入前端。
//
// 请求体：{ "modelKey": "glm" | "glm2", "systemPrompt": "...", "userPrompt": "..." }
// 返回：{ "content": "AI 解读文本" } 或 { "error": "错误说明" }
//
// 模型配置（2026-11-04 更新：主/次分属不同模型族，形成真冗余）
//   两模型均走 Workers AI 绑定 env.AI.run()，每天共 1 万 Neurons 免费，无需任何 API 密钥。
//   modelKey = "glm"   → 主模型：GLM-4.7-Flash（@cf/zai-org/glm-4.7-flash）
//                        中文（含半白话/文言）理解最强，推理模型；免费档中文主力。
//   modelKey = "glm2"  → 次模型（备援）：Qwen3-30B-A3B-FP8（@cf/qwen/qwen3-30b-a3b-fp8）
//                        与 GLM 不同模型族 → 真冗余（GLM 故障/限流时仍可出卦）；中文强、128K 上下文、
//                        Neuron 单价最低（约 4.6k 入 / 30.5k 出 per M），最省共享日额度；已关闭思维链直出。
//                        注：免费档不再依赖 Llama（@cf/meta/llama-3.1-8b-instruct 会被 Pages 路由到已弃用 infire 别名层）。
//   候选第三模型（待评测 / 待接入）：Google Gemini 2.5 Flash（gemini-2.5-flash）
//                        定位 = 跨平台备援：免费层额度**独立于** Cloudflare（每天上千次请求级、~100 万 token/天），
//                              可抗 Cloudflare 全站故障 / 额度耗尽；1M 上下文；浅文言 / 半白话文风好（古文互译实测满分）。
//                        短板：纯文本逻辑推理偏弱、冷门易学知识易幻觉；需 Gemini API Key + 独立调用代码（非 Workers AI 绑定）。
//                        ★ 后续将对 glm(GLM) / glm2(Qwen3) / Gemini 三模型释卦能力做横向评测，再决定是否接入为 glm3。
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
//   kind = 'cf-ai'（Workers AI 绑定，当前 glm / glm2 均用此）；候选第三模型计划用 'gemini'（见 glm3 注释）
//   input = 'messages' → 传入 { messages:[{role,content}] }（GLM / Qwen3 / Gemini 等对话模型）
//   input = 'prompt'   → 传入 { prompt: "..." }（Llama 等文本模型，需把 system+user 合并为一段）
const PROVIDERS = {
  // 主模型：Cloudflare Workers AI 免费档 GLM-4.7-Flash（中文/半白话理解最强）
  glm: {
    kind: 'cf-ai',
    model: '@cf/zai-org/glm-4.7-flash',
    input: 'messages',
    label: 'GLM-4.7-Flash（Cloudflare Workers AI 免费档·主）',
  },
  // 次模型（备援）：Cloudflare Workers AI 免费档 Qwen3-30B-A3B-FP8（与 GLM 不同模型族 → 真冗余）
  //   中文（半白话/文言）理解强、128K 上下文、Neuron 单价最低（约 4.6k 入 / 30.5k 出 per M），最省共享日额度；
  //   关闭思维链（enable_thinking:false）以贴合「通俗断语 + 专业详解」的直出格式、并省额度。
  glm2: {
    kind: 'cf-ai',
    model: '@cf/qwen/qwen3-30b-a3b-fp8',
    input: 'messages',
    extra: { chat_template_kwargs: { enable_thinking: false } },
    label: 'Qwen3-30B-A3B-FP8（Cloudflare Workers AI 免费档·备援，异模型冗余）',
  },
  // —— 候选第三模型（待评测 / 待接入，暂未启用）——
  // glm3: {
  //   kind: 'gemini',  // 需新增调用分支（Google Generative Language API 或 OpenAI 兼容端点），非 Workers AI 绑定
  //   model: 'gemini-2.5-flash',
  //   input: 'messages',
  //   // 需 env.GEMINI_API_KEY；返回结构为 { candidates:[{ content:{ parts:[{text}] } }] }，需另写抽取逻辑（与 extractContent 不同）
  //   label: 'Gemini 2.5 Flash（跨平台备援·待评测，独立免费额度池）',
  // },
};

function json(body, status, request, extra) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    buildCors(request),
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

// 从 Workers AI 返回中统一抽取正文。Qwen3 在关闭思维链(enable_thinking:false)时，
// 答案会被放到 message.reasoning / reasoning_content 字段，而 response/content 为 null，故做回退。
function extractContent(r) {
  if (!r || typeof r !== 'object') return '';
  if (typeof r.response === 'string' && r.response) return r.response;
  const msg = r.choices && r.choices[0] && r.choices[0].message;
  if (msg) {
    if (typeof msg.content === 'string' && msg.content) return msg.content;
    // Qwen3 关闭思维链后答案落在此字段
    if (typeof msg.reasoning === 'string' && msg.reasoning) return msg.reasoning;
    if (typeof msg.reasoning_content === 'string' && msg.reasoning_content) return msg.reasoning_content;
  }
  return '';
}

// 兜底：剔除模型可能夹带的 <think>…</think> 思维链（Qwen3 已关闭思考，GLM 一般不返回，此处双保险）
function stripThinking(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
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

  // 模型级附加参数（如关闭思维链）；不影响主模型 GLM
  if (provider.extra) Object.assign(inputs, provider.extra);

  try {
    const result = await env.AI.run(provider.model, inputs);
    const content = stripThinking(extractContent(result));
    if (!content) {
      return json({ error: '上游返回为空' }, 502, request);
    }
    return json({ content: content }, 200, request);
  } catch (e) {
    return json({ error: 'Cloudflare Workers AI 调用失败：' + e.message }, 502, request);
  }
}
