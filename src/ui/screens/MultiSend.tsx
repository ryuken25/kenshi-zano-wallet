/**
 * Multi-send (§1.6, §2.2): one signed tx → many outputs, explicit "From wallet"
 * selector, mixable assets, dev tip shown transparently in the confirmation.
 */
import { useState } from "react";
import { useStore } from "../store";
import { CoinSelector, Field } from "../components";
import { toAtomic, fromAtomic, AmountError } from "../../core/amounts";
import { buildTransfer, preflight } from "../../core/txbuilder";
import { validateDestinations } from "../../core/validation";
import type { Destination } from "../../core/types";
import {
  DEV_TIP_ADDRESS,
  DEV_TIP_ZANO,
  DEFAULT_FEE_ATOMIC,
  DEFAULT_FEE_ZANO,
  ZANO_ASSET_ID,
} from "../../core/constants";

interface Row {
  address: string;
  amount: string;
  assetId: string;
}

export function MultiSend() {
  const { accounts, activeId, assets, wallet, setActive, refresh, toast } = useStore();
  const [fromId, setFromId] = useState<string>(activeId ?? accounts[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([{ address: "", amount: "", assetId: ZANO_ASSET_ID }]);
  const [tip, setTip] = useState(true);
  const [busy, setBusy] = useState(false);

  const from = accounts.find((a) => a.id === fromId);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { address: "", amount: "", assetId: ZANO_ASSET_ID }]);
  const delRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const buildDestinations = (): Destination[] => {
    return rows.map((r) => {
      const asset = assets.find((a) => a.assetId === r.assetId);
      const decimals = asset?.decimalPoint ?? 12;
      return { address: r.address.trim(), amount: toAtomic(r.amount || "0", decimals), assetId: r.assetId };
    });
  };

  const submit = async () => {
    if (!from) {
      toast("Pilih wallet sumber dulu.", "err");
      return;
    }
    // Ensure RPC talks to the chosen source wallet.
    if (fromId !== activeId) await setActive(fromId);

    let dests: Destination[];
    try {
      dests = buildDestinations();
    } catch (e) {
      toast(e instanceof AmountError ? e.message : String(e), "err");
      return;
    }
    const v = validateDestinations(dests, from.primaryAddress);
    if (!v.ok) {
      toast(v.errors[0], "err");
      return;
    }
    const plan = buildTransfer({
      fromAccountId: from.id,
      destinations: dests,
      fee: DEFAULT_FEE_ATOMIC,
      includeDevTip: tip,
    });
    const unlockedByAsset: Record<string, bigint> = {};
    for (const a of assets) unlockedByAsset[a.assetId] = a.unlockedBalance;
    const pf = preflight(plan, unlockedByAsset);
    if (!pf.ok) {
      toast(pf.errors[0], "err");
      return;
    }

    // Confirmation summary listing every output incl. dev tip (§1.6, §3).
    const lines = plan.destinations.map((d, i) => {
      const asset = assets.find((a) => a.assetId === d.assetId);
      const dec = asset?.decimalPoint ?? 12;
      const isTip = d.address === DEV_TIP_ADDRESS && plan.includesDevTip && i === plan.destinations.length - 1;
      return `${isTip ? "TIP DEV → " : `#${i + 1} → `}${d.address.slice(0, 14)}…  ${fromAtomic(d.amount, dec)} ${asset?.ticker ?? "?"}`;
    });
    if (!confirm(`Dari: ${from.label}\n\n${lines.join("\n")}\n\nFee: ${DEFAULT_FEE_ZANO} ZANO\nTanda tangani 1 transaksi?`)) {
      return;
    }
    setBusy(true);
    try {
      const hash = await wallet.sendTransfer(plan);
      toast(`Multi-send terkirim: ${hash.slice(0, 12)}…`);
      setRows([{ address: "", amount: "", assetId: ZANO_ASSET_ID }]);
      await refresh();
    } catch (e) {
      toast(`Gagal: ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <h2>Multi-send</h2>
      <div className="card">
        <Field label="Dari wallet (sumber)">
          <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)} data-testid="from-wallet">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </Field>

        {rows.map((r, i) => (
          <div className="multisend-row" key={i} data-testid={`ms-row-${i}`}>
            <input className="input mono" placeholder="Z…" value={r.address} onChange={(e) => setRow(i, { address: e.target.value })} />
            <input className="input" placeholder="0.0" inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
            <CoinSelector assets={assets} value={r.assetId} onChange={(assetId) => setRow(i, { assetId })} />
            {rows.length > 1 && (
              <button className="btn ghost danger" onClick={() => delRow(i)} aria-label="hapus baris">×</button>
            )}
          </div>
        ))}
        <button className="btn ghost" onClick={addRow} data-testid="add-row">+ Tambah penerima</button>

        <label className="tip-row">
          <input type="checkbox" checked={tip} onChange={(e) => setTip(e.target.checked)} data-testid="ms-tip-checkbox" />
          <span>
            Tip developer <strong>{DEV_TIP_ZANO} ZANO</strong>
            <br />
            <span className="muted small mono">{DEV_TIP_ADDRESS}</span>
          </span>
        </label>

        <button className="btn primary" onClick={submit} disabled={busy} data-testid="multisend-btn">
          {busy ? "Menandatangani…" : "Tinjau & kirim"}
        </button>
      </div>
    </div>
  );
}
