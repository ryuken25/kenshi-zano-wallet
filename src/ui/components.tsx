/** Small shared presentational components. */
import type { ConnStatus, Asset } from "../core/types";
import { fromAtomic } from "../core/amounts";
import { useStore } from "./store";

export function StatusBadge({ status }: { status: ConnStatus }) {
  const label = { connected: "Terhubung", syncing: "Sinkronisasi", offline: "Offline" }[status];
  return <span className={`badge badge-${status}`} data-testid="conn-status">{label}</span>;
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

export function AssetRow({
  asset,
  selected,
  onClick,
}: {
  asset: Asset;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`asset-row${selected ? " selected" : ""}`}
      onClick={onClick}
      data-asset={asset.ticker}
    >
      <span className="asset-ticker">{asset.ticker}</span>
      <span className="asset-name muted">{asset.name}</span>
      <span className="asset-balance">{fromAtomic(asset.unlockedBalance, asset.decimalPoint)}</span>
    </button>
  );
}

/** Generic coin selector — works for any asset_id (§2.1). */
export function CoinSelector({
  assets,
  value,
  onChange,
}: {
  assets: Asset[];
  value: string;
  onChange: (assetId: string) => void;
}) {
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="coin-selector"
    >
      {assets.map((a) => (
        <option key={a.assetId} value={a.assetId}>
          {a.ticker} — {fromAtomic(a.unlockedBalance, a.decimalPoint)}
        </option>
      ))}
    </select>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
