// SiteSage — widget chat endpoint. Retrieves a bot's most relevant content
// (Postgres full-text search via a SECURITY DEFINER RPC, scoped to the bot id)
// and asks Groq to answer only from it. CORS-open so it runs on any site.
// Groq key stays server-side; only the public Supabase key is used here.

const SUPA_URL = 'https://cgebymftbitnkdemttow.supabase.co';
const SUPA_ANON = 'sb_publishable_8kKUdKYucRKPnxp0yJtevA_zP8Vw-f7';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server missing GROQ_API_KEY.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { bot = '', question = '', history = [] } = body || {};
  if (!bot) return res.status(400).json({ error: 'Missing bot id.' });
  if (!question.trim()) return res.status(400).json({ error: 'Empty question.' });

  // retrieve top chunks for this bot
  let chunks = [];
  try {
    const rpc = await fetch(`${SUPA_URL}/rest/v1/rpc/match_bot_chunks`, {
      method: 'POST',
      headers: { apikey: SUPA_ANON, authorization: `Bearer ${SUPA_ANON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_bot: bot, p_q: question, p_k: 6 }),
    });
    chunks = await rpc.json();
    if (!Array.isArray(chunks)) chunks = [];
  } catch { chunks = []; }

  if (!chunks.length) {
    return res.status(200).json({ answer: "I don't have any information about that yet." });
  }

  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
  const system =
`You are a friendly assistant embedded on a website. Answer the visitor's question using ONLY the context below.
- If the answer isn't in the context, say you don't have that information and suggest they contact the site directly. Never invent facts.
- Be concise, warm, and helpful (1–4 sentences).

CONTEXT:
${context}`;

  const messages = [{ role: 'system', content: system }];
  for (const h of (history || []).slice(-6)) {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.text || '').slice(0, 1200) });
  }
  messages.push({ role: 'user', content: question });

  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 500 }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return res.status(200).json({ answer: (d?.choices?.[0]?.message?.content || '').trim() });
    const msg = d?.error?.message || `HTTP ${r.status}`;
    if ((r.status === 429 || r.status === 503) && attempt < 2) { await new Promise((s) => setTimeout(s, 1200 * (attempt + 1))); continue; }
    return res.status(502).json({ error: msg });
  }
  return res.status(502).json({ error: 'The assistant is busy — try again shortly.' });
}
