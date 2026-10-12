import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CLASSES, RACES } from "@kader/engine";
import { classNameIn, TEMPLATES } from "@kader/game";
import type { Backend, CampaignData, CampaignSummary } from "../backend/types.ts";
import { getLocalApiKey, LocalBackend, setLocalApiKey } from "../backend/local.ts";
import { inClaude, sampleCaller } from "../backend/claude.ts";
import type { Mode } from "../App.tsx";

interface Props {
  backend: Backend;
  mode: Mode;
  onlineAvailable: boolean;
  session: Session | null;
  setMode: (m: Mode) => void;
  onLogin: () => void;
  onLogout: () => void;
  onNew: () => void;
  onOpen: (c: CampaignData) => void;
}

export function Home(p: Props) {
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(getLocalApiKey());
  const [saved, setSaved] = useState(false);
  const canList = p.mode === "local" || !!p.session;
  const claude = inClaude();
  const [claudeReady, setClaudeReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (claude) void sampleCaller().then((c) => setClaudeReady(!!c));
  }, [claude]);

  useEffect(() => {
    setList(null);
    setError(null);
    if (!canList) return;
    p.backend.listCampaigns().then(setList).catch((e) => setError((e as Error).message));
  }, [p.backend, canList]);

  const open = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      p.onOpen(await p.backend.getCampaign(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: CampaignSummary) => {
    if (!confirm(`"${c.title}" kalıcı olarak silinsin mi?`)) return;
    await p.backend.deleteCampaign(c.id);
    setList((l) => (l ?? []).filter((x) => x.id !== c.id));
  };

  const importFile = async (f: File) => {
    try {
      const id = (p.backend as LocalBackend).importCampaign(await f.text());
      setList(await p.backend.listCampaigns());
      await open(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="home">
      <div className="hero">
        <h1>Kader Zarı</h1>
        <p>
          Zarlar kuralları, kayıt hafızayı, Claude Haiku 5.5 hikâyeyi yönetir. İster büyülü bir sınır kasabasında,
          ister 1570 Rodos'unda bir kadırga kâtibi olarak: yaz, zar at, tarihi değiştir.
        </p>
      </div>

      {claude && (
        <div className="card claude-status" style={{ marginBottom: 14 }}>
          <span className={`dot ${claudeReady === false ? "off" : ""}`} />
          <div className="grow small">
            {claudeReady === false
              ? "Claude'a bağlanılamadı; kural tabanlı anlatıcıyla oynanır."
              : <>Anlatıcı <b>Claude Haiku 5.5</b>, Claude hesabınla çalışır; API anahtarı gerekmez. Kampanyaların hesabına kaydedilir; telefondan, tabletten ya da bilgisayardan kaldığın yerden devam edersin. İlk turda Claude izin isteyebilir.</>}
          </div>
        </div>
      )}

      {!claude && <div className="modes">
        <button className={`card mode ${p.mode === "local" ? "selected" : ""}`} onClick={() => p.setMode("local")}>
          <h3>Bu cihazda oyna</h3>
          <div className="muted small">
            Hesap gerekmez; kampanya tarayıcında saklanır. İstersen kendi Anthropic anahtarınla Haiku 5.5 anlatıcıyı aç,
            istemezsen kural tabanlı anlatıcıyla oyna.
          </div>
        </button>
        <button
          className={`card mode ${p.mode === "online" ? "selected" : ""}`}
          onClick={() => p.onlineAvailable && p.setMode("online")}
          disabled={!p.onlineAvailable}
        >
          <h3>Çevrimiçi (Supabase)</h3>
          <div className="muted small">
            Hesabınla giriş yap; tüm hikâye Supabase'de tutulur, her cihazdan devam edersin. Anlatıcı sunucudaki Haiku 5.5.
          </div>
        </button>
      </div>}

      {p.mode === "online" && (
        <div className="card row" style={{ marginBottom: 14 }}>
          {p.session ? (
            <>
              <span className="grow">Giriş yapıldı: <b>{p.session.user.email}</b></span>
              <button className="btn small" onClick={p.onLogout}>Çıkış</button>
            </>
          ) : (
            <>
              <span className="grow">Çevrimiçi mod için giriş yapmalısın.</span>
              <button className="btn primary" onClick={p.onLogin}>Giriş yap / Kayıt ol</button>
            </>
          )}
        </div>
      )}

      {p.mode === "local" && !claude && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Anlatıcı (isteğe bağlı)</h3>
          <div className="row">
            <input
              className="input grow"
              type="password"
              placeholder="Anthropic API anahtarı (sk-ant-…) — boş bırakırsan AI kapalı"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
              aria-label="Anthropic API anahtarı"
            />
            <button className="btn" onClick={() => { setLocalApiKey(apiKey); setSaved(true); }}>{saved ? "Kaydedildi ✓" : "Kaydet"}</button>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Anahtar yalnızca bu tarayıcıda saklanır ve doğrudan Anthropic'e gönderilir. Model: <code>claude-haiku-5-5</code>.
          </div>
        </div>
      )}

      <div className="row" style={{ margin: "18px 0 10px" }}>
        <h2 className="grow" style={{ margin: 0 }}>Kampanyalar</h2>
        {p.mode === "local" && (
          <label className="btn small">
            İçe aktar
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        )}
        <button className="btn primary" onClick={p.onNew}>+ Yeni kampanya</button>
      </div>

      {error && <div className="error">{error}</div>}
      {canList && list === null && !error && <div className="row muted"><div className="spinner" /> Yükleniyor…</div>}
      {list && list.length === 0 && <div className="card muted">Henüz kampanya yok. "Yeni kampanya" ile bir kahraman yarat.</div>}
      <div className="campaigns">
        {(list ?? []).map((c) => (
          <div key={c.id} className="card campaign-row">
            <div className="grow">
              <div style={{ fontFamily: "var(--serif)", color: "var(--gold-2)" }}>{c.title}</div>
              <div className="muted small">
                {c.player ? `${c.player.name} · ${RACES[c.player.raceKey ?? ""]?.name ?? ""} ${classNameIn(c.templateKey, c.player.classKey ?? undefined, CLASSES[c.player.classKey ?? ""]?.name ?? "")} · ${c.player.level}. seviye${c.player.alive ? "" : " · ☠ öldü"}` : ""}
                {" · "}{c.turnCount} tur{c.templateKey && TEMPLATES[c.templateKey] ? ` · ${TEMPLATES[c.templateKey]!.bible.title}` : ""}
              </div>
            </div>
            <button className="btn primary" disabled={busy === c.id} onClick={() => open(c.id)}>{busy === c.id ? "Açılıyor…" : "Devam et"}</button>
            <button className="btn small danger" onClick={() => remove(c)} aria-label="Sil">Sil</button>
          </div>
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 40, textAlign: "center" }}>
        Kurallar System Reference Document 5.1'e dayanır (CC-BY-4.0, Wizards of the Coast). v1.0.0
      </p>
    </div>
  );
}
