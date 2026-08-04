export const TASK_TYPES = Object.freeze([
  'capture_triage',
  'daily_review',
  'area_coach',
  'plan_next_step'
]);

export const RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'suggestions', 'proposedActions'],
  properties: {
    answer: { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    proposedActions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'label', 'payload'],
        properties: {
          kind: { type: 'string' },
          label: { type: 'string' },
          payload: { type: 'object', additionalProperties: true }
        }
      }
    }
  }
});

const AREA_IDS = new Set(['body', 'work', 'english', 'reading', 'travel', 'chores']);

function cleanString(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanStringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => cleanString(item, maxLength)).filter(Boolean);
}

export function validateGatewayRequest(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new GatewayError(400, 'invalid_request', '请求必须是 JSON 对象。');
  }

  if (!TASK_TYPES.includes(candidate.taskType)) {
    throw new GatewayError(400, 'unsupported_task', '不支持的 AI 任务类型。');
  }

  const userText = cleanString(candidate.userText, 4000);
  if (!userText) throw new GatewayError(400, 'empty_input', '本次输入不能为空。');

  const rawContext = candidate.context && typeof candidate.context === 'object' ? candidate.context : {};
  const areaId = AREA_IDS.has(rawContext.areaId) ? rawContext.areaId : '';
  const context = {
    areaId,
    areaName: cleanString(rawContext.areaName, 60),
    selectedRecordIds: cleanStringList(rawContext.selectedRecordIds, 20, 100),
    facts: cleanStringList(rawContext.facts, 20, 500),
    userStatements: cleanStringList(rawContext.userStatements, 20, 500)
  };

  return {
    taskType: candidate.taskType,
    userText,
    context,
    responseMode: candidate.responseMode === 'proposal' ? 'proposal' : 'answer',
    locale: cleanString(candidate.locale, 20) || 'zh-CN'
  };
}

export function normalizeModelPayload(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new GatewayError(502, 'invalid_provider_response', '模型没有返回有效对象。');
  }

  const answer = cleanString(candidate.answer, 8000);
  if (!answer) throw new GatewayError(502, 'invalid_provider_response', '模型回答为空。');

  const suggestions = cleanStringList(candidate.suggestions, 8, 600);
  const proposedActions = Array.isArray(candidate.proposedActions)
    ? candidate.proposedActions.slice(0, 8).map((action) => {
      if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
      const kind = cleanString(action.kind, 80);
      const label = cleanString(action.label, 200);
      if (!kind || !label) return null;
      const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
        ? action.payload
        : {};
      return { kind, label, payload, status: 'pending', source: 'ai' };
    }).filter(Boolean)
    : [];

  return { answer, suggestions, proposedActions };
}

export class GatewayError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GatewayError';
    this.status = status;
    this.code = code;
  }
}
