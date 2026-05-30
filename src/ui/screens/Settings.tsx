/** Settings: node list (§2.4) + change password (§1.5). */
import { useState } from "react";
import { useStore } from "../store";
import { Field, StatusBadge } from "../components";
import * as session from "../../core/session";

export function Settings() {
  const { nodes, setNodes, status, accountStore, refresh, toast } = useStore();
  const [draft, setDraft] = useState(nodes.join("\n"));
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const saveNodes = () => {
    const list = draft.split("\n").map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) {
      toast("Minimal satu node.", "err");
      return;
    }
    setNodes(list);
    toast("Daftar node disimpan.");
    refresh();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPw) return;
    try {
      await accountStore.changePassword(oldPw, newPw);
      session.unlock(newPw); // refresh in-memory password
      setOldPw("");
      setNewPw("");
      toast("Password diganti & semua akun dienkripsi ulang.");
    } catch (err) {
      toast((err as Error).message, "err");
    }
  };

  return (
    <div className="screen">
      <h2>Pengaturan</h2>

      <div className="card">
        <div className="row-between">
          <h3>Node Zano</h3>
          <StatusBadge status={status} />
        </div>
        <p className="muted small">
          Satu URL per baris. Dicoba berurutan saat timeout (fallback). Tempel node
          Anda sendiri agar lebih cepat. Untuk privasi penuh, jalankan zanod lokal
          (versi EXE).
        </p>
        <textarea className="input mono" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} data-testid="nodes-input" />
        <button className="btn" onClick={saveNodes} data-testid="save-nodes">Simpan node</button>
      </div>

      <form className="card" onSubmit={changePassword}>
        <h3>Ganti password</h3>
        <Field label="Password lama">
          <input className="input" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </Field>
        <Field label="Password baru">
          <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        </Field>
        <button className="btn" type="submit">Ganti & enkripsi ulang</button>
      </form>
    </div>
  );
}
