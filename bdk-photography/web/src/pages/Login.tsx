import { FormEvent, useState } from "react";
import { login } from "../api";
import type { MeResponse } from "../api";

export default function Login(props: { onLogin: (token: string, user: MeResponse) => void; error?: string | null }): JSX.Element {
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(props.error ?? null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login({ phone: form.phone, password: form.password });
      props.onLogin(result.token, result.user);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/30 bg-white/70 shadow-xl backdrop-blur p-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-widest text-emerald-700/80">BDK Photography</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Login</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with your phone number and password to access the portal.
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm text-slate-700">
            Phone
            <input
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-emerald-200"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              autoComplete="tel"
              placeholder="0700..."
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-700">
            Password
            <input
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-emerald-200"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>

          <button
            className="mt-2 h-11 rounded-xl bg-emerald-700 text-white font-medium shadow-md shadow-emerald-700/20 hover:bg-emerald-800 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Demo seed (local/dev): admin phone <strong>0700000000</strong> with the password you set in `SEED_ADMIN_PASSWORD`.
        </div>
      </section>
    </main>
  );
}
