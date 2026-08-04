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

  function normalizeResponse(candidate) {
    if (!candidate || typeof candidate !== 'object') throw new Error('AI Gateway 返回格式无效。');
    const answer = typeof candidate.answer === 'string' ? candidate.answer.trim().slice(0, 8000) : '';
    if (!answer) throw new Error('AI Gateway 没有返回回答。');
    const suggestions = Array.isArray(candidate.suggestions)
      ? candidate.suggestions.slice(0, 8).filter((item) => typeof item === 'string').map((item) => item.slice(0, 600))
      : [];
    const proposedActions = Array.isArray(candidate.proposedActions)
      ? candidate.proposedActions.slice(0, 8).filter((item) => item && typeof item === 'object')
      : [];
    const provenance = candidate.provenance && typeof candidate.provenance === 'object'
      ? candidate.provenance
      : { provider: 'gateway', model: '', requestId: '' };
    const usage = candidate.usage && typeof candidate.usage === 'object'
      ? candidate.usage
      : { inputTokens: 0, outputTokens: 0 };
    return { answer, suggestions, proposedActions, provenance, usage };
  }

  function gatewayBaseUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return '';
      return url.href.replace(/\/$/, '');
    } catch {
      return '';
    }
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
      this.endpoint = gatewayBaseUrl(options.endpoint);
      this.fetchImpl = options.fetchImpl || root.fetch;
      this.accessTokenProvider = typeof options.accessTokenProvider === 'function'
        ? options.accessTokenProvider
        : () => '';
    }

    async health() {
      if (!this.endpoint) return { ok: false, provider: this.id, reason: 'not-configured' };
      if (typeof this.fetchImpl !== 'function') return { ok: false, provider: this.id, reason: 'fetch-unavailable' };
      try {
        const response = await this.fetchImpl(`${this.endpoint}/health`, { method: 'GET', credentials: 'omit' });
        const data = await response.json();
        return {
          ok: response.ok && data?.ok === true,
          provider: data?.provider || this.id,
          ready: data?.ready === true,
          version: data?.version || ''
        };
      } catch {
        return { ok: false, provider: this.id, reason: 'unreachable' };
      }
    }

    async generate(rawRequest) {
      const request = normalizeRequest(rawRequest);
      if (!this.endpoint) throw new Error('真实 AI Gateway 尚未配置。');
      if (typeof this.fetchImpl !== 'function') throw new Error('当前浏览器无法连接 AI Gateway。');
      const accessToken = this.accessTokenProvider();
      if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('本次会话尚未提供 Gateway 访问令牌。');
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 45000) : null;
      try {
        const response = await this.fetchImpl(`${this.endpoint}/v1/generate`, {
          method: 'POST',
          credentials: 'omit',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request),
          signal: controller?.signal
        });
        let data;
        try {
          data = await response.json();
        } catch {
          throw new Error('AI Gateway 返回了无法读取的响应。');
        }
        if (!response.ok) throw new Error(data?.error?.message || 'AI Gateway 暂时无法完成请求。');
        return normalizeResponse(data);
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('AI Gateway 请求超时，本地记录仍然可用。');
        throw error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  }

  root.LifeOSAI = {
    TASK_TYPES,
    normalizeRequest,
    normalizeResponse,
    MockAIProvider,
    GatewayAIProvider,
    createProvider(settings = {}, runtime = {}) {
      if (settings.provider && settings.provider !== 'mock') {
        return new GatewayAIProvider({
          id: settings.provider,
          endpoint: runtime.endpoint || settings.endpoint,
          accessTokenProvider: runtime.accessTokenProvider,
          fetchImpl: runtime.fetchImpl
        });
      }
      return new MockAIProvider();
    }
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
