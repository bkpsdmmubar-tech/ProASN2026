# Cek Peserta ProASN 2026 – BKPSDM Muna Barat

Website statis: isi nama dan NIP, klik **Cek**, lalu muncul status peserta, jadwal, dan lokasi tes.
Tahap 2 menampilkan jadwal "Belum Tersedia".

## 1. Buat data.json (wajib, sekali setiap data berubah)
Unduh `Daftar_PNS_ProASN_2026_FINAL` dari Google Sheets sebagai **.xlsx** (File > Download), simpan di folder ini, lalu:

    pip install openpyxl cryptography
    python build_data.py Daftar_PNS_ProASN_2026_FINAL.xlsx

Data dienkripsi per peserta dengan NIP sebagai kunci, jadi isi `data.json` tidak bisa dibaca tanpa NIP yang benar.
File .xlsx tidak ikut ter-upload karena sudah ada di `.gitignore`.

## 2. Hubungkan ke GitHub
    git init
    git add .
    git commit -m "Website cek peserta ProASN 2026"
    git branch -M main
    git remote add origin https://github.com/<akun>/<nama-repo>.git
    git push -u origin main

Di GitHub: **Settings > Pages > Build and deployment > Deploy from a branch > main / (root)**.
Alamat situs muncul beberapa menit kemudian.

## Uji lokal
    python -m http.server 8000   # buka http://localhost:8000
