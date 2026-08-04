import { GatewayError, validateGatewayRequest } from './contracts.mjs';
import { callProvider } from './providers.mjs';

const GATEWAY_VERSION = '0.2b-b0';
const MAX_BODY_BYTES = 64 * 1024;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

function corsHeaders(origin, allowedOrigin) {
  if (!origin || !allowedOrigin || origin !== allowedOrigin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function constantTimeEqual(left, right) {
  const a = typeof left === 'string' ? left : '';
  const b = typeof right === 'string' ? right : '';
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new GatewayError(413, 'request_too_large', '请求体过大。');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new GatewayError(413, 'request_too_large', '请求体过大。');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GatewayError(400, 'invalid_json', '请求不是有效 JSON。');
  }
}

async function applyRateLimit(request, env) {
  if (!env.AI_RATE_LIMITER || typeof env.AI_RATE_LIMITER.limit !== 'function') return;
  const key = request.headers.get('CF-Connecting-IP') || 'single-user';
  const result = await env.AI_RATE_LIMITER.limit({ key });
  if (!result?.success) throw new GatewayError(429, 'rate_limited', '请求过于频繁，请稍后再试。');
}

export function createGateway({ fetchImpl = fetch } = {}) {
  return {
    async fetch(request, env = {}) {
      const origin = request.headers.get('Origin') || '';
      const allowedOrigin = typeof env.ALLOWED_ORIGIN === 'string' ? env.ALLOWED_ORIGIN.trim() : '';
      const cors = corsHeaders(origin, allowedOrigin);

      try {
        if (request.method === 'OPTIONS') {
          if (!origin || origin !== allowedOrigin) throw new GatewayError(403, 'origin_denied', '不允许的网页来源。');
          return new Response(null, { status: 204, headers: cors });
        }

        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/health') {
          return json({
            ok: true,
            version: GATEWAY_VERSION,
            ready: Boolean(env.AI_PROVIDER && env.AI_MODEL),
            provider: env.AI_PROVIDER || 'not-configured'
          }, 200, cors);
        }

        if (request.method !== 'POST' || url.pathname !== '/v1/generate') {
          throw new GatewayError(404, 'not_found', '接口不存在。');
        }

        if (!origin || origin !== allowedOrigin) throw new GatewayError(403, 'origin_denied', '不允许的网页来源。');
        if (!env.LIFEOS_ACCESS_TOKEN) throw new GatewayError(503, 'gateway_not_configured', 'Gateway 访问令牌尚未配置。');
        if (!constantTimeEqual(bearerToken(request), env.LIFEOS_ACCESS_TOKEN)) {
          throw new GatewayError(401, 'unauthorized', 'Gateway 访问令牌无效。');
        }

        await applyRateLimit(request, env);
        const aiRequest = validateGatewayRequest(await readJsonBody(request));
        const result = await callProvider(aiRequest, env, fetchImpl);
        return json(result, 200, cors);
      } catch (error) {
        const known = error instanceof GatewayError;
        const status = known ? error.status : 500;
        return json({
          error: {
            code: known ? error.code : 'internal_error',
            message: known ? error.message : 'Gateway 暂时无法完成请求。'
          }
        }, status, cors);
      }
    }
  };
}

export default createGateway();
