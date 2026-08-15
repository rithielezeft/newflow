import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash, Users } from "lucide-react";

// Fetches WhatsApp groups + channels and lets the user pick one, with a manual fallback input.
export function ChatSelect({ value, onChange, testId = "chat", includeChannels = true }) {
  const [chats, setChats] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const reqs = [api.get("/whatsapp/groups")];
        if (includeChannels) reqs.push(api.get("/whatsapp/channels"));
        const res = await Promise.all(reqs);
        const groups = (res[0].data.chats || []).map((c) => ({ ...c, kind: "Grupo" }));
        const channels = includeChannels ? (res[1].data.chats || []).map((c) => ({ ...c, kind: "Canal" })) : [];
        setChats([...groups, ...channels]);
        if (res[0].data.not_ready) setNote(res[0].data.message || "WhatsApp não conectado.");
      } catch (e) {
        setNote("Não foi possível carregar os chats.");
      }
    }
    load();
  }, [includeChannels]);

  return (
    <div className="space-y-3">
      {chats.length > 0 && (
        <Select
          value={value}
          onValueChange={(v) => {
            const c = chats.find((x) => x.id === v);
            onChange(v, c?.name || "");
          }}
        >
          <SelectTrigger data-testid={`${testId}-select`} className="bg-slate-900/60 border-slate-800">
            <SelectValue placeholder="Selecione um grupo ou canal" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-72">
            {chats.map((c) => (
              <SelectItem key={c.id} value={c.id} data-testid={`${testId}-option-${c.id}`}>
                <span className="inline-flex items-center gap-2">
                  {c.is_newsletter ? <Hash className="w-3.5 h-3.5 text-blue-400" /> : <Users className="w-3.5 h-3.5 text-emerald-400" />}
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div>
        {note && <p className="text-xs text-amber-400 mb-2">{note}</p>}
        <Label className="text-xs text-slate-500">Ou informe o ID (JID) manualmente</Label>
        <Input
          data-testid={`${testId}-manual-input`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value, "")}
          placeholder="120363...@g.us ou ...@newsletter"
          className="bg-slate-900/60 border-slate-800 mt-1 font-mono text-sm"
        />
      </div>
    </div>
  );
}
