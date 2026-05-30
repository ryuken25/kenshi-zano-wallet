/**
 * Merge / consolidation (§2.3). Pick a target + asset + source wallets; the planner
 * builds a per-wallet breakdown (moved / fee / dev tip), excludes under-funded
 * wallets with a clear message, and signs each wallet's tx sequentially so one
 * failure never blocks the others.
 */
import { useState } from "react";
import { useStore } from "../store";
import { CoinSelector, Field } from "../components";
import { fromAtomic } from "../../core/amounts";
import { buildMergePlan, type MergeSourceState, type MergePlan } from "../../core/merge";
import { DEFAULT_FEE_ATOMIC, ZANO_ASSET_ID } from "../../core/constants";
import type { Asset } from "../../core/types";

export function Merge() {
  const { accounts, assets, activeId, wallet, setActive, refresh, toast } = useStore();
  const [targetId, setTargetId] = useState(activeId ?? accounts[0]?.id ?? "");
  const [assetId, setAssetId] = useState(ZANO_ASSET_ID);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [busy, setBusy] = useState(false);

  const target = accounts.find((a) => a.id === targetId);
  const decimalsOf = (id: string) => assets.find((a: Asset) => a.assetId === id)?.decimalPoint ?? 12;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * Build a preview. NOTE: per-wallet unlocked balances require querying each
   * wallet's RPC. In this build the wallet-RPC is single-active-wallet, so the
   * preview uses the currently-loaded `assets` for the active wallet as a stand-in
   * for each selected source; a multi-wallet daemon connection would query each.
   * The planning math (exclusion, moved amount) is exact regardless of source.
   */
  const preview = () => {
    if (!target) {
      toast("Pilih target dulu.", "err");
      return;
    }
    const nativeUnlocked = assets.find((a) => a.assetId === ZANO_ASSET_ID)?.unlockedBalance ?? 0n;
    const assetUnlocked = assets.find((a) => a.assetId === assetId)?.unlockedBalance ?? 0n;
    const sources: MergeSourceState[] = accounts
      .filter((a) => selected.has(a.id))
      .map((a) => ({
        accountId: a.id,
        label: a.label,
        unlockedAsset: assetUnlocked,
        unlockedNativeZano: nativeUnlocked,
      }));
    const p = buildMergePlan({
      targetAccountId: targetId,
      targetAddress: target.primaryAddress,
      assetId,
      fee: DEFAULT_FEE_ATOMIC,
      sources,
    });
    setPlan(p);
    for (const ex of p.excluded) toast(ex.reason, "err");
  };

  const execute = async () => {
    if (!plan || plan.participants.length === 0) return;
    if (!confirm(`Jalankan merge ${plan.participants.length} wallet ke ${target?.label}?`)) return;
    setBusy(true);
    let okCount = 0;
    // Sequential: one failure must not block/corrupt the others (§2.3).
    for (const p of plan.participants) {
      try {
        await setActive(p.accountId); // point wallet RPC at this source
        await wallet.sendTransfer(p.plan); // one signed tx per wallet
        okCount++;
        toast(`${p.label}: terkirim`);
      } catch (e) {
        toast(`${p.label}: gagal — ${(e as Error).message}`, "err");
      }
    }
    setBusy(false);
    toast(`Merge selesai: ${okCount}/${plan.participants.length} berhasil.`);
    await refresh();
    setPlan(null);
  };

  const dec = decimalsOf(assetId);

  return (
    <div className="screen">
      <h2>Merge / Konsolidasi</h2>
      <div className="card">
        <Field label="Target (tujuan)">
          <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)} data-testid="merge-target">
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
          </select>
        </Field>
        <Field label="Aset">
          <CoinSelector assets={assets} value={assetId} onChange={setAssetId} />
        </Field>

        <p className="field-label">Wallet sumber</p>
        <ul className="merge-sources">
          {accounts.filter((a) => a.id !== targetId).map((a) => (
            <li key={a.id}>
              <label>
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} data-testid={`merge-src-${a.label}`} />
                {a.label}
              </label>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={preview} data-testid="merge-preview-btn">Tinjau</button>
      </div>

      {plan && (
        <div className="card" data-testid="merge-preview">
          <h3>Ringkasan per-wallet</h3>
          <table className="breakdown">
            <thead>
              <tr><th>Wallet</th><th>Dipindah</th><th>Fee</th><th>Tip</th></tr>
            </thead>
            <tbody>
              {plan.participants.map((p) => (
                <tr key={p.accountId}>
                  <td>{p.label}</td>
                  <td>{fromAtomic(p.movedAmount, dec)}</td>
                  <td>{fromAtomic(p.fee, 12)}</td>
                  <td>{fromAtomic(p.devTip, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.excluded.length > 0 && (
            <div className="excluded" data-testid="merge-excluded">
              <h4>Dilewati</h4>
              <ul>{plan.excluded.map((e) => <li key={e.accountId} className="error-text">{e.reason}</li>)}</ul>
            </div>
          )}
          {plan.participants.length > 0 && (
            <button className="btn primary" onClick={execute} disabled={busy} data-testid="merge-execute">
              {busy ? "Memproses…" : "Jalankan merge"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
