import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LayoutDashboard, MessageCircle, Send, Repeat, Clock, Settings, LogOut, Menu, Zap } from "lucide-react";

const nav = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard, testId: "nav-overview", end: true },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, testId: "nav-whatsapp" },
  { to: "/telegram", label: "Telegram", icon: Send, testId: "nav-telegram" },
  { to: "/relay", label: "Repassar Telegram→WA", icon: Repeat, testId: "nav-relay" },
  { to: "/scheduler", label: "Agendamentos", icon: Clock, testId: "nav-scheduler" },
  { to: "/settings", label: "Configurações", icon: Settings, testId: "nav-settings" },
];

function NavContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
          <Zap className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <p className="font-display font-extrabold text-lg leading-none">NewFlow</p>
          <p className="text-xs text-slate-500 mt-0.5">Painel de controle</p>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={n.testId}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 ${
                isActive ? "bg-slate-900 text-emerald-400 font-medium" : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/60"
              }`
            }
          >
            <n.icon className="w-5 h-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800 mt-2">
        <p className="text-xs text-slate-500 px-2 mb-2 truncate">{user?.email}</p>
        <Button
          data-testid="logout-btn"
          variant="ghost"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full justify-start gap-3 text-slate-400 hover:text-rose-400 hover:bg-slate-900"
        >
          <LogOut className="w-5 h-5" /> Sair
        </Button>
      </div>
    </div>
  );
}

export function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-slate-950 border-r border-slate-800">
        <NavContent />
      </aside>

      <div className="md:pl-64">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
          <span className="font-display font-extrabold text-lg">NewFlow</span>
          <Sheet>
            <SheetTrigger asChild>
              <Button data-testid="mobile-menu-btn" variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-slate-950 border-slate-800">
              <NavContent />
            </SheetContent>
          </Sheet>
        </header>
        <main className="p-6 sm:p-8 lg:p-12 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
