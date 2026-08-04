(() => {
  'use strict';

  const Data = window.LifeOSData;
  const AI = window.LifeOSAI;
  if (!Data || !AI) throw new Error('LifeOS core modules failed to load.');

  const STORAGE_KEY = 'dataimmortality.workbench.v02';
  const LEGACY_STORAGE_KEY = 'dataimmortality.workbench-demo.v01';
  const IMPORT_BACKUP_KEY = 'dataimmortality.workbench.import-backup.v02';
  const today = Data.localISODate(new Date());

  const domainMeta = [
    {
      id: 'body', name: '身体与健身', shortName: '身体', icon: 'i-body',
      description: '训练、身体状态与恢复。', itemLabel: '新增训练计划或身体目标',
      itemKind: 'fitness-plan', logSummaryLabel: '训练或身体状态', quantityLabel: '时长或数值（可选）', quantityPlaceholder: '例如：45 分钟、睡眠 7 小时',
      logTypes: [['workout', '训练'], ['body-state', '身体状态'], ['recovery', '恢复']]
    },
    {
      id: 'work', name: '每日工作', shortName: '工作', icon: 'i-work',
      description: '项目推进、决定与等待事项。', itemLabel: '新增工作项目或事项',
      itemKind: 'work-item', logSummaryLabel: '今天发生的工作事实', quantityLabel: '投入或进度（可选）', quantityPlaceholder: '例如：完成 60%、专注 90 分钟',
      logTypes: [['progress', '进展'], ['decision', '决定'], ['waiting', '等待']]
    },
    {
      id: 'english', name: '英语学习', shortName: '英语', icon: 'i-language',
      description: '托业、雅思与日常能力。', itemLabel: '新增考试目标或学习计划',
      itemKind: 'study-plan', logSummaryLabel: '这次学了什么', quantityLabel: '学习时长或题量（可选）', quantityPlaceholder: '例如：30 分钟、完成 20 题',
      logTypes: [['listening', '听力'], ['reading', '阅读'], ['speaking', '口语'], ['writing', '写作'], ['vocabulary', '词汇'], ['mixed', '综合']]
    },
    {
      id: 'reading', name: '阅读', shortName: '阅读', icon: 'i-book',
      description: '在读书籍、进度、摘录与自己的想法。', itemLabel: '新增在读书籍或阅读计划',
      itemKind: 'book', logSummaryLabel: '书名、进度或想法', quantityLabel: '页码或章节（可选）', quantityPlaceholder: '例如：第 3 章、42–58 页',
      logTypes: [['progress', '阅读进度'], ['quote', '外部摘录'], ['reflection', '我的想法']]
    },
    {
      id: 'travel', name: '出行与旅行', shortName: '旅行', icon: 'i-travel',
      description: '旅行灵感、计划、预订与真实经历。', itemLabel: '新增旅程或想去的地方',
      itemKind: 'trip', logSummaryLabel: '地点、预订或经历', quantityLabel: '日期或金额（可选）', quantityPlaceholder: '例如：8 月 20 日、预算 500 元',
      logTypes: [['idea', '旅行灵感'], ['booking', '预订'], ['itinerary', '行程'], ['experience', '真实经历']]
    },
    {
      id: 'chores', name: '杂务', shortName: '杂务', icon: 'i-chores',
      description: '容易忘、快到期和正在等待的事。', itemLabel: '新增杂务或周期事项',
      itemKind: 'chore', logSummaryLabel: '发生了什么', quantityLabel: '频率或金额（可选）', quantityPlaceholder: '例如：每月、120 元',
      logTypes: [['one-off', '一次性杂务'], ['recurring', '周期事项'], ['waiting', '等待事项']]
    }
  ];

  const localStorageAvailable = canUseLocalStorage();
  let state = loadState();
  let aiProvider = AI.createProvider(state.settings);
  let toastTimer;

  function canUseLocalStorage() {
    try {
      const probe = `${STORAGE_KEY}.probe`;
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadState() {
    if (!localStorageAvailable) return Data.createDefaultState(today);
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current) return Data.migrateState(JSON.parse(current), today);
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const migrated = legacy ? Data.migrateState(JSON.parse(legacy), today) : Data.createDefaultState(today);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      return Data.createDefaultState(today);
    }
  }

  function currentDay() {
    if (!state.days[today]) state.days[today] = Data.createDailyRecord(today);
    state.currentDate = today;
    return state.days[today];
  }

  function saveState(message, auditType) {
    try {
      if (!localStorageAvailable) throw new Error('Local storage unavailable');
      const timestamp = new Date().toISOString();
      state.lastSavedAt = timestamp;
      currentDay().updatedAt = timestamp;
      if (auditType) {
        state.audit.push({ type: auditType, at: timestamp });
        state.audit = state.audit.slice(-1000);
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateStorageStatus(true);
      if (message) showToast(message);
    } catch (error) {
      updateStorageStatus(false);
      showToast('当前浏览器无法持久保存，内容可能在关闭后丢失。');
    }
  }

  function updateStorageStatus(available) {
    const status = document.getElementById('local-save-status');
    if (!status) return;
    if (!available) {
      status.textContent = '无法持久保存';
      return;
    }
    const activeCount = state.inbox.filter((item) => item.status !== 'done').length;
    status.textContent = activeCount ? `Inbox ${activeCount} 条` : '可以使用';
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function iconMarkup(id) {
    return `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function domainById(id) {
    return domainMeta.find((domain) => domain.id === id) || domainMeta[0];
  }

  function switchView(viewName) {
    document.querySelectorAll('[data-view-panel]').forEach((panel) => {
      const active = panel.dataset.viewPanel === viewName;
      panel.hidden = !active;
      panel.classList.toggle('is-visible', active);
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === viewName;
      button.classList.toggle('is-active', active);
      if (button.classList.contains('nav-button')) {
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    });
    if (viewName === 'areas') selectArea(state.selectedArea, false);
    if (viewName === 'review') fillReviewForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTodayHeader() {
    const day = currentDay();
    const date = new Date(`${today}T12:00:00`);
    const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(date);
    const formatted = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    const hour = new Date().getHours();
    const period = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    document.getElementById('today-date-label').textContent = `${weekday} · ${formatted}`;
    document.getElementById('today-greeting').textContent = `${period}，先接住今天。`;
    document.getElementById('today-lead').textContent = day.feeling
      ? `${day.feeling}。留下一点真实记录就够了。`
      : '不用填满，留下一点真实记录就够了。';
    document.getElementById('today-score-value').textContent = String(day.score);
    document.getElementById('today-focus').textContent = day.focus || day.review.tomorrow || '现在还没有设定';
  }

  function renderAreaStrip() {
    const strip = document.getElementById('today-area-strip');
    strip.replaceChildren();
    domainMeta.forEach((domain) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'area-mini';
      button.innerHTML = `${iconMarkup(domain.icon)}<span>${domain.shortName}</span>`;
      button.setAttribute('aria-label', `打开${domain.name}`);
      button.addEventListener('click', () => {
        state.selectedArea = domain.id;
        saveState();
        switchView('areas');
      });
      strip.appendChild(button);
    });
  }

  function areaItems(areaId) {
    return state.items
      .filter((item) => item.areaId === areaId)
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function areaLogs(areaId) {
    return state.logs
      .filter((log) => log.areaId === areaId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function renderAreaGrid() {
    const grid = document.getElementById('area-grid');
    grid.replaceChildren();
    domainMeta.forEach((domain) => {
      const area = state.areas[domain.id];
      const activeItems = areaItems(domain.id).filter((item) => item.status === 'active' || item.status === 'waiting').length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `area-card${domain.id === state.selectedArea ? ' is-selected' : ''}`;
      button.dataset.areaId = domain.id;
      button.setAttribute('aria-pressed', String(domain.id === state.selectedArea));

      const top = document.createElement('div');
      top.className = 'area-card-top';
      top.innerHTML = `<span class="area-card-icon">${iconMarkup(domain.icon)}</span>`;
      const status = document.createElement('span');
      status.className = 'area-card-status';
      status.textContent = activeItems ? `${activeItems} 项进行中` : area.next ? '已有下一步' : '待定义';
      top.appendChild(status);

      const heading = document.createElement('h2');
      heading.textContent = domain.name;
      const copy = document.createElement('p');
      copy.textContent = area.next || domain.description;
      button.append(top, heading, copy);
      button.addEventListener('click', () => selectArea(domain.id));
      grid.appendChild(button);
    });
  }

  function selectArea(areaId, scroll = true) {
    const domain = domainById(areaId);
    state.selectedArea = domain.id;
    const area = state.areas[domain.id];
    document.getElementById('editor-name').textContent = domain.name;
    document.getElementById('editor-description').textContent = domain.description;
    document.getElementById('editor-icon').innerHTML = iconMarkup(domain.icon);
    document.getElementById('area-focus').value = area.focus;
    document.getElementById('area-next').value = area.next;
    document.getElementById('area-note').value = area.note;
    document.getElementById('item-title-label').textContent = domain.itemLabel;
    document.getElementById('log-summary-label').textContent = domain.logSummaryLabel;
    document.getElementById('log-quantity-label').textContent = domain.quantityLabel;
    document.getElementById('log-quantity').placeholder = domain.quantityPlaceholder;
    const typeSelect = document.getElementById('log-type');
    typeSelect.replaceChildren(...domain.logTypes.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    renderAreaGrid();
    renderAreaDetail();
    saveState();
    if (scroll && window.matchMedia('(max-width: 760px)').matches) {
      document.getElementById('area-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderAreaDetail() {
    const domain = domainById(state.selectedArea);
    const area = state.areas[domain.id];
    const items = areaItems(domain.id);
    const logs = areaLogs(domain.id);
    const active = items.filter((item) => item.status === 'active' || item.status === 'waiting');

    document.getElementById('area-record-count').textContent = `${items.length} 项 · ${logs.length} 条记录`;
    document.getElementById('item-count').textContent = `${active.length} 项`;
    document.getElementById('log-count').textContent = `${logs.length} 条`;

    const stats = document.getElementById('area-stats');
    stats.replaceChildren();
    [
      ['当前重点', area.focus || '尚未定义'],
      ['最小下一步', area.next || '尚未定义'],
      ['最近记录', logs[0]?.summary || '还没有记录']
    ].forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'area-stat';
      const caption = document.createElement('span');
      caption.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      card.append(caption, strong);
      stats.appendChild(card);
    });

    const itemList = document.getElementById('item-list');
    itemList.replaceChildren();
    items.slice(0, 12).forEach((item) => {
      const row = document.createElement('li');
      row.className = `area-entry${item.status === 'done' ? ' is-done' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = item.status === 'done';
      checkbox.setAttribute('aria-label', `标记“${item.title}”是否完成`);
      checkbox.addEventListener('change', () => {
        item.status = checkbox.checked ? 'done' : 'active';
        item.updatedAt = new Date().toISOString();
        saveState('状态已经更新。', 'item-status');
        renderAreaGrid();
        renderAreaDetail();
      });
      const copy = document.createElement('div');
      copy.className = 'area-entry-copy';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = item.nextAction || (item.dueDate ? `日期：${item.dueDate}` : '还没有写下一步');
      copy.append(title, detail);
      const time = document.createElement('time');
      time.textContent = item.dueDate || '持续';
      row.append(checkbox, copy, time);
      itemList.appendChild(row);
    });

    const recentList = document.getElementById('recent-log-list');
    recentList.replaceChildren();
    logs.slice(0, 7).forEach((log) => {
      const row = document.createElement('li');
      row.className = 'recent-log';
      const badge = document.createElement('span');
      badge.className = 'log-type-badge';
      badge.textContent = domain.logTypes.find(([value]) => value === log.type)?.[1] || '记录';
      const copy = document.createElement('div');
      copy.className = 'recent-log-copy';
      const title = document.createElement('strong');
      title.textContent = log.summary;
      const detail = document.createElement('p');
      detail.textContent = [log.quantity, log.note].filter(Boolean).join(' · ') || '用户确认记录';
      copy.append(title, detail);
      const time = document.createElement('time');
      time.textContent = log.date;
      row.append(badge, copy, time);
      recentList.appendChild(row);
    });
  }

  function renderCaptures() {
    const list = document.getElementById('capture-list');
    const feedback = document.getElementById('capture-feedback');
    list.replaceChildren();
    state.inbox.slice(0, 100).forEach((capture) => {
      const item = document.createElement('li');
      item.className = `capture-item${capture.status === 'done' ? ' is-done' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = capture.status === 'done';
      checkbox.setAttribute('aria-label', `标记“${capture.content}”是否完成`);
      checkbox.addEventListener('change', () => {
        capture.status = checkbox.checked ? 'done' : 'inbox';
        saveState('Inbox 状态已更新。', 'inbox-status');
        renderCaptures();
      });
      const content = document.createElement('span');
      content.textContent = capture.content;
      item.append(checkbox, content);
      list.appendChild(item);
    });
    if (state.inbox.length && localStorageAvailable) {
      feedback.textContent = `已保存在当前设备，共 ${state.inbox.length} 条；尚未同步到其他手机或电脑。`;
      feedback.classList.add('is-success');
    } else if (state.inbox.length) {
      feedback.textContent = `已加入当前页面，共 ${state.inbox.length} 条；关闭后可能丢失。`;
      feedback.classList.remove('is-success');
    } else {
      feedback.textContent = '写完后会明确告诉你保存到了哪里。';
      feedback.classList.remove('is-success');
    }
    updateStorageStatus(localStorageAvailable);
  }

  function renderCloseout() {
    const day = currentDay();
    document.querySelectorAll('[data-closeout]').forEach((checkbox) => {
      checkbox.checked = Boolean(day.closeout[checkbox.dataset.closeout]);
    });
    const completed = Object.values(day.closeout).filter(Boolean).length;
    document.getElementById('closeout-progress').textContent = `${completed} / 3`;
  }

  function fillReviewForm() {
    const day = currentDay();
    document.getElementById('review-score').value = String(day.score);
    document.getElementById('review-score-value').textContent = String(day.score);
    document.getElementById('review-fact').value = day.review.fact;
    document.getElementById('review-feeling').value = day.review.feeling;
    document.getElementById('review-tomorrow').value = day.review.tomorrow;
  }

  function renderRecentDays() {
    const entries = Object.entries(state.days)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 7);
    document.getElementById('recent-days-count').textContent = `${entries.length} 天`;
    const list = document.getElementById('recent-days-list');
    list.replaceChildren();
    entries.forEach(([date, day]) => {
      const row = document.createElement('li');
      row.className = 'recent-day';
      const dateBlock = document.createElement('div');
      dateBlock.className = 'recent-day-date';
      const dateText = document.createElement('strong');
      dateText.textContent = date;
      const score = document.createElement('span');
      score.textContent = `${day.score}/10`;
      dateBlock.append(dateText, score);
      const copy = document.createElement('div');
      copy.className = 'recent-day-copy';
      const heading = document.createElement('strong');
      heading.textContent = day.review.fact || day.focus || (date === today ? '今天还没有写下事实' : '这一天没有回顾');
      const detail = document.createElement('p');
      detail.textContent = day.review.feeling || day.feeling || '感受未记录';
      copy.append(heading, detail);
      row.append(dateBlock, copy);
      list.appendChild(row);
    });
  }

  function renderAll() {
    renderTodayHeader();
    renderAreaStrip();
    renderAreaGrid();
    renderAreaDetail();
    renderCaptures();
    renderCloseout();
    fillReviewForm();
    renderRecentDays();
  }

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  document.querySelectorAll('[data-go-view]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.goView));
  });

  document.getElementById('mobile-ai-button').addEventListener('click', () => {
    document.getElementById('assistant-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('assistant-question-input').focus(), 320);
  });

  document.querySelectorAll('[data-closeout]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      currentDay().closeout[checkbox.dataset.closeout] = checkbox.checked;
      saveState(undefined, 'daily-closeout');
      renderCloseout();
    });
  });

  document.getElementById('capture-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('capture-input');
    const content = input.value.trim();
    if (!content) {
      showToast('先写下一点内容。');
      input.focus();
      return;
    }
    state.inbox.unshift({
      id: makeId('inbox'), content: content.slice(0, 300), areaId: '', status: 'inbox',
      createdAt: new Date().toISOString(), source: 'human'
    });
    input.value = '';
    saveState('已接住，保存在本机 Inbox。', 'inbox-create');
    renderCaptures();
    input.focus();
  });

  document.getElementById('area-editor').addEventListener('submit', (event) => {
    event.preventDefault();
    const area = state.areas[state.selectedArea];
    area.focus = document.getElementById('area-focus').value.trim();
    area.next = document.getElementById('area-next').value.trim();
    area.note = document.getElementById('area-note').value.trim();
    area.updatedAt = new Date().toISOString();
    saveState('领域概览已经保存。', 'area-update');
    renderAreaGrid();
    renderAreaDetail();
  });

  document.getElementById('item-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const domain = domainById(state.selectedArea);
    const titleInput = document.getElementById('item-title');
    const title = titleInput.value.trim();
    if (!title) {
      showToast('先写下项目或事项名称。');
      titleInput.focus();
      return;
    }
    const timestamp = new Date().toISOString();
    state.items.unshift({
      id: makeId('item'), areaId: domain.id, kind: domain.itemKind, title: title.slice(0, 200),
      nextAction: document.getElementById('item-next').value.trim().slice(0, 200),
      dueDate: document.getElementById('item-due').value, status: 'active',
      createdAt: timestamp, updatedAt: timestamp, source: 'human'
    });
    event.currentTarget.reset();
    saveState('已经加入这个领域。', 'item-create');
    renderAreaGrid();
    renderAreaDetail();
  });

  document.getElementById('log-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const summaryInput = document.getElementById('log-summary');
    const summary = summaryInput.value.trim();
    if (!summary) {
      showToast('先写下一条确认发生的记录。');
      summaryInput.focus();
      return;
    }
    state.logs.unshift({
      id: makeId('log'), areaId: state.selectedArea, type: document.getElementById('log-type').value,
      summary: summary.slice(0, 300), quantity: document.getElementById('log-quantity').value.trim().slice(0, 80),
      note: document.getElementById('log-note').value.trim().slice(0, 800), date: today,
      createdAt: new Date().toISOString(), source: 'human'
    });
    event.currentTarget.reset();
    selectArea(state.selectedArea, false);
    saveState('这条领域记录已经保存在本机。', 'log-create');
  });

  document.getElementById('review-score').addEventListener('input', (event) => {
    document.getElementById('review-score-value').textContent = event.target.value;
  });

  function readReviewForm() {
    const day = currentDay();
    day.score = Number(document.getElementById('review-score').value);
    day.review.fact = document.getElementById('review-fact').value.trim();
    day.review.feeling = document.getElementById('review-feeling').value.trim();
    day.review.tomorrow = document.getElementById('review-tomorrow').value.trim();
    day.feeling = day.review.feeling;
    day.focus = day.review.tomorrow;
    return day;
  }

  document.getElementById('review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    readReviewForm();
    saveState('回顾草稿已保存在本机。', 'daily-review');
    renderTodayHeader();
    renderRecentDays();
  });

  document.getElementById('markdown-button').addEventListener('click', () => {
    const day = readReviewForm();
    saveState();
    const markdown = `---\ndate: ${today}\nprivacy: private\nsource: human-ai-collaboration\nstatus: draft\n---\n\n> 本文由 LifeOS 根据用户填写内容生成，仅作为待确认草稿；未填写处保持空白。\n\n# 今天发生了什么\n\n- ${day.review.fact}\n\n# 完成的行动\n\n- [ ] \n\n# 想法\n\n- \n\n# 决定与原因\n\n- \n\n# 状态\n\n- 精力：${day.energy || '未记录'}\n- 情绪：${day.score}/10${day.review.feeling ? `（${day.review.feeling}）` : ''}\n\n# 明天\n\n- [ ] ${day.review.tomorrow}\n`;
    downloadText(`${today}-draft.md`, markdown, 'text/markdown;charset=utf-8');
    showToast('Daily Markdown 草稿已下载。');
  });

  async function askMockAI(taskType, userText) {
    const domain = domainById(state.selectedArea);
    try {
      const response = await aiProvider.generate({
        taskType, userText, responseMode: 'answer', locale: 'zh-CN',
        context: { areaId: domain.id, areaName: domain.name, selectedRecordIds: [], facts: [], userStatements: [] }
      });
      document.getElementById('assistant-message').querySelector('p').textContent = response.answer;
    } catch (error) {
      document.getElementById('assistant-message').querySelector('p').textContent = error.message;
    }
  }

  document.querySelectorAll('[data-assistant-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskMap = { closeout: 'daily_review', tomorrow: 'plan_next_step', areas: 'area_coach' };
      if (button.dataset.assistantAction === 'areas') switchView('areas');
      await askMockAI(taskMap[button.dataset.assistantAction], button.textContent.trim());
    });
  });

  document.getElementById('assistant-question-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('assistant-question-input');
    const question = input.value.trim();
    if (!question) {
      showToast('先写下你想问的内容。');
      input.focus();
      return;
    }
    const matchedDomain = domainMeta.find((domain) => {
      const keywords = {
        body: ['健身', '身体', '体重', '训练', '睡眠'], work: ['工作', '项目', '同事', '老板', '职场'],
        english: ['英语', '雅思', '托业', '单词', '听力'], reading: ['阅读', '书', '读完', '作者'],
        travel: ['旅行', '出行', '机票', '酒店', '签证'], chores: ['杂务', '缴费', '快递', '提醒', '忘记']
      };
      return keywords[domain.id].some((keyword) => question.includes(keyword));
    });
    if (matchedDomain) state.selectedArea = matchedDomain.id;
    await askMockAI(matchedDomain ? 'area_coach' : 'plan_next_step', question);
    input.value = '';
  });

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById('export-button').addEventListener('click', () => {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(), app: 'LifeOS', schemaVersion: Data.SCHEMA_VERSION, state
    }, null, 2);
    downloadText(`lifeos-backup-${today}.json`, payload, 'application/json;charset=utf-8');
    showToast('完整本机快照已导出。');
  });

  document.getElementById('import-input').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const candidate = parsed.state || parsed;
      if (!candidate || typeof candidate !== 'object') throw new Error('Invalid snapshot');
      if (localStorageAvailable) window.localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(state));
      state = Data.migrateState(candidate, today);
      aiProvider = AI.createProvider(state.settings);
      saveState(undefined, 'import');
      renderAll();
      showToast('快照已校验并导入；导入前状态已保留。');
    } catch (error) {
      showToast('无法读取这个快照，当前数据没有改变。');
    } finally {
      event.target.value = '';
    }
  });

  let deferredInstallPrompt = null;
  const installButton = document.getElementById('install-button');
  const installCopy = document.getElementById('install-copy');
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    installButton.disabled = true;
    installButton.textContent = '已安装';
    installCopy.textContent = '当前已经以独立 App 模式运行。';
  } else if (isIOS) {
    installButton.textContent = '查看方法';
    installCopy.textContent = '在 Safari 中点“分享”，再选择“添加到主屏幕”。';
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.disabled = false;
    installButton.textContent = '安装';
    installCopy.textContent = '当前浏览器支持安装，可以把工作台添加到桌面。';
  });

  installButton.addEventListener('click', async () => {
    if (isStandalone) return;
    if (!deferredInstallPrompt) {
      showToast(isIOS ? 'Safari：分享 → 添加到主屏幕。' : '浏览器菜单 → 添加到主屏幕或安装应用。');
      return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    showToast(choice.outcome === 'accepted' ? '已接受安装。' : '暂不安装也没关系。');
    deferredInstallPrompt = null;
    installButton.disabled = true;
    installButton.textContent = '已处理';
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(() => {
      showToast('离线缓存暂时没有启用。');
    });
  }

  renderAll();
})();
