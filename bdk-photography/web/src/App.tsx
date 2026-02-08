import { useEffect, useState } from "react";
import { me, type MeResponse } from "./api";
import CashDashboard from "./pages/CashDashboard";
import Login from "./pages/Login";

const AUTH_STORAGE_KEY = "bdk.auth.jwt.v1";

export default function App(): JSX.Element {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(AUTH_STORAGE_KEY));
  const [user, setUser] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setError(null);

      if (!token) {
        setUser(null);
        setBooting(false);
        return;
      }

      try {
        const profile = await me(token);
        if (!cancelled) {
          setUser(profile);
        }
      } catch (caught: unknown) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Session expired. Please login again.");
          setUser(null);
          setToken(null);
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleLogin(nextToken: string, nextUser: MeResponse): void {
    window.localStorage.setItem(AUTH_STORAGE_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout(): void {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }

  if (booting) {
    return <div className="min-h-screen grid place-items-center text-slate-700">Loading...</div>;
  }

  if (!token || !user) {
    return <Login onLogin={handleLogin} error={error} />;
  }

  return <CashDashboard token={token} user={user} onLogout={handleLogout} />;
}
