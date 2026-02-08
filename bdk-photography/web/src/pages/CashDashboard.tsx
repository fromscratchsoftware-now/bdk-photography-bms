import { useEffect, useState } from "react";
import { getCashMe, type CashMe } from "../api";
import type { MeResponse } from "../api";

export default function CashDashboard(props: { token: string; user: MeResponse; onLogout: () => void }): JSX.Element {
  const [cashMe, setCashMe] = useState<CashMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const data = await getCashMe(props.token);
        if (!cancelled) {
          setCashMe(data);
        }
      } catch (caught: unknown) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.token]);

  return (
    <main className="min-h-screen p-6">
      <header className="mx-auto max-w-5xl rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 text-white shadow-2xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/70">BDK Photography</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cash Dashboard</h1>
            <p className="mt-2 text-sm text-white/80">
              Logged in as <strong>{props.user.fullName}</strong> ({props.user.role.name})
            </p>
          </div>
          <button
            className="h-10 rounded-xl bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/15 border border-white/15"
            type="button"
            onClick={props.onLogout}
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl mt-6 grid gap-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : null}

        <article className="rounded-2xl border border-white/30 bg-white/70 shadow-xl backdrop-blur p-6">
          <h2 className="text-lg font-semibold text-slate-900">Access</h2>
          <p className="mt-2 text-sm text-slate-600">
            This is a Phase 1 scaffold. Next phases will implement cash calculations and approvals.
          </p>

          <div className="mt-4 grid gap-3 text-sm text-slate-800">
            <div>
              <span className="text-slate-500">User ID:</span> {props.user.id}
            </div>
            <div>
              <span className="text-slate-500">Phone:</span> {props.user.phone}
            </div>
            <div>
              <span className="text-slate-500">Assigned shops:</span>{" "}
              {cashMe ? (cashMe.shops.length ? cashMe.shops.map((s) => `${s.name} (${s.code})`).join(", ") : "None") : "Loading..."}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
