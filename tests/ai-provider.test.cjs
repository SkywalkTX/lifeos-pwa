const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAI(fetchImpl) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'ai-provider.js'), 'utf8');
  const sandbox = {
    fetch: fetchImpl,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.LifeOSAI;
}

test('gateway provider sends only the normalized request and session token', async () => {
  let outbound;
  const AI = loadAI(async (url, options) => {
    outbound = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      answer: '候选下一步', suggestions: [], proposedActions: [],
      provenance: { provider: 'openai', model: 'server-model', requestId: 'req-1' },
      usage: { inputTokens: 1, outputTokens: 2 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const provider = new AI.GatewayAIProvider({
    endpoint: 'https://gateway.example/',
    accessTokenProvider: () => 'session-only-token'
  });
  const response = await provider.generate({
    taskType: 'plan_next_step', userText: '  学英语  ', context: { areaId: 'english' }
  });

  assert.equal(outbound.url, 'https://gateway.example/v1/generate');
  assert.equal(outbound.options.headers.Authorization, 'Bearer session-only-token');
  assert.equal(outbound.body.userText, '学英语');
  assert.equal(response.answer, '候选下一步');
});

test('gateway provider refuses unsafe endpoints and missing session tokens', async () => {
  const AI = loadAI(async () => { throw new Error('must not call'); });
  const unsafe = new AI.GatewayAIProvider({ endpoint: 'http://public.example' });
  await assert.rejects(() => unsafe.generate({ taskType: 'area_coach', userText: 'test' }), /尚未配置/);

  const noToken = new AI.GatewayAIProvider({ endpoint: 'https://gateway.example' });
  await assert.rejects(() => noToken.generate({ taskType: 'area_coach', userText: 'test' }), /访问令牌/);
});
