const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../data-model.js');

test('creates a versioned state with an independent daily record', () => {
  const state = Data.createDefaultState('2026-08-05');
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.currentDate, '2026-08-05');
  assert.equal(state.days['2026-08-05'].score, 5);
  assert.deepEqual(Object.keys(state.areas), Data.AREA_IDS);
});

test('migrates v0.1 captures, area notes, and review without overwriting the legacy day', () => {
  const legacy = {
    version: 1,
    date: '2026-08-03',
    dayScore: 7,
    dayFeeling: '整体蛮不错',
    focus: '明天先处理一件事',
    captures: [{ id: 'old-1', text: '旧版捕获', done: false }],
    selectedArea: 'reading',
    areas: { reading: { focus: '读完当前章节', next: '打开书', note: '纸质书' } },
    review: { fact: '看了电影', feeling: '轻松', tomorrow: '早睡' }
  };
  const state = Data.migrateState(legacy, '2026-08-05');
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.inbox[0].content, '旧版捕获');
  assert.equal(state.areas.reading.focus, '读完当前章节');
  assert.equal(state.days['2026-08-03'].score, 7);
  assert.equal(state.days['2026-08-03'].review.fact, '看了电影');
  assert.ok(state.days['2026-08-05']);
  assert.equal(state.audit[0].type, 'migration');
});

test('opens a new day while preserving earlier daily records', () => {
  const original = Data.createDefaultState('2026-08-04');
  original.days['2026-08-04'].review.fact = '昨天的事实';
  const next = Data.migrateState(original, '2026-08-05');
  assert.equal(next.currentDate, '2026-08-05');
  assert.equal(next.days['2026-08-04'].review.fact, '昨天的事实');
  assert.ok(next.days['2026-08-05']);
});

test('rejects malformed shared items while retaining valid human records', () => {
  const candidate = Data.createDefaultState('2026-08-05');
  candidate.items = [
    { id: 'valid', areaId: 'english', title: '完成一组听力', status: 'active', source: 'human' },
    { id: 'missing-area', title: '不应保留' },
    { id: 'unknown-area', areaId: 'unknown', title: '不应保留' }
  ];
  candidate.logs = [
    { id: 'log-1', areaId: 'body', type: 'workout', summary: '完成力量训练', source: 'human' },
    { id: 'log-2', areaId: 'body', summary: '' }
  ];
  const normalized = Data.normalizeV2(candidate, '2026-08-05');
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].title, '完成一组听力');
  assert.equal(normalized.logs.length, 1);
  assert.equal(normalized.logs[0].summary, '完成力量训练');
});
