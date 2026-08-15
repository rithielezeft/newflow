import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap } from "lucide-react";
import { toast } from "sonner";

const BG = "https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRhcmslMjB0ZWNoJTIwbmV0d29ya3xlbnwwfHx8fDE3ODY4MDQwNjB8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("rithielegui@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data);
      toast.success("Bem-vindo de volta!");
      navigate("/");
    } catch (err) {
      toast.error(apiError(err, "Falha no login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950">
      <div className="relative hidden lg:block">
        <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-slate-950/80" />
        <div className="relative h-full flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-slate-950" />
            </div>
            <span className="font-display font-extrabold text-2xl">NewFlow</span>
          </div>
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Controle seu WhatsApp <span className="text-emerald-400">e Telegram</span> num só lugar.
            </h1>
            <p className="text-slate-400 mt-4 max-w-md">
              Envie para grupos e canais, repasse conteúdo do Telegram e agende mensagens automáticas.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-slate-950" />
            </div>
            <span className="font-display font-extrabold text-2xl">NewFlow</span>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Entrar no painel</h2>
            <p className="text-slate-500 text-sm mt-1">Use suas credenciais para acessar.</p>
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-900/60 border-slate-800"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-900/60 border-slate-800"
              required
            />
          </div>
          <Button
            data-testid="login-submit"
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95"
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
