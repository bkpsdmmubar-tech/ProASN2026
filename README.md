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

## 3. Aktifkan fitur check-in (absensi)
1. Buka Google Sheets peserta (pastikan sheet **Jadwal** sudah final), lalu **Extensions > Apps Script**.
2. Ganti isi `Code.gs` dengan isi `absensi/Code.gs`, lalu **Save**. Sesuaikan `RADIUS_M`, `OPEN_BEFORE_MIN`, dan `CLOSE_AFTER_MIN` bila perlu (default: 60 menit sebelum sampai 60 menit setelah sesi dimulai).
3. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Klik Deploy, setujui izin, lalu salin URL berakhiran `/exec`.
4. Tempel URL itu ke `config.js` (`absenUrl: '...'`), lalu unggah ulang `config.js`, `app.js`, dan `index.html` ke GitHub.
5. Hasil check-in tercatat otomatis di sheet **Absensi** (dibuat otomatis saat check-in pertama).
Setiap kali `Code.gs` diubah, buat **New version** pada deployment agar perubahan berlaku.

## Link grup WhatsApp (Tahap 1)
Link grup tidak ditulis di kode. Link disisipkan ke data peserta Tahap 1 yang sudah terenkripsi saat membuat data:

    python3 build_data.py Daftar_PNS_ProASN_2026_FINAL.xlsx data.json "LINK_GRUP_WA"

Peserta Tahap 1 melihat tombol "Gabung Grup WhatsApp"; Tahap 2 tidak melihatnya.
