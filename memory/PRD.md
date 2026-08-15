# NewFlow — PRD

## Problema original
Painel web para conectar o WhatsApp existente (API "WhatsFlow" rodando na Raspberry Pi, JWT, base http://127.0.0.1:8001), enviar mensagens para grupos e canais, conectar Telegram (api_id/api_hash/telefone via MTProto), puxar imagem/descrição de um grupo do Telegram e repassar para um grupo/canal do WhatsApp, e agendar mensagens (dias/horários) com texto e imagem.

## Nome do app
NewFlow (o nome "WhatsFlow" refere-se apenas à API na Raspberry).

## Escolhas do usuário
- Auth: e-mail + senha (JWT Bearer). Admin: rithielegui@gmail.com.
- Banco: MongoDB Atlas do próprio usuário (db "whatsflow_dash").
- WhatsApp real via Raspberry (não acessível do preview → degradação graciosa).
- Telegram: credenciais inseridas manualmente na UI.

## Arquitetura
- Backend FastAPI modular: auth.py, whatsflow.py (proxy à Pi), telegram_service.py (Telethon), scheduler.py (APScheduler tick 60s), media.py (Emergent Object Storage), storage.py, db.py, server.py.
- Frontend React + Tailwind (tema dark slate/emerald), shadcn UI, sonner, react-router. Páginas: Login, Overview, WhatsApp, Telegram, Relay, Scheduler, Settings.

## Implementado (2026-08-15)
- Login/JWT + rotas protegidas + seed admin.
- WhatsApp: status/QR (poll), grupos/canais, envio texto+imagem, settings (base_url+senha) — proxy com degradação graciosa; falhas de envio retornam HTTP 400 com JSON amigável.
- Telegram: connect (código) → verify (+2FA), status, disconnect, dialogs, mensagens (com foto), relay Telegram→WhatsApp.
- Agendamentos: CRUD + toggle + "enviar agora" + disparo automático por dia/horário (America/Sao_Paulo).
- Upload de imagem via Object Storage; envio convertido para data URL ao WhatsFlow.
- Testado: 15/15 backend pytest + E2E frontend OK.

## Backlog / próximos
- P1: Repasse automático contínuo do Telegram (monitorar novo post e repassar sozinho).
- P1: Histórico/log de envios com status.
- P2: Múltiplas contas Telegram; agendamento com intervalo/data específica.
- P2: Suporte a vídeo/documentos no relay.
