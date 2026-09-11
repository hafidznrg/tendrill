# Aset brand — tendrill

Spesifikasi lengkap: [`docs/planning/12-brand-identity.md`](../../../docs/planning/12-brand-identity.md)

| Berkas | Isi |
|---|---|
| `mark.svg` | Mark utama — sulur & caret. Memakai `currentColor` untuk garis home row, `--accent` untuk sulur, `--caret` untuk caret |
| `mark-stats.svg` | Mark sekunder — sepuluh batang berwarna jari, untuk `/stats` |
| `monogram.svg` | Monogram `t`, cadangan untuk ruang sangat sempit |
| `icon-512.svg` | Ikon aplikasi, latar `--accent` padat |
| `icon-32.svg` | Favicon 32 px — ekor sulur dibuang |
| `icon-16.svg` | Favicon 16 px — sulur seminimal mungkin, caret melebar |
| `tokens.css` | Token warna & font, terang + gelap |

**Wordmark tidak dijadikan SVG.** Ia diset sebagai teks JetBrains Mono 800 dengan
`letter-spacing: -.045em`, huruf `d` dan `l` diberi `border-bottom` — supaya bisa
ikut tema dan tetap bisa dipilih/dibaca screen reader.
