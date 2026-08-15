# NewFlow — Instalação na Raspberry Pi (Nginx na porta 5011)

Este guia coloca o **NewFlow** rodando na sua Raspberry:
- **Nginx** na porta **5011** serve o site e faz proxy de `/api` para o backend.
- **Backend FastAPI** (uvicorn) roda em `127.0.0.1:8011` como serviço systemd.
- A **API WhatsFlow** (que você já tem) continua em `127.0.0.1:8001` — o NewFlow fala com ela.
- Banco: seu **MongoDB Atlas** (precisa de internet + liberar o IP no Atlas).

Estrutura final na Pi:
```
/opt/newflow/backend/     -> código do backend + venv + .env
/var/www/newflow/         -> arquivos do frontend (conteúdo de build/)
```

---

## 0) Pré-requisitos na Pi
```bash
sudo apt update
sudo apt install -y nginx python3-venv python3-pip
```

## 1) Copiar os arquivos para a Pi
No seu computador, dentro da pasta do projeto, envie a pasta `deploy_bundle` (gerada — veja seção "Pacote pronto") ou copie manualmente:

```bash
# exemplo com scp (troque IP/usuario)
scp -r backend deploy pi@192.168.0.50:/tmp/newflow_src
scp -r frontend/build pi@192.168.0.50:/tmp/newflow_build
```

Na Pi:
```bash
sudo mkdir -p /opt/newflow/backend /var/www/newflow
sudo cp -r /tmp/newflow_src/backend/* /opt/newflow/backend/
sudo cp -r /tmp/newflow_build/* /var/www/newflow/
sudo chown -R $USER:$USER /opt/newflow
```

## 2) Backend: venv + dependências + .env
```bash
cd /opt/newflow/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# .env de produção
cp /tmp/newflow_src/deploy/backend.env.example /opt/newflow/backend/.env
# (edite se quiser trocar senha admin, etc.)
```

Teste rápido:
```bash
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8011
# em outro terminal:
curl http://127.0.0.1:8011/api/
# deve responder: {"message":"NewFlow Dashboard API","status":"ok"}
# Ctrl+C para parar
```

## 3) Backend como serviço (systemd)
```bash
sudo cp /tmp/newflow_src/deploy/newflow-backend.service /etc/systemd/system/newflow-backend.service
# se seu usuário NÃO for "pi", edite User= no arquivo
sudo systemctl daemon-reload
sudo systemctl enable --now newflow-backend
sudo systemctl status newflow-backend      # deve ficar "active (running)"
```

## 4) Nginx na porta 5011
```bash
sudo cp /tmp/newflow_src/deploy/nginx-newflow.conf /etc/nginx/sites-available/newflow.conf
sudo ln -s /etc/nginx/sites-available/newflow.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Abra no navegador:  `http://<IP-DA-PI>:5011`
Login: **rithielegui@gmail.com** / **Rithi0518@**

---

## Atualizações futuras
- Frontend: gere novo build (`yarn build`) e copie para `/var/www/newflow/`.
- Backend: substitua os arquivos em `/opt/newflow/backend/` e `sudo systemctl restart newflow-backend`.

## Firewall (opcional)
```bash
sudo ufw allow 5011/tcp
```

---

## ⚠️ Observações importantes
1. **MongoDB Atlas**: libere o IP da sua rede em Atlas → Network Access (ou 0.0.0.0/0 para testes). Sem isso o backend não conecta.
2. **Upload de imagem (composer/agendamento)**: usa o Object Storage da Emergent, cuja chave é vinculada ao ambiente Emergent. **Fora da Emergent (na Pi) o upload de imagem pode falhar (401).** O envio de texto para grupos/canais e o repasse do Telegram (que já traz a imagem em base64) funcionam normalmente. Se você for usar imagens nos agendamentos rodando na Pi, me avise que eu troco o armazenamento de imagens para o disco local da Raspberry.
3. **Telegram**: informe seu `api_id`, `api_hash` e telefone na aba Telegram (pegue em my.telegram.org).
4. Se quiser acessar por um domínio/HTTPS, dá para pôr um Nginx/Certbot na frente — me avise.
