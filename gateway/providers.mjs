import { GatewayError, RESPONSE_SCHEMA, normalizeModelPayload } from './contracts.mjs';
import { buildPrompt } from './prompts.mjs';

function requireEnv(env, key) {
  const value = typeof env[key] === 'string' ? env[key].trim() : '';
  if (!value) throw new GatewayError(503, 'provider_not_configured', `服务端缺少 ${key} 配置。`);
  return value;
}

function parseJsonText(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GatewayError(502, 'invalid_provider_response', '模型没有返回 JSON 文本。');
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new GatewayError(502, 'invalid_provider_response', '模型返回的 JSON 无法解析。');
  }
}

function extractOpenAIText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  if (!Array.isArray(data.output)) return '';
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === 'string') return content.text;
    }
  }
  return '';
}

async function readProviderResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new GatewayError(502, 'provider_bad_response', '模型服务返回了无法读取的响应。');
  }
  if (!response.ok) {
    const providerCode = typeof data?.error?.code === 'string' ? data.error.code : 'upstream_error';
    throw new GatewayError(502, 'provider_error', `模型服务调用失败（${providerCode}）。`);
  }
  return data;
}

export async function callOpenAI(request, env, fetchImpl = fetch) {
  const apiKey = requireEnv(env, 'OPENAI_API_KEY');
  const model = requireEnv(env, 'AI_MODEL');
  const { instructions, input } = buildPrompt(request);
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      store: false,
      max_output_tokens: Number(env.AI_MAX_OUTPUT_TOKENS) || 800,
      text: {
        format: {
          type: 'json_schema',
          name: 'lifeos_response',
          strict: true,
          schema: RESPONSE_SCHEMA
        }
      }
    })
  });
  const data = await readProviderResponse(response);
  return {
    ...normalizeModelPayload(parseJsonText(extractOpenAIText(data))),
    provenance: {
      provider: 'openai',
      model,
      requestId: response.headers.get('x-request-id') || data.id || ''
    },
    usage: {
      inputTokens: Number(data.usage?.input_tokens) || 0,
      outputTokens: Number(data.usage?.output_tokens) || 0
    }
  };
}

export async function callDeepSeek(request, env, fetchImpl = fetch) {
  const apiKey = requireEnv(env, 'DEEPSEEK_API_KEY');
  const model = requireEnv(env, 'AI_MODEL');
  const baseUrl = (typeof env.DEEPSEEK_BASE_URL === 'string' && env.DEEPSEEK_BASE_URL.trim())
    || 'https://api.deepseek.com';
  const { instructions, input } = buildPrompt(request);
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: input }
      ],
      response_format: { type: 'json_object' },
      max_tokens: Number(env.AI_MAX_OUTPUT_TOKENS) || 800,
      stream: false
    })
  });
  const data = await readProviderResponse(response);
  return {
    ...normalizeModelPayload(parseJsonText(data.choices?.[0]?.message?.content)),
    provenance: {
      provider: 'deepseek',
      model,
      requestId: response.headers.get('x-request-id') || data.id || ''
    },
    usage: {
      inputTokens: Number(data.usage?.prompt_tokens) || 0,
      outputTokens: Number(data.usage?.completion_tokens) || 0
    }
  };
}

export async function callProvider(request, env, fetchImpl = fetch) {
  const provider = typeof env.AI_PROVIDER === 'string' ? env.AI_PROVIDER.trim().toLowerCase() : '';
  if (provider === 'openai') return callOpenAI(request, env, fetchImpl);
  if (provider === 'deepseek') return callDeepSeek(request, env, fetchImpl);
  throw new GatewayError(503, 'provider_not_configured', '尚未选择可用的 AI Provider。');
}
