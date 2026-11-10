/* Панель правок прототипа Swissflex: переключатель страниц, правка текстов, комментарии.
   Данные хранятся в localStorage браузера. Обмен через файл или текст. ?figma скрывает панель. */
(function () {
  if (/[?&]figma\b/.test(location.search)) return;
  var PAGES = window.SFX_PAGES || [];
  var KEY = 'sfx-review-v1';
  var file = (location.pathname.split('/').pop() || 'index.html');
  var pageIdx = PAGES.findIndex(function (p) { return p[0] === file; });
  var pageName = pageIdx > -1 ? PAGES[pageIdx][1] : document.title;

  function load() { try { var d = JSON.parse(localStorage.getItem(KEY) || '{}'); d.edits = d.edits || []; d.comments = d.comments || []; d.author = d.author || ''; return d; } catch (e) { return { edits: [], comments: [], author: '' }; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Браузер не дал сохранить правки'); } }
  var data = load();
  var mode = 'view';

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clean(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, ''); }
  function textOf(html) { var d = document.createElement('div'); d.innerHTML = String(html).replace(/<br\s*\/?>/gi, ' '); return d.textContent.replace(/\s+/g, ' ').trim(); }
  function inUi(el) { return !!(el && el.closest && el.closest('[data-sfx-ui]')); }
  function pathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var i = 1, s = el; while ((s = s.previousElementSibling)) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + i + ')'); el = el.parentElement;
    }
    return 'body>' + parts.join('>');
  }
  function find(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function hasOwnText(el) { for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) return true; return false; }
  function textTarget(el) { while (el && el !== document.body) { if (inUi(el)) return null; if (hasOwnText(el)) return el; el = el.parentElement; } return null; }
  function fmtDate(t) { var d = new Date(t); return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }

  /* ---------- styles ---------- */
  var css = document.createElement('style'); css.setAttribute('data-sfx-ui', '');
  css.textContent = [
    'body{padding-bottom:64px!important}',
    '.sfx-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#111;color:#fff;font:13px/1.3 Arial,sans-serif;display:flex;align-items:center;gap:10px;padding:10px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.25)}',
    '.sfx-bar button,.sfx-bar select{font:inherit;color:#fff;background:#2a2a2a;border:1px solid #444;padding:7px 11px;cursor:pointer;border-radius:0}',
    '.sfx-bar button:hover{background:#3a3a3a}.sfx-bar button[aria-pressed=true]{background:#fff;color:#111;border-color:#fff}',
    '.sfx-bar select{max-width:260px}.sfx-sep{width:1px;height:26px;background:#444;margin:0 4px}.sfx-grow{flex:1}',
    '.sfx-break{display:none}@media(max-width:900px){.sfx-bar [data-m]{order:3}.sfx-bar [data-a=list]{order:1}.sfx-break{display:block;order:2;flex-basis:100%;height:0}}.sfx-count{display:inline-block;min-width:18px;padding:1px 5px;margin-left:6px;background:#fff;color:#111;font-size:11px;text-align:center}',
    'body.sfx-edit [data-sfx-t]:hover{outline:1px dashed #1a73e8;outline-offset:2px;cursor:text}',
    'body.sfx-comment,body.sfx-comment *{cursor:crosshair!important}',
    '[data-sfx-edited]{box-shadow:inset 0 -2px 0 #1a73e8}',
    '[contenteditable=true]{outline:2px solid #1a73e8!important;outline-offset:2px;background:#eef4ff!important;color:#111!important}',
    '.sfx-pin{position:absolute;z-index:2147482990;width:26px;height:26px;border-radius:50% 50% 50% 0;background:#ffcc00;color:#111;border:2px solid #111;font:bold 12px/22px Arial;text-align:center;transform:translate(-2px,-24px);cursor:pointer!important}',
    '.sfx-pin.done{background:#ddd;color:#777;border-color:#999}',
    '.sfx-pop{position:absolute;z-index:2147483001;width:300px;background:#fff;color:#111;border:1px solid #111;box-shadow:0 8px 30px rgba(0,0,0,.2);font:13px/1.4 Arial,sans-serif;padding:14px;cursor:auto!important}',
    '.sfx-pop *{cursor:auto!important}.sfx-pop textarea,.sfx-pop input{width:100%;box-sizing:border-box;border:1px solid #bbb;padding:8px;font:inherit;margin:0 0 8px}',
    '.sfx-pop textarea{min-height:80px;resize:vertical}.sfx-pop .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
    '.sfx-pop button{font:inherit;border:1px solid #111;background:#fff;padding:6px 10px;cursor:pointer!important}.sfx-pop button.pri{background:#111;color:#fff}',
    '.sfx-pop .meta{color:#777;font-size:11px;margin-bottom:6px}.sfx-pop .body{white-space:pre-wrap;margin-bottom:10px}',
    '.sfx-panel{position:fixed;top:0;right:0;bottom:56px;width:380px;max-width:100%;z-index:2147482999;background:#fff;color:#111;border-left:1px solid #111;font:13px/1.45 Arial,sans-serif;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.15)}',
    '.sfx-panel header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #ddd;font-weight:bold;font-size:15px}',
    '.sfx-panel header button{border:0;background:none;font:inherit;cursor:pointer;font-size:13px;text-decoration:underline}',
    '.sfx-panel .list{flex:1;overflow:auto;padding:6px 16px 16px}.sfx-panel h4{margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#666}',
    '.sfx-item{border:1px solid #ddd;padding:10px;margin-bottom:8px}.sfx-item .meta{color:#777;font-size:11px}.sfx-item .was{color:#999;text-decoration:line-through}',
    '.sfx-item .acts{display:flex;gap:12px;margin-top:6px}.sfx-item .acts button,.sfx-item .acts a{border:0;background:none;padding:0;font:inherit;font-size:12px;text-decoration:underline;color:#111;cursor:pointer}',
    '.sfx-panel footer{border-top:1px solid #ddd;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.sfx-panel footer button,.sfx-panel footer label{font:inherit;border:1px solid #111;background:#fff;padding:8px;cursor:pointer;text-align:center}.sfx-panel footer .pri{background:#111;color:#fff}',
    '.sfx-panel .empty{color:#777;padding:20px 0}',
    '.sfx-toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%);z-index:2147483002;background:#111;color:#fff;padding:10px 16px;font:13px Arial,sans-serif}',
    '.sfx-hint{color:#bbb;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '@media(max-width:900px){.sfx-hint,.sfx-lbl,.sfx-sep,.sfx-grow{display:none}body{padding-bottom:112px!important}.sfx-bar{flex-wrap:wrap;gap:6px;padding:8px}.sfx-bar select{flex:1;max-width:none;min-width:0}.sfx-bar [data-m]{flex:1;padding:8px 4px}.sfx-bar [data-a=list] .sfx-count{margin-left:0}.sfx-panel{bottom:104px}.sfx-toast{bottom:120px}.sfx-pop{width:min(300px,calc(100vw - 16px))}}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- bar ---------- */
  var bar = document.createElement('div'); bar.className = 'sfx-bar'; bar.setAttribute('data-sfx-ui', '');
  var opts = PAGES.map(function (p, i) { return '<option value="' + p[0] + '"' + (i === pageIdx ? ' selected' : '') + '>' + (i + 1) + '. ' + esc(p[1]) + '</option>'; }).join('');
  bar.innerHTML = '<button type="button" data-a="prev" title="Предыдущая страница">‹</button><select data-a="page" aria-label="Страница">' + (pageIdx < 0 ? '<option selected>Оглавление</option>' : '') + opts + '</select><button type="button" data-a="next" title="Следующая страница">›</button>' +
    '<span class="sfx-sep"></span><span class="sfx-break"></span><button type="button" data-m="view" aria-pressed="true">Просмотр</button><button type="button" data-m="edit" aria-pressed="false">Правка текста</button><button type="button" data-m="comment" aria-pressed="false">Комментарий</button>' +
    '<span class="sfx-hint" id="sfx-hint"></span><span class="sfx-grow"></span><button type="button" data-a="list"><span class="sfx-lbl">Правки и комментарии</span><span class="sfx-lbl" style="display:none"></span><span class="sfx-count" id="sfx-count">0</span></button>';
  document.body.appendChild(bar);
  var layer = document.createElement('div'); layer.setAttribute('data-sfx-ui', ''); layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0'; document.body.appendChild(layer);

  function go(i) { if (i >= 0 && i < PAGES.length) location.href = PAGES[i][0] + location.hash; }
  bar.querySelector('[data-a=page]').onchange = function (e) { location.href = e.target.value; };
  bar.querySelector('[data-a=prev]').onclick = function () { go(pageIdx < 0 ? PAGES.length - 1 : pageIdx - 1); };
  bar.querySelector('[data-a=next]').onclick = function () { go(pageIdx + 1); };
  bar.querySelector('[data-a=list]').onclick = togglePanel;
  bar.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { setMode(b.getAttribute('data-m')); }; });

  var HINTS = { view: '', edit: 'Нажмите на текст, исправьте и кликните мимо. Esc отменяет.', comment: 'Нажмите на место страницы, к которому относится комментарий.' };
  function setMode(m) {
    finishEditing(true); closePop();
    mode = m; document.body.classList.toggle('sfx-edit', m === 'edit'); document.body.classList.toggle('sfx-comment', m === 'comment');
    bar.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-m') === m)); });
    document.getElementById('sfx-hint').textContent = HINTS[m];
    if (m === 'edit') markTexts();
  }
  function markTexts() { document.body.querySelectorAll('*').forEach(function (el) { if (!inUi(el) && hasOwnText(el)) el.setAttribute('data-sfx-t', ''); }); }

  /* ---------- text edits ---------- */
  var editing = null;
  function applyEdits() {
    data.edits.filter(function (e) { return e.page === file; }).forEach(function (e) {
      var el = find(e.sel); if (!el) return;
      if (!el.hasAttribute('data-sfx-orig')) el.setAttribute('data-sfx-orig', el.innerHTML);
      el.innerHTML = clean(e.html); el.setAttribute('data-sfx-edited', '');
    });
  }
  function startEditing(el) {
    if (editing === el) return;
    finishEditing(true);
    editing = el; if (!el.hasAttribute('data-sfx-orig')) el.setAttribute('data-sfx-orig', el.innerHTML);
    el.setAttribute('data-sfx-before', el.innerHTML);
    el.contentEditable = 'true'; el.focus();
    var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function finishEditing(keep) {
    if (!editing) return; var el = editing; editing = null;
    el.contentEditable = 'false'; el.removeAttribute('contenteditable');
    if (!keep) { el.innerHTML = el.getAttribute('data-sfx-before'); el.removeAttribute('data-sfx-before'); return; }
    el.removeAttribute('data-sfx-before');
    var sel = pathOf(el), orig = el.getAttribute('data-sfx-orig'), html = clean(el.innerHTML);
    var rec = data.edits.find(function (e) { return e.page === file && e.sel === sel; });
    if (textOf(html) === textOf(orig)) { if (rec) { data.edits.splice(data.edits.indexOf(rec), 1); el.removeAttribute('data-sfx-edited'); save(); refresh(); } return; }
    if (rec) { rec.html = html; rec.t = Date.now(); }
    else data.edits.push({ id: uid(), page: file, pageName: pageName, sel: sel, orig: orig, html: html, author: data.author, t: Date.now() });
    el.setAttribute('data-sfx-edited', ''); save(); refresh(); toast('Правка сохранена');
  }
  function revertEdit(id) {
    var rec = data.edits.find(function (e) { return e.id === id; }); if (!rec) return;
    data.edits.splice(data.edits.indexOf(rec), 1); save();
    if (rec.page === file) { var el = find(rec.sel); if (el) { el.innerHTML = rec.orig; el.removeAttribute('data-sfx-edited'); } }
    refresh();
  }

  /* ---------- comments ---------- */
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function anchorPos(c) {
    var el = find(c.sel); if (!el) return { x: c.x, y: c.y };
    var r = el.getBoundingClientRect();
    return { x: r.left + scrollX + c.ox * r.width, y: r.top + scrollY + c.oy * r.height };
  }
  function renderPins() {
    layer.querySelectorAll('.sfx-pin').forEach(function (p) { p.remove(); });
    data.comments.filter(function (c) { return c.page === file; }).forEach(function (c, i) {
      var p = anchorPos(c), pin = document.createElement('div');
      pin.className = 'sfx-pin' + (c.done ? ' done' : ''); pin.textContent = c.n; pin.title = c.text;
      pin.style.left = p.x + 'px'; pin.style.top = p.y + 'px';
      pin.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openComment(c); };
      layer.appendChild(pin);
    });
  }
  function placePop(x, y) {
    pop = document.createElement('div'); pop.className = 'sfx-pop'; pop.setAttribute('data-sfx-ui', '');
    var left = Math.min(x + 12, scrollX + innerWidth - 320), top = Math.max(y - 10, scrollY + 10);
    if (top + 260 > scrollY + innerHeight - 70) top = Math.max(scrollY + 10, scrollY + innerHeight - 330);
    pop.style.left = Math.max(scrollX + 8, left) + 'px'; pop.style.top = top + 'px';
    layer.appendChild(pop); return pop;
  }
  function newComment(target, x, y) {
    closePop();
    var r = target.getBoundingClientRect();
    var draft = { sel: pathOf(target), ox: r.width ? (x - scrollX - r.left) / r.width : 0, oy: r.height ? (y - scrollY - r.top) / r.height : 0, x: x, y: y, quote: (target.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) };
    var p = placePop(x, y);
    p.innerHTML = '<input id="sfx-author" placeholder="Ваше имя" value="' + esc(data.author) + '"><textarea id="sfx-text" placeholder="Комментарий к этому месту"></textarea><div class="row"><button type="button" data-x="cancel">Отмена</button><button type="button" class="pri" data-x="ok">Сохранить</button></div>';
    var ta = p.querySelector('#sfx-text'); (data.author ? ta : p.querySelector('#sfx-author')).focus();
    p.querySelector('[data-x=cancel]').onclick = closePop;
    p.querySelector('[data-x=ok]').onclick = function () {
      var text = ta.value.trim(); if (!text) { ta.focus(); return; }
      data.author = p.querySelector('#sfx-author').value.trim();
      var n = data.comments.filter(function (c) { return c.page === file; }).reduce(function (m, c) { return Math.max(m, c.n); }, 0) + 1;
      data.comments.push(Object.assign(draft, { id: uid(), n: n, page: file, pageName: pageName, text: text, author: data.author, t: Date.now(), done: false }));
      save(); closePop(); renderPins(); refresh(); toast('Комментарий сохранён');
    };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) p.querySelector('[data-x=ok]').click(); };
  }
  function openComment(c) {
    closePop(); var pos = anchorPos(c), p = placePop(pos.x, pos.y);
    p.innerHTML = '<div class="meta">' + c.n + '. ' + esc(c.author || 'Без имени') + ', ' + fmtDate(c.t) + (c.done ? ', решено' : '') + '</div><div class="body">' + esc(c.text) + '</div><div class="row"><button type="button" data-x="del">Удалить</button><button type="button" data-x="done">' + (c.done ? 'Вернуть в работу' : 'Решено') + '</button><button type="button" class="pri" data-x="close">Закрыть</button></div>';
    p.querySelector('[data-x=close]').onclick = closePop;
    p.querySelector('[data-x=done]').onclick = function () { c.done = !c.done; save(); closePop(); renderPins(); refresh(); };
    p.querySelector('[data-x=del]').onclick = function () { data.comments.splice(data.comments.indexOf(c), 1); save(); closePop(); renderPins(); refresh(); };
  }

  /* ---------- global interaction ---------- */
  document.addEventListener('click', function (e) {
    if (inUi(e.target) || e.target.closest('.sfx-pin')) return;
    if (mode === 'edit') {
      if (editing && editing.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation();
      var t = textTarget(e.target); if (t) startEditing(t); else finishEditing(true);
    } else if (mode === 'comment') {
      e.preventDefault(); e.stopPropagation();
      if (pop) { closePop(); return; }
      newComment(e.target, e.pageX, e.pageY);
    }
  }, true);
  document.addEventListener('submit', function (e) { if (mode !== 'view') e.preventDefault(); }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (editing) finishEditing(false); else if (pop) closePop(); else if (panel) togglePanel(); else setMode('view'); }
    if (e.key === 'Enter' && editing && !e.shiftKey && !/^(P|LI|DD|DIV)$/.test(editing.tagName)) { e.preventDefault(); finishEditing(true); }
  });
  document.addEventListener('focusout', function (e) { if (editing && e.target === editing) setTimeout(function () { if (editing === e.target) finishEditing(true); }, 0); });
  addEventListener('resize', function () { renderPins(); });

  /* ---------- panel ---------- */
  var panel = null;
  function counts() { return data.edits.length + data.comments.filter(function (c) { return !c.done; }).length; }
  function refresh() { document.getElementById('sfx-count').textContent = counts(); if (panel) fillPanel(); }
  function togglePanel() {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div'); panel.className = 'sfx-panel'; panel.setAttribute('data-sfx-ui', '');
    document.body.appendChild(panel); fillPanel();
  }
  function fillPanel() {
    var order = PAGES.map(function (p) { return p[0]; });
    var byPage = {};
    data.edits.forEach(function (e) { (byPage[e.page] = byPage[e.page] || { name: e.pageName, edits: [], comments: [] }).edits.push(e); });
    data.comments.forEach(function (c) { (byPage[c.page] = byPage[c.page] || { name: c.pageName, edits: [], comments: [] }).comments.push(c); });
    var keys = Object.keys(byPage).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    var html = keys.length ? keys.map(function (k) {
      var g = byPage[k];
      return '<h4>' + esc(g.name) + '</h4>' + g.edits.map(function (e) {
        return '<div class="sfx-item"><div class="meta">Правка текста' + (e.author ? ', ' + esc(e.author) : '') + '</div><div class="was">' + esc(textOf(e.orig)) + '</div><div>' + esc(textOf(e.html)) + '</div><div class="acts">' + (k !== file ? '<a href="' + k + '">Открыть страницу</a>' : '') + '<button type="button" data-rev="' + e.id + '">Вернуть как было</button></div></div>';
      }).join('') + g.comments.sort(function (a, b) { return a.n - b.n; }).map(function (c) {
        return '<div class="sfx-item"' + (c.done ? ' style="opacity:.55"' : '') + '><div class="meta">Комментарий ' + c.n + ', ' + esc(c.author || 'Без имени') + ', ' + fmtDate(c.t) + (c.done ? ', решено' : '') + '</div><div>' + esc(c.text) + '</div>' + (c.quote ? '<div class="meta">К блоку: «' + esc(c.quote) + '»</div>' : '') + '<div class="acts">' + (k !== file ? '<a href="' + k + '">Открыть страницу</a>' : '<button type="button" data-show="' + c.id + '">Показать</button>') + '<button type="button" data-done="' + c.id + '">' + (c.done ? 'Вернуть в работу' : 'Решено') + '</button></div></div>';
      }).join('');
    }).join('') : '<div class="empty">Правок и комментариев пока нет. Включите «Правка текста» или «Комментарий» в нижней панели.</div>';
    panel.innerHTML = '<header><span>Правки и комментарии</span><button type="button" data-p="close">Закрыть</button></header><div class="list">' + html + '</div><footer><button type="button" class="pri" data-p="link" style="grid-column:1/-1">Скопировать ссылку с правками</button><button type="button" data-p="copy">Скопировать текстом</button><button type="button" data-p="download">Скачать файл</button><label>Загрузить файл<input type="file" accept=".json,application/json" hidden data-p="import"></label><button type="button" data-p="clear">Очистить всё</button></footer>';
    panel.querySelector('[data-p=close]').onclick = togglePanel;
    panel.querySelectorAll('[data-rev]').forEach(function (b) { b.onclick = function () { revertEdit(b.getAttribute('data-rev')); }; });
    panel.querySelectorAll('[data-done]').forEach(function (b) { b.onclick = function () { var c = data.comments.find(function (x) { return x.id === b.getAttribute('data-done'); }); c.done = !c.done; save(); renderPins(); refresh(); }; });
    panel.querySelectorAll('[data-show]').forEach(function (b) { b.onclick = function () { var c = data.comments.find(function (x) { return x.id === b.getAttribute('data-show'); }); var p = anchorPos(c); scrollTo({ top: p.y - 200, behavior: 'smooth' }); setTimeout(function () { openComment(c); }, 350); }; });
    panel.querySelector('[data-p=link]').onclick = copyLink;
    panel.querySelector('[data-p=copy]').onclick = copyText;
    panel.querySelector('[data-p=download]').onclick = download;
    panel.querySelector('[data-p=import]').onchange = importFile;
    panel.querySelector('[data-p=clear]').onclick = function () {
      if (panel.querySelector('[data-p=clear]').getAttribute('data-sure') !== '1') { var b = panel.querySelector('[data-p=clear]'); b.textContent = 'Точно удалить?'; b.setAttribute('data-sure', '1'); return; }
      data.edits.filter(function (e) { return e.page === file; }).forEach(function (e) { var el = find(e.sel); if (el) { el.innerHTML = e.orig; el.removeAttribute('data-sfx-edited'); } });
      data.edits = []; data.comments = []; save(); renderPins(); refresh(); toast('Все правки и комментарии удалены');
    };
  }
  function summary() {
    var order = PAGES.map(function (p) { return p[0]; }), lines = ['Правки по прототипу Swissflex Москва, ' + new Date().toLocaleDateString('ru-RU'), ''];
    var pages = Array.from(new Set(data.edits.map(function (e) { return e.page; }).concat(data.comments.map(function (c) { return c.page; })))).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    pages.forEach(function (pg) {
      var ed = data.edits.filter(function (e) { return e.page === pg; }), cm = data.comments.filter(function (c) { return c.page === pg && !c.done; });
      if (!ed.length && !cm.length) return;
      var nm = (ed[0] || cm[0]).pageName; lines.push('Страница: ' + nm + ' (' + pg + ')');
      ed.forEach(function (e) { lines.push('Текст. Было: «' + textOf(e.orig) + '». Стало: «' + textOf(e.html) + '»'); });
      cm.forEach(function (c) { lines.push('Комментарий ' + c.n + (c.author ? ' (' + c.author + ')' : '') + ': ' + c.text + (c.quote ? ' [к блоку «' + c.quote + '»]' : '')); });
      lines.push('');
    });
    if (lines.length === 2) lines.push('Правок нет.');
    return lines.join('\n');
  }
  function copyText() {
    var t = summary();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Текст правок скопирован'); }, function () {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('data-sfx-ui', ''); document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Текст правок скопирован'); } catch (e) { toast('Не удалось скопировать'); } ta.remove();
    });
  }
  function download() {
    var blob = new Blob([JSON.stringify({ app: 'sfx-review', v: 1, exported: Date.now(), edits: data.edits, comments: data.comments }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'swissflex-pravki-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Файл правок скачан');
  }
  function mergeData(d) {
    var added = 0;
    (d.edits || []).forEach(function (x) { var cur = data.edits.find(function (e) { return e.page === x.page && e.sel === x.sel; }); if (!cur) { data.edits.push(x); added++; } else if ((x.t || 0) > (cur.t || 0)) { Object.assign(cur, x); added++; } });
    (d.comments || []).forEach(function (x) { if (!data.comments.some(function (c) { return c.id === x.id; })) {
      var n = data.comments.filter(function (c) { return c.page === x.page; }).reduce(function (m, c) { return Math.max(m, c.n); }, 0) + 1;
      if (data.comments.some(function (c) { return c.page === x.page && c.n === x.n; })) x.n = n;
      data.comments.push(x); added++; } });
    save(); applyEdits(); renderPins(); refresh(); return added;
  }
  function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var s = atob(str), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  async function pack(obj) { var bytes = new TextEncoder().encode(JSON.stringify(obj)); if (window.CompressionStream) { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); return 'z' + b64u(bytes); } return 'j' + b64u(bytes); }
  async function unpack(str) { var bytes = unb64u(str.slice(1)); if (str[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); return JSON.parse(new TextDecoder().decode(bytes)); }
  async function copyLink() {
    if (!data.edits.length && !data.comments.length) { toast('Пока нечего отправлять'); return; }
    var code = await pack({ app: 'sfx-review', v: 1, edits: data.edits, comments: data.comments });
    var url = location.origin + location.pathname + '#sfx=' + code;
    var ok = function () { toast('Ссылка с правками скопирована'); };
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(ok, function () {
      var ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('data-sfx-ui', ''); document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Не удалось скопировать'); } ta.remove();
    });
    window.SFX_LAST_LINK = url;
  }
  async function readLink() {
    var m = location.hash.match(/^#sfx=(.+)$/); if (!m) return;
    try { var d = await unpack(m[1]); if (d.app !== 'sfx-review') throw 0; var n = mergeData(d); toast(n ? 'Загружены правки из ссылки: ' + n : 'Эти правки у вас уже есть'); }
    catch (e) { toast('Ссылка с правками повреждена'); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  function importFile(e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result); if (d.app !== 'sfx-review') throw 0;
        toast('Загружено: ' + mergeData(d));
      } catch (err) { toast('Это не файл правок прототипа'); }
    };
    rd.readAsText(f);
  }
  var tt = null;
  function toast(m) { var t = document.querySelector('.sfx-toast'); if (!t) { t = document.createElement('div'); t.className = 'sfx-toast'; t.setAttribute('data-sfx-ui', ''); document.body.appendChild(t); } t.textContent = m; clearTimeout(tt); tt = setTimeout(function () { t.remove(); }, 2200); }

  applyEdits(); renderPins(); refresh(); readLink();
  addEventListener('hashchange', readLink);
  addEventListener('load', renderPins);
  addEventListener('storage', function (e) { if (e.key === KEY) { data = load(); renderPins(); refresh(); } });
})();
