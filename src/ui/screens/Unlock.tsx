/** Unlock / first-run screen (§1.1, §1.5). Password never logged. */
import { useState } from "react";
import { useStore } from "../store";

export function Unlock() {
  const { unlock, accounts } = useStore();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    try {
      await unlock(pw);
    } finally {
      setBusy(false);
      setPw(""); // never keep the password in component state longer than needed
    }
  };

  const firstRun = accounts.length === 0;

  return (
    <div className="screen center">
      <div className="card unlock-card">
        <img src="/icons/icon-192.png" alt="Kenshi" className="logo" width={72} height={72} />
        <h1>Kenshi</h1>
        <p className="muted">Dompet Zano yang stabil &amp; multi-aset</p>
        <form onSubmit={submit}>
          <input
            className="input"
            type="password"
            placeholder={firstRun ? "Buat password" : "Password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            data-testid="password-input"
          />
          <button className="btn primary" type="submit" disabled={busy || !pw} data-testid="unlock-btn">
            {busy ? "Membuka…" : firstRun ? "Mulai" : "Buka"}
          </button>
        </form>
        {firstRun && (
          <p className="muted small">
            Belum ada akun. Buat password lalu impor seed di tab Akun.
          </p>
        )}
      </div>
    </div>
  );
}
