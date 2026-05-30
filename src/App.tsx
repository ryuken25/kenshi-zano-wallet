/** App shell: tab nav + per-screen error boundaries (§4). */
import { useState } from "react";
import { StoreProvider, useStore } from "./ui/store";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Toasts, StatusBadge } from "./ui/components";
import { fromAtomic } from "./core/amounts";
import { Unlock } from "./ui/screens/Unlock";
import { Accounts } from "./ui/screens/Accounts";
import { Receive } from "./ui/screens/Receive";
import { Send } from "./ui/screens/Send";
import { MultiSend } from "./ui/screens/MultiSend";
import { Merge } from "./ui/screens/Merge";
import { Seed } from "./ui/screens/Seed";
import { Settings } from "./ui/screens/Settings";
import { AssetRow } from "./ui/components";

type Tab = "assets" | "accounts" | "receive" | "send" | "multisend" | "merge" | "seed" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "assets", label: "Aset" },
  { id: "receive", label: "Terima" },
  { id: "send", label: "Kirim" },
  { id: "multisend", label: "Multi-send" },
  { id: "merge", label: "Merge" },
  { id: "accounts", label: "Akun" },
  { id: "seed", label: "Seed" },
  { id: "settings", label: "Setelan" },
];

function AssetsScreen() {
  const { assets, active, status, refresh } = useStore();
  return (
    <div className="screen">
      <div className="row-between">
        <h2>{active?.label ?? "Aset"}</h2>
        <StatusBadge status={status} />
      </div>
      <button className="btn ghost" onClick={() => refresh()} data-testid="refresh">Segarkan</button>
      <div className="asset-list" data-testid="asset-list">
        {assets.map((a) => <AssetRow key={a.assetId} asset={a} />)}
        {assets.length === 0 && <p className="muted">Belum ada data saldo. Hubungkan node di Setelan.</p>}
      </div>
      {assets[0] && (
        <p className="muted small">
          Saldo {assets[0].ticker}: {fromAtomic(assets[0].unlockedBalance, assets[0].decimalPoint)} (terbuka)
        </p>
      )}
    </div>
  );
}

function Shell() {
  const { unlocked, lock } = useStore();
  const [tab, setTab] = useState<Tab>("assets");

  if (!unlocked) {
    return (
      <ErrorBoundary name="Unlock">
        <Unlock />
        <Toasts />
      </ErrorBoundary>
    );
  }

  const screen = {
    assets: <AssetsScreen />,
    accounts: <Accounts />,
    receive: <Receive />,
    send: <Send />,
    multisend: <MultiSend />,
    merge: <Merge />,
    seed: <Seed />,
    settings: <Settings />,
  }[tab];

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Kenshi</span>
        <button className="btn ghost" onClick={lock} data-testid="lock-btn">Kunci</button>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {/* Each screen is independently recoverable (§4). */}
        <ErrorBoundary name={tab}>{screen}</ErrorBoundary>
      </main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary name="App">
        <Shell />
      </ErrorBoundary>
    </StoreProvider>
  );
}
