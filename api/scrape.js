// SiteSage — fetch a URL and return readable text, so a bot can be "trained"
// on a web page. Server-side fetch avoids browser CORS limits.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  let { url = '' } = body || {};
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Enter a valid http(s) URL.' });

  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SiteSageBot/1.0)' },
      redirect: 'follow',
    });
    if (!r.ok) return res.status(502).json({ error: `Fetch failed (HTTP ${r.status}).` });
    const html = await r.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : url;
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 40) return res.status(422).json({ error: 'No readable text found on that page.' });
    return res.status(200).json({ title, text: text.slice(0, 25000) });
  } catch (e) {
    return res.status(502).json({ error: 'Could not fetch that URL.' });
  }
}
