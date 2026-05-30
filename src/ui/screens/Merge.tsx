/**
 * Merge / consolidation (§2.3 + "merge all assets").
 *
 * Pick a target + source wallets, then either consolidate ONE chosen asset or
 * ALL assets (Zano + every Confidential Asset like FUSD) in one signed tx per
 * wallet. This is a MOVE, not a swap — each token is sent as itself to the target.
 * Builds a per-wallet breakdown, excludes under-funded wallets with a clear
 * message, and signs each wallet's tx sequentially so one failure never blocks
 * the others.
 */
import { useState } from "react";
import { useStore } from "../store";
import { CoinSelector, Field } from "../components";
import { fromAtomic } from "../../core/amounts";
import {
  buildMergePlan,
  buildMergeAllPlan,
  type MergeSourceState,
  type MergeSourceFull,
  type MergeExclusion,
} from "../../core/merge";
import { DEFAULT_FEE_ATOMIC, DEV_TIP_ATOMIC, ZANO_ASSET_ID } from "../../core/constants";
import type { Asset, TransferPlan } from "../../core/types";

/** Normalized preview row covering both single-asset and all-assets modes. */
interface Row {
  accountId: string;
  label: string;
  plan: TransferPlan;
  moved: { ticker: string; amount: bigint; decimalPoint: number }[];
}

export function Merge() {
  const { accounts, assets, wallet, setActive, refresh, toast } = useStore();
  const [targetId, setTargetId] = useState(accounts[0]?.id ?? "");
  const [assetId, setAssetId] = useState(ZANO_ASSET_ID);
  const [allAssets, setAllAssets] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [excluded, setExcluded] = useState<MergeExclusion[]>([]);
  const [busy, setBusy] = useState(false);

  const target = accounts.find((a) => a.id === targetId);
  const assetOf = (id: string) => assets.find((a: Asset) => a.assetId === id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  /**
   * Build a preview. NOTE: per-wallet balances require querying each wallet's RPC.
   * In this build the wallet-RPC is single-active-wallet, so the preview uses the
   * currently-loaded `assets` as the per-source figure; a multi-wallet daemon
   * connection would query each source. The planning math is exact either way.
   */
  const preview = () => {
    if (!target) {
      toast("Pilih target dulu.", "err");
      return;
    }
    const sourceAccts = accounts.filter((a) => selected.has(a.id));
    if (sourceAccts.length === 0) {
      toast("Pilih minimal satu wallet sumber.", "err");
      return;
    }

    if (allAssets) {
      // Consolidate every asset the wallet holds.
      const sources: MergeSourceFull[] = sourceAccts.map((a) => ({
        accountId: a.id,
        label: a.label,
        assets: assets.map((as) => ({
          assetId: as.assetId,
          ticker: as.ticker,
          decimalPoint: as.decimalPoint,
          unlocked: as.unlockedBalance,
        })),
      }));
      const p = buildMergeAllPlan({
        targetAccountId: targetId,
        targetAddress: target.primaryAddress,
        fee: DEFAULT_FEE_ATOMIC,
        sources,
      });
      setRows(
        p.participants.map((x) => ({
          accountId: x.accountId,
          label: x.label,
          plan: x.plan,
          moved: x.moved.map((m) => ({ ticker: m.ticker, amount: m.amount, decimalPoint: m.decimalPoint })),
        })),
      );
      setExcluded(p.excluded);
      for (const ex of p.excluded) toast(ex.reason, "err");
      return;
    }

    // Single chosen asset.
    const chosen = assetOf(assetId);
    const nativeUnlocked = assetOf(ZANO_ASSET_ID)?.unlockedBalance ?? 0n;
    const sources: MergeSourceState[] = sourceAccts.map((a) => ({
      accountId: a.id,
      label: a.label,
      unlockedAsset: chosen?.unlockedBalance ?? 0n,
      unlockedNativeZano: nativeUnlocked,
    }));
    const p = buildMergePlan({
      targetAccountId: targetId,
      targetAddress: target.primaryAddress,
      assetId,
      fee: DEFAULT_FEE_ATOMIC,
      sources,
    });
    setRows(
      p.participants.map((x) => ({
        accountId: x.accountId,
        label: x.label,
        plan: x.plan,
        moved: [
          { ticker: chosen?.ticker ?? "?", amount: x.movedAmount, decimalPoint: chosen?.decimalPoint ?? 12 },
        ],
      })),
    );
    setExcluded(p.excluded);
    for (const ex of p.excluded) toast(ex.reason, "err");
  };

  const execute = async () => {
    if (!rows || rows.length === 0) return;
    if (!confirm(`Jalankan merge ${rows.length} wallet ke ${target?.label}?`)) return;
    setBusy(true);
    let okCount = 0;
    // Sequential: one failure must not block/corrupt the others (§2.3).
    for (const r of rows) {
      try {
        await setActive(r.accountId); // point wallet RPC at this source
        await wallet.sendTransfer(r.plan); // one signed tx per wallet (all its assets)
        okCount++;
        toast(`${r.label}: terkirim`);
      } catch (e) {
        toast(`${r.label}: gagal — ${(e as Error).message}`, "err");
      }
    }
    setBusy(false);
    toast(`Merge selesai: ${okCount}/${rows.length} berhasil.`);
    await refresh();
    setRows(null);
    setExcluded([]);
  };

  return (
    <div className="screen">
      <h2>Merge / Konsolidasi</h2>
      <p className="muted small">Memindahkan token ke 1 akun — bukan swap. Tiap token tetap jenisnya.</p>
      <div className="card">
        <Field label="Target (tujuan)">
          <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)} data-testid="merge-target">
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
          </select>
        </Field>

        <label className="tip-row" data-testid="merge-all-row">
          <input type="checkbox" checked={allAssets} onChange={(e) => setAllAssets(e.target.checked)} data-testid="merge-all-checkbox" />
          <span>
            <strong>Gabungkan semua aset</strong>
            <br />
            <span className="muted small">Pindahkan Zano + semua Confidential Asset sekaligus (1 transaksi per wallet).</span>
          </span>
        </label>

        {!allAssets && (
          <Field label="Aset">
            <CoinSelector assets={assets} value={assetId} onChange={setAssetId} />
          </Field>
        )}

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

      {rows && (
        <div className="card" data-testid="merge-preview">
          <h3>Ringkasan per-wallet</h3>
          <table className="breakdown">
            <thead>
              <tr><th>Wallet</th><th>Dipindah</th><th>Fee</th><th>Tip</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId}>
                  <td>{r.label}</td>
                  <td>
                    {r.moved.map((m, i) => (
                      <div key={i}>{fromAtomic(m.amount, m.decimalPoint)} {m.ticker}</div>
                    ))}
                  </td>
                  <td>{fromAtomic(DEFAULT_FEE_ATOMIC, 12)}</td>
                  <td>{fromAtomic(DEV_TIP_ATOMIC, 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {excluded.length > 0 && (
            <div className="excluded" data-testid="merge-excluded">
              <h4>Dilewati</h4>
              <ul>{excluded.map((e) => <li key={e.accountId} className="error-text">{e.reason}</li>)}</ul>
            </div>
          )}
          {rows.length > 0 && (
            <button className="btn primary" onClick={execute} disabled={busy} data-testid="merge-execute">
              {busy ? "Memproses…" : "Jalankan merge"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
