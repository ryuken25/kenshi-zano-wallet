/** Multi-account: import / switch / remove (§1.5). */
import { useState } from "react";
import { useStore } from "../store";
import { Field } from "../components";
import * as session from "../../core/session";
import { isValidAddress } from "../../core/validation";

export function Accounts() {
  const { accounts, activeId, setActive, accountStore, reloadAccounts, refresh, toast } = useStore();
  const [label, setLabel] = useState("");
  const [seed, setSeed] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const importAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress(address)) {
      toast("Alamat utama tidak valid.", "err");
      return;
    }
    if (seed.trim().split(/\s+/).length < 12) {
      toast("Seed phrase terlalu pendek.", "err");
      return;
    }
    setBusy(true);
    try {
      const pw = session.requirePassword(); // in-memory only
      await accountStore.importAccount({
        label: label || `Akun ${accounts.length + 1}`,
        seed: seed.trim(),
        primaryAddress: address.trim(),
        password: pw,
      });
      // Wipe sensitive inputs immediately (§5).
      setSeed("");
      setLabel("");
      setAddress("");
      await reloadAccounts();
      await refresh();
      toast("Akun ditambahkan.");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus akun ini dari perangkat? Seed terenkripsi akan dihapus.")) return;
    await accountStore.removeAccount(id);
    await reloadAccounts();
    await refresh();
    toast("Akun dihapus.");
  };

  return (
    <div className="screen">
      <h2>Akun</h2>
      <ul className="account-list">
        {accounts.map((a) => (
          <li key={a.id} className={`account-item${a.id === activeId ? " active" : ""}`}>
            <button className="account-pick" onClick={() => setActive(a.id)} data-testid={`switch-${a.label}`}>
              <strong>{a.label}</strong>
              <span className="muted small mono">{a.primaryAddress.slice(0, 14)}…</span>
            </button>
            {a.id === activeId && <span className="tag">aktif</span>}
            <button className="btn ghost danger" onClick={() => remove(a.id)} aria-label="hapus">
              Hapus
            </button>
          </li>
        ))}
        {accounts.length === 0 && <li className="muted">Belum ada akun.</li>}
      </ul>

      <form className="card" onSubmit={importAccount}>
        <h3>Impor akun</h3>
        <Field label="Nama">
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Akun Utama" />
        </Field>
        <Field label="Alamat utama (primary address)">
          <input
            className="input mono"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Z…"
            data-testid="import-address"
          />
        </Field>
        <Field label="Seed phrase (disimpan terenkripsi)">
          <textarea
            className="input"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            rows={3}
            placeholder="kata1 kata2 …"
            data-testid="import-seed"
          />
        </Field>
        <button className="btn primary" type="submit" disabled={busy} data-testid="import-btn">
          {busy ? "Mengenkripsi…" : "Impor"}
        </button>
      </form>
    </div>
  );
}
