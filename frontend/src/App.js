import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import WhatsAppPage from "@/pages/WhatsAppPage";
import TelegramPage from "@/pages/TelegramPage";
import RelayPage from "@/pages/RelayPage";
import SchedulerPage from "@/pages/SchedulerPage";
import SettingsPage from "@/pages/SettingsPage";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user && user !== null) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/" element={<Protected><Overview /></Protected>} />
          <Route path="/whatsapp" element={<Protected><WhatsAppPage /></Protected>} />
          <Route path="/telegram" element={<Protected><TelegramPage /></Protected>} />
          <Route path="/relay" element={<Protected><RelayPage /></Protected>} />
          <Route path="/scheduler" element={<Protected><SchedulerPage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
    </AuthProvider>
  );
}

export default App;
