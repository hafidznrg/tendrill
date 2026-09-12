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


## ADR-023 — `swap` dengan fallback ber-metrik cocok, bukan `optional`

**Tanggal:** 2026-09-12 · **Status:** Diterima · **Diamandemen di hari yang sama**

**Konteks.** Kedua webfont memakai `font-display: swap`: teks tampil dengan font
fallback lebih dulu, lalu **ditukar** begitu webfont tiba. Pertukaran itu mengubah
metrik huruf, dan metrik yang berubah menggeser layout — persis yang dilarang
dok. 07 §1 poin 2.

Terukur 2026-09-12: nav bergeser **0,00035** saat pertukaran terjadi. Kecil — ambang
"baik" CLS adalah 0,1, jadi ini 300× di bawahnya — tetapi dokumennya menuntut **nol**,
dan "kecil" adalah awal dari semua anggaran yang akhirnya jebol.

Ini sumber layout shift **ketiga** yang ditemukan di fase yang sama, sesudah scrollbar
dan `.ta-root` setinggi 0 px. Ketiganya punya bentuk yang sama: ruang yang tidak
dipesan sejak paint pertama.

**Keputusan.** `font-display: optional` untuk kedua `@font-face`.

Browser memakai webfont **hanya** kalau ia siap dalam periode blocking ~100 ms; kalau
tidak, fallback dipakai dan **tidak pernah ditukar** sepanjang halaman itu hidup. Nol
pertukaran berarti nol pergeseran, tanpa syarat.

**Konsekuensi.**

- (+) Sumber layout shift ini hilang seluruhnya, bukan diperkecil.
- (+) Aman terhadap R-06. `charWidth` diukur setelah `document.fonts.ready` dari
  elemen yang benar-benar dirender, jadi ia mengukur font yang **terpasang** —
  bukan yang diharapkan. Kalau fallback yang dipakai, caret tetap presisi terhadap
  fallback itu.
- (−) **Kunjungan pertama dengan disk atau jaringan lambat akan tampil dengan font
  fallback sepenuhnya**, sampai pengguna memuat ulang. Ini konsekuensi yang dipilih
  sadar: satu kunjungan yang tampil kurang rapi lebih murah daripada setiap
  kunjungan yang bergeser. Font di-host sendiri, di-subset latin, dan dibundel,
  jadi ia hampir selalu memenangi balapan 100 ms.
- (−) Fallback stack (`ui-monospace, SFMono-Regular, Consolas, monospace`) jadi lebih
  sering terlihat daripada sebelumnya, sehingga ia layak diperlakukan sebagai bagian
  desain, bukan sebagai jaring pengaman.

### Amandemen — `optional` dicoba, gagal, diganti

**`optional` ternyata kalah balapan di lapangan.** Terukur di browser pemilik
(bukan hanya di panel otomasi): `charWidth` **13,195 px** alih-alih 14,4 — pengguna
melihat **Consolas**, bukan JetBrains Mono. Terjadi di dev server maupun build
produksi, dan CSS yang dilayani terbukti berisi `optional`.

Jadi harga "kunjungan pertama tampil dengan fallback" yang diterima di keputusan awal
ternyata bukan kejadian langka, melainkan **kejadian normal**. Dasar keputusannya
salah, jadi keputusannya diganti.

**Keputusan pengganti.** Kembali ke **`font-display: swap`**, dan hilangkan
pergeserannya dari sumbernya: **cocokkan metrik fallback-nya.**

Layout hanya bergeser kalau **lebar karakter** berubah saat font ditukar. Untuk
monospace, lebar itu satu angka — dan bisa dicocokkan persis. Diukur langsung dari
berkas fontnya (2026-09-12):

| Font | Advance | |
|---|---|---|
| JetBrains Mono | 0,600000 em | target |
| Consolas | 0,549805 em | fallback di Windows |
| | **109,1296 %** | `size-adjust` |

```css
@font-face {
  font-family: 'JetBrains Mono Fallback';
  src: local('Consolas');
  size-adjust: 109.1296%;
}
```

Ditaruh **tepat sesudah** font aslinya di `--font-mono`. Di macOS/Linux
`local('Consolas')` gagal dan stack jatuh ke `ui-monospace`/`monospace` yang memang
sudah ~0,6 em.

**Terverifikasi 2026-09-12:** JetBrains Mono 14,4 px, fallback yang dicocokkan
**14,39613 px** — selisih **0,00387 px per karakter**, atau **0,2 px** terakumulasi
di baris penuh 52 kolom. Jauh di bawah ambang 1 px presisi caret. Dan `charWidth`
halaman kembali **14,4**: webfont-nya benar-benar dipakai.

**Konsekuensi.**

- (+) **Unggul di kedua sisi**: webfont tetap dipakai (tidak seperti `optional`), dan
  pertukarannya tidak menggeser apa pun (tidak seperti `swap` polos).
- (+) Tidak ada kunjungan yang "terkorbankan". Harga yang diterima di keputusan awal
  ternyata tidak perlu dibayar sama sekali.
- (−) Angka `109,1296 %` terikat pada Consolas. Kalau Windows suatu saat mengganti
  font monospace defaultnya, angka ini perlu diukur ulang — karena itu cara
  mengukurnya ditulis di komentar `styles.css`, bukan hanya hasilnya.
- (−) Hanya jalur **mono** yang dicocokkan. `IBM Plex Sans` tetap `swap` tanpa
  pencocokan: font proporsional tidak bisa disamakan hanya dengan satu angka, dan
  pergeseran yang terukur 2026-09-12 seluruhnya berasal dari elemen `font-mono`.
  **Ukur ulang; kalau ternyata sans ikut menggeser, tangani dengan data, bukan
  dengan tebakan.**

**Pelajaran yang lebih umum.** Keputusan awal diambil dari penalaran yang benar
tentang spec, tetapi tanpa mengukur apakah balapan 100 ms itu menang atau kalah di
mesin sungguhan. Penalaran tentang spec tidak menggantikan pengukuran — pola yang
sama sudah muncul tiga kali minggu ini (`perf:heap`, `autotype`, dan sekarang ini).


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
- [x] **Mode strict/non-strict bisa dipilih** — diputuskan 2026-09-12, lihat ADR-029
- [ ] **Siluet tangan/jari di virtual keyboard** — usul pemula di uji 2026-09-12: "biar
      tahu harus pakai jari apa". Warna jari sudah ada, tapi ia memberi tahu *jari mana
      yang bertanggung jawab*, bukan *di mana tangan beristirahat* — dan `h` dan `j`
      berwarna sama persis karena memang satu jari. Ditunda, bukan ditolak: perbaikan
      yang lebih murah (panduan anchoring sebelum `u1-l1`) dikerjakan lebih dulu, dan
      kalau itu sudah cukup, siluet jadi tidak perlu. Evaluasi ulang di uji pemula
      berikutnya.
- [ ] **Sorot Backspace saat ada karakter salah yang bisa dikoreksi** — uji yang sama
      menemukan pemula berhenti dan **melihat keyboard** untuk mencari Backspace, jadi
      satu-satunya jalur koreksi justru mematahkan "jangan melihat keyboard". Murah
      (pelukis sorotan sudah ada), tapi menyentuh jalur keystroke — jadi ia butuh
      pengukuran, bukan sekadar ditambahkan.

---

## ADR-024 — Satu lesson = beberapa sesi engine, dinilai sebagai satu gabungan

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Dok. 04 §2 menetapkan satu lesson punya 3–6 drill yang "dikerjakan
berurutan **dalam satu sesi**". Tetapi engine (dok. 03) hanya mengenal **satu
`target` per sesi**: `createSession(target, cols)` mengalokasikan buffer log, sel
karakter, dan `lineStarts` sekali, lalu tidak pernah menerima teks baru — justru
itulah yang membuat janji "nol alokasi per keystroke" bisa ditepati.

Dua dokumen ini tidak pernah dipertemukan sebelum Fase 3. Ada tiga jalan:

1. **Sambungkan seluruh drill menjadi satu teks.** Paling sederhana, tapi untuk
   u1-l4 hasilnya ~600 karakter = ~7 menit bagi pemula 16 WPM. Terlalu panjang,
   dan drill kehilangan batasnya — padahal batas itu yang membuat lesson terasa
   punya langkah.
2. **Beri engine kemampuan mengganti target di tengah sesi.** Menyentuh bagian
   paling sensitif Fase 1 demi kenyamanan lapisan UI.
3. **Satu sesi engine per drill, hasil lesson = gabungannya.** Dipilih.

**Keputusan.** Tiap drill dijalankan sebagai sesi engine sendiri, berurutan tanpa
layar perantara. Di akhir drill terakhir, `combineResults()` (baru,
`src/lib/engine/combine.ts`) menggabungkan semuanya menjadi satu `SessionResult`,
dan **kriteria kelulusan dinilai terhadap gabungan itu** — bukan terhadap drill
terakhir.

Menilai drill terakhir saja adalah jebakan yang mudah tidak terlihat: pengguna bisa
lulus lesson dengan mengabaikan empat drill pertama, dan angka yang tercatat di
`/stats` tidak akan mewakili sesi yang benar-benar ia jalani.

**Aturan penggabungan yang mengikat:**

- Keystroke, keystroke benar, dan durasi **dijumlahkan**; WPM & akurasi dihitung
  dari total. Bukan rata-rata dari rata-rata — itu memberi drill 12 karakter bobot
  yang sama dengan drill 200 karakter.
- `consistency` **adalah** rata-rata per drill, dan ini pengecualian yang sadar:
  menghitungnya ulang dari gabungan interval akan menghukum jeda **antar** drill,
  padahal jeda itu bukan ketidakkonsistenan mengetik.
- Satu hasil dikembalikan apa adanya (identitas), daftar kosong → `null`.

**Konsekuensi.**

- (+) Engine tidak disentuh sama sekali; batas Fase 1 tetap utuh.
- (+) Rumus WPM tetap hidup di satu tempat (folder engine), bukan bocor ke halaman.
- (+) Satu `SessionRecord` per lesson, bukan enam — `sessions` tidak membengkak dan
   riwayat tetap terbaca sebagai "satu kali mengerjakan u1-l4".
- (−) Pengguna tidak bisa mengulang **satu** drill; `Tab` mengulang dari drill 1.
   Diterima: unit latihannya adalah lesson, dan tangga bantuan (dok. 04 §9) sudah
   menyediakan drill mikro untuk tombol yang gagal.
- (−) Metrik live nol lagi di tiap perpindahan drill. Diterima — tiap drill memang
   pengukuran tersendiri, dan angka akhirnya datang dari gabungan.

---

## ADR-025 — Apa yang dihitung sebagai "percobaan", dan tangga dibekukan ke percobaan yang baru selesai

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Seluruh assist ladder (dok. 04 §9) digerakkan satu angka:
`progress.lessons[id].attempts`. Dok. 04 tidak pernah menyatakan apa yang menaikkan
angka itu, dan Fase 3 menemukan tiga kejadian yang jawabannya tidak sama.

**Keputusan.**

1. **Sesi yang di-void tidak dihitung sebagai percobaan.** Jeda > 30 detik berarti
   pengguna pergi, bukan kesulitan. Menghitungnya akan menyalakan tangga bantuan
   karena seseorang mengambil minum.
2. **Drill mikro tidak dihitung sebagai percobaan**, tidak disimpan sebagai hasil
   lesson, dan tidak dinilai terhadap kriteria. Ia bantuan; bantuan yang menaikkan
   hitungan percobaan akan mendorong pengguna ke tawaran "lanjut saja" justru karena
   ia menerima bantuan.
3. **Gagal sesudah pernah lulus tidak mencabut kelulusan.** Mengulang lesson lama
   lalu jelek tidak boleh mengunci lesson-lesson sesudahnya — itu terbaca sebagai
   progres yang hilang, bukan sebagai umpan balik.
4. **Tingkat bantuan yang ditampilkan dibekukan ke percobaan yang baru saja selesai.**

Poin 4 lahir dari bug nyata, dan bugnya sempat lolos dari penalaran: `recordAttempt`
sudah menaikkan `attempts` **sebelum** layar hasil dirender, sehingga angka percobaan
yang tersedia di sana sudah menunjuk percobaan **berikutnya**. Akibatnya seluruh
tangga bergeser satu tingkat lebih awal — catatan "target diturunkan" muncul di
percobaan yang targetnya belum diturunkan, dan tawaran "lanjut saja" muncul di
percobaan ke-5. Ditemukan `learnFlow.test.tsx`, bukan oleh membaca kode.

**Konsekuensi.**

- (+) Tangga bantuan hanya bergerak karena kesulitan nyata.
- (+) `attemptResult` menyimpan kriteria dan nomor percobaan yang dipakai, jadi layar
  hasil tidak pernah menampilkan angka yang sudah berubah di belakangnya.
- (−) Ada dua pengertian "percobaan" yang harus tetap dibedakan di kode: yang sedang
  dikerjakan dan yang baru selesai. Diberi nama berbeda (`attempt` vs `shownAssist`)
  dan diberi komentar, karena bug ini akan kembali kalau keduanya disamakan lagi.

---

## ADR-026 — `Shift` di generator berarti kapital berbobot separuh

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Dok. 04 §15 poin 3 menetapkan `Shift` adalah satu-satunya pseudo-key:
ia membuka huruf kapital dari huruf kecil yang sudah diperkenalkan. Validator sudah
patuh. Tetapi `u3-review` memuat `'Shift'` di `reviewKeys` **dan** punya drill
`weighted-random` — dan dok. 04 §8 tidak pernah mengatakan apa yang harus dilakukan
generator dengan tombol yang bukan karakter.

Dibiarkan apa adanya, generator akan menulis huruf `S` (dari `'Shift'[0]`) atau
menyisipkan teks "Shift" ke dalam drill. Keduanya salah, dan keduanya akan lolos
validator karena validator hanya memeriksa isi statis.

**Keputusan.** Di generator, `Shift` tidak pernah menjadi karakter. Kehadirannya
menambahkan **varian kapital** dari huruf yang sudah ada di kandidat, dengan bobot
**separuh** bobot huruf kecilnya.

Separuh, bukan sama: dengan bobot sama, drill berubah menjadi mayoritas chord dua
tangan, dan yang dilatih justru bukan ritme yang dimaksud unit itu. Separuh membuat
kapital hadir di setiap drill tanpa mendominasinya.

**Konsekuensi.**

- (+) `u3-review` dan seluruh lesson sesudah Shift menghasilkan drill yang sah.
- (+) Aturan kumulatif tetap terjaga untuk teks yang **dibangkitkan runtime** — dan
  ini sekarang diuji untuk ketiga puluh tujuh lesson di `drills.test.ts`, dengan
  kontrol negatif (menyelundupkan satu huruf terlarang membuat gerbangnya merah).
- (−) Angka "separuh" adalah pilihan desain tanpa data. Kalau uji pemula menunjukkan
  porsi kapital terasa salah, yang diubah satu konstanta di `charsFor()`.

---

## ADR-027 — `/posture`: satu layar anchoring sebelum lesson pertama

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Uji pemula 2026-09-12 (DoD Fase 3) menemukan satu kegagalan yang tidak
tertangkap 286 test: **tangan kanan mendarat dengan telunjuk di `h`, bukan `j`.**
Seluruh tangan kanan bergeser satu tombol ke kiri, sebelum keystroke pertama. Yang
diajarkan `u1-l1` sendiri melekat — `f` dan `j` keduanya ditekan dengan telunjuk —
jadi yang salah bukan lesson-nya, melainkan yang terjadi **sebelum** lesson dimulai.

Konsekuensinya melampaui Lesson 1: dengan telunjuk kanan di `h`, jari tengah jatuh di
`j`, manis di `k`, kelingking di `l`. `u1-l2` (`d k`) dan `u1-l3` (`s l`) akan dilatih
dengan jari yang salah sejak ketukan pertama, dan `u1-l5` yang mengajarkan `g h`
sebagai **julur telunjuk** bertabrakan dengan tangan yang justru beristirahat di sana.

Tiga hal yang seharusnya mencegahnya, dan kenapa ketiganya tidak:

| Yang ada | Kenapa tidak cukup |
|---|---|
| Warna jari di virtual keyboard (dok. 07 §4) | **Secara struktural tidak bisa.** `h` dan `j` sama-sama telunjuk kanan, jadi warnanya memang identik. Warna menjawab "jari mana yang bertanggung jawab", bukan "di mana jari beristirahat" |
| Penanda tonjolan home row di kedelapan tombol | Ada, dan terlewat. Ia penanda, bukan instruksi |
| `intro` `u1-l1` ("Telunjuk kiri di F, telunjuk kanan di J — raba dulu tanpa melihat") | Terbaca **sesudah** tangan sudah terlanjur mendarat. Teks yang benar di saat yang salah |

Dan yang paling menentukan: **panduan postur memang belum pernah dibuat.** Dok. 02 §2
sudah menetapkan alurnya sejak v2 (`[Mulai dari nol] → panduan postur → /learn/u1-l1`)
dan dok. 04 §13 masih mencatatnya belum ditulis. Fase 3 menyambungkan CTA langsung ke
`u1-l1` — jadi tidak ada satu titik pun di aplikasi yang pernah mengatakan di mana
tangan diletakkan.

**Keputusan.** Tambahkan **satu halaman**, `/posture`, di antara CTA "Mulai dari nol"
dan `u1-l1`. Sekali tampil per perangkat (`meta.postureSeenAt`), **selalu bisa
dilewati**, dan tetap bisa dibuka lagi dari `/learn`.

Isinya diikat oleh apa yang gagal, bukan oleh apa yang enak ditulis:

1. Delapan jari di `asdf jkl;`, **raba tonjolan F dan J tanpa melihat**.
2. **Periksa telunjuk kanan: `j`, bukan `h`** — disebut eksplisit, karena persis ini
   yang meleset.
3. Jempol di spasi dan tidak pernah pindah.
4. Kalau posisi hilang: angkat tangan, letakkan ulang dengan meraba — bukan mengintip.
5. **Backspace disebutkan letaknya** (ujung kanan atas, kelingking kanan). Uji yang
   sama menemukan pemula berhenti dan melihat keyboard untuk mencarinya, sehingga
   satu-satunya jalur koreksi justru mematahkan "jangan melihat keyboard".

**Kenapa halaman, bukan modal.** Dok. 02 §2 melarang modal sebelum keystroke pertama.
Halaman punya URL, bisa dibuka ulang, bisa ditutup dengan tombol yang terlihat sejak
paint pertama, dan tidak menjebak siapa pun di belakang lapisan gelap.

**Kenapa bukan siluet jari** (usul pemula di uji yang sama). Siluet mengobati layar
keyboard; yang hilang adalah instruksi sebelum tangan menyentuh keyboard. Perbaikan
termurah dicoba dulu — kalau uji pemula berikutnya masih menemukan anchoring meleset,
siluet naik dari Backlog ide menjadi kandidat berikutnya.

**Konsekuensi.**

- (+) Kegagalan yang teramati punya penawar langsung, dikerjakan di fase yang sama
  saat ia ditemukan — persis yang diminta kalimat DoD Fase 3.
- (+) Peta halaman tetap kecil: 8 rute, dan yang baru ini nol biaya di bundel awal
  (chunk rute sendiri, hanya dimuat kalau dibuka).
- (−) Satu layar berdiri di antara CTA dan keystroke pertama — bertentangan dengan
  semangat "mulai mengetik dalam tiga detik". Dimitigasi: tombol lewati terlihat sejak
  paint pertama, dan layarnya tidak pernah muncul dua kali.
- (−) `meta` bertambah satu field. Aditif dan opsional, jadi tanpa migrasi (dok. 05 §4).
- (−) **Belum diuji ke pemula.** Halaman ini lahir dari satu pengamatan, dan belum ada
  bukti ia memperbaikinya. Itu pertanyaan pertama untuk uji pemula berikutnya: dengan
  panduan ini, apakah tangan kanannya mendarat di `j`?

---

## ADR-028 — Lebar baris diukur, bukan dikonstankan; dan CSS tidak boleh ikut membungkus

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Dilaporkan 2026-09-12: teks sudah berpindah ke baris berikutnya, tetapi
caret tertinggal di baris sebelumnya. Diukur langsung di build produksi, bukan
disimpulkan dari kode:

| Yang diukur | Nilai |
|---|---|
| `charWidth` | 14,4 px |
| Lebar `.ta-text` | **720 px** (`max-w-3xl` 768 − `px-6` 2×24) |
| Kolom yang **muat** | **50** |
| `COLS` yang dipakai engine | **52** |
| Baris logis drill | 3 baris: 52, 48, 20 karakter |
| Baris **visual** di layar | **4** — mulai di indeks 0, **47**, 52, 100 |

Baris logis pertama (52 karakter) dipotong browser di indeks 47. Sejak titik itu setiap
baris logis berikutnya tergambar satu baris visual lebih bawah daripada yang dihitung
caret — dan caret dihitung aritmetika dari `lineStarts` (dok. 03 §8), yang tidak tahu
apa-apa soal potongan tambahan itu.

Dua kesalahan bertemu, dan keduanya perlu diperbaiki:

1. **`COLS = 52` adalah angka yang tidak pernah diperiksa terhadap kotaknya.** Ia
   diambil dari rentang "50–60 karakter" dok. 07 §2 dan diperlakukan sebagai fakta.
   Lebar default aplikasi sendiri hanya memuat 50 — jadi ini **bukan** kasus jendela
   sempit, melainkan **setiap pengguna, pada zoom normal**.
2. **`white-space: pre-wrap` membuat kegagalannya senyap.** CSS-nya sudah diberi
   komentar "teks dibungkus engine, bukan CSS", tetapi `pre-wrap` tetap mengizinkan
   browser memotong baris ketika kotaknya kurang lebar. Yang seharusnya menjadi
   luberan yang kelihatan, berubah menjadi caret yang salah tanpa satu pun pesan.

Kenapa baru terlihat sekarang: sampai Fase 2, layar sesi hanya pernah menampilkan drill
statis `u1-l1` yang panjangnya 35 karakter — tidak pernah ada baris yang cukup panjang
untuk menyentuh batas. Drill dinamis Fase 3 (120–200 karakter) adalah yang pertama
menghasilkan baris logis 52 karakter.

**Keputusan.**

1. **`cols` diturunkan dari pengukuran**, bukan dari konstanta:
   `cols = clamp(floor(lebarTeks / charWidth), 20, 60)`. Diukur di tempat yang sama
   dengan `charWidth` (`useCharMetrics`, setelah `document.fonts.ready`), jadi ia tidak
   menambah satu pun pengukuran DOM di jalur input (dok. 06 §2 batasan 7 tetap utuh).
2. **`white-space: pre`**, bukan `pre-wrap`. Kalau suatu saat angkanya meleset lagi,
   yang terjadi adalah teks terpotong di tepi — kelihatan, dan caretnya tetap jujur.
   Kegagalan senyap ditukar dengan kegagalan berisik, sengaja.
3. **Perubahan lebar me-*rewrap*, bukan me-*restart*.** `useTypingSession` membuat sesi
   baru setiap `cols` berubah; dengan `cols` yang kini ikut berubah saat jendela
   diubah ukurannya, itu berarti mengubah ukuran jendela di tengah drill akan
   **menghapus ketikan pengguna**. Ditambahkan `rewrapSession(session, cols)` di engine:
   ia menghitung ulang `lineStarts` saja dan tidak menyentuh sel, log, maupun
   akumulator.

**Konsekuensi.**

- (+) Caret benar pada lebar jendela dan tingkat zoom mana pun, karena angkanya berasal
  dari kotak yang sebenarnya. Ini sekaligus menutup sisa utang R-06 soal zoom: zoom
  mengubah `charWidth`, dan `cols` kini ikut.
- (+) Mengubah ukuran jendela di tengah drill tidak lagi berbahaya — ia hanya membungkus
  ulang.
- (−) Lebar baris tidak lagi selalu 50–60 karakter seperti dok. 07 §2. Pada jendela
  sempit ia turun sampai 20. Diterima **dengan sadar**: baris 35 karakter yang caretnya
  benar lebih baik daripada baris 52 karakter yang caretnya meleset, dan aplikasi ini
  desktop-first sehingga kasus itu jarang. Dok. 07 §2 diperbarui, bukan dilanggar
  diam-diam.
- (−) Satu pengukuran DOM tambahan (`clientWidth`) per perubahan geometri. Ia terjadi
  bersama pengukuran `charWidth` yang memang sudah ada, jadi tidak menambah reflow baru.

**Terukur sesudah perbaikan** (build produksi, 2026-09-12):

| | Sebelum | Sesudah |
|---|---|---|
| Baris logis vs visual (drill 120 karakter) | 3 vs **4** | **3 vs 3**, indeks awal identik: 0, 50, 100 |
| Selisih caret ↔ span di posisi kursor | satu baris (43,2 px) | **≤ 0,31 px** mendatar; tegak konstan −6 px di **setiap** baris (offset kotak-baris vs kotak-glif, bukan salah baris) |
| Mengubah lebar di tengah drill | sesi dibuat ulang, ketikan hilang | 101 karakter yang sudah diketik **tetap utuh**, baris dibungkus ulang 50/50/20 → 28/32/30/30 |

Satu catatan kejujuran soal pengukuran terakhir: panel browser otomasi **tidak
mengirim event `resize`** saat viewport-nya diemulasi, jadi jalur itu diuji dengan
membangkitkan `resize` secara manual di halaman yang sama. Yang terbukti lewat panel:
efeknya benar begitu event-nya tiba.

**Ditutup 2026-09-12:** pemilik memeriksanya di jendela sungguhan — `resize` tiba dan
pembungkusan ulang berjalan. Di sesi yang sama `caretCheck()` juga lulus sesudah zoom
(`selisihCaret` 0, `kolomTerjauhMeleset` 0) dan `watchCLS()` memberi `cls` 0 dengan nol
shift. Dengan itu sisa terakhir R-06 ikut lunas (dok. 08 Fase 2).

**Pelajaran yang sama, ketiga kalinya.** Dok. 08 mencatat "curigai ruang yang tidak
dipesan sejak paint pertama"; ini varian keempatnya — **angka yang diasumsikan muat,
tanpa pernah diukur terhadap kotaknya.** Dan seperti tiga sebelumnya, ia tidak
tertangkap satu pun dari 289 test, karena jsdom tidak punya layout. Yang menemukannya
manusia yang memakai aplikasinya.

---

## ADR-029 — Mode input bisa dipilih: strict default di `/learn`, non-strict di `/practice`

**Tanggal:** 2026-09-12 · **Status:** Diterima · **Menggantikan** kandidat ADR di bawah
· **Mengubah** dok. 02 §4

**Konteks.** Dok. 02 §4 menetapkan satu baris tanpa ADR sejak awal: *"karakter salah
tidak memblokir"*. Peninjauan 2026-09-11 menemukan konsekuensinya: engine tidak punya
model penyisipan, jadi **satu tombol berlebih menggeser seluruh sisa drill** dan setiap
karakter sesudahnya tercatat salah meski jarinya benar — selisih 20 poin akurasi dari
kesalahan jari yang persis sama (`nonStrict.test.ts`).

Keputusannya ditunda menunggu uji pemula. Datanya sekarang ada, dari dua uji:

| Yang teramati | Arahnya |
|---|---|
| Salah ketik disadari dan langsung dikoreksi sendiri | Melemahkan keberatan terkuat terhadap strict ("menabrak tembok tanpa sadar") |
| **Berhenti dan melihat keyboard untuk mencari Backspace** | Mendukung strict: di strict, jalur koreksi itu **tidak ada** — cukup tekan tombol yang benar |
| Nol ketukan berlebih | Tidak memutuskan apa pun; kecepatannya masih pelan (lihat catatan di kandidat di bawah) |

**Keputusan pemilik, 2026-09-12:** mode input **bisa dipilih pengguna**, dengan default
yang berbeda per halaman:

| Halaman | Default | Alasan |
|---|---|---|
| `/learn` | **strict** | Di sini yang dibentuk adalah memori otot. Gerakan yang salah tidak boleh lewat, dan pergeseran tidak boleh mencemari diagnosis |
| `/practice` | **non-strict** | Di sini yang diukur adalah kecepatan mengalir; tertahan tiap typo mengubah sifat latihannya |

Aturan yang mengikat implementasinya:

1. **Pengguna bebas mengganti mode di lesson mana pun**, lewat kontrol yang terlihat di
   layar sesi — **tanpa membuka pengaturan**. Pengguna yang tertahan harus bisa langsung
   melihat KENAPA ia tertahan; kalau tidak, itu terbaca sebagai aplikasi rusak.
2. **Pilihannya bertahan** ke lesson berikutnya, disimpan per-halaman di
   `typing:settings` — bukan per-lesson, dan bukan hanya untuk sesi berjalan.
3. **Sorotan tombol berikutnya bertahan** sampai ditekan benar. Ini jatuh dengan
   sendirinya dari desainnya: kursor tidak maju, jadi pelukis tidak pernah dipanggil
   ulang — panduan jari justru tetap ada di saat ia paling dibutuhkan.
4. **Akurasi tetap dihitung dari percobaan pertama** (ADR-003 tidak berubah). Tombol
   salah di mode strict tetap **tercatat salah**; ia hanya tidak memajukan kursor.
   Menahan tanpa mencatat akan membuat akurasi selalu 100% dan membunuh seluruh
   diagnosis.
5. **Percobaan salah berulang di sel yang sama tidak dihitung berkali-kali** —
   konsekuensi ADR-019 yang sudah ada: hanya percobaan pertama yang masuk log dan
   akumulator. Menghukum orang yang menekan lima tombol salah lima kali lebih berat
   daripada yang menyerah tidak masuk akal.

**Konsekuensi.**

- (+) Pergeseran mustahil di `/learn`, jadi data diagnosis dan `keystats` bersih.
- (+) Backspace tidak lagi wajib di jalur belajar — persis hambatan yang teramati.
- (−) `nonStrict.test.ts` berubah: ia test karakterisasi yang memang dipasang untuk
  berubah merah di titik ini. **Diperbarui dengan sengaja, bukan dihapus** — ia sekarang
  menjaga KEDUA mode, dan bagian non-strict-nya tetap berlaku karena mode itu masih ada.
- (−) Pemula yang benar-benar tidak melihat layar akan tertahan tanpa tahu kenapa.
  Dimitigasi: sorotan tombol berikutnya bertahan, mode terlihat di layar, dan
  menggantinya satu klik. Suara (Fase 8) akan menutup sisanya.
- (−) Satu percabangan baru di `applyKey`, yaitu jalur terpanas di seluruh aplikasi.
  Ia satu perbandingan boolean pada nilai yang sudah ada di sesi — nol alokasi, dan
  `npm run perf:heap` tetap menjaganya.

---

## Kandidat ADR — Mode input strict/non-strict bisa dipilih pengguna

**Diusulkan:** 2026-09-11 · **Status:** ✅ **Diputuskan 2026-09-12 → ADR-029 di atas**
· **Diputuskan lewat:** dua uji pemula Fase 3

> **Bagian ini disimpan apa adanya, sebagai catatan bagaimana keputusannya diambil** —
> termasuk keberatan-keberatan yang akhirnya kalah, dan data yang ternyata tidak
> memutuskan apa pun. Yang berlaku sekarang adalah ADR-029.

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

### Data uji pertama (2026-09-12) — dan kenapa ia belum memutuskan apa pun

| Yang diamati | Bacaannya untuk kandidat ini |
|---|---|
| Salah ketik **disadari** dan langsung dikoreksi sendiri | Keberatan terkuat terhadap strict ("pengguna menabrak tembok tanpa sadar") tidak terlihat — tapi pada pemula yang memang sedang melihat layar |
| **Nol** ketukan berlebih teramati | **Bukan bukti.** Kecepatannya masih pelan; pergeseran adalah gejala kecepatan, dan pemula 15 WPM mengetik satu tombol pada satu waktu |
| Berhenti dan **melihat keyboard untuk mencari Backspace** | Menguatkan argumen pendukung yang sudah tertulis di atas ("backspace tidak lagi wajib") — dari butir teoretis menjadi biaya yang terlihat |

Jadi uji pertama menggeser satu argumen **mendukung** menjadi lebih kuat, dan tidak
menghasilkan satu pun angka yang bisa menolak. Menutup kandidat ini sekarang berarti
menyimpulkan dari kondisi yang tidak pernah menguji hal yang dimaksud.

**Pemicu keputusan** (ditulis sekarang supaya tidak menggantung): uji pemula kedua —
sesudah `/posture` ada, idealnya pada orang yang sudah sampai Unit 2–3 — atau pengguna
mana pun yang mencapai ~30 WPM di `/learn`, mana yang lebih dulu.

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

---

## ADR-030 — Tes kelulusan kursus ditandai di data, dinilai terpisah dari kelulusan lesson

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Dok. 04 §4a v3 menetapkan kelulusan akhir **40 WPM / 95%** diukur pada
"**dua drill prosa terakhir**" `u6-review`, terpisah dari drill angka/simbol yang
dinilai dengan kriteria unit (25 WPM / 93%). Alasannya kuat dan tidak berubah:
mencampur `%` dan `&` ke dalam satu ambang menghukum kemampuan yang sudah terbentuk
gara-gara karakter yang memang lambat untuk semua orang.

Yang tidak pernah ada: cara mesin mengetahui drill mana itu. Sampai Fase 4, `u6-review`
hanya data — dan data tidak menilai dirinya sendiri, jadi lubang ini tidak terlihat
selama tiga fase. Halaman sesi menilai **gabungan seluruh drill** terhadap
`passCriteria` (ADR-024), dan angka 40/95 tidak muncul satu kali pun di dalam `src/`.

Tiga jalan:

1. **Aturan posisi — "dua drill terakhir".** Nol perubahan data. Tapi ia diam-diam
   salah begitu ada yang menambahkan satu drill di akhir, dan salahnya tidak
   kelihatan: tes kelulusan berpindah ke drill lain tanpa satu pun test memerah.
2. **Aturan tipe — "semua drill `type: 'sentences'`".** Juga nol perubahan data, dan
   juga salah: drill `sentences` pertama di `u6-review` justru yang penuh angka dan
   simbol (`#4021`, `$1,350`, `15%`) — persis yang dok. 04 minta **dikeluarkan**.
3. **Penanda eksplisit `graduation: true` di drill-nya.** Dipilih.

**Keputusan.** `Drill` bertambah field opsional `graduation?: true`. Dua drill prosa
terakhir `u6-review` memakainya; 35 lesson lain tidak, jadi bagi mereka tidak ada yang
berubah. Penilaian satu percobaan lesson pecah jadi dua yang tidak beririsan:

| Dinilai | Dari drill | Terhadap | Akibatnya |
|---|---|---|---|
| Kelulusan lesson | yang **bukan** `graduation` | `passCriteria` (+ assist ladder) | membuka lesson berikutnya |
| Kelulusan kursus | yang `graduation` | **tetap 40 WPM / 95%** | ditulis ke `meta.graduatedAt`, tidak menggerbangi apa pun |

Tiga aturan yang ikut mengikat:

- **Kelulusan kursus tidak pernah menggerbangi apa pun.** Gagal 40 WPM sambil lulus
  25 WPM tetap lulus `u6-review`. Ia keterangan tentang di mana pengguna berada,
  bukan pintu — dan menjadikannya pintu berarti kurikulum berakhir dengan tembok
  yang tidak punya assist ladder.
- **Ambangnya tidak pernah diturunkan**, termasuk oleh percobaan ke-4 yang menurunkan
  WPM lesson 20% (dok. 04 §9). Ini satu-satunya angka yang dipakai pengguna untuk
  menjawab "aku sudah bisa mengetik?", dan angka yang bisa ditawar berhenti berarti.
- **`graduatedAt` ditulis sekali dan tidak dicabut** (dok. 05 §3). Gagal lagi besok
  tidak menghapus hari itu.

**Konsekuensi.**

- (+) Angka 40/95 akhirnya hidup di kode, bukan hanya di dokumen — dan di satu tempat
  (`GRADUATION_CRITERIA`), bukan tersebar.
- (+) Validator bisa menegakkannya: `graduation` hanya di `u6-review`, tepat 2 drill,
  dan lesson itu wajib masih punya drill non-`graduation` untuk dinilai.
- (+) Menambah drill di akhir `u6-review` tidak lagi diam-diam memindahkan tes kelulusan.
- (−) Satu field lagi di `Drill` yang hanya dipakai satu lesson. Diterima: alternatifnya
  adalah aturan implisit yang benar hari ini dan salah diam-diam besok — bentuk bug yang
  sudah dua kali memakan fase ini ("angka yang dibaca dari sumber yang sudah berubah di
  belakangnya", catatan penutup Fase 3).
- (−) Layar hasil `u6-review` menampilkan **dua** putusan. Diterima, dan memang itu yang
  diminta dok. 04: kalimat pertamanya menyebutkan mana yang membuka lesson berikutnya.

---

## ADR-031 — Tiga gerbang baru dari audit Fase 1–4; graf chunk ikut diukur, bukan hanya bundel awal

**Tanggal:** 2026-09-12 · **Status:** Diterima

**Konteks.** Audit lintas Fase 1–4 menemukan tiga cacat. Ketiganya punya bentuk
yang sama dan itulah yang membuat ADR ini ada: **semuanya berada tepat di luar
jangkauan gerbang yang sudah dimiliki proyek.**

| Cacat | Gerbang yang seharusnya menangkap | Kenapa ia buta |
|---|---|---|
| Halaman sesi menarik SELURUH kurikulum | `npm run budget` | ia mengukur **bundel awal**; chunk lazy yang salah gaul tidak pernah membuatnya merah |
| `read()` tidak melihat tulisan tertunda | `storage.test.ts` | ia menguji "flush menulis", bukan "read melihat yang belum ter-flush" |
| Dua drill berurutan berteks sama menggantungkan layar | validator kurikulum | ia memeriksa isi tiap drill, bukan **relasi antar** drill |

**1. Graf chunk.** `loadLesson.ts` sudah menepati aturan CLAUDE.md §2 di sumber —
ia sengaja mengimpor `units.ts`, bukan `index.ts`, lengkap dengan komentarnya.
Aturannya tetap batal, karena `manualChunks` melempar **keduanya** ke satu chunk
`curriculum-map`, dan `index.ts` mengimpor statis ketujuh unit. Jadi membuka satu
lesson mengunduh seluruh kurikulum. Ini berlaku sejak Fase 3; Fase 4 tidak
menyebabkannya (dibuktikan dengan membangun ulang tanpa impor Fase 4).

Pelajarannya melampaui satu bug: **aturan impor di sumber tidak berarti apa-apa
sampai keluaran bundler-nya ikut diukur.** Sebuah berkas config bisa membatalkan
batasan arsitektur tanpa satu baris `import` pun berubah.

Keputusan: `units.ts`/`types.ts` mendapat chunk sendiri, dan
`scripts/check-chunk-graph.ts` menelusuri impor **statis** dari chunk tiap
halaman sesi lalu menolak `curriculum-map`, `unit-N`, dan `wordlists`. Impor
`import()` dinamis sengaja tidak dihitung — justru itu mekanisme yang diinginkan.
Masuk `npm run verify`.

**2. `read()` melihat tulisan tertunda.** `persistSessionResult` berpola
baca-ubah-tulis, sementara `scheduleWrite` menunda sampai browser senggang
(R-20). Dua sesi yang selesai di dalam satu jendela idle: yang kedua membaca
keadaan **sebelum** yang pertama, lalu menimpanya — sesi pertama hilang tanpa
jejak. Sulit terpicu manusia (idle callback menyala dalam satu-dua frame),
tetapi bentuknya kehilangan data diam-diam, dan obatnya dua baris.

**3. Perpindahan drill tidak lagi bergantung pada teks yang berbeda.**
`useTypingSession` membuat sesi baru hanya saat `target` berubah, dan
`LessonPage` memajukan drill tanpa menaikkan `runId`. Dua drill berturutan yang
berteks sama karenanya membiarkan sesi tetap `finished`: layar menggantung tanpa
pesan apa pun. Kurikulum hari ini nol kejadian — sudah diperiksa — jadi ini
laten, bukan aktif. Diperbaiki di **dua** sisi, karena satu sisi saja menyisakan
jebakan: mekanismenya (`runId` naik tiap pindah drill) dan datanya (validator
menolak dua drill berurutan berisi teks identik).

**Ketiga gerbang sudah dibuktikan merah** dengan kontrol negatif, sesuai aturan
Fase 2: graf chunk diuji dua kali (menggabungkan ulang chunk-nya, dan mengimpor
`index.ts` langsung dari `loadLesson.ts`); `read` diuji dengan mencabut kembali
pembacaan `pending` — hasilnya `['s5']` alih-alih `['s4','s5']`, kehilangan yang
persis; perpindahan drill diuji dengan menghentikan kenaikan `runId` di harness.

**Konsekuensi.**

- (+) Batasan "layar sesi hanya memuat unit yang diminta" akhirnya **terukur**,
  bukan sekadar tertulis di komentar.
- (+) Anggaran total turun (~11 KB gzip tidak lagi ikut terunduh saat membuka
  lesson), tetapi itu efek samping — yang dikejar adalah janji arsitekturnya.
- (−) Satu skrip gerbang lagi di `verify`, dan ia butuh `dist` hasil build.
  Diterima: ia berjalan sesudah `build` yang memang sudah ada di rantai.
- (−) `read()` kini mengembalikan objek yang sama dengan yang ada di antrean
  tulis. Pemanggil yang memutasinya ikut memutasi antrean — itu justru arah yang
  benar, tapi layak diingat kalau suatu saat ada pemanggil yang mengandaikan
  salinan.
