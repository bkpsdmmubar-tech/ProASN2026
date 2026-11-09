/**
 * Layanan check-in ProASN 2026 (Google Apps Script, terikat ke Google Sheets peserta).
 * Membaca sheet "Jadwal" (NIP, Nama, Tahap, Jadwal, Lokasi Tes ProASN) dan menulis ke sheet "Absensi".
 * Waktu dicek di server (zona WITA), bukan di HP peserta.
 */
const CFG = {
  SHEET_JADWAL: 'Jadwal',
  SHEET_ABSEN: 'Absensi',
  LAT: -3.9660477,          // UPT BKN Kendari (dari tautan Google Maps)
  LON: 122.5530052,
  RADIUS_M: 200,            // jarak maksimal dari titik lokasi tes
  MAX_ACCURACY_M: 150,      // akurasi GPS terburuk yang diterima
  OPEN_BEFORE_MIN: 60,      // check-in dibuka sekian menit sebelum sesi dimulai
  CLOSE_AFTER_MIN: 60       // check-in ditutup sekian menit setelah sesi dimulai
};
const BULAN = { januari:1, februari:2, maret:3, april:4, mei:5, juni:6, juli:7, agustus:8, september:9, oktober:10, november:11, desember:12 };

function doGet() { return out_({ status: 'ok', message: 'Layanan check-in ProASN 2026 aktif.' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    try { return out_(process_(req)); } finally { lock.releaseLock(); }
  } catch (err) {
    return out_({ status: 'error', message: 'Terjadi kesalahan. Coba lagi atau hubungi narahubung.' });
  }
}

function process_(req) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nip = String(req.nip || '').replace(/\D/g, '');
  const p = find_(ss.getSheetByName(CFG.SHEET_JADWAL), nip);
  const sh = absenSheet_(ss);
  let existing = null;
  if (p) {
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) if (String(rows[i][1]) === nip && rows[i][4] === p.jadwal) existing = rows[i][0];
  }
  const d = decide_(p, req, new Date(), existing);
  if (d.status === 'ok') { sh.appendRow(d.row); delete d.row; }
  return d;
}

function decide_(p, req, now, existing) {
  const nip = String(req.nip || '').replace(/\D/g, '');
  if (nip.length !== 18 || !p || !nameOk_(req.nama, p.nama))
    return { status: 'not_found', message: 'Data tidak ditemukan. Pastikan nama dan NIP sesuai.' };
  if (p.tahap !== '1' || !p.jadwal)
    return { status: 'no_schedule', message: 'Jadwal tes Anda belum tersedia, sehingga check-in belum dapat dilakukan.' };
  const w = parseJadwal_(p.jadwal);
  if (!w) return { status: 'error', message: 'Format jadwal tidak dikenali. Hubungi narahubung.' };
  if (existing) return { status: 'already', message: 'Anda sudah check-in pada ' + existing + ' WITA.', waktu: existing };
  const open = new Date(w.start.getTime() - CFG.OPEN_BEFORE_MIN * 60000);
  if (now < open) return { status: 'too_early', message: 'Check-in belum dibuka. Untuk jadwal ' + p.jadwal + ', check-in dibuka mulai pukul ' + wita_(open).substr(11, 5) + ' WITA.' };
  const close = new Date(w.start.getTime() + CFG.CLOSE_AFTER_MIN * 60000);
  if (now > close) return { status: 'too_late', message: 'Check-in untuk ' + p.jadwal + ' sudah ditutup (batas pukul ' + wita_(close).substr(11, 5) + ' WITA).' };
  const lat = Number(req.lat), lon = Number(req.lon), acc = Number(req.acc);
  if (!isFinite(lat) || !isFinite(lon)) return { status: 'location', message: 'Lokasi tidak terbaca. Aktifkan layanan lokasi lalu coba lagi.' };
  if (!isFinite(acc) || acc > CFG.MAX_ACCURACY_M)
    return { status: 'accuracy', message: 'Akurasi GPS terlalu rendah (±' + Math.round(acc) + ' m). Pindah ke area terbuka lalu coba lagi.' };
  const dist = haversine_(lat, lon, CFG.LAT, CFG.LON);
  if (dist > CFG.RADIUS_M)
    return { status: 'location', message: 'Anda berada sekitar ' + Math.round(dist) + ' m dari lokasi tes. Check-in hanya bisa dilakukan dalam radius ' + CFG.RADIUS_M + ' m dari ' + p.lokasi + '.' };
  const waktu = wita_(now);
  return {
    status: 'ok', message: 'Check-in berhasil.', nama: p.nama, jadwal: p.jadwal, lokasi: p.lokasi, jarak: Math.round(dist), waktu: waktu,
    row: [waktu, nip, p.nama, p.tahap, p.jadwal, p.lokasi, lat, lon, Math.round(acc), Math.round(dist), 'Hadir']
  };
}

function find_(sh, nip) {
  const v = sh.getDataRange().getValues(), h = v[0].map(function (x) { return String(x).trim(); });
  const c = { nip: h.indexOf('NIP'), nama: h.indexOf('Nama'), tahap: h.indexOf('Tahap'), jadwal: h.indexOf('Jadwal'), lokasi: h.indexOf('Lokasi Tes ProASN') };
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][c.nip]).replace(/\D/g, '') === nip)
      return { nip: nip, nama: String(v[i][c.nama]), tahap: String(v[i][c.tahap]).trim(), jadwal: String(v[i][c.jadwal] || '').trim(), lokasi: String(v[i][c.lokasi] || '') };
  }
  return null;
}

function absenSheet_(ss) {
  let sh = ss.getSheetByName(CFG.SHEET_ABSEN);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET_ABSEN);
    sh.appendRow(['Waktu Check-in (WITA)', 'NIP', 'Nama', 'Tahap', 'Jadwal', 'Lokasi', 'Latitude', 'Longitude', 'Akurasi GPS (m)', 'Jarak dari lokasi (m)', 'Status']);
    sh.getRange('A:B').setNumberFormat('@'); sh.setFrozenRows(1);
  }
  return sh;
}

function parseJadwal_(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*-\s*Sesi\s*\d\s*\((\d{2})\.(\d{2})\s*-\s*(\d{2})\.(\d{2})/);
  const mon = m && BULAN[m[2].toLowerCase()];
  if (!mon) return null;
  const p2 = function (n) { return ('0' + n).slice(-2); }, day = p2(m[1]);
  const at = function (h, mi) { return new Date(m[3] + '-' + p2(mon) + '-' + day + 'T' + h + ':' + mi + ':00+08:00'); };
  return { start: at(m[4], m[5]), end: at(m[6], m[7]) };
}

function wita_(d) { // "dd/MM/yyyy HH:mm:ss" dalam WITA (UTC+8)
  const s = new Date(d.getTime() + 8 * 3600000).toISOString();
  return s.substr(8, 2) + '/' + s.substr(5, 2) + '/' + s.substr(0, 4) + ' ' + s.substr(11, 8);
}

function haversine_(la1, lo1, la2, lo2) {
  const R = 6371000, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nameOk_(input, stored) {
  const clean = function (s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); };
  const toks = function (s) { return clean(s).replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(function (t) { return t.length > 1; }); };
  const flat = function (s) { return clean(s).replace(/[^A-Z]/g, ''); };
  const a = toks(input || ''); if (!a.length) return false;
  const core = String(stored).split(',')[0];
  if (flat(input) === flat(core)) return true;
  const st = toks(stored); if (a.every(function (t) { return st.indexOf(t) >= 0; })) return true;
  const c = toks(core); return c.length > 0 && c.every(function (t) { return a.indexOf(t) >= 0; });
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
