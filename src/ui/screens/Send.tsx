/**
 * Single send + transparent tip (§1.4, §3).
 * The tip line shows the dev address and is checked by default; the "amount + tip +
 * fee <= unlocked" check runs in integer base units and is shown to the user.
 */
import { useMemo, useState } from "react";
import { useStore } from "../store";
import { CoinSelector, Field } from "../components";
import { toAtomic, fromAtomic, AmountError } from "../../core/amounts";
import { buildSingleSend, preflight } from "../../core/txbuilder";
import { validateDestinations } from "../../core/validation";
import {
  DEV_TIP_ADDRESS,
  DEV_TIP_ZANO,
  DEFAULT_FEE_ATOMIC,
  DEFAULT_FEE_ZANO,
  ZANO_ASSET_ID,
  ZANO_DECIMALS,
} from "../../core/constants";

export function Send() {
  const { active, assets, wallet, refresh, toast } = useStore();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [assetId, setAssetId] = useState(ZANO_ASSET_ID);
  const [tip, setTip] = useState(true);
  const [busy, setBusy] = useState(false);

  const asset = assets.find((a) => a.assetId === assetId) ?? assets[0];
  const nativeUnlocked = assets.find((a) => a.assetId === ZANO_ASSET_ID)?.unlockedBalance ?? 0n;

  // Live, integer base-unit total preview (§1.4 math rigor).
  const preview = useMemo(() => {
    if (!asset) return null;
    try {
      const amt = amount ? toAtomic(amount, asset.decimalPoint) : 0n;
      const tipAtomic = tip ? toAtomic(DEV_TIP_ZANO, ZANO_DECIMALS) : 0n;
      const fee = DEFAULT_FEE_ATOMIC;
      // If sending native, total native = amt + tip + fee; else native side = tip + fee.
      const nativeSide = (assetId === ZANO_ASSET_ID ? amt : 0n) + tipAtomic + fee;
      const okNative = nativeUnlocked >= nativeSide;
      const okAsset = assetId === ZANO_ASSET_ID ? okNative : asset.unlockedBalance >= amt;
      return {
        amt,
        tipAtomic,
        fee,
        nativeSide,
        ok: okNative && okAsset && amt > 0n,
        line: `${fromAtomic(amt, asset.decimalPoint)} ${asset.ticker} + ${
          tip ? DEV_TIP_ZANO : "0"
        } tip + ${DEFAULT_FEE_ZANO} fee`,
      };
    } catch (e) {
      return { error: e instanceof AmountError ? e.message : String(e) } as const;
    }
  }, [amount, asset, assetId, tip, nativeUnlocked]);

  const send = async () => {
    if (!active || !asset) return;
    let amt: bigint;
    try {
      amt = toAtomic(amount, asset.decimalPoint);
    } catch (e) {
      toast((e as Error).message, "err");
      return;
    }
    const v = validateDestinations(
      [{ address: to.trim(), amount: amt, assetId }],
      active.primaryAddress,
    );
    if (!v.ok) {
      toast(v.errors[0], "err");
      return;
    }
    const plan = buildSingleSend({
      fromAccountId: active.id,
      to: to.trim(),
      amount: amt,
      assetId,
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
    if (!confirm(`Kirim ${amount} ${asset.ticker} ke ${to.slice(0, 12)}…?${tip ? "\n+ tip dev 0.01 ZANO" : ""}`)) {
      return;
    }
    setBusy(true);
    try {
      const hash = await wallet.sendTransfer(plan);
      toast(`Terkirim: ${hash.slice(0, 12)}…`);
      setTo("");
      setAmount("");
      await refresh();
    } catch (e) {
      toast(`Gagal kirim: ${(e as Error).message}`, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!active) return <div className="screen"><p className="muted">Pilih akun dulu.</p></div>;

  return (
    <div className="screen">
      <h2>Kirim</h2>
      <div className="card">
        <Field label="Aset">
          <CoinSelector assets={assets} value={assetId} onChange={setAssetId} />
        </Field>
        <Field label="Alamat tujuan">
          <input className="input mono" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Z…" data-testid="send-to" />
        </Field>
        <Field label="Jumlah">
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal" data-testid="send-amount" />
        </Field>

        <label className="tip-row" data-testid="tip-row">
          <input type="checkbox" checked={tip} onChange={(e) => setTip(e.target.checked)} data-testid="tip-checkbox" />
          <span>
            Tip developer <strong>{DEV_TIP_ZANO} ZANO</strong>
            <br />
            <span className="muted small mono">{DEV_TIP_ADDRESS}</span>
          </span>
        </label>

        {preview && "error" in preview && <p className="error-text">{preview.error}</p>}
        {preview && !("error" in preview) && (
          <div className={`preview ${preview.ok ? "ok" : "warn"}`} data-testid="send-preview">
            <code>{preview.line}</code>
            {!preview.ok && <span className="error-text"> — melebihi saldo</span>}
          </div>
        )}

        <button className="btn primary" onClick={send} disabled={busy || !preview || "error" in (preview ?? {}) || !preview?.ok} data-testid="send-btn">
          {busy ? "Mengirim…" : "Kirim"}
        </button>
      </div>
    </div>
  );
}
