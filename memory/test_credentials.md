# Test Credentials

## Dashboard Admin (email/password JWT) — app name: NewFlow
- URL: /login
- Email: rithielegui@gmail.com
- Password: Rithi0518@

## Auth endpoints
- POST /api/auth/login  {email, password} -> {access_token, user}
- POST /api/auth/register {email, password, name}
- GET  /api/auth/me  (Authorization: Bearer <token>)

## Notes
- App/dashboard name is "NewFlow". The name "WhatsFlow" refers ONLY to the user's existing
  WhatsApp API running on the Raspberry Pi (proxied via WHATSFLOW_BASE_URL, default http://127.0.0.1:8001).
- WhatsApp send/relay endpoints proxy to that Pi API. When unreachable (e.g. cloud preview),
  they degrade gracefully; send/run-now return HTTP 400 with a friendly JSON message.
- Telegram uses Telethon MTProto; api_id/api_hash/phone entered by the user in the UI.
- MongoDB: user's own Atlas cluster, database "whatsflow_dash".
