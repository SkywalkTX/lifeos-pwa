import test from 'node:test';
import assert from 'node:assert/strict';
import { callDeepSeek } from '../gateway/providers.mjs';
import { createGateway } from '../gateway/worker.mjs';

const origin = 'https://skywalktx.github.io';

function baseEnv(overrides = {}) {
  return {
    ALLOWED_ORIGIN: origin,
    LIFEOS_ACCESS_TOKEN: 'test-access-token',
    AI_PROVIDER: 'openai',
    AI_MODEL: 'server-configured-model',
    OPENAI_API_KEY: 'unit-test-placeholder',
    AI_MAX_OUTPUT_TOKENS: '500',
    ...overrides
  };
}

function aiRequest(overrides = {}) {
  return {
    taskType: 'plan_next_step',
    userText: '准备英语考试',
    context: { areaId: 'english', facts: [], userStatements: ['英语很重要'] },
    responseMode: 'answer',
    locale: 'zh-CN',
    ...overrides
  };
}

function gatewayRequest(body, overrides = {}) {
  return new Request('https://gateway.example/v1/generate', {
    method: 'POST',
    headers: {
      Origin: origin,
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
      ...(overrides.headers || {})
    },
    body: JSON.stringify(body),
    ...overrides,
    headers: {
      Origin: origin,
      Authorization: 'Bearer test-access-token',
      'Content-Type': 'application/json',
      ...(overrides.headers || {})
    }
  });
}

test('health exposes readiness without secrets or model details', async () => {
  const gateway = createGateway({ fetchImpl: async () => { throw new Error('unused'); } });
  const response = await gateway.fetch(new Request('https://gateway.example/health', {
    headers: { Origin: origin }
  }), baseEnv());
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data, { ok: true, version: '0.2b-b0', ready: true, provider: 'openai' });
  assert.equal(JSON.stringify(data).includes('unit-test-placeholder'), false);
  assert.equal(JSON.stringify(data).includes('server-configured-model'), false);
});

test('rejects foreign origins before calling a provider', async () => {
  let called = false;
  const gateway = createGateway({ fetchImpl: async () => { called = true; } });
  const request = gatewayRequest(aiRequest(), { headers: { Origin: 'https://attacker.example' } });
  const response = await gateway.fetch(request, baseEnv());
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test('rejects missing or invalid personal gateway tokens', async () => {
  const gateway = createGateway({ fetchImpl: async () => { throw new Error('unused'); } });
  const request = gatewayRequest(aiRequest(), { headers: { Authorization: 'Bearer wrong-token' } });
  const response = await gateway.fetch(request, baseEnv());
  const data = await response.json();
  assert.equal(response.status, 401);
  assert.equal(data.error.code, 'unauthorized');
});

test('validates task type and empty input before provider calls', async () => {
  let called = false;
  const gateway = createGateway({ fetchImpl: async () => { called = true; } });
  const response = await gateway.fetch(gatewayRequest(aiRequest({ taskType: 'rewrite_identity', userText: '' })), baseEnv());
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.error.code, 'unsupported_task');
  assert.equal(called, false);
});

test('maps a validated request to OpenAI Responses with store disabled', async () => {
  let upstream;
  const fetchImpl = async (url, options) => {
    upstream = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      id: 'resp_test',
      output_text: JSON.stringify({
        answer: '先打开一套十分钟听力练习。',
        suggestions: ['完成后记下一个困难点'],
        proposedActions: [{ kind: 'set_next_step', label: '十分钟听力', payload: { areaId: 'english' } }]
      }),
      usage: { input_tokens: 120, output_tokens: 30 }
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_test' } });
  };
  const gateway = createGateway({ fetchImpl });
  const response = await gateway.fetch(gatewayRequest(aiRequest()), baseEnv());
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(upstream.url, 'https://api.openai.com/v1/responses');
  assert.equal(upstream.body.store, false);
  assert.equal(upstream.body.model, 'server-configured-model');
  assert.equal(upstream.body.text.format.strict, true);
  assert.equal(upstream.options.headers.Authorization, 'Bearer unit-test-placeholder');
  assert.equal(data.proposedActions[0].status, 'pending');
  assert.equal(data.provenance.requestId, 'req_test');
  assert.deepEqual(data.usage, { inputTokens: 120, outputTokens: 30 });
});

test('maps DeepSeek JSON output into the same response contract', async () => {
  let upstream;
  const result = await callDeepSeek(aiRequest({ taskType: 'capture_triage', userText: '周六去跑步' }), baseEnv({
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'deepseek-unit-placeholder',
    DEEPSEEK_BASE_URL: 'https://deepseek.example/'
  }), async (url, options) => {
    upstream = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      id: 'chat_test',
      choices: [{ message: { content: JSON.stringify({ answer: '建议归入身体与健身。', suggestions: [], proposedActions: [] }) } }],
      usage: { prompt_tokens: 40, completion_tokens: 12 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  assert.equal(upstream.url, 'https://deepseek.example/chat/completions');
  assert.equal(upstream.body.response_format.type, 'json_object');
  assert.equal(result.provenance.provider, 'deepseek');
  assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 12 });
});

test('returns a stable 429 without invoking a billable request', async () => {
  let called = false;
  const gateway = createGateway({ fetchImpl: async () => { called = true; } });
  const response = await gateway.fetch(gatewayRequest(aiRequest()), baseEnv({
    AI_RATE_LIMITER: { limit: async () => ({ success: false }) }
  }));
  const data = await response.json();
  assert.equal(response.status, 429);
  assert.equal(data.error.code, 'rate_limited');
  assert.equal(called, false);
});
