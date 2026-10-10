# Deploy Toko HP V2 (Docker Compose)

Kode ini ditujukan untuk Ubuntu 24.04 dengan Docker Compose V2. Satu aplikasi terpisah pada localhost:18080, di-reverse-proxy oleh Caddy atau Nginx yang sudah dipakai VPS.

## Persiapan

```bash
git clone --branch feature/v2-pos-mobile-analytics https://github.com/mochadamfikri/shing-garbanzo.git toko-hp-v2
cd toko-hp-v2
cp deploy/backend.env.example backend/.env
chmod 600 backend/.env
nano backend/.env
mkdir -p data/uploads
cp -n backend/uploads/* data/uploads/ 2>/dev/null || true
```

Set `JWT_SECRET` acak, `OWNER_EMAIL`, `OWNER_PASSWORD`, dan `CORS_ORIGINS` sesuai domain HTTPS.
Jangan menggunakan kredensial pengujian dari history repo. Ganti secret pembayaran dan sesuaikan URL webhook di penyedia.

## Jalankan database

```bash
sudo docker compose up -d mongo
sudo docker compose exec -T mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]})'
sudo docker compose exec -T mongo mongosh --quiet --eval 'rs.status().ok'
```

Setelah replica set sudah menjadi PRIMARY, jalankan:

```bash
sudo docker compose up -d --build api web
sudo docker compose ps
curl -i http://127.0.0.1:18080/api/health
```

Jika berjalan, kesehatan API menampilkan `{"status":"ok"}`. Bila `rs.initiate` mengembalikan AlreadyInitialized, jangan ulangi inisialisasi.

## Domain lewat Caddy

Atur A record subdomain ke IP publik VPS, buka port 80 dan 443 pada firewall/provider, kemudian tambahkan ke Caddyfile:

```caddy
toko.domainlu.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:18080
}
```

Validasi konfigurasi dengan `sudo caddy validate --config /etc/caddy/Caddyfile`; reload dengan `sudo systemctl reload caddy`.

## Penting

- Ini deployment **staging**; POS, checkout dan pembayaran nyata masih memerlukan pengujian integrasi independen.
- MongoDB menggunakan single-node replica set **tanpa password**, terisolasi pada Docker network dan tanpa published port. Sebelum produksi, aktifkan database authentication/keyfile dan backup rutin.
- Database di volume `toko-hp-v2_mongo_data`. File gambar upload ada di `data/uploads`. Keduanya wajib di-backup.
- Kamera scanner memerlukan HTTPS dan izin kamera Android.
- Jangan gunakan `docker compose down -v`: itu menghapus volume database.
- Ketika ingin update, jalankan `git pull` dan `sudo docker compose up -d --build` hanya setelah backup dan pengecekan migrasi.
- Untuk aplikasi ini `backend/.env` dibaca saat backend dijalankan, sedangkan alamat API frontend dibangun relatif `/api` agar website dan API satu origin.
