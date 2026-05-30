/**
 * Seed reveal (§1.1 seed auto-hide, §1.8b async race fix).
 *
 * The async-render race Pearl hit was: the seed UI rendered before the decrypted
 * value resolved, briefly showing a stale/empty box or flashing. Fix: we keep an
 * explicit `ready` gate and only render the seed block once the decryption promise
 * has resolved. Seed is hidden by default and re-hidden on unmount.
 */
import { useState } from "react";
import { useStore } from "../store";
import * as session from "../../core/session";

export function Seed() {
  const { active, accountStore, toast } = useStore();
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async () => {
    if (!active) return;
    setBusy(true);
    setReady(false); // gate closed until the promise resolves (§1.8b)
    try {
      const pw = session.requirePassword();
      const s = await accountStore.revealSeed(active.id, pw);
      setSeed(s);
      setReady(true); // only now is it safe to render the seed
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const hide = () => {
    setSeed(null);
    setReady(false);
  };

  if (!active) return <div className="screen"><p className="muted">Pilih akun dulu.</p></div>;

  return (
    <div className="screen">
      <h2>Seed phrase</h2>
      <div className="card">
        <p className="muted">Jangan pernah bagikan seed Anda. Disimpan terenkripsi (PBKDF2 + AES-GCM).</p>
        {!ready && (
          <button className="btn" onClick={reveal} disabled={busy} data-testid="reveal-seed">
            {busy ? "Membuka…" : "Tampilkan seed"}
          </button>
        )}
        {ready && seed && (
          <>
            <code className="address-block mono" data-testid="seed-text">{seed}</code>
            <button className="btn ghost" onClick={hide} data-testid="hide-seed">Sembunyikan</button>
          </>
        )}
      </div>
    </div>
  );
}
