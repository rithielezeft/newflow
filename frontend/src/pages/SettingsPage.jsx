import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/whatsapp/settings").then((r) => {
      setBaseUrl(r.data.base_url || "");
      setHasPassword(r.data.has_password);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/whatsapp/settings", { base_url: baseUrl, password: password || null });
      toast.success("Configurações salvas");
      setPassword("");
      const r = await api.get("/whatsapp/settings");
      setHasPassword(r.data.has_password);
    } catch (e) {
      toast.error(apiError(e, "Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Sistema</p>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Configurações</h1>
      <p className="text-slate-400 mt-2">Conexão com a API WhatsFlow que roda na sua Raspberry Pi.</p>

      <div className="max-w-lg mt-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Settings className="w-5 h-5 text-slate-300" /> API WhatsFlow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>URL base do WhatsFlow</Label>
              <Input
                data-testid="settings-baseurl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8001 ou https://seu-dominio.com"
                className="bg-slate-900/60 border-slate-800 font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Na própria Raspberry use <code className="text-slate-300">http://127.0.0.1:8001</code>. Para acessar de fora, exponha via domínio público.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Senha do WhatsFlow (login da API)</Label>
              <Input
                data-testid="settings-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? "•••••••• (salva)" : "senha do POST /api/auth/login"}
                className="bg-slate-900/60 border-slate-800"
              />
            </div>
            <Button
              data-testid="settings-save"
              onClick={save}
              disabled={saving}
              className="bg-slate-50 text-slate-900 hover:bg-slate-200 font-semibold transition-all duration-200 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Salvar</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
