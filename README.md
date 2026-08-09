# 💬 SiteSage — an AI chat widget for any website

Create an AI chatbot, train it on your text or web pages, and embed it on **any**
site with one line of code. Multi-tenant, powered by Groq.

**Live demo: https://sitesage-erfanul.vercel.app**

## Embed anywhere
```html
<script src="https://sitesage-erfanul.vercel.app/widget.js" data-bot="YOUR_BOT_ID"></script>
```
That's it — a chat bubble appears, answering only from the content you trained that bot on.

## How it works
- **Dashboard** — create a bot, then feed it pasted text or a URL (server-side scrape → readable text).
- **Retrieval** — content is chunked and searched with **Postgres full-text search** via a
  `SECURITY DEFINER` function scoped to the bot id, so the widget can only ever read its own bot.
- **Answers** — the top passages go to **Groq (Llama 3.3 70B)**, which answers only from them.
- **Widget** — a tiny, dependency-free script (no model download) that runs on any origin (CORS-open API).

## Stack
| Layer | |
| --- | --- |
| Dashboard | Vanilla JS + Supabase JS |
| Data | Supabase Postgres, full-text `tsvector` index, multi-tenant `bots` / `bot_chunks` |
| API | Vercel serverless: `/api/chat`, `/api/meta`, `/api/scrape` |
| AI | Groq `llama-3.3-70b-versatile` (key stays server-side) |
| Widget | ~4 KB self-contained `widget.js` |

---
Built by **Erfanul Hakim Farhan** · [github.com/erfanulfarhan](https://github.com/erfanulfarhan)
