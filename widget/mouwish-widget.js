/* ============================================================================
 * LAAPOA MOU Wish List — Member Widget
 *
 * Drop-in widget for the Announcements tab of /memberinfo.
 *
 * USAGE
 * -----
 *   <div id="mouwish-widget"></div>
 *   <script src="https://laapoa.github.io/mouwish/widget/mouwish-widget.js"></script>
 *
 * EXPECTS (set by /memberinfo before this script runs)
 * ----------------------------------------------------
 *   window.MEMBER_ID   string — unique member identifier. If absent, the widget
 *                       renders in read-only mode (no thumbs buttons).
 *   window.MEMBER_MOU  string — one of "MOU 30/39", "MOU 28", "MOU 65".
 *                       Used as the initial filter. Falls back to "all".
 *
 * STYLING
 * -------
 * The widget reads these CSS custom properties from the page if defined,
 * with reasonable fallbacks. Override any of them in your page CSS:
 *
 *   --mw-navy            primary dark color   (default #0b1f3a)
 *   --mw-gold            accent color         (default #c8a44b)
 *   --mw-ink             body text            (default #14181f)
 *   --mw-muted           secondary text       (default #6b6f78)
 *   --mw-paper           card background      (default #ffffff)
 *   --mw-line            borders              (default #d8d2c0)
 *   --mw-up              upvote color         (default #1e6f3a)
 *   --mw-down            downvote color       (default #a4341c)
 *   --mw-font-display    headings/labels      (default inherits)
 *   --mw-font-body       body text            (default inherits)
 *
 * CONFIG (edit ONCE, after deploying the Worker)
 * ----------------------------------------------
 *   API_URL   — Worker /api/list endpoint
 *   VOTE_URL  — Worker /api/vote endpoint
 *   APP_TOKEN — shared secret. NOTE: anything in client-side JS is visible to
 *               anyone who views source. This token is "casual scraping"
 *               protection only. If a real attacker matters, swap this for a
 *               signed JWT issued by your /memberinfo auth flow.
 * ============================================================================ */

(function () {
  'use strict';

  // ---------- CONFIG ----------
  const API_URL   = 'https://mouwish-api.mike-a78.workers.dev/api/list';
  const VOTE_URL  = 'https://mouwish-api.mike-a78.workers.dev/api/vote';
  const APP_TOKEN = '8f8d1e2d16e4d2da0a6016ff3a124d2194cbf1570c77f20ccd0255322e3fe985';
  const MOUNT_ID  = 'mouwish-widget';
  const REFRESH_MS = 60_000;
  const LIKES_STORAGE_KEY = 'mouwish:my-votes';  // local cache of member's reactions

  // ---------- STYLES ----------
  const STYLES = `
    .mw-root {
      font-family: var(--mw-font-body, inherit);
      color: var(--mw-ink, #14181f);
      --_navy:  var(--mw-navy,  #0b1f3a);
      --_gold:  var(--mw-gold,  #c8a44b);
      --_muted: var(--mw-muted, #6b6f78);
      --_paper: var(--mw-paper, #ffffff);
      --_line:  var(--mw-line,  #d8d2c0);
      --_up:    var(--mw-up,    #1e6f3a);
      --_down:  var(--mw-down,  #a4341c);
      --_display: var(--mw-font-display, inherit);
    }
    .mw-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--_line);
    }
    .mw-title {
      font-family: var(--_display);
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: 14px;
      color: var(--_navy);
      margin: 0;
    }
    .mw-meta {
      margin-left: auto;
      font-size: 11px;
      color: var(--_muted);
      font-family: var(--_display);
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .mw-meta b { color: var(--_navy); }

    .mw-pills {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-bottom: 14px;
    }
    .mw-pill {
      background: transparent;
      border: 1px solid var(--_line);
      padding: 6px 12px;
      font-family: var(--_display);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--_navy);
      cursor: pointer;
      border-radius: 999px;
      transition: all .15s;
    }
    .mw-pill:hover { border-color: var(--_navy); }
    .mw-pill.active {
      background: var(--_navy);
      color: var(--_gold);
      border-color: var(--_navy);
    }
    .mw-pill .mw-count {
      color: var(--_muted);
      margin-left: 5px;
      font-weight: 500;
    }
    .mw-pill.active .mw-count { color: rgba(200,164,75,.7); }

    .mw-context-line {
      font-size: 12px;
      color: var(--_muted);
      margin-bottom: 12px;
    }
    .mw-context-line b { color: var(--_navy); }

    .mw-list {
      display: flex; flex-direction: column; gap: 10px;
    }
    .mw-item {
      background: var(--_paper);
      border: 1px solid var(--_line);
      border-left: 3px solid var(--_gold);
      padding: 12px 14px;
      border-radius: 4px;
    }
    .mw-item-head {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
      margin-bottom: 7px;
      font-family: var(--_display);
      font-size: 10px;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .mw-tag {
      padding: 2px 7px;
      border-radius: 2px;
    }
    .mw-tag.mou { background: var(--_navy); color: var(--_gold); }
    .mw-tag.cat { background: rgba(0,0,0,.05); color: var(--_navy); }
    .mw-proposal {
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 10px;
      word-wrap: break-word;
    }
    .mw-proposal a {
      color: var(--_navy);
      text-decoration: underline;
      text-decoration-color: var(--_gold);
      text-underline-offset: 2px;
    }

    .mw-reactions {
      display: flex; align-items: center; gap: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--_line);
    }
    .mw-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent;
      border: 1px solid var(--_line);
      padding: 5px 12px;
      border-radius: 999px;
      cursor: pointer;
      font-family: var(--_display);
      font-size: 12px;
      font-weight: 600;
      color: var(--_muted);
      transition: all .15s;
      user-select: none;
    }
    .mw-btn:hover:not(.mw-disabled) {
      background: rgba(0,0,0,.03);
      border-color: var(--_navy);
    }
    .mw-btn .mw-emoji { font-size: 14px; line-height: 1; }
    .mw-btn .mw-num   { min-width: 14px; text-align: left; }
    .mw-btn.mw-up.active {
      background: var(--_up);
      border-color: var(--_up);
      color: white;
    }
    .mw-btn.mw-down.active {
      background: var(--_down);
      border-color: var(--_down);
      color: white;
    }
    .mw-btn.mw-disabled {
      cursor: default;
      opacity: .85;
    }
    .mw-btn.mw-pending { opacity: .5; pointer-events: none; }

    .mw-readonly-note {
      margin-left: auto;
      font-size: 10px;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--_muted);
      font-family: var(--_display);
    }

    .mw-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--_muted);
      font-size: 13px;
    }
    .mw-skeleton {
      background: linear-gradient(90deg, rgba(0,0,0,.04) 0%, rgba(0,0,0,.07) 50%, rgba(0,0,0,.04) 100%);
      background-size: 200% 100%;
      animation: mw-shimmer 1.4s linear infinite;
      height: 90px;
      border-radius: 4px;
      margin-bottom: 10px;
    }
    @keyframes mw-shimmer { to { background-position: -200% 0; } }
  `;

  // ---------- STATE ----------
  const MOU_TABS = ['MOU 30/39', 'MOU 28', 'MOU 65'];
  const MOU_LABELS = {
    'MOU 30/39': 'Airport Police',
    'MOU 28':    'LAPD Municipal',
    'MOU 65':    'Park Rangers',
  };

  const state = {
    items: [],
    counts: {},
    filter: 'all',
    myVotes: loadMyVotes(),
    memberId: (typeof window.MEMBER_ID === 'string' && window.MEMBER_ID.trim()) ? window.MEMBER_ID.trim() : '',
    memberMou: (typeof window.MEMBER_MOU === 'string' && MOU_TABS.indexOf(window.MEMBER_MOU) >= 0) ? window.MEMBER_MOU : null,
    pendingItemIds: new Set(),
  };

  // Default filter to the member's own MOU, if known.
  if (state.memberMou) state.filter = state.memberMou;

  // ---------- ENTRY ----------
  function init() {
    const mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      console.warn('[mouwish] mount point #' + MOUNT_ID + ' not found');
      return;
    }
    injectStyles();

    mount.innerHTML = `
      <div class="mw-root">
        <div class="mw-header">
          <h3 class="mw-title">MOU Wish List</h3>
          <div class="mw-meta" data-meta>Loading…</div>
        </div>
        <div class="mw-pills" data-pills></div>
        <div class="mw-context-line" data-context></div>
        <div class="mw-list" data-list>
          <div class="mw-skeleton"></div>
          <div class="mw-skeleton"></div>
          <div class="mw-skeleton"></div>
        </div>
      </div>
    `;

    mount.querySelector('[data-pills]').addEventListener('click', onPillClick);
    mount.querySelector('[data-list]').addEventListener('click', onItemAction);

    renderPills();
    renderContext();
    load();
    setInterval(load, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') load();
    });
  }

  function injectStyles() {
    if (document.getElementById('mw-styles')) return;
    const s = document.createElement('style');
    s.id = 'mw-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // ---------- DATA ----------
  async function load() {
    try {
      const res = await fetch(API_URL, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Bad response');
      state.items = data.items || [];
      state.counts = data.counts || {};
      const meta = document.querySelector('#' + MOUNT_ID + ' [data-meta]');
      if (meta) {
        meta.innerHTML = `<b>${state.items.length}</b> ideas · updated ${new Date(data.generatedAt || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
      }
      renderPills();
      renderList();
    } catch (err) {
      console.error('[mouwish] load failed:', err);
      const meta = document.querySelector('#' + MOUNT_ID + ' [data-meta]');
      if (meta) meta.textContent = 'Update failed';
    }
  }

  async function castVote(itemId, value) {
    if (!state.memberId) return;
    if (state.pendingItemIds.has(itemId)) return;
    state.pendingItemIds.add(itemId);

    const prev = state.myVotes[itemId] || 0;
    // Optimistic update locally
    state.myVotes[itemId] = value;
    saveMyVotes();
    // Apply delta to the item in-memory so counts feel instant
    const item = state.items.find(i => i.itemId === itemId);
    if (item) {
      if (prev === 1)  item.thumbsUp   = Math.max(0, (item.thumbsUp   || 0) - 1);
      if (prev === -1) item.thumbsDown = Math.max(0, (item.thumbsDown || 0) - 1);
      if (value === 1)  item.thumbsUp   = (item.thumbsUp   || 0) + 1;
      if (value === -1) item.thumbsDown = (item.thumbsDown || 0) + 1;
      item.netScore = (item.thumbsUp || 0) - (item.thumbsDown || 0);
    }
    renderList();

    try {
      const res = await fetch(VOTE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId,
          memberId: state.memberId,
          value,
          appToken: APP_TOKEN,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Vote rejected');
      // Sync canonical totals from the server response
      if (item && typeof data.thumbsUp === 'number') {
        item.thumbsUp   = data.thumbsUp;
        item.thumbsDown = data.thumbsDown;
        item.netScore   = data.netScore;
        renderList();
      }
    } catch (err) {
      console.error('[mouwish] vote failed:', err);
      // Roll back the optimistic update
      state.myVotes[itemId] = prev;
      saveMyVotes();
      if (item) {
        if (value === 1)  item.thumbsUp   = Math.max(0, (item.thumbsUp   || 0) - 1);
        if (value === -1) item.thumbsDown = Math.max(0, (item.thumbsDown || 0) - 1);
        if (prev === 1)  item.thumbsUp   = (item.thumbsUp   || 0) + 1;
        if (prev === -1) item.thumbsDown = (item.thumbsDown || 0) + 1;
        item.netScore = (item.thumbsUp || 0) - (item.thumbsDown || 0);
      }
      renderList();
    } finally {
      state.pendingItemIds.delete(itemId);
    }
  }

  function loadMyVotes() {
    try {
      const raw = localStorage.getItem(LIKES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }
  function saveMyVotes() {
    try { localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(state.myVotes)); }
    catch (_) {}
  }

  // ---------- RENDER ----------
  function renderPills() {
    const wrap = document.querySelector('#' + MOUNT_ID + ' [data-pills]');
    if (!wrap) return;
    const total = MOU_TABS.reduce((n, m) => n + (state.counts[m] || 0), 0);
    const buttons = [
      { key: 'all', label: 'All', count: total },
    ].concat(MOU_TABS.map(m => ({
      key: m,
      label: MOU_LABELS[m] || m,
      count: state.counts[m] || 0,
    })));
    wrap.innerHTML = buttons.map(b => `
      <button type="button" class="mw-pill ${b.key === state.filter ? 'active' : ''}" data-mou="${escAttr(b.key)}">
        ${escHtml(b.label)} <span class="mw-count">${b.count}</span>
      </button>
    `).join('');
  }

  function renderContext() {
    const ctx = document.querySelector('#' + MOUNT_ID + ' [data-context]');
    if (!ctx) return;
    if (state.memberId) {
      ctx.innerHTML = `React to ideas with <b>👍</b> or <b>👎</b>. Your reaction is recorded once per idea and can be changed any time.`;
    } else {
      ctx.innerHTML = `Read-only view — sign in to react.`;
    }
  }

  function renderList() {
    const list = document.querySelector('#' + MOUNT_ID + ' [data-list]');
    if (!list) return;

    let items = state.filter === 'all'
      ? state.items.slice()
      : state.items.filter(i => i.mou === state.filter);

    // Sort: most upvoted first
    items.sort((a, b) => (b.netScore || 0) - (a.netScore || 0));

    if (items.length === 0) {
      list.innerHTML = `<div class="mw-state">No ideas in this category yet.</div>`;
      return;
    }

    list.innerHTML = items.map(buildItemHtml).join('');
  }

  function buildItemHtml(i) {
    const my = state.myVotes[i.itemId] || 0;
    const canVote = !!state.memberId;
    const pending = state.pendingItemIds.has(i.itemId);
    const upActive   = my === 1  ? 'active' : '';
    const downActive = my === -1 ? 'active' : '';
    const disabled   = canVote ? '' : 'mw-disabled';
    const pendingCls = pending  ? 'mw-pending' : '';
    const proposal = sanitizeForRender(i.proposalHtml || escHtml(i.proposal || ''));

    return `
      <article class="mw-item" data-item="${escAttr(i.itemId)}">
        <div class="mw-item-head">
          <span class="mw-tag mou">${escHtml(MOU_LABELS[i.mou] || i.mou || '')}</span>
          <span class="mw-tag cat">${escHtml(i.category || '')}</span>
        </div>
        <div class="mw-proposal">${proposal}</div>
        <div class="mw-reactions">
          <button type="button"
                  class="mw-btn mw-up ${upActive} ${disabled} ${pendingCls}"
                  data-vote="up"
                  ${canVote ? '' : 'aria-disabled="true"'}>
            <span class="mw-emoji">👍</span>
            <span class="mw-num">${i.thumbsUp || 0}</span>
          </button>
          <button type="button"
                  class="mw-btn mw-down ${downActive} ${disabled} ${pendingCls}"
                  data-vote="down"
                  ${canVote ? '' : 'aria-disabled="true"'}>
            <span class="mw-emoji">👎</span>
            <span class="mw-num">${i.thumbsDown || 0}</span>
          </button>
          ${canVote ? '' : '<span class="mw-readonly-note">Sign in to react</span>'}
        </div>
      </article>
    `;
  }

  // ---------- EVENTS ----------
  function onPillClick(e) {
    const pill = e.target.closest('.mw-pill');
    if (!pill) return;
    state.filter = pill.dataset.mou;
    renderPills();
    renderList();
  }

  function onItemAction(e) {
    const btn = e.target.closest('.mw-btn');
    if (!btn) return;
    if (btn.classList.contains('mw-disabled') || btn.classList.contains('mw-pending')) return;
    const article = btn.closest('[data-item]');
    if (!article) return;
    const itemId = article.dataset.item;
    const action = btn.dataset.vote;
    const current = state.myVotes[itemId] || 0;

    // Toggle: same button again clears the vote; opposite button switches sides.
    let value;
    if (action === 'up')   value = (current === 1)  ? 0 :  1;
    if (action === 'down') value = (current === -1) ? 0 : -1;
    castVote(itemId, value);
  }

  // ---------- UTIL ----------
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/\s+/g, '-');
  }
  // Defense-in-depth: re-sanitize HTML coming back from the server.
  function sanitizeForRender(html) {
    const tmpl = document.createElement('template');
    tmpl.innerHTML = String(html || '');
    walkSanitize(tmpl.content);
    return tmpl.innerHTML;
  }
  function walkSanitize(root) {
    Array.from(root.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); return; }
      const tag = node.tagName.toLowerCase();
      if (tag === 'a') {
        const href = (node.getAttribute('href') || '').trim();
        const safe = /^(https?:|mailto:)/i.test(href);
        Array.from(node.attributes).forEach(a => node.removeAttribute(a.name));
        if (!safe) { unwrap(node); return; }
        node.setAttribute('href', href);
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        walkSanitize(node);
        return;
      }
      if (['b','strong','i','em','u','br'].includes(tag)) {
        Array.from(node.attributes).forEach(a => node.removeAttribute(a.name));
        walkSanitize(node);
        return;
      }
      walkSanitize(node);
      unwrap(node);
    });
  }
  function unwrap(el) {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  // ---------- GO ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
