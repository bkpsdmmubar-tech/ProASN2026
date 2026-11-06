#!/usr/bin/env python3
"""Ubah spreadsheet peserta menjadi data.json terenkripsi.
Pemakaian: python build_data.py Daftar_PNS_ProASN_2026_FINAL.xlsx   (atau .csv)
Kolom yang dibaca: NIP, Nama, Tahap, Jadwal, Lokasi Tes ProASN."""
import sys, os, re, csv, json, base64, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
ITER = 100_000
b64 = lambda b: base64.b64encode(b).decode()

def rows(path):
    if path.lower().endswith('.csv'):
        with open(path, newline='', encoding='utf-8-sig') as f:
            yield from csv.DictReader(f)
    else:
        import openpyxl
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb['Jadwal'] if 'Jadwal' in wb.sheetnames else wb.worksheets[0]
        it = ws.iter_rows(values_only=True)
        head = [str(h).strip() if h else '' for h in next(it)]
        for r in it:
            yield dict(zip(head, r))

def clean(v): return '' if v is None else str(v).strip()

def main(src, out='data.json'):
    salt = os.urandom(16); records = {}
    for r in rows(src):
        raw = r.get('NIP')
        nip = re.sub(r'\D', '', str(int(raw)) if isinstance(raw, float) else clean(raw))
        if not nip: continue
        tahap = clean(r.get('Tahap')); tahap = str(int(float(tahap))) if tahap else ''
        p = {'n': clean(r.get('Nama')), 't': tahap, 'j': clean(r.get('Jadwal')), 'l': clean(r.get('Lokasi Tes ProASN'))}
        bits = hashlib.pbkdf2_hmac('sha256', nip.encode(), salt, ITER, 64)
        iv = os.urandom(12)
        records[bits[:32].hex()] = b64(iv + AESGCM(bits[32:]).encrypt(iv, json.dumps(p).encode(), None))
    json.dump({'v': 1, 'iter': ITER, 'salt': b64(salt), 'records': records}, open(out, 'w'))
    print(f'{len(records)} peserta ditulis ke {out}')

if __name__ == '__main__':
    main(*sys.argv[1:3]) if len(sys.argv) > 1 else sys.exit(__doc__)
