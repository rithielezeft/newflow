import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChatSelect } from "@/components/ChatSelect";
import { Repeat, Loader2, Image as ImageIcon, RefreshCw, Zap, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function RelayPage() {
  const [connected, setConnected] = useState(false);
  const [dialogs, setDialogs] = useState([]);
  const [source, setSource] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [waChat, setWaChat] = useState("");
  const [includeImage, setIncludeImage] = useState(true);
  const [extraText, setExtraText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [relaying, setRelaying] = useState(false);

  // auto-relay
  const [rules, setRules] = useState([]);
  const [autoSource, setAutoSource] = useState(null);
  const [autoWa, setAutoWa] = useState("");
  const [autoWaName, setAutoWaName] = useState("");
  const [autoInclude, setAutoInclude] = useState(true);
  const [autoExtra, setAutoExtra] = useState("");
  const [creatingRule, setCreatingRule] = useState(false);

  useEffect(() => {
    api.get("/telegram/status").then((r) => {
      setConnected(r.data.connected);
      if (r.data.connected) {
        loadDialogs();
        loadRules();
      }
    });
  }, []);

  const loadDialogs = async () => {
    try {
      const { data } = await api.get("/telegram/dialogs");
      setDialogs(data.dialogs);
    } catch (e) {
      toast.error(apiError(e, "Falha ao carregar diálogos"));
    }
  };

  const loadRules = async () => {
    try {
      const { data } = await api.get("/telegram/relays");
      setRules(data.relays);
    } catch (e) {}
  };

  const loadMessages = async (d) => {
    setSource(d);
    setSelectedMsg(null);
    setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/telegram/chats/${encodeURIComponent(d.id)}/messages`, {
        params: { limit: 15, include_photos: true },
      });
      setMessages(data.messages);
    } catch (e) {
      toast.error(apiError(e, "Falha ao carregar mensagens"));
    } finally {
      setLoadingMsgs(false);
    }
  };

  const relay = async () => {
    if (!source) return toast.error("Escolha um grupo/canal de origem");
    if (!waChat) return toast.error("Escolha o destino no WhatsApp");
    setRelaying(true);
    try {
      await api.post("/telegram/relay", {
        source_chat_id: source.id,
        message_id: selectedMsg?.id || null,
        wa_chat_id: waChat,
        include_image: includeImage,
        extra_text: extraText || null,
      });
      toast.success("Conteúdo repassado!");
    } catch (e) {
      toast.error(apiError(e, "Falha ao repassar"));
    } finally {
      setRelaying(false);
    }
  };

  const createRule = async () => {
    if (!autoSource) return toast.error("Escolha a origem no Telegram");
    if (!autoWa) return toast.error("Escolha o destino no WhatsApp");
    setCreatingRule(true);
    try {
      await api.post("/telegram/relays", {
        source_chat_id: autoSource.id,
        source_name: autoSource.name,
        wa_chat_id: autoWa,
        wa_name: autoWaName || autoWa,
        include_image: autoInclude,
        extra_text: autoExtra || null,
      });
      toast.success("Repasse automático criado! Novos posts serão encaminhados.");
      setAutoExtra("");
      loadRules();
    } catch (e) {
      toast.error(apiError(e, "Falha ao criar regra"));
    } finally {
      setCreatingRule(false);
    }
  };

  const toggleRule = async (r) => {
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api.patch(`/telegram/relays/${r.id}`, { enabled: !r.enabled });
    } catch (e) {
      loadRules();
    }
  };

  const deleteRule = async (id) => {
    await api.delete(`/telegram/relays/${id}`);
    toast.success("Regra removida");
    loadRules();
  };

  if (!connected) {
    return (
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Repassar Telegram → WhatsApp</h1>
        <Card className="bg-slate-900 border-slate-800 mt-8 max-w-lg">
          <CardContent className="p-8 text-center text-slate-400">
            <Repeat className="w-8 h-8 mx-auto text-slate-600" />
            <p className="mt-4">Conecte sua conta do Telegram primeiro (aba Telegram) para usar o repasse.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Automação</p>
      <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Repassar Telegram → WhatsApp</h1>
        <Button data-testid="relay-refresh-dialogs" variant="outline" size="icon" onClick={() => { loadDialogs(); loadRules(); }} className="border-slate-800 bg-slate-900">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* ---------- REPASSE AUTOMÁTICO ---------- */}
      <Card className="bg-slate-900 border-emerald-500/30 mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Zap className="w-5 h-5 text-emerald-400" /> Repasse automático
          </CardTitle>
          <p className="text-sm text-slate-400">Cada post novo do grupo/canal do Telegram é enviado sozinho ao WhatsApp (verifica a cada minuto).</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Origem no Telegram</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-800 p-1.5">
                {dialogs.map((d) => (
                  <button
                    key={d.id}
                    data-testid={`auto-source-${d.id}`}
                    onClick={() => setAutoSource(d)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${autoSource?.id === d.id ? "bg-emerald-500/15 text-emerald-300" : "hover:bg-slate-800/60 text-slate-300"}`}
                  >
                    {d.name} <span className="text-xs text-slate-500">· {d.is_channel ? "Canal" : "Grupo"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Destino no WhatsApp</Label>
              <ChatSelect value={autoWa} onChange={(id, name) => { setAutoWa(id); setAutoWaName(name); }} testId="auto-wa" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" data-testid="auto-include-image" checked={autoInclude} onChange={(e) => setAutoInclude(e.target.checked)} className="accent-emerald-500 w-4 h-4" />
              Incluir imagem quando houver
            </label>
            <Textarea data-testid="auto-extra-text" value={autoExtra} onChange={(e) => setAutoExtra(e.target.value)} rows={2} placeholder="Texto extra fixo (opcional)" className="bg-slate-900/60 border-slate-800 resize-none" />
            <Button data-testid="auto-create-btn" onClick={createRule} disabled={creatingRule} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95">
              {creatingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Ativar repasse automático</>}
            </Button>
          </div>
        </CardContent>
        {rules.length > 0 && (
          <CardContent className="border-t border-slate-800 pt-4 space-y-2">
            {rules.map((r) => (
              <div key={r.id} data-testid={`rule-${r.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="min-w-0">
                  <p className="text-sm truncate"><span className="text-blue-400">{r.source_name || r.source_chat_id}</span> → <span className="text-emerald-400">{r.wa_name || r.wa_chat_id}</span></p>
                  <p className="text-[11px] text-slate-500">{r.forwarded_count || 0} repassado(s) · {r.last_status || "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch data-testid={`rule-toggle-${r.id}`} checked={r.enabled} onCheckedChange={() => toggleRule(r)} />
                  <Button data-testid={`rule-delete-${r.id}`} size="sm" variant="outline" onClick={() => deleteRule(r.id)} className="border-slate-800 bg-slate-900 text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ---------- REPASSE MANUAL ---------- */}
      <p className="text-sm font-semibold text-slate-400 mt-10 mb-3">Repasse manual (post específico)</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="font-display text-lg">1. Origem</CardTitle></CardHeader>
          <CardContent className="space-y-1 max-h-96 overflow-y-auto">
            {dialogs.length === 0 && <p className="text-sm text-slate-500">Nenhum diálogo carregado.</p>}
            {dialogs.map((d) => (
              <button key={d.id} data-testid={`relay-source-${d.id}`} onClick={() => loadMessages(d)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${source?.id === d.id ? "bg-blue-500/15 text-blue-300" : "hover:bg-slate-800/60 text-slate-300"}`}>
                {d.name}
                <span className="block text-xs text-slate-500">{d.is_channel ? "Canal" : "Grupo"}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="font-display text-lg">2. Mensagem</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-2">
            {loadingMsgs ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-500" /></div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">Selecione uma origem. Sem escolher, usaremos a mais recente.</p>
            ) : (
              messages.map((m) => (
                <button key={m.id} data-testid={`relay-msg-${m.id}`} onClick={() => setSelectedMsg(m)} className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${selectedMsg?.id === m.id ? "border-blue-500/50 bg-blue-500/10" : "border-slate-800 hover:bg-slate-800/40"}`}>
                  {m.photo_base64 && <img src={m.photo_base64} alt="" className="w-full h-24 object-cover rounded mb-2" />}
                  {!m.photo_base64 && m.has_photo && <span className="inline-flex items-center gap-1 text-xs text-slate-500 mb-1"><ImageIcon className="w-3 h-3" /> imagem</span>}
                  <p className="line-clamp-3 text-slate-300">{m.text || <span className="italic text-slate-500">(sem texto)</span>}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="font-display text-lg">3. Destino</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <ChatSelect value={waChat} onChange={(id) => setWaChat(id)} testId="relay-wa" />
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" data-testid="relay-include-image" checked={includeImage} onChange={(e) => setIncludeImage(e.target.checked)} className="accent-emerald-500 w-4 h-4" />
              Incluir imagem (se houver)
            </label>
            <Textarea data-testid="relay-extra-text" value={extraText} onChange={(e) => setExtraText(e.target.value)} rows={2} placeholder="Texto extra (opcional)" className="bg-slate-900/60 border-slate-800 resize-none" />
            <Button data-testid="relay-send-btn" onClick={relay} disabled={relaying} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95">
              {relaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Repeat className="w-4 h-4 mr-2" /> Repassar agora</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
