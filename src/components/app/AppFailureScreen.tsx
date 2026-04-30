interface AppFailureScreenProps {
  title: string;
  message: string;
  details?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  diagnostics?: Array<{ label: string; status: 'ok' | 'warning' | 'missing'; detail: string }>;
}

export function AppFailureScreen({
  title,
  message,
  details,
  actionLabel,
  onAction,
  diagnostics = [],
}: AppFailureScreenProps) {
  const diagnosticToneClasses = {
    ok: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
    missing: 'border-rose-400/35 bg-rose-500/10 text-rose-200',
  } as const;

  return (
    <main className="min-h-screen px-5 py-8 text-slate-100">
      <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-rose-400/30 bg-slate-950/80 p-6 shadow-[0_24px_48px_rgba(6,13,23,0.45)] backdrop-blur">
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-rose-200/80">Listing Control Center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>

        {details ? (
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs leading-6 text-rose-100/90">
            {details}
          </pre>
        ) : null}

        {diagnostics.length > 0 ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-slate-300">Runtime diagnostics</p>
            {diagnostics.map((diagnostic) => (
              <div key={diagnostic.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{diagnostic.label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${diagnosticToneClasses[diagnostic.status]}`}>
                    {diagnostic.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-300">{diagnostic.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        {actionLabel && onAction ? (
          <button
            type="button"
            className="mt-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}