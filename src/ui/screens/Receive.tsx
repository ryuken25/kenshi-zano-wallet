/** Receive: single primary address + QR + copy. NO sub-address generation (§1.3). */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useStore } from "../store";

export function Receive() {
  const { active, toast } = useStore();
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (active?.primaryAddress) {
      QRCode.toDataURL(active.primaryAddress, { margin: 1, width: 240 })
        .then((url) => {
          if (!cancelled) setQr(url);
        })
        .catch(() => {
          /* error boundary / no-op; QR is non-critical */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [active?.primaryAddress]);

  if (!active) return <div className="screen"><p className="muted">Pilih akun dulu.</p></div>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.primaryAddress);
      toast("Alamat disalin.");
    } catch {
      toast("Tidak bisa menyalin.", "err");
    }
  };

  return (
    <div className="screen center">
      <h2>Terima</h2>
      <p className="muted">Alamat utama akun ini (satu-satunya alamat terima).</p>
      <div className="card receive-card">
        {qr && <img src={qr} alt="QR alamat" className="qr" data-testid="receive-qr" />}
        <code className="address-block mono" data-testid="receive-address">{active.primaryAddress}</code>
        <button className="btn" onClick={copy} data-testid="copy-address">Salin alamat</button>
      </div>
    </div>
  );
}
