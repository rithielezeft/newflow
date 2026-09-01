# NewFlow — Deploy na Raspberry (usuário rithiele, HTTPS na própria Pi via Certbot)

Repo: https://github.com/rithielezeft/newflow
Estrutura na Pi:
```
~/websites/newflow/          -> código (git clone)
~/websites/newflow/backend/  -> backend + venv + .env + uploads
~/websites/newflow/public/   -> arquivos do frontend (build)
```
Portas: Nginx **80/443** (Certbot) → backend **127.0.0.1:8011**. API WhatsFlow continua em **8001**.
Config Nginx é um **vhost isolado** (sem `default_server`/catch-all) — não afeta seus outros sites.

---

## 1) Clonar
```bash
sudo apt update && sudo apt install -y nginx python3-venv python3-pip git
mkdir -p ~/websites && cd ~/websites
git clone https://github.com/rithielezeft/newflow newflow
```

## 2) Backend (venv + deps + .env + uploads)
```bash
cd ~/websites/newflow/backend
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt
cp ../deploy/backend.env.example .env     # já vem com seu Atlas (db newflow)
mkdir -p uploads
# teste:
uvicorn server:app --host 127.0.0.1 --port 8011 & sleep 4
curl http://127.0.0.1:8011/api/           # {"message":"NewFlow Dashboard API","status":"ok"}
kill %1
```
> Porta 8011 ocupada? Verifique com `sudo lsof -i:8011`.

## 3) Serviço systemd
```bash
sudo cp ~/websites/newflow/deploy/newflow-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now newflow-backend
sudo systemctl status newflow-backend     # active (running)
```

## 4) Frontend (build) em public/
O `build` não vai no Git. Baixe o **newflow-deploy.tar.gz** (do Emergent), envie e extraia só o build:
```bash
# no SEU PC:
scp newflow-deploy.tar.gz rithiele@<IP-ou-host>:/tmp/
# na Pi:
mkdir -p /tmp/nf && tar -xzf /tmp/newflow-deploy.tar.gz -C /tmp/nf
mkdir -p ~/websites/newflow/public
cp -r /tmp/nf/frontend/build/* ~/websites/newflow/public/
```
> Alternativa (sem tarball): no seu PC, dentro do repo, `cd frontend && REACT_APP_BACKEND_URL="" yarn install && REACT_APP_BACKEND_URL="" yarn build` e copie `build/` para `~/websites/newflow/public/`.

## 5) Nginx + HTTPS (Certbot)
```bash
sudo cp ~/websites/newflow/deploy/nginx-newflow-https.conf /etc/nginx/sites-available/newflow.conf
sudo ln -s /etc/nginx/sites-available/newflow.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx        # não mexe nos outros sites
sudo certbot --nginx -d newflow.newhybrid.com       # cria 443 + redirect sozinho
sudo nginx -t && sudo systemctl reload nginx
```

## 6) Finalizar
- **MongoDB Atlas → Network Access**: libere o IP público da Pi.
- **DNS**: `newflow.newhybrid.com` (registro A) → IP da Pi (o Certbot valida pelo domínio).
- Acesse **https://newflow.newhybrid.com** → login `rithielegui@gmail.com` / `Rithi0518@`.

---

## Atualizações
```bash
cd ~/websites/newflow && git pull
sudo systemctl restart newflow-backend
# frontend (se mudou): gere novo build e copie para ~/websites/newflow/public/
```

## Observações
1. Imagens ficam em `~/websites/newflow/backend/uploads` (disco local). Configurável via `UPLOADS_DIR` no `.env`.
2. Telegram: informe `api_id`, `api_hash` e telefone na aba Telegram (my.telegram.org).
3. A API WhatsFlow (envio real do WhatsApp) precisa rodar na Pi em `127.0.0.1:8001`; configure a URL/senha em **Configurações** dentro do NewFlow.
4. Permissões: o Nginx (www-data) precisa ler `~/websites/newflow/public` — como você já serve outros sites do seu home, isso já deve estar ok.
