import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { MessageCircle, Send, Clock, ArrowRight } from "lucide-react";

export default function Overview() {
  const [wa, setWa] = useState(null);
  const [tg, setTg] = useState(null);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    api.get("/whatsapp/status").then((r) => setWa(r.data)).catch(() => setWa({ state: "unreachable" }));
    api.get("/telegram/status").then((r) => setTg(r.data)).catch(() => setTg({ connected: false }));
    api.get("/schedules").then((r) => setSchedules(r.data.schedules)).catch(() => {});
  }, []);

  const cards = [
    {
      to: "/whatsapp",
      icon: MessageCircle,
      title: "WhatsApp",
      color: "text-emerald-400",
      badge: wa ? (
        <StatusBadge
          testId="ov-wa-status"
          state={wa.state === "connected" || wa.ready ? "connected" : wa.state === "unreachable" ? "unreachable" : "pending"}
          label={wa.ready ? "Conectado" : wa.state === "unreachable" ? "Inacessível" : "Aguardando"}
        />
      ) : null,
    },
    {
      to: "/telegram",
      icon: Send,
      title: "Telegram",
      color: "text-blue-400",
      badge: tg ? (
        <StatusBadge
          testId="ov-tg-status"
          state={tg.connected ? "connected" : tg.pending ? "pending" : "disconnected"}
          label={tg.connected ? "Conectado" : tg.pending ? "Aguardando código" : "Desconectado"}
        />
      ) : null,
    },
    {
      to: "/scheduler",
      icon: Clock,
      title: "Agendamentos",
      color: "text-amber-400",
      badge: (
        <StatusBadge testId="ov-sched-count" state="ok" label={`${schedules.length} agendado(s)`} />
      ),
    },
  ];

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Painel</p>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Visão Geral</h1>
      <p className="text-slate-400 mt-2">Status das conexões e atalhos rápidos.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {cards.map((c, i) => (
          <Link key={c.to} to={c.to} className="stagger-in" style={{ animationDelay: `${i * 80}ms` }}>
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <c.icon className={`w-8 h-8 ${c.color}`} />
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                </div>
                <h3 className="font-display text-xl font-bold mt-4">{c.title}</h3>
                <div className="mt-3">{c.badge}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
