(function attachLifeOSData(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LifeOSData = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function createLifeOSData() {
  'use strict';

  const SCHEMA_VERSION = 2;
  const AREA_IDS = ['body', 'work', 'english', 'reading', 'travel', 'chores'];

  function text(value, max = 500) {
    return typeof value === 'string' ? value.slice(0, max) : '';
  }

  function localISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function createDailyRecord(date) {
    return {
      date,
      score: 5,
      feeling: '',
      energy: '',
      focus: '',
      closeout: { experience: false, feeling: false, tomorrow: false },
      review: { fact: '', feeling: '', tomorrow: '' },
      updatedAt: ''
    };
  }

  function createAreaState() {
    return { focus: '', next: '', note: '', updatedAt: '' };
  }

  function createDefaultState(date = localISODate()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      currentDate: date,
      lastSavedAt: '',
      selectedArea: 'body',
      profile: { locale: 'zh-CN', timezone: 'Asia/Shanghai', displayName: '' },
      settings: { theme: 'system', aiEnabled: false, provider: 'mock', model: '' },
      inbox: [],
      days: { [date]: createDailyRecord(date) },
      areas: Object.fromEntries(AREA_IDS.map((id) => [id, createAreaState()])),
      items: [],
      logs: [],
      aiProposals: [],
      audit: []
    };
  }

  function normalizeDailyRecord(candidate, date) {
    const day = createDailyRecord(date);
    if (!candidate || typeof candidate !== 'object') return day;
    const score = Number(candidate.score);
    if (Number.isFinite(score)) day.score = Math.min(10, Math.max(1, score));
    day.feeling = text(candidate.feeling, 300);
    day.energy = text(candidate.energy, 100);
    day.focus = text(candidate.focus, 160);
    day.updatedAt = text(candidate.updatedAt, 50);
    if (candidate.closeout && typeof candidate.closeout === 'object') {
      Object.keys(day.closeout).forEach((key) => { day.closeout[key] = Boolean(candidate.closeout[key]); });
    }
    if (candidate.review && typeof candidate.review === 'object') {
      day.review.fact = text(candidate.review.fact, 500);
      day.review.feeling = text(candidate.review.feeling, 500);
      day.review.tomorrow = text(candidate.review.tomorrow, 200);
    }
    return day;
  }

  function normalizeArea(candidate) {
    const area = createAreaState();
    if (!candidate || typeof candidate !== 'object') return area;
    area.focus = text(candidate.focus, 160);
    area.next = text(candidate.next, 160);
    area.note = text(candidate.note, 600);
    area.updatedAt = text(candidate.updatedAt, 50);
    return area;
  }

  function normalizeInboxItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const content = text(candidate.content ?? candidate.text, 300).trim();
    if (!content) return null;
    return {
      id: text(candidate.id, 100) || `inbox-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      content,
      areaId: AREA_IDS.includes(candidate.areaId) ? candidate.areaId : '',
      status: candidate.status === 'done' || candidate.done ? 'done' : 'inbox',
      createdAt: text(candidate.createdAt, 50) || new Date().toISOString(),
      source: candidate.source === 'ai' ? 'ai' : 'human'
    };
  }

  function normalizeItem(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const title = text(candidate.title, 200).trim();
    if (!title || !AREA_IDS.includes(candidate.areaId)) return null;
    const allowedStatuses = ['active', 'done', 'waiting', 'cancelled', 'archived'];
    return {
      id: text(candidate.id, 100) || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      areaId: candidate.areaId,
      kind: text(candidate.kind, 50) || 'item',
      title,
      nextAction: text(candidate.nextAction, 200),
      dueDate: text(candidate.dueDate, 20),
      status: allowedStatuses.includes(candidate.status) ? candidate.status : 'active',
      createdAt: text(candidate.createdAt, 50) || new Date().toISOString(),
      updatedAt: text(candidate.updatedAt, 50),
      source: candidate.source === 'ai' ? 'ai' : 'human'
    };
  }

  function normalizeLog(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const summary = text(candidate.summary, 300).trim();
    if (!summary || !AREA_IDS.includes(candidate.areaId)) return null;
    return {
      id: text(candidate.id, 100) || `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      areaId: candidate.areaId,
      type: text(candidate.type, 60) || 'note',
      summary,
      quantity: text(candidate.quantity, 80),
      note: text(candidate.note, 800),
      date: text(candidate.date, 20) || localISODate(),
      createdAt: text(candidate.createdAt, 50) || new Date().toISOString(),
      source: candidate.source === 'external' ? 'external' : candidate.source === 'ai' ? 'ai' : 'human'
    };
  }

  function normalizeV2(candidate, today = localISODate()) {
    const normalized = createDefaultState(today);
    if (!candidate || typeof candidate !== 'object') return normalized;
    normalized.lastSavedAt = text(candidate.lastSavedAt, 50);
    normalized.selectedArea = AREA_IDS.includes(candidate.selectedArea) ? candidate.selectedArea : 'body';

    if (candidate.profile && typeof candidate.profile === 'object') {
      normalized.profile.locale = text(candidate.profile.locale, 30) || 'zh-CN';
      normalized.profile.timezone = text(candidate.profile.timezone, 80) || 'Asia/Shanghai';
      normalized.profile.displayName = text(candidate.profile.displayName, 80);
    }
    if (candidate.settings && typeof candidate.settings === 'object') {
      normalized.settings.theme = ['system', 'light', 'dark'].includes(candidate.settings.theme) ? candidate.settings.theme : 'system';
      normalized.settings.aiEnabled = Boolean(candidate.settings.aiEnabled);
      normalized.settings.provider = text(candidate.settings.provider, 50) || 'mock';
      normalized.settings.model = text(candidate.settings.model, 100);
    }

    if (candidate.days && typeof candidate.days === 'object') {
      normalized.days = {};
      Object.entries(candidate.days).slice(-370).forEach(([date, day]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) normalized.days[date] = normalizeDailyRecord(day, date);
      });
    }
    if (!normalized.days[today]) normalized.days[today] = createDailyRecord(today);
    normalized.currentDate = today;

    if (candidate.areas && typeof candidate.areas === 'object') {
      AREA_IDS.forEach((id) => { normalized.areas[id] = normalizeArea(candidate.areas[id]); });
    }
    if (Array.isArray(candidate.inbox)) normalized.inbox = candidate.inbox.map(normalizeInboxItem).filter(Boolean).slice(0, 500);
    if (Array.isArray(candidate.items)) normalized.items = candidate.items.map(normalizeItem).filter(Boolean).slice(0, 1000);
    if (Array.isArray(candidate.logs)) normalized.logs = candidate.logs.map(normalizeLog).filter(Boolean).slice(0, 2000);
    if (Array.isArray(candidate.aiProposals)) normalized.aiProposals = candidate.aiProposals.filter((item) => item && typeof item === 'object').slice(0, 200);
    if (Array.isArray(candidate.audit)) normalized.audit = candidate.audit.filter((item) => item && typeof item === 'object').slice(-1000);
    return normalized;
  }

  function migrateV1(candidate, today = localISODate()) {
    const migrated = createDefaultState(today);
    const legacyDate = /^\d{4}-\d{2}-\d{2}$/.test(candidate?.date || '') ? candidate.date : today;
    const legacyDay = createDailyRecord(legacyDate);
    const score = Number(candidate?.dayScore);
    if (Number.isFinite(score)) legacyDay.score = Math.min(10, Math.max(1, score));
    legacyDay.feeling = text(candidate?.dayFeeling, 300);
    legacyDay.energy = text(candidate?.energy, 100);
    legacyDay.focus = text(candidate?.focus, 160);
    legacyDay.closeout = normalizeDailyRecord({ closeout: candidate?.closeout }, legacyDate).closeout;
    legacyDay.review = normalizeDailyRecord({ review: candidate?.review }, legacyDate).review;
    migrated.days[legacyDate] = legacyDay;
    if (!migrated.days[today]) migrated.days[today] = createDailyRecord(today);
    migrated.currentDate = today;
    migrated.lastSavedAt = text(candidate?.lastSavedAt, 50);
    migrated.selectedArea = AREA_IDS.includes(candidate?.selectedArea) ? candidate.selectedArea : 'body';
    AREA_IDS.forEach((id) => { migrated.areas[id] = normalizeArea(candidate?.areas?.[id]); });
    migrated.inbox = Array.isArray(candidate?.captures) ? candidate.captures.map(normalizeInboxItem).filter(Boolean) : [];
    migrated.audit.push({ type: 'migration', from: 1, to: 2, at: new Date().toISOString() });
    return migrated;
  }

  function migrateState(candidate, today = localISODate()) {
    if (candidate?.schemaVersion === SCHEMA_VERSION) return normalizeV2(candidate, today);
    return migrateV1(candidate, today);
  }

  return {
    SCHEMA_VERSION,
    AREA_IDS,
    localISODate,
    createDailyRecord,
    createDefaultState,
    migrateState,
    normalizeV2,
    normalizeInboxItem,
    normalizeItem,
    normalizeLog
  };
}));
