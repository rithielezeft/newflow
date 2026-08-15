export function StatusDot({ state }) {
  const map = {
    connected: "bg-emerald-400",
    ok: "bg-emerald-400",
    pending: "bg-amber-400",
    awaiting_qr: "bg-amber-400",
    initializing: "bg-amber-400",
    authenticated: "bg-amber-400",
    disconnected: "bg-rose-400",
    unreachable: "bg-rose-400",
    auth_failure: "bg-rose-400",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[state] || "bg-slate-500"}`} />;
}

export function StatusBadge({ state, label, testId }) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300"
    >
      <StatusDot state={state} />
      {label}
    </span>
  );
}
