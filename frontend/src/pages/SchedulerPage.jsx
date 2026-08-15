import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChatSelect } from "@/components/ChatSelect";
import { ImageUpload } from "@/components/ImageUpload";
import { Clock, Plus, Trash2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState([]);
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [days, setDays] = useState([]);
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [imageFileId, setImageFileId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/schedules");
      setSchedules(data.schedules);
    } catch (e) {}
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  const create = async () => {
    if (!chatId) return toast.error("Selecione o grupo/canal");
    if (days.length === 0) return toast.error("Escolha ao menos um dia");
    if (!message && !imageFileId) return toast.error("Escreva a mensagem ou anexe imagem");
    setSaving(true);
    try {
      await api.post("/schedules", {
        chat_id: chatId,
        chat_name: chatName || chatId,
        days,
        time,
        message: message || null,
        image_file_id: imageFileId,
        enabled: true,
      });
      toast.success("Agendamento criado!");
      setMessage("");
      setImageFileId(null);
      setDays([]);
      load();
    } catch (e) {
      toast.error(apiError(e, "Falha ao criar"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => {
    await api.patch(`/schedules/${s.id}`, { enabled: !s.enabled });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/schedules/${id}`);
    toast.success("Agendamento removido");
    load();
  };

  const runNow = async (id) => {
    try {
      await api.post(`/schedules/${id}/run`);
      toast.success("Enviado agora!");
      load();
    } catch (e) {
      toast.error(apiError(e, "Falha ao enviar"));
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Automação</p>
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">Agendamentos</h1>
      <p className="text-slate-400 mt-2">Programe mensagens com texto e imagem em dias e horários fixos.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Plus className="w-5 h-5 text-emerald-400" /> Novo agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-2 block">Grupo / Canal do WhatsApp</Label>
              <ChatSelect value={chatId} onChange={(id, name) => { setChatId(id); setChatName(name); }} testId="sched-chat" />
            </div>
            <div>
              <Label className="mb-2 block">Dias da semana</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`sched-day-${i}`}
                    onClick={() => toggleDay(i)}
                    className={`w-11 h-11 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                      days.includes(i) ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-40">
              <Label className="mb-2 block">Horário</Label>
              <Input data-testid="sched-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-slate-900/60 border-slate-800" />
            </div>
            <Textarea
              data-testid="sched-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Mensagem a enviar..."
              className="bg-slate-900/60 border-slate-800 resize-none"
            />
            <ImageUpload onChange={setImageFileId} testId="sched-image" />
            <Button
              data-testid="sched-create-btn"
              onClick={create}
              disabled={saving}
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar agendamento"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Clock className="w-5 h-5 text-amber-400" /> Agendados ({schedules.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {schedules.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">Nenhum agendamento ainda.</p>}
            {schedules.map((s) => (
              <div key={s.id} data-testid={`sched-item-${s.id}`} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.chat_name || s.chat_id}</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {s.days.map((d) => DAYS[d]).join(", ")} às <span className="text-slate-200">{s.time}</span>
                    </p>
                    {s.message && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{s.message}</p>}
                    {s.image_file_id && <span className="text-xs text-emerald-400">+ imagem</span>}
                    {s.last_status && <p className="text-xs text-slate-600 mt-1">Último: {s.last_status}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch data-testid={`sched-toggle-${s.id}`} checked={s.enabled} onCheckedChange={() => toggle(s)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button data-testid={`sched-run-${s.id}`} size="sm" variant="outline" onClick={() => runNow(s.id)} className="border-slate-800 bg-slate-900 text-emerald-400">
                    <Play className="w-3.5 h-3.5 mr-1" /> Enviar agora
                  </Button>
                  <Button data-testid={`sched-delete-${s.id}`} size="sm" variant="outline" onClick={() => remove(s.id)} className="border-slate-800 bg-slate-900 text-rose-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
