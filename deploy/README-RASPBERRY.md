# NewFlow — Deploy na Raspberry Pi via GitHub (Nginx 5011, domínio newflow.zeferius.com.br)

Stack: **React (build estático) + FastAPI (uvicorn) + MongoDB Atlas**. Sem dependências da Emergent
(uploads de imagem agora ficam em **disco local**). O frontend já vem **pré-compilado** em `frontend/build`
(chamadas de API são relativas a `/api`, então funciona em qualquer domínio).

Portas: **Nginx 5011** (site + proxy `/api`) → **backend 8011** (uvicorn). A API WhatsFlow continua em **8001**.

---

## 1) Na Pi: clonar o repositório
```bash
sudo apt update
sudo apt install -y nginx python3-venv python3-pip git
sudo mkdir -p /opt && cd /opt
sudo git clone <URL_DO_SEU_REPO_GITHUB> newflow
sudo chown -R $USER:$USER /opt/newflow
cd /opt/newflow
```

## 2) Backend: venv + dependências + .env
```bash
cd /opt/newflow/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# .env de produção (o repo NÃO inclui o .env real por segurança)
cp ../deploy/backend.env.example .env
# edite .env se quiser trocar senha admin etc.

# pasta de uploads (imagens dos envios/agendamentos)
mkdir -p uploads
```

Teste:
```bash
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8011 &
curl http://127.0.0.1:8011/api/        # {"message":"NewFlow Dashboard API","status":"ok"}
kill %1
```

## 3) Backend como serviço (systemd)
```bash
sudo cp /opt/newflow/deploy/newflow-backend.service /etc/systemd/system/
# se o usuário não for "pi", edite User= no arquivo
sudo systemctl daemon-reload
sudo systemctl enable --now newflow-backend
sudo systemctl status newflow-backend    # active (running)
```

## 4) Frontend: publicar o build
O `build` NÃO vai no Git. Você tem duas opções:

**Opção A — usar o build já pronto do pacote `newflow-deploy.tar.gz`:**
```bash
tar -xzf newflow-deploy.tar.gz -C /tmp/newflow_pkg
sudo mkdir -p /var/www/newflow
sudo cp -r /tmp/newflow_pkg/frontend/build/* /var/www/newflow/
```

**Opção B — gerar o build (no seu PC, não na Pi):**
```bash
cd frontend
REACT_APP_BACKEND_URL="" yarn install && REACT_APP_BACKEND_URL="" yarn build
# copie a pasta build/ para a Pi em /var/www/newflow/
```

## 5) Nginx na porta 5011 (domínio via túnel/proxy na frente)
Use este quando o **Cloudflare Tunnel / proxy** aponta `newflow.zeferius.com.br` → porta 5011
(o TLS/cadeado é terminado no Cloudflare):
```bash
sudo cp /opt/newflow/deploy/nginx-newflow.conf /etc/nginx/sites-available/newflow.conf
sudo ln -s /etc/nginx/sites-available/newflow.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### (Alternativa) HTTPS direto na Pi (Let's Encrypt)
Só se a **própria Pi** for terminar o TLS (portas 80/443 abertas e domínio resolvendo para o IP da Pi):
```bash
sudo cp /opt/newflow/deploy/nginx-newflow-https.conf /etc/nginx/sites-available/newflow.conf
sudo ln -s /etc/nginx/sites-available/newflow.conf /etc/nginx/sites-enabled/
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d newflow.zeferius.com.br
sudo nginx -t && sudo systemctl reload nginx
```

Acesse: **https://newflow.zeferius.com.br** — login **rithielegui@gmail.com** / **Rithi0518@**

---

## Atualizações futuras (git pull)
```bash
cd /opt/newflow && git pull
# backend:
sudo systemctl restart newflow-backend
# frontend (se mudou): gere um novo build (Opção B acima) e copie para /var/www/newflow/
```
> O `frontend/build` não é versionado. Gere-o no seu PC com
> `REACT_APP_BACKEND_URL="" yarn build` e copie a pasta `build/` para `/var/www/newflow/`.

---

## ⚠️ Observações
1. **MongoDB Atlas**: libere o IP da sua rede em Atlas → Network Access (ou 0.0.0.0/0 para testes),
   senão o backend não conecta.
2. **Imagens**: agora ficam em `/opt/newflow/backend/uploads` (disco local). Faça backup dessa pasta
   se quiser preservar as imagens. Configurável via `UPLOADS_DIR` no `.env`.
3. **Telegram**: informe `api_id`, `api_hash` e telefone na aba Telegram (my.telegram.org).
4. A API **WhatsFlow** (envio real do WhatsApp) precisa estar rodando na Pi em `127.0.0.1:8001`.
   Configure a URL/senha dela em **Configurações** dentro do NewFlow.
