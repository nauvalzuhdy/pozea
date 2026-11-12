# Pozea – Landing page

Landing page statis (HTML + CSS + JavaScript biasa, tanpa build tool).

## Menjalankan di VS Code

1. Buka folder `pozea-web` di VS Code.
2. Pasang ekstensi **Live Server** (Ritwick Dey).
3. Klik kanan `index.html` → **Open with Live Server**.

Bisa juga lewat terminal: `npx serve .` atau `python3 -m http.server 8000`, lalu buka `http://localhost:8000`.

## Struktur

```
index.html              # semua section halaman
assets/css/style.css    # gaya global, responsif, animasi
assets/js/main.js       # logika form waitlist
assets/video/           # video demo (hero, pose, langkah 2–3)
assets/img/             # poster video, foto "Untuk siapa", thumbnail pose
```

Sebagian besar gaya masih ditulis inline (`style="…"`) di `index.html`,
sesuai versi desain aslinya. Gaya yang dipakai ulang dan aturan responsif ada di `style.css`.

## Yang perlu diisi sebelum rilis

- **Form waitlist:** isi `WAITLIST_ENDPOINT` di `assets/js/main.js` dengan URL
  dari layanan yang kamu pilih (Formspree, Brevo, MailerLite, dll.) supaya email tersimpan
  dan pendaftar mendapat email konfirmasi.
- **Link toko aplikasi:** tombol Google Play masih `href="#"`. Ganti dengan link Play Store
  dan badge resmi.
- **Link sosial media:** TikTok dan Instagram di footer masih `href="#"`.
- **Halaman legal:** Kebijakan Privasi, Syarat dan Ketentuan, Kebijakan Cookie masih `#privacy`, `#terms`, `#cookies`.
- **Teks bertanda [ … ]** di FAQ adalah placeholder yang perlu diganti dengan info asli.
- **Hak pakai foto:** pastikan kamu punya izin untuk semua foto di `assets/img/usecase-*.jpg`.
