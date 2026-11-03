'use strict';

(function () {
  window.__naspilotBooted = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const on = (target, ev, fn, opts) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.addEventListener(ev, fn, opts);
    return el;
  };

  function reportError(msg) {
    try {
      let bar = document.getElementById('bootError');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bootError';
        bar.className = 'boot-error';
        document.body.appendChild(bar);
      }
      bar.textContent = msg;
    } catch (e) {
    }
  }
  window.addEventListener('error', (e) => {
    const msg = (e && e.message) || '脚本执行出错';
    reportError(`界面脚本出错：${msg} · 若刚更新过，请把 public 整个目录重新覆盖一次`);
  });
  const esc = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICON = {
    all: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>',
    star: '<svg viewBox="0 0 20 20"><path d="M10 3.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7L3.2 8.2l4.7-.7z"/></svg>',
    clock: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.6"/><path d="M10 6.4V10l2.6 1.6"/></svg>',
    flame: '<svg viewBox="0 0 20 20"><path d="M10 2.6c2.6 3 4.4 4.8 4.4 7.3a4.4 4.4 0 01-8.8 0c0-1.2.5-2.2 1.4-3.3.3 1.2 1 1.9 1.7 2.1-.3-2.3-.4-4.1 1.3-6.1z"/></svg>',
    inbox: '<svg viewBox="0 0 20 20"><path d="M3 11.5l1.8-6A1.6 1.6 0 016.3 4.4h7.4a1.6 1.6 0 011.5 1.1l1.8 6"/><path d="M3 11.5h3.6l1 2h4.8l1-2H17v4a1.6 1.6 0 01-1.6 1.6H4.6A1.6 1.6 0 013 15.5z"/></svg>',
    media: '<svg viewBox="0 0 20 20"><rect x="2.6" y="4.2" width="14.8" height="11.6" rx="2"/><path d="M8.4 8l4 2.2-4 2.2z"/></svg>',
    download: '<svg viewBox="0 0 20 20"><path d="M10 3.6v8.2M6.8 9l3.2 3.2L13.2 9"/><path d="M4 15.2h12"/></svg>',
    tool: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.4"/><path d="M10 2.6v2M10 15.4v2M17.4 10h-2M4.6 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3L4.9 4.9"/></svg>',
    system: '<svg viewBox="0 0 20 20"><rect x="3" y="3.6" width="14" height="9.4" rx="1.8"/><path d="M7 16.4h6"/></svg>',
    other: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.6"/><path d="M10 3.4v13.2"/></svg>',
    gear: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.6v2.2M10 15.2v2.2M17.4 10h-2.2M4.8 10H2.6M15.3 4.7l-1.6 1.6M6.3 13.7l-1.6 1.6M15.3 15.3l-1.6-1.6M6.3 6.3L4.7 4.7"/></svg>',
    open: '<svg viewBox="0 0 20 20"><path d="M11.4 4.6h4v4M15.4 4.6L9.6 10.4"/><path d="M15.4 11.6v3a1.6 1.6 0 01-1.6 1.6H5.2a1.6 1.6 0 01-1.6-1.6V6.2A1.6 1.6 0 015.2 4.6h3"/></svg>',
    edit: '<svg viewBox="0 0 20 20"><path d="M13.2 3.8l3 3L7.6 15.4l-3.8.9.9-3.8z"/></svg>',
    hide: '<svg viewBox="0 0 20 20"><path d="M2.6 10S5.4 5.4 10 5.4 17.4 10 17.4 10 14.6 14.6 10 14.6 2.6 10 2.6 10z"/><circle cx="10" cy="10" r="2"/><path d="M3.4 3.4l13.2 13.2"/></svg>',
    play: '<svg viewBox="0 0 20 20"><path d="M7 4.8l8 5.2-8 5.2z"/></svg>',
    stop: '<svg viewBox="0 0 20 20"><rect x="5.4" y="5.4" width="9.2" height="9.2" rx="1.6"/></svg>',
    restart: '<svg viewBox="0 0 20 20"><path d="M16 9.4A6.2 6.2 0 1 0 15.8 12"/><path d="M16.4 5.2v4.2h-4.2"/></svg>',
    scan: '<svg viewBox="0 0 20 20"><path d="M3.4 7V4.6a1.2 1.2 0 011.2-1.2H7M13 3.4h2.4a1.2 1.2 0 011.2 1.2V7M16.6 13v2.4a1.2 1.2 0 01-1.2 1.2H13M7 16.6H4.6a1.2 1.2 0 01-1.2-1.2V13"/><path d="M7 10h6"/></svg>',
    drag: '<svg viewBox="0 0 20 20"><circle cx="8" cy="6" r="1.1"/><circle cx="12" cy="6" r="1.1"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="10" r="1.1"/><circle cx="8" cy="14" r="1.1"/><circle cx="12" cy="14" r="1.1"/></svg>'
  };

  const ACCENTS = ['#e8b45a', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6', '#fb7185', '#94a3b8'];
  const state = {
    data: null,
    view: 'all',
    sel: -1,
    query: '',
    health: {},
    discover: null,
    scanning: false,
    editing: null,
    tab: 'general',
    stats: null,
    statsSel: -1,
    iconStamp: 0,
    iconFail: new Set(),
    kinds: [],
    timers: [],
    lastGroupSortEnd: 0
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.locked) {
      location.reload();
      throw new Error('需要重新输入密码');
    }
    if (!res.ok || data.ok === false) throw new Error(data.error || `请求失败 (${res.status})`);
    return data;
  }

  function toast(msg, isErr, action) {
    const box = $('#toasts');
    const n = document.createElement('div');
    n.className = 'toast' + (isErr ? ' err' : '');
    function remove() {
      n.style.opacity = '0';
      n.style.transition = 'opacity .2s';
      setTimeout(() => n.remove(), 220);
    }
    const span = document.createElement('span');
    span.textContent = msg;
    n.appendChild(span);
    if (action) {
      const b = document.createElement('button');
      b.className = 'toast-act';
      b.textContent = action.label;
      b.addEventListener('click', () => {
        remove();
        action.onClick();
      });
      n.appendChild(b);
    }
    box.appendChild(n);
    setTimeout(remove, action ? 6000 : isErr ? 3600 : 2000);
  }

  function askConfirm(opt) {
    return new Promise((resolve) => {
      const box = $('#confirm');
      if (!box) {
        resolve(window.confirm(String(opt.text || '').replace(/<[^>]+>/g, '')));
        return;
      }
      const yes = $('#confirmYes');
      const no = $('#confirmNo');
      $('#confirmTitle').textContent = opt.title || '确认';
      $('#confirmText').innerHTML = opt.text || '';
      yes.textContent = opt.okText || '确定';
      yes.classList.toggle('danger', !!opt.danger);
      box.hidden = false;
      const done = (v) => {
        box.hidden = true;
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        box.removeEventListener('click', onBack);
        resolve(v);
      };
      const onYes = () => done(true);
      const onNo = () => done(false);
      const onBack = (e) => {
        if (e.target.id === 'confirm') done(false);
      };
      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      box.addEventListener('click', onBack);
    });
  }

  function askPrompt(opt) {
    return new Promise((resolve) => {
      const box = $('#confirm');
      if (!box) {
        resolve(window.prompt(opt.title || '输入', opt.value || '') || null);
        return;
      }
      const yes = $('#confirmYes');
      const no = $('#confirmNo');
      $('#confirmTitle').textContent = opt.title || '输入';
      const holder = $('#confirmText');
      holder.innerHTML = '';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = opt.value || '';
      inp.placeholder = opt.placeholder || '';
      holder.appendChild(inp);
      yes.textContent = opt.okText || '保存';
      yes.classList.remove('danger');
      box.hidden = false;
      const done = (v) => {
        box.hidden = true;
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        box.removeEventListener('click', onBack);
        inp.removeEventListener('keydown', onKey);
        resolve(v);
      };
      const onYes = () => done(inp.value.trim() || null);
      const onNo = () => done(null);
      const onKey = (e) => {
        if (e.key === 'Enter') onYes();
        if (e.key === 'Escape') onNo();
      };
      const onBack = (e) => {
        if (e.target.id === 'confirm') done(null);
      };
      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      box.addEventListener('click', onBack);
      inp.addEventListener('keydown', onKey);
      setTimeout(() => {
        inp.focus();
        inp.select();
      }, 30);
    });
  }

  const TONES = ['#7d8fa6', '#8a93a1', '#7f8b91', '#8f8779', '#7c8a80', '#8a8296'];

  function hue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function tone(str) {
    return TONES[hue(String(str || '?')) % TONES.length];
  }

  function letter(app) {
    const ch = (app.name || '?').trim().charAt(0);
    return esc(ch.toUpperCase());
  }

  function favicon(app) {
    if (app.icon) return app.icon;
    if (!app.url) return '';
    try {
      const origin = new URL(app.url).origin;
      if (state.iconFail.has(origin)) return '';
      const q = '/api/icon?u=' + encodeURIComponent(origin);
      return state.iconStamp ? q + '&t=' + state.iconStamp : q;
    } catch (e) {
      return '';
    }
  }

  function applySettings() {
    const s = state.data.settings;
    const sysLight = (() => {
      try {
        return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
      } catch (e) {
        return false;
      }
    })();
    const theme = s.theme === 'auto' ? (sysLight ? 'light' : 'dark') : s.theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--accent-raw', s.accent);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#f1f3f7' : '#0b0e13');
    document.body.dataset.density = s.density || 'standard';
    $('#brandTitle').textContent = s.title || 'NasPilot';
    document.title = s.title || 'NasPilot';
    drawDensityBtn();
  }

  function groupIcon(id) {
    return ICON[id] && id !== 'all' ? ICON[id] : ICON.other;
  }

  function groupName(id) {
    const g = state.data.groups.find((x) => x.id === id);
    return g ? g.name : '未分组';
  }

  function renderGroups() {
    const d = state.data;
    const counts = {};
    d.apps.forEach((a) => {
      if (a.hidden) return;
      counts[a.groupId] = (counts[a.groupId] || 0) + 1;
    });
    const pinned = d.apps.filter((a) => a.pinned && !a.hidden).length;
    const items = [
      { id: 'all', name: '全部入口', icon: 'all', count: Object.values(counts).reduce((a, b) => a + b, 0) },
      { id: 'star', name: '收藏', icon: 'star', count: pinned },
      { id: 'top', name: '常用', icon: 'flame', count: 0 },
      { id: 'recent', name: '最近打开', icon: 'clock', count: 0 }
    ];
    const hiddenCount = d.apps.filter((a) => a.hidden).length;
    items.push({ id: 'discover', name: '待认领', icon: 'inbox', count: d.discover.count || 0 });
    if (hiddenCount) items.push({ id: 'hidden', name: '已隐藏', icon: 'hide', count: hiddenCount });

    let html = items
      .map(
        (g) => `<button class="grp${state.view === g.id ? ' on' : ''}" data-view="${g.id}">
        <span class="gi">${ICON[g.icon] || ICON.other}</span>
        <span class="gt">${esc(g.name)}</span>
        ${g.count ? `<span class="cnt">${g.count}</span>` : ''}
      </button>`
      )
      .join('');

    html += '<div class="grp-div"></div>';
    html += [...d.groups]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(
        (g) => `<button class="grp${state.view === g.id ? ' on' : ''}" data-view="${g.id}" data-gid="${g.id}">
        <span class="gi">${groupIcon(g.id)}</span>
        <span class="gt">${esc(g.name)}</span>
        ${counts[g.id] ? `<span class="cnt">${counts[g.id]}</span>` : ''}
      </button>`
      )
      .join('');

    $('#groups').innerHTML = html;
    setupGroupSort('#groups .grp[data-gid]');
  }

  function dotClass(app) {
    if (app.missing) return 'off';
    if (app.source === 'docker' && app.state !== 'running') return 'off';
    const h = state.health[app.id];
    if (!h) return '';
    return h.ok ? 'on' : 'wait';
  }

  function latencyChip(app) {
    const h = state.health[app.id];
    if (app.source === 'docker' && app.state && app.state !== 'running') return '<span class="chip mute">已停止</span>';
    if (!h) return '';
    if (!h.ok) return '<span class="chip bad">离线</span>';
    const cls = h.ms > 800 ? 'warn' : 'ok';
    return `<span class="chip ${cls}">${h.ms}ms</span>`;
  }

  function portChip(app) {
    if (!app.port) return '';
    return `<span class="chip mute">:${app.port}</span>`;
  }

  function rowHtml(app) {
    const icon = favicon(app);
    let ico;
    if (icon) {
      let origin = '';
      try {
        origin = new URL(app.url).origin;
      } catch (e) {}
      ico = `<img src="${esc(icon)}" alt="" loading="lazy" draggable="false" data-letter="${letter(app)}" data-origin="${esc(origin)}" />`;
    } else {
      ico = `<span>${letter(app)}</span>`;
    }
    const badges = [];
    if (app.pinned) badges.push('<span class="badge accent">收藏</span>');
    if (app.source === 'docker' && !app.missing) badges.push('<span class="badge">docker</span>');
    if (app.missing) badges.push('<span class="badge">已移除</span>');

    return `<div class="svc${app.hidden ? ' dim' : ''}${app.missing ? ' flagged' : ''}${state.view === 'hidden' ? ' restore-row' : ''}" data-id="${app.id}" tabindex="0">
      <span class="dot ${dotClass(app)}"></span>
      <span class="ico" style="${icon ? '' : `color:${tone(app.name)}`}">${ico}</span>
      <div class="info">
        <div class="nm">${esc(app.name)}${badges.join('')}</div>
        <div class="ds">${esc(app.desc || app.url || '')}</div>
      </div>
      <div class="acts">${
        state.view === 'hidden'
          ? `<button class="btn sm" data-act="restore">恢复</button><button data-act="open" title="打开">${ICON.open}</button>`
          : `${app.canControl ? controlBtns(app) : ''}<button data-act="edit" title="编辑">${ICON.edit}</button><button data-act="hide" title="${app.hidden ? '显示' : '隐藏'}">${ICON.hide}</button><button data-act="open" title="打开">${ICON.open}</button>`
      }</div>
      <div class="metrics">${portChip(app)}${latencyChip(app)}</div>
    </div>`;
  }

  function controlBtns(app) {
    const running = app.state === 'running';
    return running
      ? `<button data-act="restart" title="重启容器">${ICON.restart}</button><button class="act-stop" data-act="stop" title="停止容器">${ICON.stop}</button>`
      : `<button class="act-play" data-act="start" title="启动容器">${ICON.play}</button>`;
  }

  function visibleApps() {
    const d = state.data;
    let list = state.view === 'hidden' ? d.apps.filter((a) => a.hidden) : d.apps.filter((a) => !a.hidden || state.query);
    const q = state.query.trim().toLowerCase();

    if (state.view === 'star') list = list.filter((a) => a.pinned);
    else if (state.view === 'top') list = list.filter((a) => a.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
    else if (state.view === 'recent') list = list.filter((a) => a.lastVisit).sort((a, b) => b.lastVisit - a.lastVisit).slice(0, 14);
    else if (state.view !== 'all' && state.view !== 'discover' && state.view !== 'hidden')
      list = list.filter((a) => a.groupId === state.view);

    if (q) {
      list = list.filter((a) =>
        [a.name, a.desc, a.url, groupName(a.groupId), (a.tags || []).join(' ')].join(' ').toLowerCase().includes(q)
      );
    }
    return list;
  }

  const titles = {
    all: '全部入口',
    star: '收藏',
    top: '常用',
    recent: '最近打开',
    discover: '待认领',
    hidden: '已隐藏'
  };

  function markSelection() {
    const rows = $$('#services .svc');
    if (!rows.length) {
      state.sel = -1;
      return;
    }
    if (state.sel > rows.length - 1) state.sel = rows.length - 1;
    rows.forEach((el, i) => el.classList.toggle('sel', i === state.sel));
    const hit = state.sel >= 0 ? rows[state.sel] : null;
    if (hit && typeof hit.scrollIntoView === 'function') hit.scrollIntoView({ block: 'nearest' });
  }

  function renderServices() {
    const list = visibleApps();
    const body = $('#services');

    if (state.view === 'discover') {
      renderDiscover(body);
      updateTitle('待认领', '');
      return;
    }

    const running = list.filter((a) => a.source === 'docker' && a.state === 'running').length;
    updateTitle(
      state.view === 'all' ? '全部入口' : titles[state.view] || groupName(state.view),
      state.view === 'hidden' ? `${list.length} 个已隐藏 · 点「恢复」放回面板` : ''
    );

    if (!list.length) {
      state.sel = -1;
      body.innerHTML = '';
      $('#empty').hidden = false;
      const eT = state.query ? '没有匹配的入口' : state.view === 'hidden' ? '没有隐藏的入口' : '这里还空着';
      const eP = state.query
        ? '换个关键词试试，或者清空搜索框。'
        : state.view === 'hidden'
          ? '隐藏只是从面板收起，容器和入口本身都不受影响。'
          : '点右上角「添加」手动录入，或在设置里同步 Docker 容器与扫描本机端口。';
      $('#empty').innerHTML = `<div class="eico">${ICON.inbox}</div><h3>${eT}</h3><p>${eP}</p>`;
      return;
    }
    $('#empty').hidden = true;

    let html = '';
    if (state.view === 'all' && !state.query) {
      const groups = [...state.data.groups].sort((a, b) => (a.order || 0) - (b.order || 0));
      const folded = collapsedSet();
      for (const g of groups) {
        const items = list.filter((a) => a.groupId === g.id).sort(sortApps);
        if (!items.length) continue;
        const isFold = folded.has(g.id);
        html += `<div class="sec" data-gid="${g.id}"><span>${esc(g.name)}</span><i>${isFold ? `已折叠 ${items.length}` : items.length}</i></div>`;
        if (isFold) continue;
        html += items.map(rowHtml).join('');
      }
      const rest = list.filter((a) => !groups.some((g) => g.id === a.groupId)).sort(sortApps);
      if (rest.length) html += `<div class="sec"><span>未分组</span></div>` + rest.map(rowHtml).join('');
    } else {
      html = list.sort(sortApps).map(rowHtml).join('');
    }
    body.innerHTML = html;
    attachDrag();
    markSelection();
  }

  function collapsedSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem('naspilot.folded') || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function toggleFold(gid) {
    const set = collapsedSet();
    set.has(gid) ? set.delete(gid) : set.add(gid);
    localStorage.setItem('naspilot.folded', JSON.stringify([...set]));
    renderServices();
  }

  let drag = null;
  let dragGuard = 0;

  function attachDrag() {
    if (state.view !== 'all' || state.query.trim()) return;
    $$('#services .svc').forEach((row) => {
      row.classList.add('can-drag');
      row.addEventListener('pointerdown', (e) => onDragDown(e, row));
    });
  }

  function onDragDown(e, row) {
    if (drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    const touch = e.pointerType !== 'mouse';
    drag = { row, id: row.dataset.id, x: e.clientX, y: e.clientY, active: false, touch, timer: 0, ghost: null, over: null, offX: 0, offY: 0 };
    if (touch) drag.timer = setTimeout(() => activate(drag.x, drag.y), 320);
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragUp);
    window.addEventListener('pointercancel', onDragUp);
  }

  function onDragMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 9) return;
      if (drag.touch) return resetDrag();
      activate(drag.x, drag.y);
    }
    e.preventDefault();
    paintGhost(e.clientX, e.clientY);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest ? el.closest('#services .svc') : null;
    const next = target && target !== drag.row ? target : null;
    const grpEl = !next && el && el.closest ? el.closest('#groups .grp') : null;
    const onlyGroup = grpEl && state.data.groups.some((g) => g.id === grpEl.dataset.view) ? grpEl : null;
    const slotEl = !next && !onlyGroup && el && el.closest ? el.closest('.grp-empty[data-gid], .sec[data-gid]') : null;
    if (drag.over && drag.over !== next) drag.over.classList.remove('drag-over');
    if (next) next.classList.add('drag-over');
    if (drag.slotEl && drag.slotEl !== slotEl) drag.slotEl.classList.remove('drag-over');
    if (slotEl) slotEl.classList.add('drag-over');
    if (drag.grpEl && drag.grpEl !== onlyGroup) drag.grpEl.classList.remove('drag-over');
    if (onlyGroup) onlyGroup.classList.add('drag-over');
    drag.over = next;
    drag.slotEl = slotEl || null;
    drag.slotGid = slotEl ? slotEl.dataset.gid : '';
    drag.grpEl = onlyGroup;
    drag.grpGid = onlyGroup ? onlyGroup.dataset.view : '';
  }

  function activate(px, py) {
    if (!drag || drag.active) return;
    drag.active = true;
    clearTimeout(drag.timer);
    if (drag.touch) {
      try {
        if (navigator.vibrate) navigator.vibrate(12);
      } catch (e) {}
    }
    const r = drag.row.getBoundingClientRect();
    const g = drag.row.cloneNode(true);
    g.className = 'svc dragging-ghost';
    g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;pointer-events:none;z-index:220`;
    document.body.appendChild(g);
    drag.ghost = g;
    drag.offX = px - r.left;
    drag.offY = py - r.top;
    drag.row.classList.add('drag-src');
    document.body.classList.add('is-dragging');
  }

  function paintGhost(x, y) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.left = x - drag.offX + 'px';
    drag.ghost.style.top = y - drag.offY + 'px';
  }

  function resetDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    if (drag.ghost) drag.ghost.remove();
    if (drag.row) drag.row.classList.remove('drag-src');
    $$('#services .svc, #services .grp-empty, #services .sec, #groups .grp').forEach((r) => r.classList.remove('drag-over'));
    document.body.classList.remove('is-dragging');
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', onDragUp);
    drag = null;
  }

  function onDragUp() {
    if (!drag) return;
    const moved = drag.active;
    const targetId = drag.over ? drag.over.dataset.id : null;
    const slotGid = drag.slotGid || '';
    const grpGid = drag.grpGid || '';
    const fromId = drag.id;
    resetDrag();
    if (!moved) return;
    dragGuard = Date.now() + 350;
    if (grpGid) commitToGroup(fromId, grpGid, true);
    else if (slotGid) commitToGroup(fromId, slotGid);
    else if (targetId && targetId !== fromId) commitDrop(fromId, targetId);
  }

  async function commitToGroup(fromId, gid, fromRail) {
    const src = state.data.apps.find((a) => a.id === fromId);
    if (!src) return;
    if (src.groupId === gid) {
      if (fromRail) toast(`已经在「${groupName(gid)}」里了`);
      return;
    }
    src.groupId = gid;
    render();
    try {
      await api('/api/apps/' + fromId, { method: 'PATCH', body: { groupId: gid } });
      toast(`已移到「${groupName(gid)}」`);
    } catch (e) {
      toast(e.message, true);
      load();
    }
  }

  async function commitDrop(fromId, toId) {
    const ids = $$('#services .svc').map((r) => r.dataset.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const apps = state.data.apps;
    const src = apps.find((a) => a.id === fromId);
    const dst = apps.find((a) => a.id === toId);
    if (!src || !dst) return;

    const patch = {};
    if (src.pinned !== dst.pinned) {
      src.pinned = dst.pinned;
      patch.pinned = dst.pinned;
    }
    if (src.groupId !== dst.groupId) {
      src.groupId = dst.groupId;
      patch.groupId = dst.groupId;
    }
    const rest = apps.filter((a) => !ids.includes(a.id)).map((a) => a.id);
    ids.concat(rest).forEach((id, i) => {
      const a = apps.find((x) => x.id === id);
      if (a) a.order = i;
    });
    render();
    try {
      if (Object.keys(patch).length) await api('/api/apps/' + fromId, { method: 'PATCH', body: patch });
      await api('/api/apps/reorder', { method: 'POST', body: { ids: ids.concat(rest) } });
    } catch (err) {
      toast(err.message, true);
      load();
    }
  }

  function sortApps(a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (a.order || 0) - (b.order || 0);
  }

  function updateTitle(title, meta) {
    $('#viewTitle').textContent = title;
    $('#viewMeta').textContent = meta || '';
  }

  function renderDiscover(box) {
    box.innerHTML = '';
    if (state.scanning) {
      box.innerHTML = '<div class="sec"><span>扫描中</span></div>';
      return;
    }
    const res = state.discover;
    if (!res) {
      box.innerHTML = '';
      $('#empty').hidden = false;
      $('#empty').innerHTML = `<div class="eico">${ICON.scan}</div><h3>扫描本机端口</h3><p>读取宿主机监听端口并逐个探测，把没有纳入面板的 Web 服务找出来。飞牛自带的应用也能在这里认领。</p><button class="btn primary" data-act="scan">开始扫描</button>`;
      return;
    }
    if (!res.ok && !res.services.length) {
      $('#empty').hidden = false;
      $('#empty').innerHTML = `<div class="eico">${ICON.scan}</div><h3>没有读到端口</h3><p>${esc(res.error || '容器内无法读取宿主机 /proc，请确认 compose 已挂载 /proc 到 /host/proc。')}</p><button class="btn" data-act="scan">重新扫描</button>`;
      return;
    }
    const list = res.services.filter((s) => !s.claimed);
    if (!list.length) {
      $('#empty').hidden = false;
      $('#empty').innerHTML = `<div class="eico">${ICON.inbox}</div><h3>没有待认领的入口</h3><p>已扫描 ${res.scanned} 个端口，全部已收录或不是 Web 服务。</p><button class="btn" data-act="scan">重新扫描</button>`;
      return;
    }
    $('#empty').hidden = true;
    box.innerHTML =
      `<div class="sec"><span>发现 ${list.length} 个</span></div>
       <div class="scanbar">
         <button class="btn sm primary" data-act="collect">全部收录</button>
         <button class="btn sm" data-act="scan">重新扫描</button>
         <span class="hint">${esc(res.probeHost || '')} · 宿主共 ${res.total || 0} 个监听端口</span>
       </div>` +
      list
        .map(
          (s) => `<div class="svc svc-scan" data-port="${s.port}" data-path="${esc(s.path || '')}">
        <span class="dot on"></span>
        <span class="ico">${ICON.scan}</span>
        <div class="info">
          <div class="nm">${esc(s.title || `端口 ${s.port}`)}</div>
          <div class="ds">${esc(location.hostname)}:${s.port}${esc(s.path || '')}${s.ports && s.ports.length > 1 && !s.path ? `（等 ${s.ports.length} 个端口）` : ''} · ${s.ms ? `HTTP ${esc(String(s.code))} · ${esc(String(s.ms))}ms` : '内置应用'}</div>
        </div>
        <div class="acts"><button class="btn sm" data-act="claim">认领</button></div>
      </div>`
        )
        .join('');
  }

  function renderFoot() {
    const box = $('#railStat');
    if (!box) return;
    const d = state.data;
    const shown = d.apps.filter((a) => !a.hidden);
    const online = shown.filter((a) => state.health[a.id] && state.health[a.id].ok).length;
    const hasProbe = shown.length > 0 && shown.some((a) => state.health[a.id]);
    let txt = hasProbe ? `${online}/${shown.length} 入口` : `${shown.length} 个入口`;
    const tips = [hasProbe ? `${online}/${shown.length} 个入口在线（不含已隐藏）` : `面板内 ${shown.length} 个入口（不含已隐藏）`];
    if (d.settings.dockerEnabled) {
      const dockers = shown.filter((a) => a.source === 'docker' && !a.missing && a.state !== 'removed');
      const running = dockers.filter((a) => a.state === 'running').length;
      if (dockers.length) tips.push(`其中容器 ${dockers.length} 个（${running} 个运行中）`);
      const hiddenDocker = d.apps.filter((a) => a.hidden && a.source === 'docker').length;
      const gone = d.apps.filter((a) => a.source === 'docker' && (a.missing || a.state === 'removed')).length;
      if (hiddenDocker) tips.push(`另有 ${hiddenDocker} 个容器入口被隐藏`);
      if (gone) tips.push(`另有 ${gone} 个容器已移除`);
    }
    const dotClass = !hasProbe ? 'wait' : online > 0 ? 'on' : 'off';
    box.innerHTML = `<i class="stat-dot ${dotClass}"></i><span class="stat-num">${hasProbe ? online : shown.length}</span>${hasProbe ? `<span class="stat-sep">/${shown.length}</span>` : ''}<span class="stat-t">入口</span>`;
    box.title = tips.join('\n');
  }

  function render() {
    renderGroups();
    renderServices();
    renderFoot();
  }

  async function load() {
    const data = await api('/api/state');
    state.data = data;
    applySettings();
    drawDensityBtn();
    render();
    if (!data.settings.onboarded) {
      await api('/api/settings', { method: 'PATCH', body: { onboarded: true } });
      state.data.settings.onboarded = true;
    }
  }

  async function refreshHealth() {
    if (document.hidden) return;
    if (!state.data || !state.data.settings.probeEnabled) return;
    const ids = state.data.apps.filter((a) => !a.hidden && a.url).map((a) => a.id);
    if (!ids.length) return;
    try {
      const res = await api('/api/health?ids=' + ids.join(','));
      state.health = { ...state.health, ...res.health };
      renderServices();
      renderFoot();
    } catch (e) {
    }
  }

  async function dockerSync(silent) {
    if (!state.data || !state.data.settings.dockerEnabled) return;
    try {
      const res = await api('/api/docker/sync', { method: 'POST', body: {} });
      if (!res.ok) {
        if (!silent) toast(res.error || 'Docker 同步失败', true);
        return;
      }
      if (!silent && res.added) toast(`同步完成，新增 ${res.added} 个容器`);
      if (res.state) state.data = res.state;
      applySettings();
      render();
      refreshHealth();
    } catch (e) {
      if (!silent) toast(e.message, true);
    }
  }

  function appUrl(app) {
    if (app.url) return app.url;
    if (!app.port) return '';
    const scheme = app.scheme === 'https' ? 'https' : 'http';
    return `${scheme}://${location.hostname}:${app.port}/`;
  }

  function openApp(app) {
    const url = appUrl(app);
    if (!url) {
      toast('这个入口还没有配置地址', true);
      return;
    }
    api('/api/visit/' + app.id, { method: 'POST' }).catch(() => {});
    app.lastVisit = Date.now();
    const target = state.data.settings.openInNewTab ? '_blank' : '_self';
    window.open(url, target, 'noopener');
  }

  async function dockerAction(app, verb) {
    const names = { start: '启动', stop: '停止', restart: '重启' };
    if (verb === 'stop' || verb === 'restart') {
      const ok = await askConfirm({
        title: names[verb] + '容器',
        text: verb === 'stop'
          ? `停止后 <b>${esc(app.name)}</b> 将立即无法访问，正在进行的传输或任务会被中断。`
          : `重启过程中 <b>${esc(app.name)}</b> 会断开几秒到几十秒。`,
        okText: names[verb],
        danger: verb === 'stop',
      });
      if (!ok) return;
    }
    try {
      toast(`${names[verb]}中…`);
      const res = await api(`/api/docker/${app.id}/${verb}`, { method: 'POST', body: {} });
      state.data = res.state;
      render();
      refreshHealth();
      toast(`${app.name} 已${names[verb]}`);
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function setHidden(app, hidden, quiet) {
    try {
      await api('/api/apps/' + app.id, { method: 'PATCH', body: { hidden } });
      app.hidden = hidden;
      if (!hidden && state.view === 'hidden' && !state.data.apps.some((x) => x.hidden)) state.view = 'all';
      render();
      if (quiet) return;
      if (hidden) {
        toast('已隐藏，左侧「已隐藏」里可以找回', false, { label: '撤销', onClick: () => setHidden(app, false, true) });
      } else {
        toast('已恢复显示');
      }
    } catch (e) {
      toast(e.message, true);
    }
  }

  function toggleHide(app) {
    setHidden(app, !app.hidden);
  }

  on('#services', 'click', (e) => {
    if (Date.now() < dragGuard) return;
    const sec = e.target.closest('.sec[data-gid]');
    if (sec) {
      toggleFold(sec.dataset.gid);
      return;
    }
    const btn = e.target.closest('button[data-act]');
    const row = e.target.closest('.svc');

    if (btn && btn.dataset.act === 'scan') {
      runScan();
      return;
    }
    if (btn && btn.dataset.act === 'claim') {
      claim(row.dataset.port, row.dataset.path);
      return;
    }
    if (btn && btn.dataset.act === 'collect') {
      collectAll();
      return;
    }
    if (!row) return;
    if (state.view === 'discover') return;

    const app = state.data.apps.find((a) => a.id === row.dataset.id);
    if (!app) return;

    if (btn) {
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'open') openApp(app);
      else if (act === 'edit') openModal(app);
      else if (act === 'hide') toggleHide(app);
      else if (act === 'restore') setHidden(app, false);
      else dockerAction(app, act);
      return;
    }
    openApp(app);
  });

  on('#services', 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('svc')) {
      const app = state.data.apps.find((a) => a.id === e.target.dataset.id);
      if (app) openApp(app);
    }
  });

  on('#services', 
    'error',
    (e) => {
      const img = e.target;
      if (img.tagName !== 'IMG') return;
      const box = img.parentNode;
      if (!box || !box.classList.contains('ico')) return;
      box.textContent = img.dataset.letter || '?';
    },
    true
  );

  document.addEventListener('click', (e) => {
    if (Date.now() - (state.lastGroupSortEnd || 0) < 400) return;
    const view = e.target.closest('.grp[data-view]');
    if (!view) return;
    state.view = view.dataset.view;
    render();
    $('#services').scrollTop = 0;
    $('.main').scrollTop = 0;
    if (state.view === 'discover' && !state.discover) runScan();
  });

  on('#search', 'input', (e) => {
    state.query = e.target.value;
    state.sel = -1;
    renderServices();
  });

  on('#search', 'keydown', (e) => {
    if (e.key === 'Escape') {
      if (e.target.value) {
        e.target.value = '';
        state.query = '';
        state.sel = -1;
        renderServices();
      } else {
        e.target.blur();
      }
      return;
    }
    const rows = $$('#services .svc');
    if (!rows.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      let next = state.sel + (e.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) next = rows.length - 1;
      if (next > rows.length - 1) next = 0;
      state.sel = next;
      markSelection();
      return;
    }
    if (e.key === 'Enter') {
      const hit = rows[state.sel >= 0 ? state.sel : 0];
      if (hit) {
        e.preventDefault();
        hit.click();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#search').focus();
      $('#search').select();
    }
    if (e.key === 'Escape') {
      const confirmBox = $('#confirm');
      if (confirmBox && !confirmBox.hidden) $('#confirmNo').click();
      else if ($('#search') && !$('#search').value) closeDrawer(), closeModal();
    }
  });

  on('#btnRefresh', 'click', async () => {
    const icon = $('#btnRefresh');
    icon.style.transition = 'transform .5s';
    icon.style.transform = 'rotate(360deg)';
    setTimeout(() => (icon.style.transform = ''), 520);
    await dockerSync(false);
    await refreshHealth();
    if (state.view === 'discover') runScan();
    toast('已刷新');
  });

  on('#btnAdd', 'click', () => openModal(null));
  on('#btnSettings', 'click', () => openDrawer('general'));

  const DENSITY_LABEL = { loose: '宽松', standard: '标准', compact: '紧凑' };
  const densityLabel = (d) => DENSITY_LABEL[d] || '标准';
  const DENSITY_GRID = {
    loose: '<rect x="3.6" y="3.6" width="4.8" height="4.8" rx="1.4"/><rect x="11.6" y="3.6" width="4.8" height="4.8" rx="1.4"/><rect x="3.6" y="11.6" width="4.8" height="4.8" rx="1.4"/><rect x="11.6" y="11.6" width="4.8" height="4.8" rx="1.4"/>',
    standard: '<rect x="3" y="3" width="5.4" height="5.4" rx="1.4"/><rect x="11.6" y="3" width="5.4" height="5.4" rx="1.4"/><rect x="3" y="11.6" width="5.4" height="5.4" rx="1.4"/><rect x="11.6" y="11.6" width="5.4" height="5.4" rx="1.4"/>',
    compact: '<rect x="2.5" y="2.5" width="7" height="7" rx="1.5"/><rect x="10.5" y="2.5" width="7" height="7" rx="1.5"/><rect x="2.5" y="10.5" width="7" height="7" rx="1.5"/><rect x="10.5" y="10.5" width="7" height="7" rx="1.5"/>'
  };
  function drawDensityBtn() {
    const btn = $('#btnDensity');
    if (!btn || !state.data || !state.data.settings) return;
    const ico = btn.querySelector('.density-ico');
    const d = state.data.settings.density || 'standard';
    btn.title = '卡片密度：' + densityLabel(d) + '（点这里切换）';
    if (ico && DENSITY_GRID[d]) ico.innerHTML = DENSITY_GRID[d];
  }
  function toggleDensityPop(open) {
    const pop = $('#densityPop');
    if (!pop) return;
    pop.hidden = !open;
    if (open) {
      const d = state.data.settings.density || 'standard';
      $$('#densityPop [data-density]').forEach((b) => b.classList.toggle('on', b.dataset.density === d));
      const btn = $('#btnDensity');
      if (btn) {
        const r = btn.getBoundingClientRect();
        pop.style.top = (r.bottom + 6) + 'px';
        pop.style.right = (window.innerWidth - r.right) + 'px';
      }
    }
  }
  on('#btnDensity', 'click', (e) => {
    e.stopPropagation();
    const pop = $('#densityPop');
    toggleDensityPop(!!pop && pop.hidden);
  });
  $$('#densityPop [data-density]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDensityPop(false);
      patchSettings({ density: e.currentTarget.dataset.density });
      drawDensityBtn();
      toast('卡片密度已切换为「' + densityLabel(e.currentTarget.dataset.density) + '」');
    })
  );
  on(document, 'click', () => toggleDensityPop(false));

  async function runScan() {
    state.scanning = true;
    renderServices();
    try {
      const res = await fetch('/api/discover').then((r) => r.json());
      state.discover = res;
      state.scanning = false;
      if (res.ok === false && res.error) toast(res.error, true);
      renderServices();
      state.data.discover.count =
        typeof res.count === 'number' ? res.count : (res.services || []).filter((s) => !s.claimed).length;
      renderGroups();
    } catch (e) {
      state.scanning = false;
      toast(e.message, true);
      renderServices();
    }
  }

  async function collectAll() {
    try {
      toast('正在收录…');
      const r = await api('/api/discover/collect', { method: 'POST', body: { host: location.hostname } });
      if (!r.ok) return toast(r.error || '收录失败', true);
      state.discover = null;
      await load();
      runScan();
      toast(r.added ? `已收录 ${r.added} 个入口` : '没有新的可收录入口');
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function claim(port, path) {
    const svc = (state.discover.services || []).find(
      (s) => String(s.port) === String(port) && (s.path || '') === (path || '')
    );
    if (!svc) return;
    try {
      await api('/api/apps', {
        method: 'POST',
        body: {
          name: svc.title || `端口 ${port}`,
          url: `${svc.scheme === 'https' || /^https:/i.test(svc.url || '') ? 'https' : 'http'}://${location.hostname}:${svc.port}${svc.path || '/'}`,
          port: svc.port,
          desc: '端口扫描认领',
          source: 'manual'
        }
      });
      svc.claimed = true;
      await load();
      if (state.discover && state.discover.services) {
        renderGroups();
        renderServices();
      }
      toast('已加入面板');
    } catch (e) {
      toast(e.message, true);
    }
  }

  function openModal(app) {
    state.editing = app;
    const isEdit = !!app;
    $('#modalTitle').textContent = isEdit ? '编辑入口' : '添加入口';
    $('#btnDeleteApp').hidden = !isEdit;

    const groups = [...state.data.groups].sort((a, b) => (a.order || 0) - (b.order || 0));
    const g = app ? app.groupId : (groups[0] ? groups[0].id : 'other');

    $('#modalBody').innerHTML = `<div class="form">
      <label>名称<input id="f-name" type="text" maxlength="60" placeholder="例如：影视库" value="${esc(app ? app.name : '')}" /></label>
      <label>地址
        <div class="url-row">
          <input id="f-url" type="text" placeholder="输入 IP 或路径，例如 192.168.1.10:8096" value="${esc(app ? app.url : '')}" />
          <button type="button" class="btn" id="btnPing">测试</button>
        </div>
        <div id="f-url-msg" class="url-msg" hidden></div>
      </label>
      <div class="row2">
        <label>分组
          <select id="f-group">${groups.map((x) => `<option value="${x.id}"${x.id === g ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        </label>
        <label>图标地址（可选）<input id="f-icon" type="text" placeholder="留空自动取网站图标" value="${esc(app ? app.icon : '')}" /></label>
      </div>
      <label>描述<input id="f-desc" type="text" maxlength="160" placeholder="一句话说明用途" value="${esc(app ? app.desc : '')}" /></label>
      <label>标签 / 别名<input id="f-tags" type="text" placeholder="逗号分隔，搜索时一起匹配，例如：下载,bt,种子" value="${esc(app ? (app.tags || []).join(',') : '')}" /></label>
      <div class="field" style="padding:0;border:0">
        <span class="lbl">置顶到收藏</span>
        <button type="button" class="sw${app && app.pinned ? ' on' : ''}" id="f-pin"></button>
      </div>
      <div class="field" style="padding:0;border:0">
        <span class="lbl">在面板中隐藏</span>
        <button type="button" class="sw${app && app.hidden ? ' on' : ''}" id="f-hidden"></button>
      </div>
      <div class="tip">不写协议时按端口自动判断：443、5667、8443 这类端口走 <code>https</code>，其余走 <code>http</code>；也可以直接写全，比如 <code>https://192.168.1.10:5667</code>。<br/>同一个端口上的应用用路径区分：相册 <code>192.168.1.10:5666/p</code>、音乐 <code>192.168.1.10:5666/music</code>。<br/>自签证书的 https 浏览器会先弹一次「不安全」提示，点继续访问就行，面板的探活已经忽略了证书校验。</div>
    </div>`;

    on('#f-pin', 'click', (e) => e.currentTarget.classList.toggle('on'));
    on('#f-hidden', 'click', (e) => e.currentTarget.classList.toggle('on'));

    const say = (cls, text) => {
      const box = $('#f-url-msg');
      if (!box) return;
      box.hidden = !text;
      box.className = 'url-msg' + (cls ? ' ' + cls : '');
      box.textContent = text || '';
    };
    $('#f-url').addEventListener('input', () => say('', ''));

    on('#btnPing', 'click', async (e) => {
      const btn = e.currentTarget;
      const addr = parseAddress($('#f-url').value);
      if (addr.error) return say('bad', addr.error);
      if (!addr.url) return say('bad', '先填地址');
      btn.disabled = true;
      btn.textContent = '测试中';
      say('', '正在连接…');
      try {
        const res = await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: addr.url })
        });
        const r = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(r.error || '请求失败 (' + res.status + ')');
        if (r.ok) {
          say('good', '能打开 · ' + r.code + ' · ' + r.ms + ' ms' + (r.title ? ' · ' + r.title.slice(0, 28) : ''));
        } else {
          say('bad', probeText(r));
        }
      } catch (err) {
        say('bad', '测试失败：' + err.message);
      }
      btn.disabled = false;
      btn.textContent = '测试';
    });

    $('#modal').hidden = false;
    setTimeout(() => $('#f-name').focus(), 60);
  }

  function closeModal() {
    $('#modal').hidden = true;
    state.editing = null;
  }

  const TLS_PORTS = [443, 5667, 6443, 8006, 8443, 9443];

  function parseAddress(input) {
    let raw = String(input || '').trim();
    if (!raw) return { url: '' };
    if (/\s/.test(raw)) return { error: '地址里不要留空格' };
    if (/[\u4e00-\u9fa5\uff00-\uffef]/.test(raw)) return { error: '地址要填 IP 或域名，不能带中文' };

    let full = raw;
    if (/^\/\//.test(full)) full = 'http:' + full;
    const explicit = /^https?:\/\//i.test(full);
    if (!explicit && /^[a-z][a-z0-9+.-]*:\/\//i.test(full)) return { error: '只支持 http 和 https' };

    if (!explicit) {
      const m = full.match(/^([^/?#:]+)(?::(\d{1,5}))?(?:[/?#]|$)/);
      if (!m) return { error: '地址格式不对，例如 192.168.1.10:8096' };
      const port = m[2] ? Number(m[2]) : 80;
      if (port < 1 || port > 65535) return { error: '端口要在 1 到 65535 之间' };
      full = (TLS_PORTS.includes(port) ? 'https://' : 'http://') + full;
    }

    let u;
    try {
      u = new URL(full);
    } catch (e) {
      return { error: '地址格式不对，例如 192.168.1.10:8096' };
    }
    if (!u.hostname) return { error: '地址格式不对，例如 192.168.1.10:8096' };
    if (u.port && (Number(u.port) < 1 || Number(u.port) > 65535)) return { error: '端口要在 1 到 65535 之间' };
    if (!explicit && !u.hostname.includes('.') && !u.port && !u.hostname.startsWith('[')) {
      return { error: '「' + u.hostname + '」看着不像完整地址，补上端口试试：' + u.hostname + ':8096' };
    }
    let out = u.href;
    if (u.pathname === '/' && !u.search && !u.hash) out = out.replace(/\/$/, '');
    return { url: out };
  }

  function probeText(r) {
    if (r.code && r.code >= 400) return '能连上，但返回 ' + r.code + '，可能是路径不对';
    const map = {
      ECONNREFUSED: '连不上：这个端口没有服务在跑',
      ENOTFOUND: '连不上：找不到这个地址，检查 IP 或域名',
      EHOSTUNREACH: '连不上：网络不通，检查 IP 对不对',
      ENETUNREACH: '连不上：网络不通',
      ECONNRESET: '连不上：对方断开了连接',
      ETIMEDOUT: '连不上：超时了，多半被防火墙拦了',
      EAI_AGAIN: '连不上：域名解析失败'
    };
    if (map[r.error]) return map[r.error];
    return '连不上' + (r.error ? '（' + r.error + '）' : '');
  }

  async function saveApp() {
    const name = $('#f-name').value.trim();
    if (!name) return toast('请填写名称', true);
    const addr = parseAddress($('#f-url').value);
    if (addr.error) return toast(addr.error, true);
    const body = {
      name,
      url: addr.url,
      groupId: $('#f-group').value,
      icon: $('#f-icon').value.trim(),
      desc: $('#f-desc').value.trim(),
      tags: $('#f-tags')
        .value.split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      pinned: $('#f-pin').classList.contains('on'),
      hidden: $('#f-hidden').classList.contains('on')
    };
    try {
      if (state.editing) {
        await api('/api/apps/' + state.editing.id, { method: 'PATCH', body });
        toast('已保存');
      } else {
        await api('/api/apps', { method: 'POST', body });
        toast('已添加');
      }
      closeModal();
      await load();
      refreshHealth();
    } catch (e) {
      toast(e.message, true);
    }
  }

  on('#btnSaveApp', 'click', saveApp);
  on('#btnDeleteApp', 'click', async () => {
    if (!state.editing) return;
    const ok = await askConfirm({
      title: '删除入口',
      text: `确定删除 <b>${esc(state.editing.name)}</b>？只移除面板里的入口，容器本身不受影响。`,
      okText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/api/apps/' + state.editing.id, { method: 'DELETE' });
      closeModal();
      await load();
      toast('已删除');
    } catch (e) {
      toast(e.message, true);
    }
  });
  $$('[data-close-modal]').forEach((b) => b.addEventListener('click', closeModal));
  on('#modal', 'click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
  on('#modalBody', 'keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveApp();
  });

  async function patchSettings(patch) {
    state.data.settings = { ...state.data.settings, ...patch };
    applySettings();
    try {
      await api('/api/settings', { method: 'PATCH', body: patch });
    } catch (e) {
      toast(e.message, true);
    }
  }

  function openDrawer(tab) {
    state.tab = tab || 'general';
    $('#drawer').hidden = false;
    $('#scrim').hidden = false;
    renderDrawer();
  }

  function closeDrawer() {
    $('#drawer').hidden = true;
    $('#scrim').hidden = true;
    render();
  }

  on('#btnCloseDrawer', 'click', closeDrawer);
  on('#scrim', 'click', () => {
    closeDrawer();
    closeModal();
  });

  on('#setTabs', 'click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    $$('#setTabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderDrawer();
  });

  function renderDrawer() {
    const s = state.data.settings;
    $$('#setTabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === state.tab));
    const body = $('#setBody');
    const sw = (key, label, hint) =>
      `<div class="field"><div><div class="lbl">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div><button class="sw${s[key] ? ' on' : ''}" data-sw="${key}"></button></div>`;

    if (state.tab === 'general') {
      body.innerHTML = `
        <div class="field"><div class="lbl">面板名称</div><input type="text" id="s-title" value="${esc(s.title)}" style="width:150px" /></div>
        ${sw('openInNewTab', '在新标签页打开', '关闭后在当前页跳转')}
        <div class="field col"><div class="lbl">分组管理</div>
          <div id="groupList" class="top-list"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <input type="text" id="s-newgroup" placeholder="新分组名称" style="flex:1" />
            <button class="btn" id="btnAddGroup">添加</button>
          </div>
        </div>`;
      renderGroupList();
      on('#s-title', 'change', (e) => patchSettings({ title: e.target.value }));
      on('#btnAddGroup', 'click', async () => {
        const name = $('#s-newgroup').value.trim();
        if (!name) return toast('请输入分组名', true);
        try {
          await api('/api/groups', { method: 'POST', body: { name } });
          await load();
          renderDrawer();
          toast('分组已添加');
        } catch (e) {
          toast(e.message, true);
        }
      });
    }

    if (state.tab === 'security') {
      body.innerHTML = `
        <div class="field col"><div class="lbl">访问密码</div>
          <div class="pass-row">
            <input type="password" id="s-pass" autocomplete="new-password" placeholder="${state.data.hasPass ? '已设置，输入新密码可替换' : '留空表示不设密码'}" />
            <button class="btn" id="btnSavePass">${state.data.hasPass ? '替换' : '设置'}</button>
            ${state.data.hasPass ? '<button class="btn danger" id="btnClearPass">取消</button>' : ''}
          </div>
          <div class="note" style="margin-top:0">开启后打开面板要先输密码，通过后 30 天内免输。忘了密码就删掉 data/config.json 里的 passcode 字段再重启容器。</div>
        </div>
        <div class="field col"><div class="lbl">本机凭证</div>
          <div><button class="btn" id="btnLogout">退出登录</button><span class="hint" style="margin-left:8px">在别人的电脑上用完就点这个，会立刻清掉本机凭证</span></div>
        </div>`;
      on('#btnSavePass', 'click', async () => {
        const pass = $('#s-pass').value;
        if (pass.length < 4) return toast('密码至少 4 位', true);
        try {
          await api('/api/passcode', { method: 'POST', body: { password: pass } });
          await load();
          renderDrawer();
          toast('访问密码已设置');
        } catch (e) {
          toast(e.message, true);
        }
      });
      if ($('#btnClearPass'))
        on('#btnClearPass', 'click', async () => {
          try {
            await api('/api/passcode', { method: 'POST', body: { password: '' } });
            await load();
            renderDrawer();
            toast('已取消密码');
          } catch (e) {
            toast(e.message, true);
          }
        });
      if ($('#btnLogout'))
        on('#btnLogout', 'click', async () => {
          try {
            await fetch('/api/auth', { method: 'DELETE', cache: 'no-store' });
          } catch (e) {}
          try {
            location.reload();
          } catch (e) {}
        });
    }

    if (state.tab === 'look') {
      body.innerHTML = `
        <div class="field"><div class="lbl">主题</div><div class="opt-row">
          ${['dark', 'light', 'auto']
            .map((t) => `<button class="opt${s.theme === t ? ' on' : ''}" data-theme-opt="${t}">${{ dark: '深色', light: '浅色', auto: '跟随系统' }[t]}</button>`)
            .join('')}
        </div></div>
        <div class="field"><div class="lbl">卡片密度</div><div class="opt-row">
          ${['loose', 'standard', 'compact']
            .map((d) => `<button class="opt${s.density === d ? ' on' : ''}" data-density="${d}">${{ loose: '宽松', standard: '标准', compact: '紧凑' }[d]}</button>`)
            .join('')}
        </div></div>
        <div class="field col"><div class="lbl">强调色</div>
          <div class="swatches">${ACCENTS.map((c) => `<button class="swatch${s.accent.toLowerCase() === c ? ' on' : ''}" data-accent="${c}" style="background:${c}"></button>`).join('')}
          <input type="color" id="s-accent" value="${esc(s.accent)}" style="width:30px;height:22px;border:none;background:none;padding:0" /></div>
        </div>`;
      on('#s-accent', 'change', (e) => patchSettings({ accent: e.target.value }));
    }

    if (state.tab === 'docker') {
      const last = state.data.docker.lastSync ? new Date(state.data.docker.lastSync).toLocaleString('zh-CN') : '尚未同步';
      body.innerHTML = `
        ${sw('dockerEnabled', '读取 Docker 容器', '自动生成入口、同步运行状态')}
        ${sw('dockerControl', '允许启停容器', '需要 docker.sock 读写权限，关闭后只读')}
        <div class="field"><div class="lbl">Docker 套接字</div><input type="text" id="s-socket" value="${esc(s.dockerSocket)}" style="width:170px" /></div>
        <div class="field col"><div class="lbl">访问地址覆盖<div class="hint">留空则自动使用当前浏览器地址，例如用域名访问时想固定内网地址再填</div></div>
        <input type="text" id="s-host" placeholder="192.168.1.10" value="${esc(s.hostOverride)}" style="width:100%" /></div>
        <div class="field"><div class="lbl">上次同步<div class="hint">${last}</div></div><button class="btn" id="btnSyncDocker">立即同步</button></div>
        ${sw('probeEnabled', '入口探活', '定时请求每个入口，显示响应耗时')}
        ${sw('discoverEnabled', '宿主机端口扫描', '读取 /host/proc 发现未收录的服务')}
        ${sw('autoDiscover', '启动时自动收录', '面板启动 15 秒后扫一遍，把能打开的 Web 服务自动加进来')}
        <div class="field col"><div class="lbl">挂载路径<div class="hint">compose 中把宿主机 /proc 挂到容器的 /host/proc，端口扫描才有数据</div></div>
        <input type="text" id="s-proc" value="${esc(s.hostProc)}" style="width:100%" /></div>
        <div class="field col"><div class="lbl">后台扫描频率<div class="hint">扫一次要探测几十个端口，间隔越长越省资源；选「仅启动时」则不重复扫</div></div>
          <div class="opt-row">${[[0, '仅启动时'], [60, '每小时'], [360, '每 6 小时']]
            .map(([v, l]) => `<button class="opt${(Number(s.discoverInterval) || 0) === v ? ' on' : ''}" data-discover-interval="${v}">${l}</button>`)
            .join('')}</div></div>
        <div class="field col"><div class="lbl">容器状态刷新<div class="hint">只读取 docker 列表，开销很小；嫌频繁可以调长</div></div>
          <div class="opt-row">${[[120, '120 秒'], [60, '60 秒'], [30, '30 秒'], [0, '关闭自动刷新']]
            .map(([v, l]) => `<button class="opt${(Number(s.dockerInterval ?? 60)) === v ? ' on' : ''}" data-docker-interval="${v}">${l}</button>`)
            .join('')}</div></div>
        ${sw('monitorEnabled', '系统监控', '顶栏显示 CPU 占用，点开看内存、网速、负载')}
        <div class="field col"><div class="lbl">监控刷新频率<div class="hint">只读两次 /proc 做差，开销很小；用电池的设备可以调长</div></div>
          <div class="opt-row">${[[1, '1 秒'], [2, '2 秒'], [5, '5 秒'], [10, '10 秒']]
            .map(([v, l]) => `<button class="opt${(Number(s.monitorInterval) || 2) === v ? ' on' : ''}" data-monitor-interval="${v}">${l}</button>`)
            .join('')}</div></div>
`;
      on('#s-socket', 'change', (e) => patchSettings({ dockerSocket: e.target.value.trim() }));
      on('#s-host', 'change', (e) => patchSettings({ hostOverride: e.target.value.trim() }));
      on('#s-proc', 'change', (e) => patchSettings({ hostProc: e.target.value.trim() }));
      on('#btnSyncDocker', 'click', () => {
        dockerSync(false);
        setTimeout(renderDrawer, 700);
      });
      $$('#setBody [data-discover-interval]').forEach((b) =>
        b.addEventListener('click', async () => {
          await patchSettings({ discoverInterval: Number(b.dataset.discoverInterval) });
          renderDrawer();
          toast('下一次重启面板后按新频率扫描');
        })
      );
      $$('#setBody [data-docker-interval]').forEach((b) =>
        b.addEventListener('click', async () => {
          await patchSettings({ dockerInterval: Number(b.dataset.dockerInterval) });
          renderDrawer();
          restartTimers();
        })
      );
      $$('#setBody [data-monitor-interval]').forEach((b) =>
        b.addEventListener('click', async () => {
          await patchSettings({ monitorInterval: Number(b.dataset.monitorInterval) });
          renderDrawer();
          restartTimers();
          tickMonitor();
        })
      );
    }

    if (state.tab === 'data') {
      body.innerHTML = `
        <div class="field"><div class="lbl">导出配置</div><a class="btn" href="/api/export" download>下载 JSON</a></div>
        <div class="field col"><div class="lbl">导入配置<div class="hint">会覆盖当前分组与入口列表，选完文件后还会再问一次</div></div>
          <div><button class="btn" id="btnImport">选择文件</button></div>
          <div id="importBox"></div>
        </div>
        <input type="file" id="fileImport" accept="application/json" hidden />
        <div class="field"><div class="lbl">整理自动发现的条目<div class="hint">删掉状态码、默认页这类误收录项，并补齐缺失的访问地址</div></div><button class="btn" id="btnClean">清理</button></div>
        <div class="field"><div class="lbl">图标缓存<div class="hint">站点换了图标后点一下重新抓取，最长 24 小时也会自动更新</div></div><button class="btn" id="btnIconClear">重新抓取</button></div>
        ${sw('statsEnabled', '记录访问统计', '统计点击次数与最近访问，用于「最近打开」和热度排序')}
        <div id="statsBox" class="note"${s.statsEnabled ? '' : ' hidden'}>正在统计…</div>`;
      on('#btnImport', 'click', () => $('#fileImport').click());

      let pendingImport = null;
      const importBad = (msg) => {
        const box = $('#importBox');
        if (box) box.innerHTML = `<div class="warn-box bad">${esc(msg)}</div>`;
      };
      on('#fileImport', 'change', async (e) => {
        const input = e.target;
        const file = input.files && input.files[0];
        input.value = '';
        pendingImport = null;
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) return importBad('文件超过 8MB，不像是配置备份');
        let parsed;
        try {
          parsed = JSON.parse(await file.text());
        } catch (err) {
          return importBad('这个文件不是有效的 JSON，可能选错了');
        }
        if (!parsed || !Array.isArray(parsed.apps)) {
          return importBad('文件里没有 entries 列表，请选「导出配置」下载的备份文件');
        }
        pendingImport = parsed;
        const inG = Array.isArray(parsed.groups) ? parsed.groups.length : 0;
        const inA = parsed.apps.length;
        const nowG = (state.data.groups || []).length;
        const nowA = (state.data.apps || []).length;
        const box = $('#importBox');
        box.innerHTML = `<div class="warn-box">
            <b>${esc(file.name)}</b>
            <div class="warn-num">将导入 <b>${inG}</b> 个分组、<b>${inA}</b> 个入口</div>
            <div class="warn-num">当前 <b>${nowG}</b> 个分组、<b>${nowA}</b> 个入口，会被整体替换</div>
            <div class="warn-tip">这一步不能撤销。想留个底，先点上面的「下载 JSON」备份现有配置。</div>
            <div class="warn-act">
              <button class="btn" id="btnImportCancel">取消</button>
              <button class="btn danger" id="btnImportOk">确认覆盖</button>
            </div>
          </div>`;
        on('#btnImportCancel', 'click', () => {
          pendingImport = null;
          box.innerHTML = '';
        });
        on('#btnImportOk', 'click', async (ev) => {
          if (!pendingImport) return;
          const btn = ev.currentTarget;
          btn.disabled = true;
          btn.textContent = '导入中';
          try {
            await api('/api/import', { method: 'POST', body: pendingImport });
            pendingImport = null;
            await load();
            renderDrawer();
            toast('导入完成');
          } catch (err) {
            btn.disabled = false;
            btn.textContent = '确认覆盖';
            importBad('导入失败：' + err.message);
          }
        });
      });

      on('#btnIconClear', 'click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await api('/api/icons/clear', { method: 'POST', body: {} });
          state.iconStamp = Date.now();
          render();
          toast('已清空，正在重新抓取图标');
        } catch (err) {
          toast(err.message, true);
        }
        btn.disabled = false;
      });
      on('#btnClean', 'click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          const r = await api('/api/maintenance/clean', { method: 'POST', body: {} });
          await load();
          renderDrawer();
          const parts = [];
          if (r.removed) parts.push(`删掉 ${r.removed} 条无效条目`);
          if (r.fixed) parts.push(`补全 ${r.fixed} 条地址`);
          toast(parts.length ? parts.join('，') : '没有需要清理的条目');
        } catch (err) {
          toast(err.message, true);
          btn.disabled = false;
        }
      });
      loadStats();
    }

    if (state.tab === 'about') {
      body.innerHTML = `
        <div class="note" style="margin-top:14px"><b>NasPilot</b><br/>一个给自建服务准备的启动台：自动收敛 Docker 容器、扫出宿主机端口，所有服务收进一个页面，点一下就能打开，谁在跑一眼看清，管理更省事。</div>
        <div class="field"><div class="lbl">版本</div><div style="font-family:var(--mono);font-size:12px">v${esc(state.data.version)}</div></div>
        <div class="field"><div class="lbl">作者</div><div style="font-size:13px">小余</div></div>
        <div class="field"><div class="lbl">联系</div><div style="font-size:13px;font-family:var(--mono)">QQ 6214880</div></div>
        <div class="field"><div class="lbl">博客</div><a href="https://www.52stu.com" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-family:var(--mono);color:var(--accent)">www.52stu.com</a></div>
        <div class="field"><div class="lbl">快捷键</div><div class="hint" style="margin:0">Ctrl / ⌘ + K 聚焦搜索 · Esc 关闭弹层</div></div>
        <div class="note">数据全部保存在本地 <b>data/config.json</b>，不经过任何第三方服务。建议定期在「数据」里导出备份。</div>`;
    }

    $$('#setBody [data-sw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sw;
        const on = !btn.classList.contains('on');
        btn.classList.toggle('on', on);
        if (key === 'statsEnabled') {
          const box = $('#statsBox');
          if (box) box.hidden = !on;
          if (on) loadStats();
        }
        patchSettings({ [key]: on });
      });
    });
    $$('#setBody [data-density]').forEach((btn) =>
      btn.addEventListener('click', () => {
        patchSettings({ density: btn.dataset.density });
        renderDrawer();
      })
    );
    $$('#setBody [data-theme-opt]').forEach((btn) =>
      btn.addEventListener('click', () => {
        patchSettings({ theme: btn.dataset.themeOpt });
        renderDrawer();
      })
    );
    $$('#setBody [data-accent]').forEach((btn) =>
      btn.addEventListener('click', () => {
        patchSettings({ accent: btn.dataset.accent });
        renderDrawer();
      })
    );
  }

  function renderGroupList() {
    const box = $('#groupList');
    if (!box) return;
    const d = state.data;
    const counts = {};
    d.apps.forEach((a) => (counts[a.groupId] = (counts[a.groupId] || 0) + 1));
    box.innerHTML = [...d.groups]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(
        (g) => `<div class="top-item" data-gid="${g.id}">
        <span class="drag-grip">${ICON.drag}</span>
        <span class="n">${esc(g.name)}</span>
        <span class="v">${counts[g.id] || 0}</span>
        <button class="ghost-icon" data-rename="${g.id}" title="重命名" style="width:22px;height:22px">${ICON.edit}</button>
        <button class="ghost-icon" data-del="${g.id}" title="删除" style="width:22px;height:22px">${ICON.hide}</button>
      </div>`
      )
      .join('');

    $$('#groupList [data-rename]').forEach((b) =>
      b.addEventListener('click', async () => {
        const g = d.groups.find((x) => x.id === b.dataset.rename);
        const name = await askPrompt({ title: '分组名称', value: g.name });
        if (!name || name === g.name) return;
        await api('/api/groups/' + g.id, { method: 'PATCH', body: { name } });
        await load();
        renderDrawer();
      })
    );
    $$('#groupList [data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        const g = d.groups.find((x) => x.id === b.dataset.del);
        const ok = await askConfirm({
          title: '删除分组',
          text: `删除 <b>${esc(g.name)}</b>？组内入口会被移动到第一个分组。`,
          okText: '删除',
          danger: true,
        });
        if (!ok) return;
        try {
          await api('/api/groups/' + g.id, { method: 'DELETE' });
          await load();
          renderDrawer();
          toast('分组已删除');
        } catch (e) {
          toast(e.message, true);
        }
      })
    );
    setupGroupSort('#groupList .top-item[data-gid]');
  }

  let groupSort = null;
  function setupGroupSort(sel) {
    if (!window.PointerEvent) return;
    const items = $(sel) ? $$(sel) : [];
    items.forEach((row) => {
      if (row.dataset._gs) return;
      row.dataset._gs = '1';
      row.addEventListener('pointerdown', (e) => groupSortDown(e, row));
    });
  }

  function groupSortDown(e, row) {
    if (groupSort) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const ctrl = e.target.closest('button, a, input, select, textarea');
    if (ctrl && ctrl !== row) return;
    const touch = e.pointerType !== 'mouse';
    groupSort = { row, id: row.dataset.gid, x: e.clientX, y: e.clientY, active: false, touch, timer: 0, ghost: null, over: null, offX: 0, offY: 0 };
    if (touch) groupSort.timer = setTimeout(() => groupSortActivate(groupSort.x, groupSort.y), 320);
    window.addEventListener('pointermove', groupSortMove, { passive: false });
    window.addEventListener('pointerup', groupSortUp);
    window.addEventListener('pointercancel', groupSortUp);
  }

  function groupSortMove(e) {
    if (!groupSort) return;
    if (!groupSort.active) {
      if (Math.abs(e.clientX - groupSort.x) + Math.abs(e.clientY - groupSort.y) < 6) return;
      if (groupSort.touch) return groupSortReset();
      groupSortActivate(groupSort.x, groupSort.y);
    }
    e.preventDefault();
    if (groupSort.ghost) {
      groupSort.ghost.style.left = e.clientX - groupSort.offX + 'px';
      groupSort.ghost.style.top = e.clientY - groupSort.offY + 'px';
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest ? el.closest(groupSortSel()) : null;
    const next = target && target !== groupSort.row ? target : null;
    if (groupSort.over && groupSort.over !== next) groupSort.over.classList.remove('drag-over');
    if (next) next.classList.add('drag-over');
    if (next) {
      const r = next.getBoundingClientRect();
      groupSort.after = e.clientY > r.top + r.height / 2;
    }
    groupSort.over = next;
  }

  function groupSortSel() {
    if (!groupSort || !groupSort.row) return '#groupList .top-item[data-gid]';
    return groupSort.row.closest('#groups') ? '#groups .grp[data-gid]' : '#groupList .top-item[data-gid]';
  }

  function groupSortActivate(px, py) {
    if (!groupSort || groupSort.active) return;
    groupSort.active = true;
    clearTimeout(groupSort.timer);
    const r = groupSort.row.getBoundingClientRect();
    const g = groupSort.row.cloneNode(true);
    g.className = groupSort.row.className + ' dragging-ghost';
    g.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;min-width:${r.width}px;margin:0;pointer-events:none;z-index:220;opacity:.9`;
    document.body.appendChild(g);
    groupSort.ghost = g;
    groupSort.offX = px - r.left;
    groupSort.offY = py - r.top;
    groupSort.row.classList.add('drag-src');
    document.body.classList.add('is-dragging');
  }

  function groupSortUp() {
    if (!groupSort) return;
    const moved = groupSort.active;
    const overId = groupSort.over ? groupSort.over.dataset.gid : null;
    const fromId = groupSort.id;
    const after = !!groupSort.after;
    const sel = groupSortSel();
    groupSortReset();
    if (!moved || !overId || overId === fromId) return;
    state.lastGroupSortEnd = Date.now();
    commitGroupOrder(sel, fromId, overId, after);
  }

  async function commitGroupOrder(sel, fromId, toId, after) {
    const h = $$(sel);
    const fromEl = h.find((r) => r.dataset.gid === fromId);
    const toEl = h.find((r) => r.dataset.gid === toId);
    if (!fromEl || !toEl) return;
    const wrap = fromEl.parentElement;
    if (after) {
      wrap.insertBefore(fromEl, toEl.nextSibling);
    } else {
      wrap.insertBefore(fromEl, toEl);
    }
    const ids = $$(sel).map((r) => r.dataset.gid);
    const groups = state.data.groups;
    ids.forEach((id, i) => {
      const g = groups.find((x) => x.id === id);
      if (g) g.order = i;
    });
    render();
    try {
      await Promise.all(
        ids.map((id, i) =>
          api('/api/groups/' + id, { method: 'PATCH', body: { order: i } }).catch(() => null)
        )
      );
      toast('分组顺序已更新');
    } catch (e) {
      toast(e.message, true);
      load();
    }
  }

  function groupSortReset() {
    if (!groupSort) return;
    clearTimeout(groupSort.timer);
    if (groupSort.ghost) groupSort.ghost.remove();
    if (groupSort.row) groupSort.row.classList.remove('drag-src');
    const delim = groupSort.row && groupSort.row.closest('#groups') ? '#groups .grp[data-gid]' : '#groupList .top-item[data-gid]';
    $$(delim).forEach((r) => r.classList.remove('drag-over'));
    document.body.classList.remove('is-dragging');
    window.removeEventListener('pointermove', groupSortMove);
    window.removeEventListener('pointerup', groupSortUp);
    window.removeEventListener('pointercancel', groupSortUp);
    groupSort = null;
  }

  function renderStats() {
    const box = $('#statsBox');
    const s = state.stats;
    if (!box || !s) return;
    const max = Math.max(1, ...s.days.map((d) => d.count));
    const sel = state.statsSel;
    const day = sel >= 0 && s.days[sel] ? s.days[sel] : null;
    const rows = day ? day.apps : s.top;
    box.innerHTML = `<div class="stats-hd"><span>近 7 天访问</span><span>总计 ${s.total} · 今日 ${s.today}</span></div>
      <div class="bars">${s.days
        .map(
          (d, i) => `<button class="bar-wrap${i === sel ? ' on' : ''}" data-day="${i}" title="${esc(d.date)} · ${d.count} 次访问">
        <div class="bar" style="height:${Math.max(2, (d.count / max) * 62)}px"></div><span>${d.label}</span></button>`
        )
        .join('')}</div>
      <div class="day-hd">${day ? `${esc(day.date)} 这天 · ${day.count} 次访问` : '最近 7 天最常打开'}</div>
      <div class="top-list">${
        rows.length
          ? rows.map((t) => `<div class="top-item"><span class="n">${esc(t.name)}</span><span class="v">${t.count} 次</span></div>`).join('')
          : `<div class="top-item"><span class="n" style="color:var(--faint)">${day ? '这天没有访问记录' : '还没有访问记录'}</span></div>`
      }</div>`;
    box.onclick = (e) => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      const i = Number(b.dataset.day);
      state.statsSel = state.statsSel === i ? -1 : i;
      renderStats();
    };
  }

  async function loadStats() {
    const box = $('#statsBox');
    if (!box) return;
    try {
      const s = await api('/api/stats');
      state.stats = s;
      state.statsSel = s.days.length - 1;
      renderStats();
    } catch (e) {
      box.textContent = '统计数据不可用';
    }
  }

  const mon = { hist: [], open: false, pin: false };
  const fmtRate = (n) => {
    if (n == null) return '--';
    if (n < 1024) return `${n} B/s`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB/s`;
    return `${(n / 1048576).toFixed(1)} MB/s`;
  };
  const fmtSize = (n) => {
    if (!n) return '0 B';
    if (n < 1048576) return `${Math.round(n / 1024)} KB`;
    if (n < 1073741824) return `${Math.round(n / 1048576)} MB`;
    return `${(n / 1073741824).toFixed(1)} GB`;
  };
  const fmtUp = (sec) => {
    if (!sec) return '--';
    const dd = Math.floor(sec / 86400);
    const hh = Math.floor((sec % 86400) / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    if (dd) return `已运行 ${dd} 天 ${hh} 小时`;
    if (hh) return `已运行 ${hh} 小时 ${mm} 分`;
    return `已运行 ${mm} 分钟`;
  };
  const lvl = (v, hi, mid) => (v == null ? '' : v >= hi ? 'bad' : v >= mid ? 'warn' : 'ok');

  function sparkLine(sel, vals) {
    const el = $(sel);
    if (!el) return;
    const n = vals.length;
    if (n < 2) {
      el.setAttribute('points', '');
      return;
    }
    el.setAttribute(
      'points',
      vals
        .map((v, i) => {
          const p = Math.max(0, Math.min(100, Number(v) || 0));
          return `${((i / (n - 1)) * 120).toFixed(1)},${(31 - (p / 100) * 29).toFixed(1)}`;
        })
        .join(' ')
    );
  }

  function drawSpark() {
    sparkLine('#ppSpark .pp-cpu-line', mon.hist.map((x) => x.c));
    sparkLine('#ppSpark .pp-mem-line', mon.hist.map((x) => x.m));
  }

  let lastActive = Date.now();
  let idleTick = 0;
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, () => (lastActive = Date.now()), { passive: true })
  );

  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset.origin) return;
    const ico = img.closest('.ico');
    if (ico) ico.innerHTML = `<span>${img.dataset.letter || '?'}</span>`;
    state.iconFail.add(img.dataset.origin);
  }, true);

  async function tickMonitor() {
    const btn = $('#btnPulse');
    if (!btn || document.hidden) return;
    if (Date.now() - lastActive > 120000 && !mon.open) {
      idleTick++;
      if (idleTick % 5 !== 0) return;
    } else {
      idleTick = 0;
    }
    let d = null;
    try {
      d = await fetch('/api/monitor', { cache: 'no-store' }).then((r) => r.json());
    } catch (e) {
      d = null;
    }
    if (!d || !d.ok) {
      btn.hidden = true;
      if (mon.open) closePulse();
      return;
    }
    btn.hidden = false;
    const v = d.cpu;
    const mem = d.mem;
    const val = $('#pulseVal');
    if (val) val.textContent = v == null ? '--' : `${v}%`;
    btn.dataset.level = lvl(v, 85, 60);
    btn.style.setProperty('--p', String(v == null ? 0 : Math.max(0, Math.min(100, Number(v) || 0))));
    mon.hist.push({ c: v, m: mem ? mem.percent : null });
    if (mon.hist.length > 60) mon.hist.shift();
    if (!mon.open) return;
    const set = (sel, txt) => {
      const el = $(sel);
      if (el) el.textContent = txt;
    };
    set('#ppCpu', v == null ? '--' : `${v}%`);
    set('#ppCores', d.cpuCores ? `${d.cpuCores} 核` : '');

    if (mem) {
      set('#ppMem', `${mem.percent}%`);
      const bar = $('#ppMemBar');
      if (bar) {
        bar.style.width = `${mem.percent}%`;
        bar.dataset.level = lvl(mem.percent, 90, 75);
      }
      const cache = $('#ppMemCache');
      if (cache) {
        cache.style.left = `${Math.min(100, mem.percent)}%`;
        cache.style.width = `${Math.max(0, Math.min(100 - mem.percent, (mem.cached / mem.total) * 100))}%`;
      }
      set('#ppMemDetail', `${fmtSize(mem.used)} 已用 / ${fmtSize(mem.total)}`);
    } else {
      set('#ppMem', '--');
      set('#ppMemDetail', '--');
    }

    const sw = d.swap;
    const swSec = $('#ppSwapSec');
    if (swSec) swSec.hidden = !sw;
    if (sw) {
      set('#ppSwap', `${fmtSize(sw.used)} / ${fmtSize(sw.total)} · ${sw.percent}%`);
      const sb = $('#ppSwapBar');
      if (sb) {
        sb.style.width = `${sw.percent}%`;
        sb.dataset.level = lvl(sw.percent, 80, 50);
      }
    }

    set('#ppRx', fmtRate(d.net && d.net.rx));
    set('#ppTx', fmtRate(d.net && d.net.tx));
    const ld = d.load;
    set('#ppLoad', ld ? `负载 ${ld[0].toFixed(2)}${d.loadPercent == null ? '' : ` · ${d.loadPercent}%`}` : '');
    const disks = Array.isArray(d.disks) ? d.disks : [];
    const diskSec = $('#ppDiskSec');
    if (diskSec) diskSec.hidden = !disks.length;
    const diskBox = $('#ppDisks');
    if (diskBox) {
      diskBox.innerHTML = disks.length
        ? disks
            .slice(0, 4)
            .map(
              (k) => `<div class="pp-disk">
            <div class="pp-disk-top"><span>${esc(k.mount)}</span><b>${fmtSize(k.used)} / ${fmtSize(k.total)} · ${k.percent}%</b></div>
            <div class="pp-bar"><i style="width:${Math.min(100, k.percent) || 0}%" data-level="${lvl(k.percent, 90, 75)}"></i></div>
          </div>`
            )
            .join('')
        : '';
    }
    const dio = d.disk;
    set('#ppDiskIO', dio && dio.rd != null ? `读 ${fmtRate(dio.rd)} · 写 ${fmtRate(dio.wr)}` : '');

    const nt = d.net;
    set('#ppTotal', nt && nt.rxTotal ? `累计 ↓${fmtSize(nt.rxTotal)} ↑${fmtSize(nt.txTotal)}` : '');
    set('#ppUp', fmtUp(d.uptime));
    set('#ppSrc', d.local ? '容器视角' : '宿主机');
    drawSpark();
  }

  function openPulse(pin) {
    const pop = $('#pulsePop');
    const btn = $('#btnPulse');
    if (!pop || !btn) return;
    clearTimeout(mon.closeTimer);
    pop.hidden = false;
    mon.open = true;
    if (pin) mon.pin = true;
    btn.classList.add('on');
    tickMonitor();
  }

  function closePulse() {
    clearTimeout(mon.closeTimer);
    const pop = $('#pulsePop');
    if (pop) pop.hidden = true;
    mon.open = false;
    mon.pin = false;
    const btn = $('#btnPulse');
    if (btn) btn.classList.remove('on');
  }

  function hoverLeave() {
    if (!mon.open || mon.pin) return;
    clearTimeout(mon.closeTimer);
    mon.closeTimer = setTimeout(() => {
      if (!mon.pin) closePulse();
    }, 260);
  }

  const isMouse = (e) => !e || !e.pointerType || e.pointerType === 'mouse';

  on('#btnPulse', 'pointerenter', (e) => {
    if (!isMouse(e)) return;
    if (mon.open) clearTimeout(mon.closeTimer);
    else openPulse(false);
  });
  on('#btnPulse', 'pointerleave', (e) => {
    if (!isMouse(e)) return;
    hoverLeave();
  });
  on('#pulsePop', 'pointerenter', (e) => {
    if (!isMouse(e)) return;
    clearTimeout(mon.closeTimer);
  });
  on('#pulsePop', 'pointerleave', (e) => {
    if (!isMouse(e)) return;
    hoverLeave();
  });

  on('#btnPulse', 'click', (e) => {
    e.stopPropagation();
    if (!mon.open) return openPulse(true);
    if (!mon.pin) {
      mon.pin = true;
      return;
    }
    closePulse();
  });
  document.addEventListener('click', (e) => {
    if (!mon.open) return;
    if (e.target.closest('#pulsePop') || e.target.closest('#btnPulse')) return;
    closePulse();
  });

  try {
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
    const onChange = () => {
      if (state.data && state.data.settings.theme === 'auto') applySettings();
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq && mq.addListener) mq.addListener(onChange);
  } catch (e) {}

  function showLock() {
    document.body.innerHTML = `<div class="lock-wrap">
      <div class="lock-box">
        <div class="lock-ico"><svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></svg></div>
        <h2>需要访问密码</h2>
        <p>这台面板设置了访问密码，输入后继续。</p>
        <div class="lock-row">
          <input id="lockPass" type="password" autocomplete="current-password" placeholder="访问密码" />
          <button class="btn primary" id="lockGo">进入</button>
        </div>
        <div class="lock-err" id="lockErr"></div>
      </div>
    </div>`;
    const go = async () => {
      const input = $('#lockPass');
      const err = $('#lockErr');
      const btn = $('#lockGo');
      const pass = input.value;
      if (!pass) {
        err.textContent = '请输入密码';
        return;
      }
      btn.disabled = true;
      err.textContent = '';
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: pass })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || '密码不对');
        location.reload();
      } catch (e) {
        err.textContent = e.message;
        btn.disabled = false;
        input.select();
      }
    };
    on('#lockGo', 'click', go);
    on('#lockPass', 'keydown', (e) => {
      if (e.key === 'Enter') go();
    });
    setTimeout(() => $('#lockPass').focus(), 80);
  }

  async function boot() {
    let gate = null;
    try {
      gate = await fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json());
    } catch (e) {
      gate = null;
    }
    if (gate && gate.enabled && !gate.authed) {
      showLock();
      return;
    }
    try {
      await load();
    } catch (e) {
      document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#e7eef7">面板启动失败：${esc(
        e.message
      )}<br/><br/>先确认容器在运行（docker logs naspilot），再检查浏览器地址能否访问 /api/state。</div>`;
      return;
    }
    if (state.data.settings.dockerEnabled) await dockerSync(true);
    refreshHealth();
    tickMonitor();
    startTimers();
  }

  function startTimers() {
    const s = state.data.settings;
    const probeSec = Math.max(15, Number(s.probeInterval) || 30);
    const dockerSec = Number(s.dockerInterval ?? 60);
    const monSec = Math.max(1, Number(s.monitorInterval) || 2);
    state.timers.push(setInterval(tickMonitor, monSec * 1000));
    state.timers.push(setInterval(refreshHealth, probeSec * 1000));
    if (dockerSec > 0)
      state.timers.push(
        setInterval(() => {
          if (!document.hidden) dockerSync(true);
        }, dockerSec * 1000)
      );
  }

  function restartTimers() {
    state.timers.forEach((t) => clearInterval(t));
    state.timers = [];
    startTimers();
    toast('刷新频率已更新');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    lastActive = Date.now();
    tickMonitor();
    refreshHealth();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  boot();
})();
