# OzimAI

AI booking assistant for clinics: patients chat, the AI answers from the clinic's knowledge base and books real slots, admins take over from the panel.

## Channels

| Channel | How patients reach it | Setup |
| --- | --- | --- |
| **Web chat** (default) | Chat button on the clinic's site, or the link `https://<host>/c/<slug>` (Instagram bio, 2GIS, QR) | None. Link and embed code are in the panel under «Айым» → «Веб-чат» |
| WhatsApp (optional) | Clinic's WhatsApp Business number | Meta Cloud API credentials (`WHATSAPP_*` in `.env`) |

Website embed (paste before `</body>`):

```html
<script src="https://<host>/widget.js" data-clinic="<slug>" async></script>
```

Optional attributes: `data-color="#0B9B6D"`, `data-label="Записаться онлайн"`, `data-position="left"`.

Web visitors enter name + phone before chatting (phone = CRM identity and reminder destination). Conversations are scoped to the browser session, so typing someone else's number never reveals their history.

## Reminders (24h and 2h before a visit)

| Patient came from | Reminder goes via |
| --- | --- |
| WhatsApp | WhatsApp if configured, otherwise SMS |
| Web chat | Browser push if they enabled it, otherwise SMS |
| Instagram | SMS |

SMS and push carry a link back to the clinic chat to confirm or reschedule.

- **SMS**: `SMS_PROVIDER=mobizon` + `MOBIZON_API_KEY` (+ `SMS_SENDER` once your alpha name is registered with KZ operators). `console` (default) just logs.
- **Push**: `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. Works on Android/desktop; on iPhone only when the chat is added to the home screen.

Set `PUBLIC_APP_URL` so reminder links point at your deployment. See `.env.example` for every variable.

## Local development

```bash
docker compose up -d        # Postgres (pgvector) + Redis
cp .env.example .env
npm install
npm run migrate && npm run seed
npm run dev:backend         # :3000
npm run dev:frontend        # :5173 — demo chat at /c/aigul
```
