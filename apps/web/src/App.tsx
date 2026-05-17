import { useEffect, useState } from "react";
import { useWorldSocket } from "./net/useWorldSocket.js";
import { useWorld } from "./store/worldStore.js";
import { Scene } from "./three/Scene.js";
import { HUD } from "./ui/HUD.js";
import { CameraSwitcher } from "./ui/CameraSwitcher.js";
import { PillInspector } from "./ui/PillInspector.js";
import { Sidebar } from "./ui/Sidebar.js";
import { TokenPanel } from "./ui/TokenPanel.js";
import { Landing } from "./ui/Landing.js";
import { DialogueStrip } from "./ui/DialogueStrip.js";
import { Replay } from "./ui/Replay.js";
import { TopNav, type NavTab } from "./ui/TopNav.js";
import { Blogs } from "./ui/Blogs.js";
import { Characters } from "./ui/Characters.js";
import { type DocsRouteKey, PublicDocs, publicDocsRouteFromHash } from "./ui/docs/PublicDocs.js";

type Route = "landing" | "world" | "replay" | DocsRouteKey;

function readRoute(): Route {
  if (typeof window === "undefined") return "landing";
  const hash = window.location.hash.replace(/^#/, "").split("?")[0]!;
  if (hash === "world") return "world";
  if (hash === "replay") return "replay";
  if (hash === "docs" || hash.startsWith("docs/")) return publicDocsRouteFromHash(hash);
  return "landing";
}

export function App() {
  const [route, setRoute] = useState<Route>(() => readRoute());

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const goto = (r: Route | "landing") => {
    if (r === "landing") window.location.hash = "";
    else window.location.hash = r;
    setRoute(readRoute());
  };

  if (route === "landing") return <Landing onEnter={() => goto("world")} onReplay={() => goto("replay")} />;
  if (route === "replay") return <Replay onBack={() => goto("landing")} />;
  if (route === "docs" || route.startsWith("docs/")) {
    return <PublicDocs route={route as DocsRouteKey} onBack={() => goto("landing")} />;
  }
  return <WorldView onBack={() => goto("landing")} onReplay={() => goto("replay")} />;
}

function WorldView({ onBack, onReplay }: { onBack: () => void; onReplay: () => void }) {
  useWorldSocket();
  const [tab, setTab] = useState<NavTab>("live");
  const setCamera = useWorld(s => s.setCamera);
  const selectPill = useWorld(s => s.selectPill);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Scene />
      <TopNav
        active={tab}
        onChange={setTab}
        onAbout={onBack}
        onReplays={onReplay}
      />
      <TokenPanel />
      <HUD />
      <Sidebar />
      <PillInspector />
      <DialogueStrip />
      <CameraSwitcher />

      {tab === "blogs" && (
        <Blogs onClose={() => setTab("live")} />
      )}
      {tab === "characters" && (
        <Characters
          onClose={() => setTab("live")}
          onOpenBlogs={() => setTab("blogs")}
          onFollow={(pid) => { selectPill(pid); setCamera("follow", pid); }}
        />
      )}
    </div>
  );
}
