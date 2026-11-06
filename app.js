(function (root) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
  async function derive(nip, salt, iter) {
    const k = await crypto.subtle.importKey('raw', enc.encode(nip), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 512));
  }
  const clean = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const toks = s => clean(s).replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
  const flat = s => clean(s).replace(/[^A-Z]/g, '');
  function nameOk(input, stored) {
    const a = toks(input); if (!a.length) return false;
    const core = stored.split(',')[0];
    if (flat(input) === flat(core)) return true;
    const s = new Set(toks(stored)); if (a.every(t => s.has(t))) return true;
    const i = new Set(a), c = toks(core); return c.length > 0 && c.every(t => i.has(t));
  }
  async function lookup(nama, nipRaw, data) {
    const nip = String(nipRaw).replace(/\D/g, '');
    if (nip.length !== 18) return { status: 'format' };
    const bits = await derive(nip, b64(data.salt), data.iter);
    const rec = data.records[hex(bits.slice(0, 32))];
    if (!rec) return { status: 'notfound' };
    const raw = b64(rec);
    const key = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['decrypt']);
    const p = JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))));
    return nameOk(nama, p.n) ? { status: 'ok', p } : { status: 'notfound' };
  }
  root.ProASN = { lookup };
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById(id);
  let data = null;
  const load = fetch('data.json').then(r => r.json()).then(d => (data = d));
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAPS = { 'UPT BKN Kendari': 'https://maps.app.goo.gl/VQrfmdmewpriYPEz7' };
  const msg = (t, h) => `<div class="note"><strong>${t}</strong><p>${h}</p></div>`;

  function ticket(p) {
    let tgl = 'Belum Tersedia', sesi = '', jam = '';
    if (p.t === '1' && p.j) {
      const [d, s = ''] = p.j.split(' - '); tgl = d;
      const m = s.match(/^(Sesi \d)\s*\((.*)\)$/); sesi = m ? m[1] : s; jam = m ? m[2] : '';
    }
    const ready = tgl !== 'Belum Tersedia';
    return `<article class="ticket"><div class="stub"><span>Tahap</span><b>${esc(p.t)}</b></div>
      <div class="body"><p class="ok">Terdaftar sebagai peserta ProASN 2026</p>
      <h2>${esc(p.n)}</h2>
      <dl><dt>Jadwal tes</dt><dd class="${ready ? 'date' : 'pending'}">${esc(tgl)}</dd>
      ${ready ? `<dd>${esc(sesi)}${jam ? ', pukul ' + esc(jam) : ''}</dd>` : ''}
      <dt>Lokasi tes</dt><dd>${esc(p.l || 'Belum Tersedia')}</dd>${MAPS[p.l] ? `<a class="map" href="${MAPS[p.l]}" target="_blank" rel="noopener">Buka di Google Maps ↗</a>` : ''}</dl></div></article>`;
  }

  $('cek').addEventListener('submit', async e => {
    e.preventDefault();
    const out = $('hasil'), btn = $('btn'); btn.disabled = true; btn.textContent = 'Memeriksa…';
    try {
      await load;
      const r = await lookup($('nama').value, $('nip').value, data);
      out.innerHTML = r.status === 'ok' ? ticket(r.p)
        : r.status === 'format' ? msg('NIP harus 18 digit', 'Periksa kembali NIP Anda, lalu klik Cek lagi.')
        : msg('Data tidak ditemukan', 'Pastikan nama dan NIP sesuai data kepegawaian. Jika sudah sesuai namun tetap tidak ditemukan, hubungi narahubung di bawah.');
    } catch (err) {
      out.innerHTML = msg('Data belum dapat dimuat', 'Muat ulang halaman, atau hubungi narahubung di bawah.');
    }
    btn.disabled = false; btn.textContent = 'Cek'; out.focus();
  });
})(typeof window !== 'undefined' ? window : module.exports);
