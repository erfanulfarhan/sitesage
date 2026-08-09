/* SiteSage dashboard — create bots, train them, get an embed snippet.
   Uses the public Supabase key; RLS + the widget's read-path function keep
   each bot's data scoped. No secrets in the browser. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const sb = createClient(window.SUPA.url, window.SUPA.anon);
const $ = (s) => document.querySelector(s);

let owner = localStorage.getItem('ss.owner');
if (!owner) { owner = 'o_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ss.owner', owner); }

let current = null; // selected bot object

const el = {
  bots: $('#bots'), botsEmpty: $('#botsEmpty'), newBot: $('#newBot'),
  createPanel: $('#createPanel'), cName: $('#cName'), cGreet: $('#cGreet'), cAccent: $('#cAccent'), createBtn: $('#createBtn'),
  botView: $('#botView'), bName: $('#bName'),
  pasteText: $('#pasteText'), pasteName: $('#pasteName'), addText: $('#addText'),
  url: $('#url'), addUrl: $('#addUrl'), trainStatus: $('#trainStatus'), srcList: $('#srcList'),
  snippet: $('#snippet'), copyBtn: $('#copyBtn'), previewBtn: $('#previewBtn'), delBot: $('#delBot'),
};

function chunk(text) {
  text = (text || '').replace(/\s+/g, ' ').trim();
  const size = 800, overlap = 120, out = [];
  for (let i = 0; i < text.length; i += (size - overlap)) out.push(text.slice(i, i + size));
  return out.filter((c) => c.trim().length > 30);
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---- bots ---- */
async function loadBots() {
  const { data } = await sb.from('bots').select('*').eq('owner_key', owner).order('created_at', { ascending: true });
  const bots = data || [];
  el.bots.innerHTML = bots.map((b) =>
    `<li data-id="${b.id}" class="${current && current.id === b.id ? 'active' : ''}"><span><span class="dot" style="background:${esc(b.accent)}"></span> ${esc(b.name)}</span></li>`).join('');
  el.botsEmpty.style.display = bots.length ? 'none' : 'block';
  el.bots.querySelectorAll('li').forEach((li) => (li.onclick = () => selectBot(bots.find((x) => x.id === li.dataset.id))));
  return bots;
}

function showCreate() { el.createPanel.hidden = false; el.botView.hidden = true; current = null; }

async function createBot() {
  const name = el.cName.value.trim() || 'My Assistant';
  const greeting = el.cGreet.value.trim() || 'Hi! Ask me anything.';
  const accent = el.cAccent.value || '#6366f1';
  const id = 'bot_' + Math.random().toString(36).slice(2, 10);
  const { error } = await sb.from('bots').insert({ id, name, owner_key: owner, greeting, accent });
  if (error) { alert('Could not create bot: ' + error.message); return; }
  el.cName.value = el.cGreet.value = '';
  await loadBots();
  selectBot({ id, name, greeting, accent });
}

async function selectBot(bot) {
  if (!bot) return;
  current = bot;
  el.createPanel.hidden = true; el.botView.hidden = false;
  el.bName.textContent = bot.name;
  const origin = location.origin;
  el.snippet.textContent = `<script src="${origin}/widget.js" data-bot="${bot.id}"><\/script>`;
  await loadBots();
  loadSources();
}

async function loadSources() {
  const { data } = await sb.from('bot_chunks').select('source').eq('bot_id', current.id);
  const counts = {};
  (data || []).forEach((r) => { const s = r.source || 'Untitled'; counts[s] = (counts[s] || 0) + 1; });
  const names = Object.keys(counts);
  el.srcList.innerHTML = names.length
    ? names.map((n) => `<div class="src"><span>${esc(n)}</span><span class="n">${counts[n]} chunks</span></div>`).join('')
    : '<p class="hint" style="margin-top:.6rem">No content yet — add text or a URL above.</p>';
}

/* ---- training ---- */
async function addChunks(text, source) {
  const chunks = chunk(text);
  if (!chunks.length) { el.trainStatus.textContent = 'Nothing to add.'; return; }
  const rows = chunks.map((c) => ({ bot_id: current.id, source: source || 'Untitled', content: c }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await sb.from('bot_chunks').insert(rows.slice(i, i + 50));
    if (error) { el.trainStatus.textContent = 'Save error: ' + error.message; return; }
  }
  el.trainStatus.textContent = `Added “${source || 'Untitled'}” — ${chunks.length} chunks.`;
  loadSources();
}

async function addText() {
  if (!current) return;
  const t = el.pasteText.value;
  if (!t.trim()) { el.trainStatus.textContent = 'Paste some text first.'; return; }
  el.addText.disabled = true; el.trainStatus.textContent = 'Adding…';
  await addChunks(t, el.pasteName.value.trim() || 'Pasted text');
  el.pasteText.value = ''; el.pasteName.value = '';
  el.addText.disabled = false;
}

async function addUrl() {
  if (!current) return;
  const url = el.url.value.trim();
  if (!/^https?:\/\//i.test(url)) { el.trainStatus.textContent = 'Enter a valid URL.'; return; }
  el.addUrl.disabled = true; el.trainStatus.textContent = 'Fetching page…';
  try {
    const r = await fetch('/api/scrape', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const d = await r.json();
    if (!r.ok) { el.trainStatus.textContent = '⚠️ ' + (d.error || 'Fetch failed.'); el.addUrl.disabled = false; return; }
    el.trainStatus.textContent = `Fetched “${d.title}” — embedding…`;
    await addChunks(d.text, d.title || url);
    el.url.value = '';
  } catch (e) { el.trainStatus.textContent = '⚠️ ' + e.message; }
  el.addUrl.disabled = false;
}

/* ---- embed / preview / delete ---- */
function copySnippet() {
  navigator.clipboard && navigator.clipboard.writeText(el.snippet.textContent);
  el.copyBtn.textContent = 'Copied ✓'; setTimeout(() => (el.copyBtn.textContent = 'Copy snippet'), 1500);
}
function loadPreview() {
  document.querySelectorAll('.ssg-btn,.ssg-panel').forEach((n) => n.remove());
  const old = document.getElementById('ss-preview'); if (old) old.remove();
  const s = document.createElement('script');
  s.id = 'ss-preview'; s.src = '/widget.js?bot=' + encodeURIComponent(current.id);
  s.setAttribute('data-bot', current.id);
  document.body.appendChild(s);
  el.previewBtn.textContent = 'Preview loaded ↘';
  setTimeout(() => (el.previewBtn.textContent = 'Reload preview ↘'), 1500);
}
async function deleteBot() {
  if (!current || !confirm('Delete this bot and all its content?')) return;
  await sb.from('bots').delete().eq('id', current.id); // chunks cascade
  document.querySelectorAll('.ssg-btn,.ssg-panel').forEach((n) => n.remove());
  current = null; el.botView.hidden = true;
  const bots = await loadBots();
  if (bots.length) selectBot(bots[0]); else showCreate();
}

/* ---- wiring ---- */
el.newBot.onclick = showCreate;
el.createBtn.onclick = createBot;
el.addText.onclick = addText;
el.addUrl.onclick = addUrl;
el.copyBtn.onclick = copySnippet;
el.previewBtn.onclick = loadPreview;
el.delBot.onclick = deleteBot;

(async function init() {
  const bots = await loadBots();
  if (bots.length) selectBot(bots[bots.length - 1]); else showCreate();
})();
