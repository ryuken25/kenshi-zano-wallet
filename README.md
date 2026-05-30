# Kenshi — Dompet Zano

Kenshi adalah dompet **Zano** yang dibuat untuk **stabil** (anti-crash, anti-bug),
**multi-aset**, dan punya fitur **multi-send** serta **merge / konsolidasi**. UI-nya
meniru alur "Pearl Wallet", tetapi seluruh operasi uang memakai RPC asli Zano.

> Semua nominal dihitung dalam **satuan terkecil (atomic units) memakai integer**,
> bukan float. Setiap aset memakai `decimalPoint`-nya sendiri — Zano native = 12
> desimal, **Confidential Asset di blockchain Zano** ikut otomatis tanpa ubah kode.

---

## ✨ Fitur

- 🔐 Keamanan: keystore terenkripsi **PBKDF2 + AES-GCM**, **auto-lock** saat idle &
  saat reload penuh, seed disembunyikan secara default, **CSP** + **allowlist RPC**.
- 👛 Multi-akun: **impor / ganti / hapus** akun, satu password bersama (hanya di
  memori saat terbuka), ganti password meng-enkripsi-ulang semua akun.
- 🪙 Multi-aset: menampilkan **semua aset** yang dipegang wallet, **Zano selalu di
  atas** walau saldo 0. Selector koin generik untuk semua operasi.
- 📥 Terima: hanya **satu alamat utama** + QR + salin (tanpa sub-address acak).
- 📤 Kirim + tip transparan: cek otomatis `jumlah + tip + fee ≤ saldo`.
- 📦 Multi-send (gaya OKX): **1 transaksi → banyak penerima**, bisa **campur aset**,
  dengan selector **"Dari wallet"** dan ringkasan konfirmasi tiap output.
- 🔀 Merge / konsolidasi: gabungkan saldo beberapa akun ke satu akun target, dengan
  **rincian per-wallet** dan pengecualian wallet yang dananya kurang.
- ⚡ Node cepat: daftar node + **fallback** otomatis, cache saldo (tampil instan,
  refresh di belakang), status **Terhubung / Sinkronisasi / Offline**.

---

## 📖 Cara Pakai

### 1. Pasang aplikasi
- **Android (APK):** salin `dist/kenshi-debug.apk` ke HP, aktifkan "Install dari
  sumber tak dikenal", lalu pasang. (Cara build APK ada di `BUILD_NOTES.md`.)
- **Windows (EXE):** jalankan installer `Kenshi_x64-setup.exe` atau pakai versi
  portable. (Cara build EXE ada di `BUILD_NOTES.md`.)
- **Web/PWA:** `npm install && npm run build`, lalu `npm run preview`.

### 2. Buat password & impor seed
1. Buka aplikasi → buat **password** (hanya disimpan di memori saat terbuka).
2. Tab **Akun** → isi **Nama**, **Alamat utama**, dan **Seed phrase** → **Impor**.
   Seed langsung dienkripsi (PBKDF2 + AES-GCM); plaintext tidak pernah disimpan.

### 3. Ganti / hapus akun
- Tab **Akun** → klik akun untuk **mengaktifkan**, atau **Hapus** untuk membuang
  akun (seed terenkripsinya ikut terhapus).

### 4. Terima
- Tab **Terima** → tampil **satu alamat utama** + **QR**. Tekan **Salin alamat**.

### 5. Kirim
- Tab **Kirim** → pilih **aset**, isi **alamat** + **jumlah**.
- Centang **Tip developer** (default aktif). Aplikasi menampilkan baris
  `jumlah + tip + fee` dan menolak jika melebihi saldo.

### 6. Multi-send
- Tab **Multi-send** → pilih **Dari wallet (sumber)**.
- Tambah beberapa penerima (boleh **beda aset** per baris).
- Centang tip jika mau → **Tinjau & kirim** → muncul ringkasan semua output
  (termasuk baris tip) sebelum 1 transaksi ditandatangani.

### 7. Merge / konsolidasi
- Tab **Merge** → pilih **Target**, **Aset**, dan centang **wallet sumber**.
- **Tinjau** → muncul tabel rincian per-wallet (dipindah / fee / tip). Wallet yang
  dananya kurang akan **dilewati dengan pesan jelas**.
- **Jalankan merge** → tiap wallet diproses **berurutan**; satu gagal tidak
  membatalkan yang lain.

### 8. Setelan node (biar kenceng)
- Tab **Setelan** → tempel URL node Zano Anda (satu per baris). Node dicoba
  berurutan saat timeout (fallback). Untuk **privasi penuh**, gunakan versi EXE yang
  bisa menjalankan **zanod lokal** sebagai sidecar.

---

## 💸 Fee developer (transparan)

- **Multi-send & merge** dikenakan fee **0.01 ZANO** ke alamat developer,
  **ditampilkan transparan sebelum tanda tangan** (checkbox aktif default).
- Fee ini menjadi **satu output tambahan di transaksi yang sama** (bukan kirim
  terpisah).
- Alamat: `iZ2q2xfw9AdX8YpGrcrjEPTG2ie8FMuXMFdDNKqRRbGo15zbuUfMAzDbtEDxcDpJcXGijaADG2WVs41p8PMiBnzrV94bWuisSKk2U53u3Wyg`

## ⚠️ Syarat merge

- Setiap wallet yang ikut merge **wajib punya minimal 0.01 ZANO + fee jaringan**.
  Jika kurang, wallet itu **dilewati** (lihat pesan: *"Wallet X dilewati: minimal
  0.01 ZANO + fee jaringan"*).

---

## 🛠️ Pengembangan

```bash
npm install
npm run dev        # dev server
npm test           # 30 unit test (math, tip, merge, keystore, rpc)
npm run build      # bundel produksi -> dist/
npm run icons      # generate set ikon PWA + Android
npm run e2e        # walkthrough Playwright -> screenshots/
```

Detail build APK/EXE, ukuran, dan hash artifact ada di **`BUILD_NOTES.md`**.
