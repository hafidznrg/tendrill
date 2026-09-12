# 10 — Architecture Decision Records

Dokumen hidup. Setiap keputusan yang sulit dibalik, atau yang nanti akan membuat orang bertanya "kenapa begini?", dicatat di sini.

Format: **Konteks → Keputusan → Konsekuensi.**

---

## ADR-001 — Tanpa backend, tanpa auth

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Vocatype dan aplikasi sejenis memakai akun untuk sinkronisasi lintas perangkat. Tujuan proyek ini adalah belajar mengetik, bukan membangun platform.

**Keputusan.** Seluruh state persisten di `localStorage`. Tidak ada server, tidak ada auth, tidak ada analytics.

**Konsekuensi.**

- (+) Bisa di-deploy sebagai static site, gratis, nol biaya operasional.
- (+) Privasi absolut — jadi nilai jual yang bisa dinyatakan terbuka.
- (+) Menghilangkan seluruh kelas pekerjaan: session, keamanan, rate limit, database.
- (−) Progres hilang jika browser data dibersihkan → dimitigasi fitur ekspor/impor.
- (−) Tidak ada sinkronisasi lintas perangkat.
- (−) Tidak ada leaderboard (memang out of scope).

---

## ADR-002 — Vite + React, bukan Next.js

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Next.js adalah default untuk banyak proyek React, tetapi keunggulannya (SSR, API route, routing berbasis file di server) tidak terpakai di aplikasi tanpa backend.

**Keputusan.** Vite + React + React Router.

**Konsekuensi.**

- (+) Dev server jauh lebih cepat; iterasi engine lebih nyaman.
- (+) Tidak ada hydration — penting untuk aplikasi yang sensitif input latency.
- (+) Model mental lebih sederhana.
- (−) Jika suatu saat butuh backend, perlu migrasi (dinilai kecil kemungkinannya, dan tetap mungkin).

---

## ADR-003 — Akurasi dihitung dari percobaan pertama

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Ada dua mazhab: akurasi dihitung dari teks akhir (koreksi memaafkan error), atau dari setiap keystroke (koreksi tidak menghapus error).

**Keputusan.** Akurasi = keystroke benar / total keystroke. Backspace memperbaiki teks tetapi tidak memperbaiki akurasi.

**Konsekuensi.**

- (+) Sejalan dengan tujuan produk: membentuk ketikan yang benar sejak awal.
- (+) Mendorong pelan-tapi-benar, yang memang cara belajar mengetik yang benar.
- (−) Angka akurasi akan lebih rendah daripada aplikasi lain — perlu dijelaskan di UI supaya tidak dikira bug.

---

## ADR-004 — State sesi di `useRef`, bukan `useState`

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Menaruh `SessionState` di React state akan menyalin array karakter setiap keystroke dan me-render ulang seluruh paragraf — penyebab paling umum typing app terasa berat.

**Keputusan.** `SessionState` disimpan di ref sebagai sumber kebenaran. Render dipicu secara eksplisit dan terbatas. Metrik diperbarui pada interval 250ms terpisah.

**Konsekuensi.**

- (+) Performa memenuhi anggaran 16ms.
- (−) Kode terasa kurang "React idiomatic"; wajib diberi komentar penjelas supaya tidak "dirapikan" oleh diri sendiri di masa depan.
- (−) Butuh disiplin: setiap komponen karakter harus `memo` dengan props primitif.

---

## ADR-005 — Konten bahasa Inggris dulu, struktur multi-bahasa sejak awal

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Konten EN lebih mudah didapat (daftar kata, kutipan domain publik) dan kurikulum mengetik standar disusun untuk EN. Bahasa Indonesia direncanakan menyusul.

**Keputusan.** Hanya membuat konten `en/`, tetapi struktur folder dan tipe data sudah dipisah per-locale sejak hari pertama. Tidak memasang library i18n sekarang.

**Konsekuensi.**

- (+) Menambah ID nanti = menambah folder, bukan refactor.
- (−) Sedikit boilerplate di awal (path `en/` yang terasa berlebihan untuk satu bahasa).

---

## ADR-006 — Desktop-only

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Mengetik 10 jari mustahil dilatih di layar sentuh.

**Keputusan.** Viewport sempit mendapat halaman penjelasan, bukan versi mobile yang dipaksakan. Halaman statistik tetap bisa dibaca di mobile.

**Konsekuensi.**

- (+) Menghemat banyak pekerjaan responsive.
- (+) Menghindari produk yang buruk di dua platform sekaligus.
- (−) Kehilangan trafik mobile — dinilai tidak relevan untuk tujuan produk.

---

---

## ADR-007 — Engine bermutasi dan mengembalikan `KeyOutcome`, bukan state baru

**Tanggal:** 2026-09-10 · **Status:** Diterima · **Menggantikan:** kontrak API di dok. 03 v1

**Konteks.** Dok. 03 v1 mendefinisikan `applyKey(state, key, at): SessionState` — tanda
tangan fungsional-immutable — sementara dok. 03 §5 melarang alokasi array sepanjang teks
per keystroke dan ADR-004 menyimpan state di ref. Ketiganya tidak bisa benar bersamaan:
mengembalikan `SessionState` baru berarti menyalin `cells[]` setiap ketukan.

**Keputusan.** Engine bermutasi eksplisit dan mengembalikan deskripsi perubahan
(`KeyOutcome { accepted, dirty[], cursorMoved, finished }`). Array `dirty` dipakai ulang.

**Konsekuensi.**

- (+) Nol alokasi per keystroke; anggaran performa jadi bisa dipenuhi, bukan sekadar dicita-citakan.
- (+) UI tahu persis sel mana yang berubah → dasar dari ADR-008.
- (+) Engine tetap bebas React/DOM dan tetap dites di Node murni.
- (−) Kehilangan immutability, jadi tidak ada time-travel debugging gratis.
  Dinilai murah karena state hanya punya satu pemilik.
- (−) Butuh disiplin: fungsi engine tidak boleh dipanggil dari dua tempat sekaligus.

---

## ADR-008 — Lapisan teks diperbarui imperatif, di luar React

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** `memo` mencegah re-render tetapi bukan reconciliation: setiap render induk
tetap membuat dan membandingkan 500 elemen React. Disiplin "props primitif" juga rapuh —
satu prop objek yang tak sengaja lolos akan merusak seluruh memoisasi tanpa gejala jelas.

**Keputusan.** `TypingArea` memasang span statis sekali saat mount, menyimpan
`HTMLSpanElement[]` di ref, lalu memperbarui `className` hanya untuk indeks di
`outcome.dirty`. Nol `setState` di jalur keystroke.

**Konsekuensi.**

- (+) 1–2 penulisan DOM per keystroke, nol pekerjaan React. DoD berubah dari
  "≤ 3 komponen re-render" menjadi "0".
- (+) Seluruh kelas bug memoisasi hilang.
- (−) Ini manipulasi DOM langsung di dalam aplikasi React — wajib diberi komentar
  penjelas supaya tidak "dirapikan" oleh diri sendiri enam bulan lagi.
- (−) Testing Library jadi kurang cocok untuk area ini; diverifikasi lewat engine test
  plus pemeriksaan visual.

---

## ADR-009 — Recharts dihapus, grafik ditulis sebagai SVG

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Recharts beserta dependensinya ≈ 90–110 KB gzip. React + Router + Zustand
≈ 55 KB. Anggaran 150 KB gzip di dok. 06 v1 sudah jebol sebelum satu baris kode aplikasi
ditulis — demi dua grafik di halaman yang jarang dibuka.

**Keputusan.** Tidak memakai library grafik. Line chart dan bar chart dibuat dari
`<polyline>` dan `<rect>`. Anggaran diubah menjadi bundel awal < 90 KB gzip, ditegakkan CI.

**Konsekuensi.**

- (+) Anggaran bundel jadi realistis dan bisa diverifikasi.
- (+) Satu dependensi besar hilang dari beban pemeliharaan dan pemantauan keamanan.
- (−) Tooltip, animasi, dan sumbu harus dibuat sendiri (~80 baris).
- (−) Kalau nanti butuh grafik yang benar-benar rumit, keputusan ini ditinjau ulang.

---

## ADR-010 — Placement test sebagai pintu masuk, dan assist ladder sebagai jalan keluar

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** PRD menempatkan persona "Menengah tersendat" sebagai prioritas v1, lalu
memaksa mereka melewati `ff jj dd kk` — mereka akan pergi dalam satu menit. Di sisi lain,
pemula yang gagal delapan kali di satu lesson tidak punya jalan keluar selain menyerah.
Rencana v1 diam soal keduanya.

**Keputusan.**

- **Unit 0 Placement Test** (60 detik, bisa dilewati) menandai unit yang sudah dikuasai
  sebagai `passed-by-placement`.
- **Assist ladder**: percobaan ke-3 memberi drill mikro, ke-4–5 menurunkan target WPM 20%,
  ke-6 menawarkan `passed-with-assist`. **Akurasi tidak pernah diturunkan.**

**Konsekuensi.**

- (+) Kedua persona prioritas punya jalur yang masuk akal sejak menit pertama.
- (+) Kriteria sukses PRD "pengguna bisa menyebut satu kelemahannya setelah satu sesi"
  tercapai di sesi pertama, bukan setelah berminggu-minggu.
- (−) Status lesson jadi punya lima nilai, bukan tiga — logika unlock dan tampilan
  `/learn` ikut bertambah rumit.
- (−) Ada risiko pengguna lulus terlalu murah lewat assist. Dimitigasi: status dicatat,
  ditampilkan halus di `/learn`, dan tombolnya diprioritaskan di review session.

---

## ADR-011 — Diagnosis memakai latensi, bukan hanya kesalahan

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Pengguna 50 WPM umumnya tidak banyak salah — mereka lambat di tombol
tertentu (kelingking, `p`, `q`, baris angka) dan di transisi tertentu. `keystats` v1 hanya
menyimpan `{attempts, errors}`, sehingga produk buta terhadap masalah utama persona
prioritas kedua.

**Keputusan.** Tambahkan `totalMs` dan `slowCount` per tombol, plus (P1) 50 bigram paling
lambat. Generator adaptif membobot error **dan** latensi, dengan rentang latensi lebih
sempit ([1, 2.5]) daripada error ([1, 4]).

**Konsekuensi.**

- (+) Biaya komputasi satu penjumlahan per keystroke; nilainya besar.
- (+) `/stats` bisa menampilkan dua heatmap yang benar-benar berbeda: "salah" dan "lambat".
- (+) Membuka plateau 50→70 WPM, yang tidak tersentuh oleh diagnosis berbasis error.
- (−) `keystats` tumbuh ~2×, tetap jauh di bawah kuota.
- (−) Latensi berisik saat pengguna berhenti berpikir; perlu ambang jumlah kemunculan
  minimal sebelum ditampilkan.

---

## ADR-012 — Uji pengguna dipindah dari hari 25 ke hari 11

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Roadmap v1 menempatkan uji pakai ke orang lain di Fase 7. Risiko terbesar
proyek ini bukan kode — engine punya spesifikasi jelas dan bisa dites otomatis. Risiko
terbesarnya adalah **apakah kurikulumnya benar-benar mengajar**, dan itu hanya bisa
dijawab oleh manusia lain.

**Keputusan.** Kurikulum Unit 0–1 naik ke Fase 3, ditutup dengan uji ke satu pemula nyata
di ~hari 11. Storage layer digabung ke ekor Fase 1 karena semua fase setelahnya
membutuhkannya. Penulisan konten dilepas dari jalur kritis menjadi pekerjaan latar.

**Konsekuensi.**

- (+) Asumsi paling mahal diuji saat 11 hari kerja dipertaruhkan, bukan 25.
- (+) Latihan bebas turun prioritas — fitur menyenangkan yang tidak membuktikan apa pun.
- (−) Halaman `/learn` harus dibangun sebelum semua konten unit selesai; perlu disiplin
  agar Unit 2–6 tidak dibiarkan kosong terlalu lama.

## ADR-013 — Kriteria lulus per-lesson, bukan per-unit

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Saat kurikulum benar-benar ditulis (dok. 04 §14), satu kelemahan v2 langsung
terlihat: satu kriteria per unit berarti `u3-l1` (`v m`, dua telunjuk) dan `u3-l4`
(`z /`, kelingking baris bawah) dituntut angka yang sama. Kedua gerakan itu tidak
sebanding. Akibatnya assist ladder akan terpicu di lesson tersulit bukan karena
penggunanya butuh bantuan, melainkan karena ambangnya memang salah pasang.

**Keputusan.** Setiap lesson punya `passCriteria` sendiri (dok. 04 §4a), lebih longgar
pada tombol sulit dan naik bertahap sampai **review session menyentuh persis kriteria
unit**. Review menjadi gerbang sesungguhnya; lesson individual adalah tanjakan ke sana.
Dua batas ditegakkan validator: akurasi tidak pernah di bawah 90%, dan kriteria lesson
tidak boleh melebihi kriteria unitnya.

**Konsekuensi.**

- (+) Assist ladder kembali menjadi sinyal kesulitan nyata, bukan artefak ambang.
- (+) Progres terasa jujur: WPM boleh turun di tombol sulit tanpa dianggap gagal.
- (−) 37 angka yang harus dirawat, bukan 6. Diterima karena validator menjaganya.
- (−) UI `/learn` harus menampilkan target per-lesson, bukan satu angka per unit.

## ADR-014 — `newKeys` berisi karakter, bukan tombol fisik

**Tanggal:** 2026-09-10 · **Status:** Diterima

**Konteks.** Unit 5 mengajarkan `"` `?` `!` `:`, semuanya chord Shift. Kalau `newKeys`
dimaknai sebagai tombol fisik, mengajarkan `!` berarti membuka tombol `1` — padahal angka
baru diajarkan di Unit 6. Validator akan meloloskan angka di Unit 5 tanpa bersuara.

**Keputusan.** `newKeys` berisi **karakter** yang diajarkan. Chord ber-Shift tidak membuka
karakter dasarnya. Satu-satunya pseudo-key adalah `Shift`, yang membuka huruf kapital dari
huruf kecil yang sudah diperkenalkan.

**Konsekuensi.**

- (+) Aturan kumulatif bisa ditegakkan mesin, dan langsung menangkap empat bug nyata.
- (−) Peta jari (`features/keyboard/fingerMap.ts`) harus memetakan karakter → tombol fisik
  secara terpisah; keduanya tidak boleh dianggap struktur yang sama.

---

## ADR-015 — Nama produk: **tendrill**

**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** Proyek berjalan dengan codename `Typing` — deskriptif, tidak bisa jadi merek,
dan bentrok dengan ruang nama yang sudah sangat padat (Typing.com, TypeRacer, Typeform,
TypingClub). Dibutuhkan nama sebelum aset visual, favicon, dan meta sosial dikerjakan,
karena semuanya diturunkan dari nama.

**Keputusan.** Nama produk adalah **tendrill**, selalu ditulis huruf kecil.

Namanya membawa tiga bacaan sekaligus, dan ketiganya memang isi produk: _ten_ (sepuluh
jari), _tendril_ (sulur — tumbuh merambat bertahap, seperti kurikulum berjenjang), dan
_drill_ (latihan terarah pada kelemahan). Ejaan dengan dua `l` membedakannya dari kata
`tendril` yang umum.

Deployment memakai **subdomain dari situs pribadi**, bukan domain sendiri.

**Konsekuensi.**

- (+) Ketersediaan domain apex berhenti menjadi syarat — tidak ada tenggat pembelian
  yang menekan keputusan penamaan.
- (+) Huruf `d` dan `l` di dalam nama kebetulan duduk di home row, dan itu dipakai
  sebagai penanda wordmark. Identitasnya tumbuh dari kurikulum, bukan ditempel.
- (+) "drill" memberi nada serius/terstruktur yang membedakan dari game ketik kasual.
- (−) Sebagian orang akan salah baca dan kehilangan bacaan _ten_; dimitigasi lockup
  vertikal yang membawa teks `SEPULUH JARI`.
- (−) Nada "drill" bertegangan dengan prinsip PRD #3 ("jangan menghukum kesalahan").
  Ketegangan itu diselesaikan di UI, bukan di nama: nada lembut dijaga lewat warna
  error rendah saturasi, tanpa suara, tanpa animasi patah.

---

## ADR-016 — Palet hijau-sulur dengan satu aksen panas eksklusif untuk caret

**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** 07-ux-ui-spec.md §5 menetapkan nama token (`--bg`, `--accent`, dst.) tetapi
tidak pernah menetapkan nilainya. Tanpa nilai konkret, setiap komponen akan memilih
warnanya sendiri.

**Keputusan.** Nilai token ditetapkan di [12-brand-identity.md](12-brand-identity.md) §5 dan
dikodekan di `src/assets/brand/tokens.css`. Dua aturan mengikat:

1. `--caret` (kuning) adalah **satu-satunya warna panas** di seluruh antarmuka dan hanya
   boleh dipakai untuk penanda posisi mengetik.
2. Netral tidak memakai abu-abu murni; semuanya dimiringkan sedikit ke hijau agar
   sebidang dengan `--accent`.

**Konsekuensi.**

- (+) Caret menjadi satu-satunya hal yang "menyala" di layar — mata pengguna selalu tahu
  di mana posisinya tanpa perlu animasi kedip yang agresif.
- (+) Token punya nilai gelap dan terang lengkap sejak awal; tidak ada komponen yang
  hanya benar di satu tema.
- (−) Badge, streak, dan tombol sekunder kehilangan kuning sebagai opsi. Mereka harus
  membedakan diri lewat bentuk dan `--surface`, bukan warna panas.

---

## ADR-017 — React Router deklaratif, bukan data router

**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** Fase 0 memasang enam rute lazy dengan `createBrowserRouter`. Gerbang
anggaran bundel (dok. 06 §6) langsung menolak build: bundel awal **103,8 KB gzip**,
lewat 13,8 KB dari batas 90 KB — sebelum satu baris kode engine ditulis.

Penyebabnya mesin data-router (loader, action, fetcher, `revalidate`) yang ikut
terbundel meski tidak satu pun dipakai. Aplikasi ini tidak punya loader sama sekali:
tidak ada network request saat runtime (dok. 06 §2 batasan 4).

**Keputusan.** Pakai router deklaratif — `<BrowserRouter>` + `<Routes>` dari paket
`react-router`. `react-router-dom` dihapus dari dependensi.

**Konsekuensi.**

- (+) Bundel awal turun ke **86,7 KB gzip**, di bawah anggaran tanpa mengorbankan
  code-splitting per rute (enam chunk tetap terpisah).
- (+) Gerbang anggaran terbukti bekerja pada hari pertama — persis alasan ia dibuat.
- (−) **Margin tersisa hanya ~3,3 KB gzip**, dan engine Fase 1 belum masuk. Engine
  murni tanpa dependensi seharusnya kecil, tapi kalau margin ini habis, opsi
  berikutnya adalah memindahkan `AppLayout` ke luar bundel awal atau meninjau ulang
  angka 90 KB dengan pengukuran nyata "waktu ke keystroke pertama" (dok. 06 §6).
- (−) Kalau nanti benar-benar butuh loader, migrasi balik harus disertai pengukuran
  anggaran ulang, bukan asumsi.

---

## ADR-018 — Anggaran bundel dipecah dua, bundel awal naik ke 105 KB

**Tanggal:** 2026-09-11 · **Status:** Diterima, **akan dievaluasi ulang di Fase 8**

**Konteks.** Setelah ADR-017 bundel awal duduk di 86,9 / 90 KB gzip — margin 3,1 KB,
dan engine Fase 1 belum masuk. Pembongkaran isinya:

| Isi bundel awal           | gzip        |
| ------------------------- | ----------- |
| React + react-dom         | 67,3 KB     |
| react-router (deklaratif) | 14,3 KB     |
| zustand                   | 0,3 KB      |
| **kode aplikasi kita**    | **~1,6 KB** |
| CSS                       | 3,2 KB      |

**96% bundel awal bukan kode kita.** Artinya gerbang yang ada tidak pernah bisa
menangkap kode kita membengkak; ia hanya meledak sekali saat dependensi bertambah.

Ongkos menaikkan 15 KB, dihitung: jalur yang memblokir keystroke pertama 87,6 KB.
Di Fast 3G (~200 KB/s) itu 438 ms transfer; +15 KB menjadi 513 ms — **+75 ms**,
atau **+6 ms** di broadband 20 Mbps. Dari anggaran 3 detik, dan RTT 562 ms Fast 3G
jauh lebih dominan daripada seluruh waktu transfer kita.

Tiga opsi lain ditimbang dan ditolak **untuk saat ini**:

- _Router tulis sendiri_ (−13 KB): 60 baris routing yang dirawat selamanya beserta
  back/forward, scroll restoration, dan test-nya — ditukar 65 ms yang tidak terasa.
- _Preact via `compat`_ (−60 KB, terukur: 7,0 KB vs 67,3 KB): menukar framework di
  Fase 0 demi byte yang belum melanggar metrik nyata itu prematur, dan compat-nya
  baru bisa diuji jujur setelah Fase 2.
- _Biarkan 90_: memblokir Fase 1 demi angka yang tidak pernah diukur.

**Keputusan.** Anggaran dipecah dua: **framework ≤ 85 KB** (terkunci, menambah
dependensi runtime wajib ADR) + **kode aplikasi ≤ 20 KB**, dengan atap bundel awal
**105 KB**. Vite memisahkan chunk `vendor` supaya pemisahan ini bisa diukur mesin,
bukan diperkirakan.

**Konsekuensi.**

- (+) Gerbangnya mulai mengukur hal yang kita kendalikan. Kode aplikasi 1,6 → 20 KB
  adalah batas yang benar-benar akan menggigit selama Fase 1–8.
- (+) Menambah dependensi runtime berhenti menjadi keputusan diam-diam.
- (+) Chunk `vendor` terpisah juga memperbaiki cache: perubahan kode aplikasi tidak
  lagi membatalkan 81,5 KB framework di cache pengguna.
- (−) **Angka 105 tidak diukur, ia dinaikkan karena kepentok.** Ini persis pola yang
  membunuh anggaran performa: naik sedikit demi sedikit, tidak ada satu langkah pun
  yang salah, tapi jumlahnya salah. Mitigasinya bukan niat baik melainkan tenggat:
  R-24 (ukur waktu ke keystroke pertama di Fast 3G) dijadwalkan di Fase 8 dan
  **angkanya wajib diturunkan ke hasil pengukuran**. Kalau Fase 8 lewat tanpa
  pengukuran itu, ADR ini gagal.
- (−) Lighthouse ≥ 95 tidak bisa jadi jaring pengaman kedua — ia lolos santai bahkan
  di 200 KB untuk desktop. Satu-satunya yang menjaga adalah anggaran kode aplikasi.

---

## ADR-019 — Hanya percobaan pertama yang tercatat
**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** Dok. 03 §4 menetapkan "akurasi dihitung dari percobaan pertama" (ADR-003)
dan dok. 02 §4 menetapkan "backspace mengoreksi teks tetapi error yang sudah tercatat
tetap dihitung". Keduanya tidak menjawab satu pertanyaan yang baru muncul saat menulis
`applyKey`: **saat pengguna mengetik ulang karakter yang sama setelah backspace, apakah
keystroke itu masuk `acc.total`?**

Tiga jawaban mungkin, dan ketiganya menghasilkan akurasi berbeda untuk kejadian yang
sama persis (salah 1 karakter dari 50, lalu dikoreksi):

| Perlakuan | Akurasi | Masalahnya |
|---|---|---|
| Percobaan ulang menambah `total` saja | 49/51 ≈ 96% lalu turun tiap koreksi | Menghukum koreksi dua kali: sekali lewat waktu, sekali lagi lewat akurasi |
| Percobaan ulang menambah `total` **dan** `correct` | 50/51 ≈ 98% | Backspace jadi alat memutihkan kesalahan — melanggar ADR-003 |
| **Percobaan ulang tidak dicatat sama sekali** | **49/50 = 98%** | — |

**Keputusan.** Percobaan ulang tidak dicatat sama sekali. Log dan akumulator hanya
memuat percobaan pertama di tiap indeks, sehingga `accuracy` persis berarti "berapa
persen karakter yang kamu kenai dengan benar pada percobaan pertama".

**Konsekuensi.**
- (+) Satu definisi yang bisa dijelaskan ke pengguna dalam satu kalimat, dan sebanding
  dengan cara aplikasi mengetik lain melaporkan akurasi.
- (+) Koreksi tetap ada ongkosnya — waktunya terpakai, jadi WPM turun sendiri. Cukup
  satu hukuman, bukan dua.
- (+) `log.count` tidak bisa membengkak karena pengguna yang gemar backspace; kapasitas
  `target.length * 2 + 64` jadi punya arti.
- (+) Invarian "metrik(akumulator) == metrik(log)" jadi sepele dijaga karena keduanya
  memuat himpunan kejadian yang sama.
- (−) `confusions` kehilangan informasi tentang kesalahan pada percobaan kedua dan
  seterusnya ("sudah dikoreksi pun masih salah"). Ini kerugian nyata untuk diagnosis,
  dan diterima karena percobaan ulang biasanya sudah dituntun oleh sel yang ditandai
  merah — jadi nilainya sebagai sinyal diagnosis rendah.
- (−) `state: 'corrected'` tidak bisa lagi diturunkan dari log; ia butuh penanda
  terpisah (`_firstOk`) di dalam `SessionState`.


---

## ADR-020 — p95 input→paint diukur rAF; Event Timing turun jadi gerbang lulus/gagal
**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** Dok. 09 §5 mensyaratkan "p95 input→paint ≤ 8 ms (Event Timing API)" dan
sekaligus menyuruh memakai skrip autotype keystroke sintetis. Saat verifikasi Fase 1
dijalankan, dua syarat itu ternyata **saling meniadakan**.

Yang diuji di situs produksi pada 2026-09-11:

| Cara mengirim keydown | Sampai ke aplikasi? | Terekam Event Timing? |
|---|---|---|
| `document.dispatchEvent` dari konsol | ya | **tidak** |
| CDP (`computer key` lewat browser automation) | ya | **tidak** |
| CDP, dengan handler sengaja diblokir 60 ms | ya | **tidak** |

Baris ketiga yang menutup perkara: bahkan interaksi yang jelas-jelas lambat pun tidak
menghasilkan satu entri pun. Jadi bukan soal ambang `durationThreshold`, melainkan
Event Timing memang tidak menghitung input yang tidak berasal dari manusia.

**Keputusan.** Dua sumber angka yang berbeda, dengan tugas yang berbeda:

1. **p95/p99 dispatch→paint** diukur `scripts/perf-autotype.js` — tiap keystroke diikuti
   satu `requestAnimationFrame`, dijalankan pada beban konstan 140 WPM selama 60 detik.
   Inilah yang dibandingkan dengan anggaran 8 ms / 16 ms.
2. **Event Timing** dipakai dengan mengetik sungguhan, sebagai **gerbang lulus/gagal**:
   nol entri = tidak ada interaksi yang tersendat. Ia tidak lagi diminta menghasilkan p95.

**Konsekuensi.**
- (+) Kedua angka sekarang benar-benar bisa diperoleh. Syarat lama tidak pernah bisa
  dipenuhi oleh siapa pun, dan itu jenis DoD paling berbahaya: kelihatan ketat, padahal
  hanya bisa dilewati dengan berpura-pura.
- (+) Beban 140 WPM selama 60 detik tetap terotomasi — tangan manusia tidak bisa
  mempertahankan laju itu dengan stabil.
- (−) **Verifikasi performa tidak bisa sepenuhnya diotomasi**, termasuk oleh agent.
  Mengetik sungguhan tetap dibutuhkan, dan begitu pula Chrome Memory profiler serta
  React Profiler yang hanya hidup di antarmuka DevTools.
- (−) `rAF` mengukur "sampai frame berikutnya dicat", sedikit berbeda dari definisi
  Event Timing (`processingEnd` → presentasi). Bedanya kecil dan arahnya konservatif
  (rAF cenderung melaporkan lebih besar), jadi lulus di sini berarti lulus di sana.


## ADR-021 — Nol alokasi heap & nol re-render turun dari DevTools ke `npm run verify`
**Tanggal:** 2026-09-11 · **Status:** Diterima

**Konteks.** Dok. 09 §5 menaruh empat verifikasi performa di DevTools Chrome, dan
ADR-020 menyimpulkan verifikasi performa "tidak bisa sepenuhnya diotomasi". Kesimpulan
itu benar **untuk p95 input→paint**, tetapi terlanjur ikut menyeret dua item lain yang
sebenarnya tidak butuh DevTools sama sekali:

- **nol alokasi heap per keystroke** — engine wajib murni Node (dok. 06 §2 batasan 1),
  jadi ia bisa diukur `process.memoryUsage().heapUsed` dengan `--expose-gc`, jauh lebih
  deterministik daripada membaca grafik allocation dengan mata.
- **nol re-render per keystroke** — `<Profiler>` adalah API `react`, bukan fitur
  ekstensi DevTools. Ia jalan di Vitest tanpa browser.

Keduanya punya sifat yang sama: **regresi diam-diam**. Satu `useState` yang tidak
sengaja masuk jalur keystroke, atau satu objek yang dialokasikan per karakter, tidak
akan terlihat sampai seseorang membuka DevTools lagi berbulan-bulan kemudian. Verifikasi
manual hanya benar pada hari ia dijalankan.

Pemeriksaan ulang pada 2026-09-11 lewat browser automation juga menambahkan satu fakta
baru ke tabel ADR-020: di dalam panel browser yang dikendalikan agent,
`requestAnimationFrame` **tidak pernah dipanggil** meski `document.visibilityState`
bernilai `"visible"` — 36 keydown tiba di aplikasi, nol callback rAF. Jadi bukan hanya
Event Timing yang tertutup: **seluruh pengukuran yang bergantung pada paint** tertutup
di jalur otomasi, termasuk pengganti rAF yang dipilih ADR-020.

**Keputusan.** Belah daftar dok. 09 §5 menjadi dua menurut apakah ia butuh **paint**:

| Verifikasi | Butuh paint? | Ke mana |
|---|---|---|
| Nol alokasi heap per keystroke | tidak | `npm run perf:heap`, masuk `npm run verify` |
| Nol re-render per keystroke | tidak | Vitest `<Profiler>`, masuk `npm run verify` |
| Caret presisi setelah webfont & resize | tidak (layout saja) | skrip geometri di browser panel |
| p95 dispatch→paint, long task, forced reflow | **ya** | tetap manual (ADR-020) |

**Konsekuensi.**
- (+) Dua dari empat utang performa berubah dari "diperiksa sekali" menjadi "dijaga tiap
  commit". Inilah yang sebenarnya dibeli: bukan menghemat waktu hari ini, melainkan
  menolak regresi besok.
- (+) Nol dependensi baru, nol perubahan anggaran bundel — `--expose-gc` adalah flag
  Node, `<Profiler>` sudah ikut React.
- (−) `npm run verify` jadi lebih lambat (uji heap ~2 detik) dan sedikit lebih rapuh:
  ambang byte-per-keystroke bergantung versi Node. Karena itu ambangnya ditetapkan
  longgar dan diukur sebagai **minimum lintas ronde**, bukan sekali jalan.
- (−) Yang tersisa manual tetap manual. ADR ini **tidak** menghapus titik henti Fase 2;
  ia hanya memperkecilnya dari empat item jadi dua.


## ADR-022 — Ambang Event Timing diganti; "nol entri" tidak bisa dipenuhi siapa pun

**Tanggal:** 2026-09-12 · **Status:** Diterima · **Mengamandemen:** ADR-020

**Konteks.** ADR-020 menurunkan Event Timing dari sumber p95 menjadi gerbang
lulus/gagal, dengan aturan **"nol entri = lulus"**. Alasannya: entri dianggap hanya
muncul untuk interaksi yang melewati ambang, jadi ketiadaan entri berarti tidak ada
yang tersendat.

Asumsi itu **salah**, dan pengukuran 2026-09-12 membuktikannya. Dua aturan spec yang
tidak diperhitungkan:

1. **`durationThreshold` berlantai 16 ms.** Menyetelnya ke 0 tidak berpengaruh — spec
   menaikkannya kembali ke 16.
2. **`duration` dihitung sampai paint BERIKUTNYA**, lalu dibulatkan ke kelipatan 8 ms.

Di layar 60 Hz jarak antar-frame 16,7 ms. Keystroke yang jatuh tepat **sesudah** satu
frame menunggu hampir satu frame penuh sebelum ada yang dicat — itu saja sudah ~16 ms,
betapa pun cepatnya kode kita, dan ia terekam. Keystroke yang jatuh tepat **sebelum**
frame hanya menunggu 1–2 ms, tidak sampai ambang, dan tidak terekam.

Jadi entri yang muncul menandai **di mana keystroke jatuh dalam siklus frame**, bukan
seberapa lambat aplikasinya.

Data yang menutup perkara: **16 entri, semuanya 16 atau 24 ms** — kelipatan 8, tidak
satu pun di bawah 16, tidak satu pun di atas 24. Itu sidik jari kedua aturan spec di
atas. Jank yang sungguhan akan tampak sebagai sebaran lebar dengan ekor 50–150 ms.
Di jalan yang sama `autotype()` melaporkan p95 **7,9 ms** dispatch→paint dan nol long
task — dua pengukuran independen, dua-duanya menyatakan jalur keystroke lapang.

Ironisnya ADR-020 mengulangi persis kesalahan yang ia perbaiki: syarat yang
**kelihatan ketat padahal hanya bisa dilewati dengan berpura-pura** — di sini, dengan
keberuntungan atau dengan tidak mengetik sama sekali.

**Keputusan.** Ambang Event Timing untuk ketikan sungguhan:

| Ukuran | Batas | Artinya |
|---|---|---|
| Entri > 50 ms | **nol** | tidak ada interaksi yang benar-benar tersendat |
| p99 | **≤ 32 ms** | paling buruk dua frame: satu menunggu vsync, satu bekerja |

Karena `duration` dibulatkan ke kelipatan 8 ms, "> 50 ms" secara efektif berarti
**≥ 56 ms**. Jumlah entri **tidak lagi** menjadi kriteria apa pun — ia dilaporkan
sebagai konteks, bukan sebagai nilai.

Yang **tidak** berubah dari ADR-020: Event Timing tetap bukan sumber p95 utama. Angka
yang dibandingkan dengan anggaran 8 ms tetap dispatch→paint dari `autotype()`. Event
Timing menjawab pertanyaan berbeda — "apakah ada interaksi sungguhan yang tersendat?"
— dan ambang di atas adalah ambang untuk pertanyaan itu.

**Konsekuensi.**

- (+) Gerbangnya sekarang bisa dilewati oleh aplikasi yang memang cepat, dan tetap
  menolak yang tersendat. Sebelumnya ia tidak bisa dilewati oleh apa pun.
- (+) Ambangnya dinyatakan dalam satuan yang sesuai dengan alat ukurnya — frame dan
  kelipatan 8 ms — bukan dalam angka yang di bawah lantai instrumennya sendiri.
- (−) 32 ms terasa longgar dibanding 8 ms. Memang berbeda: 8 ms adalah anggaran
  **kerja kita**; 32 ms adalah anggaran **dari jari sampai piksel**, termasuk penundaan
  OS dan menunggu vsync yang bukan milik kita. Membandingkan keduanya adalah kesalahan
  kategori, dan itulah kesalahan ADR-020.
- (−) Ambang ini dikalibrasi untuk 60 Hz. Di layar 120 Hz lantainya turun dan ambangnya
  bisa diperketat; belum dikerjakan karena belum ada perangkatnya untuk diuji.


# Backlog ide

Tempat parkir untuk ide yang muncul di tengah pengerjaan. **Tidak dikerjakan sampai fase berjalan selesai.**

- [ ] Konten bahasa Indonesia (sudah direncanakan sebagai P2)
- [ ] Layout Dvorak / Colemak
- [ ] Programmer mode (simbol, indentasi, potongan kode)
- [ ] PWA / offline penuh
- [ ] Command palette (Ctrl+K)
- [ ] Ringkasan pencapaian yang bisa dibagikan
- [ ] Latensi bigram penuh (saat ini hanya top-50, P1)
- [ ] Playwright untuk 3 skenario E2E
- [ ] Router tulis sendiri (−13 KB) — jalan keluar kalau anggaran mengikat (ADR-018)
- [ ] Preact via `compat` (−60 KB) — jalan keluar darurat, evaluasi setelah Fase 2 (ADR-018)
- [ ] **Mode strict/non-strict bisa dipilih** — kandidat ADR, rinciannya di bawah

---

## Kandidat ADR — Mode input strict/non-strict bisa dipilih pengguna

**Diusulkan:** 2026-09-11 · **Status:** *Kandidat — belum diputuskan, belum dikerjakan*
· **Diputuskan:** uji pemula Fase 3 · **Dikerjakan:** Fase 4 (bersyarat)

> Ini **belum** ADR. Ia ditulis di sini, bukan di daftar ADR di atas, justru supaya
> tidak terbaca sebagai keputusan yang sudah diambil.

### Konteks

Dok. 02 §4 menetapkan satu baris tanpa ADR: *"Karakter salah tidak memblokir —
pengguna tetap bisa lanjut (mode non-strict)."* Kodenya patuh — `applyKey` selalu
memajukan kursor, benar atau salah.

Peninjauan pada 2026-09-11 menemukan satu konsekuensi yang belum pernah tertulis
di dokumen mana pun.

**Engine ini tidak punya model penyisipan.** Setiap karakter tercetak mengonsumsi
tepat satu sel target, jadi **satu tombol berlebih menggeser seluruh sisa drill** —
dan tiap karakter sesudahnya tercatat salah meski jarinya benar. Pada drill 500
karakter, pergeseran di awal bisa merusak seluruh sisanya, termasuk `confusions`,
`errorsByKey`, dan heatmap latensi yang menjadi bahan diagnosis (ADR-011, R-18).

Akibatnya arti backspace bergeser. Di bawah ADR-019 ia **tidak memperbaiki akurasi**;
yang ia perbaiki adalah **keselarasan**. Tapi untuk memakainya, pengguna harus sadar
bahwa ia sudah bergeser — dan itu berarti **melihat ke layar**, kebalikan dari yang
diajarkan aplikasi ini.

Terukur di `nonStrict.test.ts`: dua sesi dengan kesalahan jari yang **persis sama**
berselisih **20 poin akurasi**, dan satu-satunya pembeda adalah apakah pengguna
sempat melihat layar.

### Usulan

Mode input menjadi **pilihan pengguna**, dengan default per konteks:

| Halaman | Default | Alasan |
|---|---|---|
| `/learn` | **strict** | membentuk pola jari yang benar; pergeseran mustahil terjadi |
| `/practice` | **non-strict** | membangun kecepatan; ritme tidak boleh putus |

Tiga syarat yang mengikat usulan ini:

1. **Bisa diganti pengguna**, per halaman, tersimpan di pengaturan (dok. 05).
2. **Mode yang aktif harus terlihat**, bukan tersembunyi di pengaturan. Pengguna yang
   tertahan di mode strict harus langsung paham **kenapa** ia tertahan — kalau tidak,
   perilaku itu terbaca sebagai aplikasi yang rusak. Sorotan tombol berikutnya di
   virtual keyboard yang tetap menyala adalah bagian dari penjelasan itu.
3. **Strict layak jadi anak tangga assist ladder** (ADR-010): pengguna yang gagal tiga
   kali di lesson yang sama justru paling butuh dipaksa melakukan gerakan yang benar.

### Yang mendukung, dan yang menentang

**Mendukung strict di `/learn`:**
- Gerakan yang diulang menjadi gerakan yang **benar**; pola motorik salah tidak dibiarkan lewat.
- Sorotan tombol berikutnya tetap menyala sampai ditekan benar — panduan jari tidak
  menjauh justru saat paling dibutuhkan.
- Pergeseran mustahil, jadi data diagnosis bersih dan backspace tidak lagi wajib.
- Selaras dok. 04 §292: *"akurasi tidak pernah dikompromikan, kecepatan boleh menunggu."*

**Menentang (dan ini keberatan terkuat):**
- **Pengguna yang benar-benar tidak melihat layar akan menabrak tembok tanpa sadar.**
  Suara belum ada (Fase 8, opsional), jadi umpan baliknya hanya visual — padahal ia
  sedang tidak melihat. Ini yang belum bisa dijawab dokumen mana pun.
- Persona "menengah tersendat" (prioritas v1, ADR-010) akan jengkel kalau tertahan tiap
  typo. Dimitigasi oleh default non-strict di `/practice` dan `passed-by-placement`.

### Kenapa belum diputuskan sekarang

Instrumen untuk menjawabnya sudah dijadwalkan: **uji ke satu pemula nyata di ~hari 11**
(ADR-012), dengan instruksi mengamati tanpa memberi instruksi. Pertanyaan "pemula
tersesat saat diblokir, atau justru tersesat saat dibiarkan lanjut?" adalah persis yang
uji itu dirancang untuk menjawab. Memutuskannya sekarang berarti menebak beberapa hari
sebelum datanya tiba.

**Jadikan ini butir observasi eksplisit di uji tersebut** — bukan sekadar "amati",
melainkan: *hitung berapa kali ia bergeser, dan apakah ia menyadarinya.*

### Kalau jadi dikerjakan

Urutannya mengikat (dok. 00): ubah dok. 02 §4 → naikkan bagian ini menjadi ADR →
baru kode. Yang tersentuh: `applyKey` (mode), `TypingArea` (umpan balik tertahan),
`VirtualKeyboard` (sorotan bertahan), pengaturan + storage, dan
`src/lib/engine/__tests__/nonStrict.test.ts` — test karakterisasi yang sengaja dipasang
supaya **berubah merah** saat perilaku ini diubah.
