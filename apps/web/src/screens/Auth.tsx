import { useState } from "react";
import { supabase } from "../backend/online.ts";

export function Auth({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "notice"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onDone();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href } });
        if (error) throw error;
        if (data.session) onDone();
        else setMsg({ kind: "notice", text: "Kayıt oluşturuldu. E-postana gelen bağlantıyla hesabını doğrula, sonra giriş yap." });
      }
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home" style={{ maxWidth: 440 }}>
      <div className="hero"><h1>Kader Zarı</h1><p>Çevrimiçi kampanyaların için giriş yap.</p></div>
      <form className="card" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="row">
          <button type="button" className={`btn small ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Giriş</button>
          <button type="button" className={`btn small ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Kayıt ol</button>
        </div>
        <label className="field">E-posta<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field">Parola<input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {msg && <div className={msg.kind}>{msg.text}</div>}
        <button className="btn primary" disabled={busy}>{busy ? "Bekle…" : mode === "login" ? "Giriş yap" : "Kayıt ol"}</button>
        <button type="button" className="btn ghost small" onClick={onBack}>← Bu cihazda oyna</button>
      </form>
    </div>
  );
}
