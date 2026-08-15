import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatSelect } from "@/components/ChatSelect";
import { ImageUpload } from "@/components/ImageUpload";
import { RefreshCw, Send, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";

function labelFor(state, ready) {
  if (ready) return "Conectado";
  return {
    awaiting_qr: "Escaneie o QR",
    initializing: "Inicializando",
    authenticated: "Autenticando",
    connected: "Conectado",
    disconnected: "Desconectado",
    unreachable: "Inacessível",
    auth_failure: "Falha de auth",
  }[state] || state;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [chatId, setChatId] = useState("");
  const [message, setMessage] = useState("");
  const [imageFileId, setImageFileId] = useState(null);
  const [sending, setSending] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/whatsapp/status");
      setStatus(data);
      if (data.has_qr || data.state === "awaiting_qr") {
        const q = await api.get("/whatsapp/qr");
        setQr(q.data.qr);
      } else {
        setQr(null);
      }
    } catch (e) {
      setStatus({ state: "unreachable" });
    }
  };

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 8000);
    return () => clearInterval(t);
  }, []);

  const send = async () => {
    if (!chatId) return toast.error("Selecione um grupo ou canal");
    if (!message && !imageFileId) return toast.error("Escreva uma mensagem ou anexe uma imagem");
    setSending(true);
    try {
      await api.post("/whatsapp/send", { chat_id: chatId, message: message || null, image_file_id: imageFileId });
      toast.success("Mensagem enviada!");
      setMessage("");
      setImageFileId(null);
    } catch (e) {
      toast.error(apiError(e, "Falha ao enviar"));
    } finally {
      setSending(false);
    }
  };

  const connected = status?.ready || status?.state === "connected";

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Conexão</p>
      <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">WhatsApp</h1>
        <div className="flex items-center gap-3">
          {status && (
            <StatusBadge
              testId="wa-status-badge"
              state={connected ? "connected" : status.state === "unreachable" ? "unreachable" : "pending"}
              label={labelFor(status.state, status.ready)}
            />
          )}
          <Button data-testid="wa-refresh" variant="outline" size="icon" onClick={loadStatus} className="border-slate-800 bg-slate-900">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {status?.unreachable && (
        <p className="text-sm text-amber-400 mt-3">
          {status.error || "WhatsFlow inacessível."} Configure a URL da sua Raspberry em Configurações ou rode o painel na própria Pi.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <QrCode className="w-5 h-5 text-emerald-400" /> Parear número
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connected ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Send className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="mt-4 font-medium">WhatsApp conectado e pronto para enviar.</p>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-4 py-4" data-testid="wa-qr-wrap">
                <div className="bg-white p-4 rounded-xl">
                  <img src={qr} alt="QR Code" className="w-56 h-56" data-testid="wa-qr-image" />
                </div>
                <p className="text-sm text-slate-400 text-center">Abra o WhatsApp → Aparelhos conectados → Conectar aparelho.</p>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500">
                <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                <p className="mt-3 text-sm">Aguardando QR code do servidor...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Send className="w-5 h-5 text-emerald-400" /> Enviar mensagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ChatSelect value={chatId} onChange={(id) => setChatId(id)} testId="wa-compose-chat" />
            <Textarea
              data-testid="wa-compose-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva sua mensagem..."
              rows={4}
              className="bg-slate-900/60 border-slate-800 resize-none"
            />
            <ImageUpload onChange={setImageFileId} testId="wa-compose-image" />
            <Button
              data-testid="wa-send-btn"
              onClick={send}
              disabled={sending}
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Enviar agora</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
