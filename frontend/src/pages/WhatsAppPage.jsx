import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatSelect } from "@/components/ChatSelect";
import { ImageUpload } from "@/components/ImageUpload";
import { RefreshCw, Send, QrCode, Loader2, Copy, Users, Hash, AlertTriangle } from "lucide-react";
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

function ChatList({ title, icon: Icon, items, message, onCopy }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-400" /> {title} <span className="text-slate-500">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {message || "Nada encontrado."}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {items.map((c) => (
            <div key={c.id} data-testid={`wa-chat-${c.id}`} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <div className="min-w-0">
                <p className="text-sm truncate">{c.name}</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">{c.id}</p>
              </div>
              <Button
                data-testid={`wa-copy-${c.id}`}
                size="sm"
                variant="outline"
                onClick={() => onCopy(c.id)}
                className="shrink-0 h-8 border-slate-800 bg-slate-900 text-slate-300"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState(null);
  const [groups, setGroups] = useState([]);
  const [channels, setChannels] = useState([]);
  const [groupsMsg, setGroupsMsg] = useState("");
  const [channelsMsg, setChannelsMsg] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
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

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const [g, c] = await Promise.all([api.get("/whatsapp/groups"), api.get("/whatsapp/channels")]);
      setGroups(g.data.chats || []);
      setChannels(c.data.chats || []);
      setGroupsMsg(g.data.not_ready ? g.data.message : "");
      setChannelsMsg(c.data.not_ready ? c.data.message : "");
    } catch (e) {
      setGroupsMsg(apiError(e));
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadChats();
    const t = setInterval(loadStatus, 10000);
    return () => clearInterval(t);
  }, []);

  const copyId = (id) => {
    navigator.clipboard?.writeText(id);
    toast.success("JID copiado!");
  };

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
          <Button data-testid="wa-refresh" variant="outline" size="icon" onClick={() => { loadStatus(); loadChats(); }} className="border-slate-800 bg-slate-900">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {status?.unreachable && (
        <p className="text-sm text-amber-400 mt-3">
          {status.error || "WhatsFlow inacessível."} Configure a URL e a senha do WhatsFlow em Configurações e confirme que o número está pareado.
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
              <div className="text-center py-8">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Send className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="mt-4 font-medium">WhatsApp conectado e pronto para enviar.</p>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-4 py-4" data-testid="wa-qr-wrap">
                <div className="bg-white p-4 rounded-xl">
                  <img src={qr} alt="QR Code" className="w-52 h-52" data-testid="wa-qr-image" />
                </div>
                <p className="text-sm text-slate-400 text-center">WhatsApp → Aparelhos conectados → Conectar aparelho.</p>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                <p className="mt-3 text-sm">Aguardando QR / conexão...</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-display">
              <Users className="w-5 h-5 text-emerald-400" /> Meus grupos e canais
            </CardTitle>
            <Button data-testid="wa-chats-refresh" size="sm" variant="outline" onClick={loadChats} disabled={loadingChats} className="border-slate-800 bg-slate-900">
              {loadingChats ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <ChatList title="Grupos" icon={Users} items={groups} message={groupsMsg} onCopy={copyId} />
            <ChatList title="Canais" icon={Hash} items={channels} message={channelsMsg} onCopy={copyId} />
            <p className="text-[11px] text-slate-500">Toque em copiar para pegar o JID e usar em agendamentos/repasse.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Send className="w-5 h-5 text-emerald-400" /> Enviar mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 max-w-2xl">
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
            className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Enviar agora</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
