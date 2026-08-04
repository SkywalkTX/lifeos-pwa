(() => {
  'use strict';

  const STORAGE_KEY = 'dataimmortality.workbench-demo.v01';
  const today = localISODate(new Date());
  const domainMeta = [
    { id: 'body', name: '身体与健身', shortName: '身体', icon: 'i-body', description: '训练、身材状态与恢复。' },
    { id: 'work', name: '每日工作', shortName: '工作', icon: 'i-work', description: '项目推进、决定与等待事项。' },
    { id: 'english', name: '英语学习', shortName: '英语', icon: 'i-language', description: '托业、雅思与日常能力。' },
    { id: 'reading', name: '阅读', shortName: '阅读', icon: 'i-book', description: '当前在读、问题与理解。' },
    { id: 'travel', name: '出行与旅行', shortName: '旅行', icon: 'i-travel', description: '从想去到计划，再到真实经历。' },
    { id: 'chores', name: '杂务', shortName: '杂务', icon: 'i-chores', description: '容易忘、快到期和正在等待的事。' }
  ];

  const defaultState = {
    version: 1,
    date: today,
    dayScore: 5,
    dayFeeling: '',
    energy: '',
    focus: '',
    lastSavedAt: '',
    closeout: { experience: false, feeling: false, tomorrow: false },
    captures: [],
    selectedArea: 'body',
    areas: Object.fromEntries(domainMeta.map((domain) => [domain.id, { focus: '', next: '', note: '' }])),
    review: { fact: '', feeling: '', tomorrow: '' }
  };

  const localStorageAvailable = canUseLocalStorage();
  let state = loadState();
  let toastTimer;

  function localISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function normalizeState(candidate) {
    const normalized = cloneDefaultState();
    if (!candidate || typeof candidate !== 'object') return normalized;
    if (typeof candidate.date === 'string') normalized.date = candidate.date;
    if (Number.isFinite(Number(candidate.dayScore))) normalized.dayScore = Math.min(10, Math.max(1, Number(candidate.dayScore)));
    if (typeof candidate.dayFeeling === 'string') normalized.dayFeeling = candidate.dayFeeling;
    if (typeof candidate.energy === 'string') normalized.energy = candidate.energy;
    if (typeof candidate.focus === 'string') normalized.focus = candidate.focus;
    if (typeof candidate.lastSavedAt === 'string') normalized.lastSavedAt = candidate.lastSavedAt;
    if (candidate.closeout && typeof candidate.closeout === 'object') {
      Object.keys(normalized.closeout).forEach((key) => { normalized.closeout[key] = Boolean(candidate.closeout[key]); });
    }
    if (Array.isArray(candidate.captures)) {
      normalized.captures = candidate.captures
        .filter((item) => item && typeof item.text === 'string')
        .slice(0, 100)
        .map((item) => ({ id: String(item.id || makeId()), text: item.text.slice(0, 160), done: Boolean(item.done) }));
    }
    if (domainMeta.some((domain) => domain.id === candidate.selectedArea)) normalized.selectedArea = candidate.selectedArea;
    if (candidate.areas && typeof candidate.areas === 'object') {
      domainMeta.forEach((domain) => {
        const source = candidate.areas[domain.id];
        if (!source || typeof source !== 'object') return;
        ['focus', 'next', 'note'].forEach((field) => {
          if (typeof source[field] === 'string') normalized.areas[domain.id][field] = source[field];
        });
      });
    }
    if (candidate.review && typeof candidate.review === 'object') {
      ['fact', 'feeling', 'tomorrow'].forEach((field) => {
        if (typeof candidate.review[field] === 'string') normalized.review[field] = candidate.review[field];
      });
    }
    return normalized;
  }

  function loadState() {
    if (!localStorageAvailable) return cloneDefaultState();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeState(JSON.parse(saved)) : cloneDefaultState();
    } catch (error) {
      return cloneDefaultState();
    }
  }

  function saveState(message) {
    try {
      if (!localStorageAvailable) throw new Error('Local storage unavailable');
      state.lastSavedAt = new Date().toISOString();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateStorageStatus(true);
      if (message) showToast(message);
    } catch (error) {
      updateStorageStatus(false);
      showToast('当前浏览器没有提供持久存储，内容只保留到页面关闭。');
    }
  }

  function updateStorageStatus(available) {
    const status = document.getElementById('local-save-status');
    if (!status) return;
    if (!available) {
      status.textContent = '无法持久保存';
      return;
    }
    const count = state.captures.length;
    status.textContent = count ? `已保存 ${count} 条捕获` : '可以使用';
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function iconMarkup(id) {
    return `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
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
    if (viewName === 'areas') selectArea(state.selectedArea);
    if (viewName === 'review') fillReviewForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAreaStrip() {
    const strip = document.getElementById('today-area-strip');
    strip.replaceChildren();
    domainMeta.forEach((domain) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'area-mini';
      button.dataset.areaId = domain.id;
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

  function renderAreaGrid() {
    const grid = document.getElementById('area-grid');
    grid.replaceChildren();
    domainMeta.forEach((domain) => {
      const area = state.areas[domain.id];
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
      status.textContent = area.next ? '已有下一步' : '待定义';
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

  function selectArea(areaId) {
    const domain = domainMeta.find((item) => item.id === areaId) || domainMeta[0];
    state.selectedArea = domain.id;
    const area = state.areas[domain.id];
    document.getElementById('editor-name').textContent = domain.name;
    document.getElementById('editor-icon').innerHTML = iconMarkup(domain.icon);
    document.getElementById('area-focus').value = area.focus;
    document.getElementById('area-next').value = area.next;
    document.getElementById('area-note').value = area.note;
    renderAreaGrid();
    saveState();
  }

  function renderCaptures() {
    const list = document.getElementById('capture-list');
    const feedback = document.getElementById('capture-feedback');
    list.replaceChildren();
    state.captures.forEach((capture) => {
      const item = document.createElement('li');
      item.className = `capture-item${capture.done ? ' is-done' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = capture.done;
      checkbox.setAttribute('aria-label', `标记“${capture.text}”是否完成`);
      checkbox.addEventListener('change', () => {
        capture.done = checkbox.checked;
        saveState();
        renderCaptures();
      });
      const text = document.createElement('span');
      text.textContent = capture.text;
      item.append(checkbox, text);
      list.appendChild(item);
    });
    if (state.captures.length && localStorageAvailable) {
      feedback.textContent = `已保存在当前设备，共 ${state.captures.length} 条；尚未同步到其他手机或电脑。`;
      feedback.classList.add('is-success');
    } else if (state.captures.length) {
      feedback.textContent = `已加入当前页面，共 ${state.captures.length} 条；浏览器没有提供持久存储，关闭后可能丢失。`;
      feedback.classList.remove('is-success');
    } else {
      feedback.textContent = '写完后会明确告诉你保存到了哪里。';
      feedback.classList.remove('is-success');
    }
    updateStorageStatus(localStorageAvailable);
  }

  function renderCloseout() {
    document.querySelectorAll('[data-closeout]').forEach((checkbox) => {
      checkbox.checked = Boolean(state.closeout[checkbox.dataset.closeout]);
    });
    const completed = Object.values(state.closeout).filter(Boolean).length;
    document.getElementById('closeout-progress').textContent = `${completed} / 3`;
  }

  function renderTodayHeader() {
    const date = new Date(`${state.date}T12:00:00`);
    const validDate = !Number.isNaN(date.getTime()) ? date : new Date();
    const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(validDate);
    const formatted = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(validDate);
    const hour = new Date().getHours();
    const period = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    document.getElementById('today-date-label').textContent = `${weekday} · ${formatted}`;
    document.getElementById('today-greeting').textContent = `${period}，先接住今天。`;
    document.getElementById('today-lead').textContent = state.dayFeeling
      ? `${state.dayFeeling}。留下一点真实记录就够了。`
      : '不用填满，留下一点真实记录就够了。';
    document.getElementById('today-score-value').textContent = String(state.dayScore);
    document.getElementById('today-focus').textContent = state.focus || state.review.tomorrow || '现在还没有设定';
  }

  function fillReviewForm() {
    document.getElementById('review-score').value = String(state.dayScore);
    document.getElementById('review-score-value').textContent = String(state.dayScore);
    document.getElementById('review-fact').value = state.review.fact;
    document.getElementById('review-feeling').value = state.review.feeling;
    document.getElementById('review-tomorrow').value = state.review.tomorrow;
  }

  function renderAll() {
    renderTodayHeader();
    renderAreaStrip();
    renderAreaGrid();
    renderCaptures();
    renderCloseout();
    fillReviewForm();
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
      state.closeout[checkbox.dataset.closeout] = checkbox.checked;
      saveState();
      renderCloseout();
    });
  });

  document.getElementById('capture-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('capture-input');
    const text = input.value.trim();
    if (!text) {
      showToast('先写下一点内容。');
      input.focus();
      return;
    }
    state.captures.unshift({ id: makeId(), text, done: false });
    input.value = '';
    saveState('已接住，暂时不分类。');
    renderCaptures();
    input.focus();
  });

  document.getElementById('area-editor').addEventListener('submit', (event) => {
    event.preventDefault();
    const area = state.areas[state.selectedArea];
    area.focus = document.getElementById('area-focus').value.trim();
    area.next = document.getElementById('area-next').value.trim();
    area.note = document.getElementById('area-note').value.trim();
    saveState('这个领域已经保存。');
    renderAreaGrid();
  });

  document.getElementById('review-score').addEventListener('input', (event) => {
    document.getElementById('review-score-value').textContent = event.target.value;
  });

  document.getElementById('review-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.dayScore = Number(document.getElementById('review-score').value);
    state.review.fact = document.getElementById('review-fact').value.trim();
    state.review.feeling = document.getElementById('review-feeling').value.trim();
    state.review.tomorrow = document.getElementById('review-tomorrow').value.trim();
    state.dayFeeling = state.review.feeling;
    state.focus = state.review.tomorrow;
    saveState('回顾草稿已保存在本地。');
    renderTodayHeader();
  });

  document.getElementById('markdown-button').addEventListener('click', () => {
    state.dayScore = Number(document.getElementById('review-score').value);
    state.review.fact = document.getElementById('review-fact').value.trim();
    state.review.feeling = document.getElementById('review-feeling').value.trim();
    state.review.tomorrow = document.getElementById('review-tomorrow').value.trim();
    state.dayFeeling = state.review.feeling;
    state.focus = state.review.tomorrow;
    saveState();
    const fact = state.review.fact || '';
    const feeling = state.review.feeling || '';
    const tomorrow = state.review.tomorrow || '';
    const markdown = `---\ndate: ${state.date}\nprivacy: private\nsource: human-ai-collaboration\nstatus: draft\n---\n\n> 本文由 LifeOS demo 根据用户填写内容生成，仅作为待确认草稿；未填写处保持空白。\n\n# 今天发生了什么\n\n- ${fact}\n\n# 完成的行动\n\n- [ ] \n\n# 想法\n\n- \n\n# 决定与原因\n\n- \n\n# 状态\n\n- 精力：${state.energy || '未记录'}\n- 情绪：${state.dayScore}/10${feeling ? `（${feeling}）` : ''}\n\n# 明天\n\n- [ ] ${tomorrow}\n`;
    downloadText(`${state.date}-draft.md`, markdown, 'text/markdown;charset=utf-8');
    showToast('Daily Markdown 草稿已下载。');
  });

  document.querySelectorAll('[data-assistant-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const responses = {
        closeout: '好。你可以随便说几句今天发生了什么。正式接入后，我会把内容分成亲历事实、你的感受、外部转述和候选推断，再交给你确认。',
        tomorrow: '明天先只选一件最重要的事。等你提供固定安排和精力预期后，我再帮你压缩成现实版本。',
        areas: '目前六个领域都还没有设定下一步。这不是问题：我们可以先从你最想改善、也最容易行动的一块开始。'
      };
      const message = document.getElementById('assistant-message');
      message.querySelector('p').textContent = responses[button.dataset.assistantAction];
      if (button.dataset.assistantAction === 'areas') switchView('areas');
    });
  });

  document.getElementById('assistant-question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('assistant-question-input');
    const question = input.value.trim();
    if (!question) {
      showToast('先写下你想问的内容。');
      input.focus();
      return;
    }
    const match = domainMeta.find((domain) => {
      const keywords = {
        body: ['健身', '身体', '体重', '训练', '睡眠'],
        work: ['工作', '项目', '同事', '老板', '职场'],
        english: ['英语', '雅思', '托业', '单词', '听力'],
        reading: ['阅读', '书', '读完', '作者'],
        travel: ['旅行', '出行', '机票', '酒店', '签证'],
        chores: ['杂务', '缴费', '快递', '提醒', '忘记']
      };
      return keywords[domain.id].some((keyword) => question.includes(keyword));
    });
    const message = document.getElementById('assistant-message').querySelector('p');
    message.textContent = match
      ? `演示回应：我会先把这条内容归到“${match.name}”。真正接入 AI 后，我还会结合相关 Daily 和计划回答；现在这段文字没有发送到网络。`
      : '演示回应：我已经接到这个问题，但当前没有连接真正的模型，所以不会假装给出智能答案。这段文字没有发送到网络。';
    input.value = '';
  });

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
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
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'LifeOS demo', state }, null, 2);
    downloadText(`lifeos-demo-${state.date}.json`, payload, 'application/json;charset=utf-8');
    showToast('演示快照已导出。');
  });

  document.getElementById('import-input').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      state = normalizeState(parsed.state || parsed);
      saveState();
      renderAll();
      showToast('演示快照已导入。');
    } catch (error) {
      showToast('无法读取这个快照，请确认它是正确的 JSON 文件。');
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
    installCopy.textContent = '当前浏览器支持安装，可以把工作台添加到手机或电脑桌面。';
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
