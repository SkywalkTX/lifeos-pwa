(function attachLifeOSAI(root) {
  'use strict';

  const TASK_TYPES = ['capture_triage', 'daily_review', 'area_coach', 'plan_next_step'];

  function normalizeRequest(request) {
    if (!request || typeof request !== 'object') throw new Error('AI request is required.');
    if (!TASK_TYPES.includes(request.taskType)) throw new Error('Unsupported AI task type.');
    const userText = typeof request.userText === 'string' ? request.userText.trim().slice(0, 2000) : '';
    if (!userText) throw new Error('AI request text is empty.');
    return {
      taskType: request.taskType,
      userText,
      context: request.context && typeof request.context === 'object' ? request.context : {},
      responseMode: request.responseMode === 'proposal' ? 'proposal' : 'answer',
      locale: request.locale || 'zh-CN'
    };
  }

  class MockAIProvider {
    constructor() {
      this.id = 'mock';
    }

    async health() {
      return { ok: true, provider: this.id, mode: 'local-mock' };
    }

    async generate(rawRequest) {
      const request = normalizeRequest(rawRequest);
      const areaName = request.context.areaName || '当前领域';
      const replies = {
        capture_triage: `本地演示建议：先把这条内容保留在 Inbox，再由你确认是否归入“${areaName}”。`,
        daily_review: '本地演示建议：把内容分别放入“确认事实、我的感受、决定、明天一步”；没有写到的部分保持空白。',
        area_coach: `本地演示回应：我只能看到你主动选择的“${areaName}”上下文。接入真实模型后，也不会自动读取其他领域。`,
        plan_next_step: '本地演示建议：把目标压缩成一个十分钟内可以开始、完成标准清楚的下一步。'
      };
      return {
        answer: replies[request.taskType],
        suggestions: [],
        proposedActions: [],
        provenance: { provider: 'mock', model: 'local-rules', requestId: `mock-${Date.now()}` },
        usage: { inputTokens: 0, outputTokens: 0 }
      };
    }
  }

  class GatewayAIProvider {
    constructor(options = {}) {
      this.id = options.id || 'gateway';
      this.endpoint = options.endpoint || '';
    }

    async health() {
      if (!this.endpoint) return { ok: false, provider: this.id, reason: 'not-configured' };
      return { ok: false, provider: this.id, reason: 'network-provider-disabled-in-v0.2a' };
    }

    async generate() {
      throw new Error('真实 AI Gateway 尚未配置；API Key 不能保存在公开 PWA 中。');
    }
  }

  root.LifeOSAI = {
    TASK_TYPES,
    normalizeRequest,
    MockAIProvider,
    GatewayAIProvider,
    createProvider(settings = {}) {
      if (settings.provider && settings.provider !== 'mock') return new GatewayAIProvider({ id: settings.provider, endpoint: settings.endpoint });
      return new MockAIProvider();
    }
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
