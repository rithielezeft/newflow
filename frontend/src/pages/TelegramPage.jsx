import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Send, Loader2, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function TelegramPage() {
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState("form"); // form | code | connected
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/telegram/status");
      setStatus(data);
      if (data.connected) setStep("connected");
      else if (data.pending) setStep("code");
      else setStep("form");
    } catch (e) {
      setStatus({ connected: false });
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const connect = async () => {
    if (!apiId || !apiHash || !phone) return toast.error("Preencha api_id, api_hash e telefone");
    setLoading(true);
    try {
      await api.post("/telegram/connect", { api_id: apiId, api_hash: apiHash, phone });
      toast.success("Código enviado no seu Telegram");
      setStep("code");
    } catch (e) {
      toast.error(apiError(e, "Falha ao conectar"));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (!code) return toast.error("Digite o código recebido");
    setLoading(true);
    try {
      const { data } = await api.post("/telegram/verify", { code, password: password || null });
      if (data.status === "password_required") {
        setNeed2fa(true);
        toast.info("Sua conta tem 2FA. Informe a senha.");
      } else {
        toast.success("Telegram conectado!");
        await loadStatus();
      }
    } catch (e) {
      toast.error(apiError(e, "Falha na verificação"));
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    await api.post("/telegram/disconnect");
    setApiId("");
    setApiHash("");
    setPhone("");
    setCode("");
    setPassword("");
    setNeed2fa(false);
    toast.success("Telegram desconectado");
    loadStatus();
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Conexão</p>
      <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Telegram</h1>
        {status && (
          <StatusBadge
            testId="tg-status-badge"
            state={status.connected ? "connected" : status.pending ? "pending" : "disconnected"}
            label={status.connected ? "Conectado" : status.pending ? "Aguardando código" : "Desconectado"}
          />
        )}
      </div>

      <div className="max-w-lg mt-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Send className="w-5 h-5 text-blue-400" /> Conectar conta (MTProto)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === "connected" ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Send className="w-7 h-7 text-blue-400" />
                </div>
                <p className="mt-4 font-medium">
                  Conectado como {status?.first_name || ""} {status?.username ? `(@${status.username})` : ""}
                </p>
                <p className="text-sm text-slate-500">{status?.phone}</p>
                <Button
                  data-testid="tg-disconnect-btn"
                  variant="outline"
                  onClick={disconnect}
                  className="mt-5 border-slate-800 bg-slate-900 text-rose-400 hover:text-rose-300"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Desconectar
                </Button>
              </div>
            ) : step === "code" ? (
              <>
                <p className="text-sm text-slate-400">
                  Enviamos um código para o Telegram de <span className="text-slate-200">{status?.phone || phone}</span>.
                </p>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    data-testid="tg-code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="12345"
                    className="bg-slate-900/60 border-slate-800"
                  />
                </div>
                {need2fa && (
                  <div className="space-y-2">
                    <Label>Senha 2FA</Label>
                    <Input
                      data-testid="tg-2fa-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-900/60 border-slate-800"
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    data-testid="tg-verify-btn"
                    onClick={verify}
                    disabled={loading}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-semibold transition-all duration-200 active:scale-95"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4 mr-2" /> Verificar</>}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep("form")} className="text-slate-400">
                    Voltar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  Pegue seu <span className="text-slate-200">api_id</span> e <span className="text-slate-200">api_hash</span> em{" "}
                  <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="text-blue-400 underline">
                    my.telegram.org
                  </a>
                  .
                </p>
                <div className="space-y-2">
                  <Label>api_id</Label>
                  <Input data-testid="tg-apiid-input" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="123456" className="bg-slate-900/60 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>api_hash</Label>
                  <Input data-testid="tg-apihash-input" value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="0123456789abcdef..." className="bg-slate-900/60 border-slate-800 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (com código do país)</Label>
                  <Input data-testid="tg-phone-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" className="bg-slate-900/60 border-slate-800" />
                </div>
                <Button
                  data-testid="tg-connect-btn"
                  onClick={connect}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold transition-all duration-200 active:scale-95"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar código"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
