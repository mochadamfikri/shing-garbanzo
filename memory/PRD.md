# PRD - Sistem Manajemen Toko HP & Toko Online

## Problem Statement Asli (Ringkasan)
Website full-stack toko smartphone Indonesia. Dua bagian: (A) Panel Admin internal — kelola stok smartphone (per unit dengan IMEI), harga modal, biaya servis, penjualan, pembayaran, pengiriman, pelanggan, keuntungan, laporan. (B) Website Toko Online publik — pelanggan lihat produk, cari, daftar, checkout, bayar, lacak pesanan. Dua bagian wajib terintegrasi via database. Bahasa Indonesia. Format tanggal DD/BULAN/YYYY. Mobile-first.

## User Personas
- **Owner / Super Admin**: Pemilik toko, akses penuh termasuk modal/profit.
- **Admin**: Kelola produk/pesanan sesuai izin, akses keuangan.
- **Staf**: Input barang, bantu pesanan, tanpa akses keuangan sensitif.
- **Pelanggan**: Browsing produk, checkout, tracking (Fase 2+).

## Arsitektur Teknis
- **Frontend**: React 19 + React Router + Shadcn UI + Tailwind + Sonner (toast)
- **Backend**: FastAPI + Motor (MongoDB async) + Pydantic v2 + PyJWT + bcrypt
- **Database**: MongoDB (lapisan akses data terpisah, migrasi ke PostgreSQL mudah di VPS)
- **Storage**: Local filesystem (`/app/backend/uploads`) via `StorageBackend` adapter — siap migrasi ke R2/S3/Google Drive
- **Auth**: JWT (access 12 jam, refresh 7 hari) via httpOnly cookies + Bearer fallback

## Core Requirements (Statis)
1. Fase 1: Fondasi admin + inventaris
2. Fase 2: Katalog publik + registrasi pelanggan + keranjang
3. Fase 3: Checkout + pembayaran (Kasera Pay, QRIS, Transfer manual) + pengiriman
4. Fase 4: Analitik + pengeluaran + garansi + servis + laporan
5. Fase 5: Testing menyeluruh + persiapan produksi

## Yang Sudah Diimplementasikan

### Fase 1 (08/OKTOBER/2026) ✅
- Admin login JWT (owner@tokohp.id/Admin@12345), roles, CRUD inventaris per unit, scan IMEI (manual+kamera+scanner), validasi Luhn, upload foto/video dengan storage adapter, estimasi profit backend, dashboard dasar, audit log.

### Fase 2 (08/OKTOBER/2026) ✅
- Katalog publik, registrasi pelanggan + alamat multiple + promo consent opt-in, keranjang server-side, riwayat harga/status UI di admin.

### Fase 3 (08/OKTOBER/2026) ✅
- **WhatsApp Float**: Tombol melayang hijau pojok kanan bawah, nomor dari pengaturan toko
- **Checkout**: `/checkout` dengan pilih alamat + metode pengiriman + metode pembayaran. Reservasi stok (unit → HOLD, hold_batas 30 menit). Create order dengan snapshot alamat/items/harga. Pencegahan double-sell via atomic update.
- **Pembayaran**: Pelanggan upload bukti transfer (`POST /api/orders/{id}/bukti-bayar`). Admin verifikasi (terima → unit TERJUAL + status DIPROSES; tolak → unit TERSEDIA + status DIBATALKAN). Pelanggan dapat batalkan pesanan sebelum verifikasi (stok dilepas).
- **Pengaturan Toko**: Panel admin `/admin/pengaturan` 3 tab (Identitas, Pembayaran, Pengiriman). Toggle metode on/off, config rekening bank, QR URL. 3 metode bayar (Transfer Manual aktif, QRIS fondasi, Kasera Pay fondasi disabled). 6 metode kirim.
- **Pengiriman Manual**: Admin isi nomor resi + estimasi + status pengiriman (MENUNGGU/DIKEMAS/DIKIRIM/DITERIMA). Status DIKIRIM → status_pesanan DIKIRIM; DITERIMA → SELESAI.
- **Status lifecycle**: MENUNGGU_BAYAR → MENUNGGU_VERIFIKASI → DIPROSES → DIKIRIM → SELESAI (atau DIBATALKAN).

Hasil testing: iteration_1 → 17/17, iteration_2 → 20/20, iteration_3 → 14/14 (+1 bug fix), iteration_4 → 100% full flow e2e.

### Fase 4 (08/OKTOBER/2026) ✅
- **Laporan Keuangan** `/admin/laporan` dengan 6 KPI cards (Omzet, HPP, Laba Kotor, Pengeluaran, Laba Bersih dengan tag PROFIT/LOSS, Unit Terjual)
- **Grafik Pergerakan Keuangan** (AreaChart harian: Omzet, Laba Kotor, Pengeluaran, Laba Bersih)
- **Grafik Tingkat Penjualan** (ComposedChart: Bar unit terjual + Bar pesanan + Line omzet)
- **Candle OHLC Mingguan** untuk omzet (hijau up, merah down, wick low-high)
- **Rincian** per Top Produk, Pengeluaran per Kategori, dan Nilai Inventaris saat ini
- **Filter rentang** cepat (Hari Ini / 7 / 30 / 90 Hari / 1 Tahun) + rentang kustom
- **Export CSV** (Keuangan harian, Penjualan per pesanan, Pengeluaran)
- **Pengeluaran Operasional** `/admin/pengeluaran` CRUD dengan 8 kategori (SEWA, LISTRIK, INTERNET, GAJI, PEMASARAN, KEMASAN, LOGISTIK, LAINNYA) — otomatis mengurangi laba_bersih di laporan
- HPP di-snapshot ke `order.items.modal` saat checkout (akurat untuk pesanan baru)

Hasil testing iteration_5: Backend 21/21 pytest + UI 100% end-to-end PASS.

## Backlog & Prioritas
### P0 (Fase 2 - setelah user approve Fase 1)
- Katalog publik otomatis dari unit berpublikasi TAYANG
- Halaman detail produk (tanpa IMEI/modal)
- Registrasi pelanggan + alamat (dengan persetujuan promosi)
- Keranjang belanja

### P1 (Fase 3)
- Checkout + reservasi stok (prevent double-sell)
- Pengaturan metode pembayaran (toggle on/off): Transfer Manual, QRIS Merchant, Kasera Pay fondasi
- Pengiriman manual (tabel ongkir, input resi, status)
- Fondasi adapter Biteship (verifikasi akun masih proses)

### P2 (Fase 4-5)
- Laporan keuangan lengkap, pengeluaran operasional
- Garansi toko + riwayat reparasi
- Export CSV/Excel, impor stok massal
- Notifikasi (email/Telegram/WhatsApp)
- Pengujian menyeluruh + panduan deploy VPS + export source code

## Catatan Teknis Penting
- `StaticFiles` di-mount di `/api/uploads/files` (bukan `/api/uploads`) agar tidak bentrok dengan POST endpoint upload.
- Semua perhitungan uang menggunakan `int`/`Decimal` di backend (hindari floating-point).
- Snapshot transaksi akan diimplementasi di Fase 3 (saat ini belum ada tabel pesanan).
- Model `UnitHP` adalah entity utama; nanti akan dipisah dari `CatalogListing` di Fase 2 jika beberapa unit perlu digrupkan.

## Update 09/OKTOBER/2026 — Impor ke lingkungan baru + QRIS Kasera + Google Drive

### Lingkungan & Konfigurasi
- Proyek diimpor dari repo `mochadamfikri/project-web` ke `/app`. Arsitektur CRA+craco (React 19) + FastAPI + MongoDB dipertahankan.
- Database pengembangan terpisah: `DB_NAME=toko_hp_dev`.
- Secret di `/app/backend/.env`: `JWT_SECRET` (acak), `KASERA_API_KEY` (live), `KASERA_WEBHOOK_SECRET` (kosong, menunggu), `GDRIVE_*` (kosong, menunggu).

### QRIS via Kasera Pay ✅ (aktif)
- Modul `kasera.py` (create_qris, get_transaction, verify_signature HMAC-SHA256, friendly_error).
- Checkout metode `qris_merchant` otomatis membuat transaksi QRIS Kasera & simpan `qr_string` di order.
- Webhook `POST /api/webhooks/kasera` (verifikasi tanda tangan + dedup `webhook_events`) → otomatis tandai pesanan LUNAS (unit TERJUAL, status DIPROSES/DIKEMAS).
- Fallback rekonsiliasi `GET /api/orders/{id}/sync-pembayaran` (polling 5 detik di frontend) — berfungsi walau webhook belum dikonfigurasi.
- Endpoint `POST /api/orders/{id}/qris` untuk buat/ulang QR.
- Frontend `PesananDetailPage`: render QR (qrcode.react) + status real-time + tombol coba lagi + pesan error.
- **BATAS PENTING**: QRIS Kasera menolak nominal > Rp 10.000.000/transaksi (`amount_too_large`). HP di atas 10jt harus pakai Transfer Bank. Sudah ditangani dengan pesan jelas.
- **Batas QRIS Pintar (checkout)**: opsi QRIS otomatis disembunyikan di CheckoutPage bila total > Rp 10.000.000 + catatan arahan Transfer Bank. Terverifikasi.
- **Kedaluwarsa QRIS**: PesananDetailPage menampilkan hitung mundur masa berlaku QR; saat kedaluwarsa tampil tombol "Perbarui QR" (backend `POST /orders/{id}/qris` membuat QR baru jika kadaluwarsa).
- Yang MASIH perlu dari user: `KASERA_WEBHOOK_SECRET` + daftarkan URL webhook `https://toko-hp-dev.preview.emergentagent.com/api/webhooks/kasera` di dashboard Kasera (agar verifikasi otomatis tanpa polling).

### Google Drive Storage 🟡 (kode siap, belum aktif)
- `storage_adapter.py` menambah `GoogleDriveStorage` (Service Account → upload + share anyone reader → URL `drive.google.com/uc?export=view&id=`).
- Aktif bila `STORAGE_BACKEND=gdrive`. Perlu dari user: file JSON Service Account (`GDRIVE_SERVICE_ACCOUNT_FILE`) + `GDRIVE_FOLDER_ID` (folder dishare ke email service account). Saat ini masih `local`.

## Update lanjutan 09/OKTOBER/2026
- **Webhook Kasera AKTIF**: `KASERA_WEBHOOK_SECRET` sudah diisi. Diuji end-to-end (localhost): tanda tangan valid → pesanan DIPROSES + notif admin; event duplikat ter-dedup; tanda tangan salah ditolak 400. (Catatan: uji via URL publik diblok Cloudflare error 1010 untuk user-agent non-browser — tidak memengaruhi Kasera asli.)
- **Notifikasi admin**: lonceng + badge + panel di AdminLayout, polling 20 detik, toast saat pembayaran baru. Endpoint `GET/POST /api/orders/admin/notifikasi[/baca]`.
- **Riwayat Pembayaran QRIS**: halaman admin `/admin/pembayaran-qris` + nav, endpoint `GET /api/orders/admin/pembayaran-qris` (semua order dengan `qris_paid_at`). Terverifikasi.
- **Batas QRIS pintar** di checkout (>Rp10jt sembunyikan QRIS) + **hitung mundur & perbarui QR** di detail pesanan. Terverifikasi.
- **Google Drive BELUM aktif**: file yang diunggah user adalah OAuth Client ID (`web.client_secret`), BUKAN Service Account (`private_key`). Perlu JSON Service Account yang benar.
- **Pesanan uji bayar Rp 1.000** (ORD-20261009-AD4889, akun `ujibayar@tokohp.id`) sengaja dipertahankan untuk uji pembayaran nyata oleh user.
