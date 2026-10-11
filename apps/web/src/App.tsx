import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LocalBackend } from "./backend/local.ts";
import { OnlineBackend, supabase } from "./backend/online.ts";
import type { Backend, CampaignData } from "./backend/types.ts";
import { Home } from "./screens/Home.tsx";
import { Auth } from "./screens/Auth.tsx";
import { Create } from "./screens/Create.tsx";
import { Game } from "./screens/Game.tsx";

export type Mode = "local" | "online";
type Screen =
  | { name: "home" }
  | { name: "auth" }
  | { name: "create" }
  | { name: "game"; initial: CampaignData };

function readMode(): Mode {
  try {
    return (localStorage.getItem("kz:mode") as Mode) || "local";
  } catch {
    return "local";
  }
}

export function App() {
  const [mode, setModeState] = useState<Mode>(readMode);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const online = !!supabase();

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const backend: Backend = useMemo(() => (mode === "online" ? new OnlineBackend() : new LocalBackend()), [mode, session?.user.id]);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem("kz:mode", m);
    } catch {
      // yok say
    }
  };

  const needsAuth = mode === "online" && !session;

  if (screen.name === "auth" || (needsAuth && screen.name !== "home")) {
    return <Auth onDone={() => setScreen({ name: "home" })} onBack={() => { setMode("local"); setScreen({ name: "home" }); }} />;
  }
  if (screen.name === "create") {
    return <Create backend={backend} onCancel={() => setScreen({ name: "home" })} onCreated={(c) => setScreen({ name: "game", initial: c })} />;
  }
  if (screen.name === "game") {
    return <Game backend={backend} initial={screen.initial} onExit={() => setScreen({ name: "home" })} />;
  }
  return (
    <Home
      backend={backend}
      mode={mode}
      onlineAvailable={online}
      session={session}
      setMode={setMode}
      onLogin={() => setScreen({ name: "auth" })}
      onLogout={async () => { await supabase()?.auth.signOut(); }}
      onNew={() => (needsAuth ? setScreen({ name: "auth" }) : setScreen({ name: "create" }))}
      onOpen={(c) => setScreen({ name: "game", initial: c })}
    />
  );
}
