// SiteSage — public bot metadata for the widget (name, greeting, accent).
// GET /api/meta?bot=ID  → { name, greeting, accent }  (CORS-open)

const SUPA_URL = 'https://cgebymftbitnkdemttow.supabase.co';
const SUPA_ANON = 'sb_publishable_8kKUdKYucRKPnxp0yJtevA_zP8Vw-f7';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const bot = (req.query && req.query.bot) || '';
  if (!bot) return res.status(400).json({ error: 'Missing bot id.' });
  try {
    const rpc = await fetch(`${SUPA_URL}/rest/v1/rpc/bot_meta`, {
      method: 'POST',
      headers: { apikey: SUPA_ANON, authorization: `Bearer ${SUPA_ANON}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_bot: bot }),
    });
    const rows = await rpc.json();
    const m = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!m) return res.status(404).json({ error: 'Bot not found.' });
    return res.status(200).json({ name: m.name, greeting: m.greeting, accent: m.accent });
  } catch (e) {
    return res.status(502).json({ error: 'Lookup failed.' });
  }
}
