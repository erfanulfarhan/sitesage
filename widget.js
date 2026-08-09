/* SiteSage embeddable widget — drop-in chat bubble.
   Usage:  <script src="https://your-host/widget.js" data-bot="BOT_ID"></script>
   Self-contained, no dependencies. Reads its bot id + API host from its own tag. */
(function () {
  'use strict';
  var me = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    for (var i = s.length - 1; i >= 0; i--) if (/widget\.js/.test(s[i].src)) return s[i];
    return null;
  })();
  if (!me) return;
  var API = new URL(me.src).origin;
  var BOT = me.getAttribute('data-bot') || new URL(me.src).searchParams.get('bot');
  if (!BOT) { console.error('SiteSage: add data-bot="YOUR_BOT_ID" to the script tag.'); return; }

  var accent = '#6366f1', name = 'Assistant', greeting = 'Hi! How can I help?';
  var history = [], open = false, greeted = false;

  /* styles */
  var css = document.createElement('style');
  css.textContent = [
    '.ssg-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border:0;border-radius:50%;',
    'cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.28);color:#fff;font-size:24px;display:flex;align-items:center;justify-content:center;transition:transform .15s}',
    '.ssg-btn:hover{transform:scale(1.06)}',
    '.ssg-panel{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:370px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);',
    'background:#fff;color:#1a1d26;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;',
    'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.ssg-panel.ss-open{display:flex;animation:ss-pop .2s ease}',
    '@keyframes ss-pop{from{opacity:0;transform:translateY(10px)}}',
    '.ssg-head{padding:14px 16px;color:#fff;font-weight:700;display:flex;justify-content:space-between;align-items:center}',
    '.ssg-head small{display:block;font-weight:400;opacity:.85;font-size:11px}',
    '.ssg-x{background:none;border:0;color:#fff;font-size:20px;cursor:pointer;opacity:.9}',
    '.ssg-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:#f7f8fb}',
    '.ssg-m{max-width:85%;padding:9px 12px;border-radius:13px;white-space:pre-wrap;word-wrap:break-word}',
    '.ssg-m.u{align-self:flex-end;color:#fff;border-bottom-right-radius:4px}',
    '.ssg-m.a{align-self:flex-start;background:#fff;border:1px solid #e6e8ef;border-bottom-left-radius:4px}',
    '.ssg-m.t{color:#8b90a0}',
    '.ssg-in{display:flex;gap:8px;padding:10px;border-top:1px solid #eceef3;background:#fff}',
    '.ssg-in input{flex:1;border:1px solid #dfe2ea;border-radius:10px;padding:10px;font:inherit;outline:none}',
    '.ssg-in button{border:0;border-radius:10px;color:#fff;padding:0 14px;font-weight:700;cursor:pointer}',
    '.ssg-foot{text-align:center;font-size:10px;color:#aab;padding:0 0 8px;background:#fff}',
    '.ssg-foot a{color:#889;text-decoration:none}'
  ].join('');
  document.head.appendChild(css);

  /* DOM */
  var btn = document.createElement('button');
  btn.className = 'ssg-btn'; btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML = '💬';
  var panel = document.createElement('div');
  panel.className = 'ssg-panel';
  panel.innerHTML =
    '<div class="ssg-head"><div><span class="ssg-name">Assistant</span><small>AI assistant</small></div><button class="ssg-x" aria-label="Close">×</button></div>' +
    '<div class="ssg-msgs"></div>' +
    '<div class="ssg-in"><input type="text" placeholder="Ask a question…" aria-label="Message"><button>Send</button></div>' +
    '<div class="ssg-foot"><a href="' + API + '" target="_blank" rel="noopener">Powered by SiteSage</a></div>';
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('.ssg-msgs');
  var input = panel.querySelector('.ssg-in input');
  var send = panel.querySelector('.ssg-in button');

  function paint() {
    btn.style.background = accent;
    panel.querySelector('.ssg-head').style.background = accent;
    send.style.background = accent;
    panel.querySelector('.ssg-name').textContent = name;
    panel.querySelectorAll('.ssg-m.u').forEach(function (m) { m.style.background = accent; });
  }
  function add(role, text) {
    var d = document.createElement('div');
    d.className = 'ssg-m ' + (role === 'user' ? 'u' : 'a') + (role === 'typing' ? ' t' : '');
    d.textContent = text;
    if (role === 'user') d.style.background = accent;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  fetch(API + '/api/meta?bot=' + encodeURIComponent(BOT)).then(function (r) { return r.json(); })
    .then(function (m) { if (m && !m.error) { name = m.name || name; greeting = m.greeting || greeting; accent = m.accent || accent; } paint(); })
    .catch(function () { paint(); });

  function toggle() {
    open = !open; panel.classList.toggle('ss-open', open);
    if (open && !greeted) { add('assistant', greeting); greeted = true; setTimeout(function () { input.focus(); }, 60); }
  }
  btn.onclick = toggle;
  panel.querySelector('.ssg-x').onclick = toggle;

  async function ask() {
    var q = input.value.trim(); if (!q) return;
    input.value = ''; add('user', q); history.push({ role: 'user', text: q });
    var typing = add('typing', '…'); send.disabled = true;
    try {
      var r = await fetch(API + '/api/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bot: BOT, question: q, history: history.slice(0, -1) }),
      });
      var d = await r.json();
      typing.remove();
      var a = r.ok ? (d.answer || '…') : ('⚠️ ' + (d.error || 'Something went wrong.'));
      add('assistant', a);
      if (r.ok) history.push({ role: 'assistant', text: a });
    } catch (e) { typing.remove(); add('assistant', '⚠️ Network error — try again.'); }
    send.disabled = false;
  }
  send.onclick = ask;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
})();
