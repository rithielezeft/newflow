import { useEffect, useMemo, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChatSelect } from "@/components/ChatSelect";
import { ImageUpload } from "@/components/ImageUpload";
import { Clock, Plus, Trash2, Play, Loader2, CalendarClock, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const EMPTY_IMG =
  "https://images.unsplash.com/photo-1543332164-6e82f355badc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxtZXNzYWdlJTIwc3BlZWNoJTIwYnViYmxlJTIwbmVvbnxlbnwwfHx8fDE3ODY4MDQwNjZ8MA&ixlib=rb-4.1.0&q=85";

const PRESETS = [
  { label: "Dias úteis", days: [0, 1, 2, 3, 4] },
  { label: "Fim de semana", days: [5, 6] },
  { label: "Todos os dias", days: [0, 1, 2, 3, 4, 5, 6] },
];

export default function SchedulerPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState("");
  const [chatName, setChatName] = useState("");
  const [days, setDays] = useState([]);
  const [time, setTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [imageFileId, setImageFileId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/schedules");
      setSchedules(data.schedules);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = useMemo(() => schedules.filter((s) => s.enabled).length, [schedules]);

  const toggleDay = (i) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const applyPreset = (p) => setDays(p.days);

  const resetForm = () => {
    setChatId("");
    setChatName("");
    setDays([]);
    setTime("09:00");
    setMessage("");
    setImageFileId(null);
  };

  const create = async () => {
    if (!chatId) return toast.error("Selecione o grupo/canal");
    if (days.length === 0) return toast.error("Escolha ao menos um dia");
    if (!message && !imageFileId) return toast.error("Escreva a mensagem ou anexe imagem");
    setSaving(true);
    try {
      await api.post("/schedules", {
        chat_id: chatId,
        chat_name: chatName || chatId,
        days: [...days].sort(),
        time,
        message: message || null,
        image_file_id: imageFileId,
        enabled: true,
      });
      toast.success("Agendamento criado!");
      resetForm();
      load();
    } catch (e) {
      toast.error(apiError(e, "Falha ao criar"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s) => {
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api.patch(`/schedules/${s.id}`, { enabled: !s.enabled });
    } catch (e) {
      load();
    }
  };

  const remove = async (id) => {
    await api.delete(`/schedules/${id}`);
    toast.success("Agendamento removido");
    load();
  };

  const runNow = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/schedules/${id}/run`);
      toast.success("Enviado agora!");
      load();
    } catch (e) {
      toast.error(apiError(e, "Falha ao enviar"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">Automação</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Agendamentos</h1>
          <p className="text-slate-400 mt-2 text-sm sm:text-base">Programe mensagens com texto e imagem em dias e horários fixos.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <CalendarClock className="w-4 h-4 text-amber-400" /> {schedules.length} total
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            {activeCount} ativos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8 items-start">
        {/* FORM */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2 lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Plus className="w-5 h-5 text-emerald-400" /> Novo agendamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-2 block">Grupo / Canal do WhatsApp</Label>
              <ChatSelect value={chatId} onChange={(id, name) => { setChatId(id); setChatName(name); }} testId="sched-chat" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      data-testid={`sched-preset-${p.label}`}
                      onClick={() => applyPreset(p)}
                      className="text-[11px] px-2 py-1 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    data-testid={`sched-day-${i}`}
                    onClick={() => toggleDay(i)}
                    className={`aspect-square rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 active:scale-95 ${
                      days.includes(i) ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Horário</Label>
              <Input
                data-testid="sched-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-slate-900/60 border-slate-800 w-full sm:w-40"
              />
            </div>

            <div>
              <Label className="mb-2 block">Mensagem</Label>
              <Textarea
                data-testid="sched-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Mensagem a enviar..."
                className="bg-slate-900/60 border-slate-800 resize-none"
              />
            </div>

            <div>
              <Label className="mb-2 block">Imagem (opcional)</Label>
              <ImageUpload onChange={setImageFileId} testId="sched-image" />
            </div>

            <Button
              data-testid="sched-create-btn"
              onClick={create}
              disabled={saving}
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold transition-all duration-200 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Criar agendamento</>}
            </Button>
          </CardContent>
        </Card>

        {/* LIST */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-500" /></div>
          ) : schedules.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <div className="relative h-40 sm:h-48">
                <img src={EMPTY_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>
              <CardContent className="text-center py-8">
                <h3 className="font-display text-xl font-bold">Nenhum agendamento ainda</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                  Crie seu primeiro envio automático escolhendo grupo, dias e horário no formulário ao lado.
                </p>
              </CardContent>
            </Card>
          ) : (
            schedules.map((s, idx) => (
              <div
                key={s.id}
                data-testid={`sched-item-${s.id}`}
                style={{ animationDelay: `${idx * 50}ms` }}
                className={`stagger-in p-4 sm:p-5 rounded-2xl border bg-slate-900 transition-colors ${
                  s.enabled ? "border-slate-800" : "border-slate-800/60 opacity-70"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex flex-col items-center justify-center w-16 shrink-0 rounded-xl bg-slate-950 border border-slate-800 py-3">
                    <span className="font-display text-xl font-extrabold text-emerald-400 leading-none">{s.time}</span>
                    <Clock className="w-4 h-4 text-slate-600 mt-1.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium truncate">{s.chat_name || s.chat_id}</p>
                      <Switch data-testid={`sched-toggle-${s.id}`} checked={s.enabled} onCheckedChange={() => toggle(s)} className="shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="sm:hidden text-sm font-semibold text-emerald-400 mr-1">{s.time}</span>
                      {DAYS.map((d, i) => (
                        <span
                          key={i}
                          className={`text-[11px] w-7 h-7 rounded-md flex items-center justify-center ${
                            s.days.includes(i) ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800/60 text-slate-600"
                          }`}
                        >
                          {d[0]}
                        </span>
                      ))}
                    </div>

                    {s.message && <p className="text-sm text-slate-400 mt-3 line-clamp-2">{s.message}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {s.image_file_id && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-400"><ImageIcon className="w-3.5 h-3.5" /> com imagem</span>
                      )}
                      {s.last_status && (
                        <span className={`inline-flex items-center gap-1 text-xs ${s.last_status.startsWith("enviado") ? "text-emerald-400" : "text-rose-400"}`}>
                          {s.last_status.startsWith("enviado") ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {s.last_status}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        data-testid={`sched-run-${s.id}`}
                        size="sm"
                        variant="outline"
                        disabled={busyId === s.id}
                        onClick={() => runNow(s.id)}
                        className="border-slate-800 bg-slate-950 text-emerald-400 hover:text-emerald-300"
                      >
                        {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3.5 h-3.5 mr-1.5" /> Enviar agora</>}
                      </Button>
                      <Button
                        data-testid={`sched-delete-${s.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => remove(s.id)}
                        className="border-slate-800 bg-slate-950 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
