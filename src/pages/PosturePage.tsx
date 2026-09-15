import { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { VirtualKeyboard } from '@/features/keyboard';
import { markPostureSeen } from '@/lib/storage/flags.ts';
import './posture-page.css';

/**
 * `/posture` — panduan postur & anchoring (ADR-027, dok. 02 §2, dok. 04 §13).
 *
 * Halaman ini lahir dari kegagalan yang teramati, bukan dari daftar fitur: uji
 * pemula 2026-09-12 menemukan tangan kanan mendarat dengan telunjuk di `h`, dan
 * tidak ada satu titik pun di aplikasi yang pernah mengatakan di mana tangan
 * diletakkan. Karena itu isinya **tidak boleh dirapikan menjadi panduan postur
 * umum**: butir 2 (telunjuk kanan di `j`, bukan `h`) dan butir 5 (letak
 * Backspace) ada karena persis keduanya yang meleset.
 *
 * Aturan dok. 02 §2 yang mengikat halaman ini:
 * - satu layar, bukan tur;
 * - tombol lewati terlihat **sejak paint pertama**, bukan setelah menggulir;
 * - sekali tampil per perangkat, dan tetap bisa dibuka lagi dari `/learn`.
 */

const FIRST_LESSON = '/learn/u1-l1';

export default function PosturePage() {
  const navigate = useNavigate();

  // Ditandai saat halaman DIBUKA, bukan saat tombolnya ditekan — dibaca maupun
  // dilewati sama-sama "sudah lihat". Pengguna yang menutup tab di tengah
  // panduan tetap sudah melihatnya, dan menyodorkannya lagi besok bukan
  // pengajaran, melainkan gangguan.
  useEffect(() => markPostureSeen(), []);

  const start = useCallback(() => {
    void navigate(FIRST_LESSON);
  }, [navigate]);

  return (
    <section className="pg-root">
      <h1 className="pg-title">Sebelum ketukan pertama</h1>
      <p className="pg-lead">
        Dua menit di sini menghemat dua minggu kebiasaan yang salah. Boleh dilewati —
        panduan ini tetap bisa dibuka lagi dari halaman kurikulum.
      </p>

      {/* Tombol lewati ada DI ATAS, sejak paint pertama (dok. 02 §2): panduan yang
          jalan keluarnya harus dicari dulu terbaca sebagai tur produk. */}
      <div className="pg-actions">
        <button type="button" className="ul-cta ul-cta-primary" onClick={start}>
          Mulai Lesson 1
        </button>
        <button type="button" className="ul-cta" onClick={start}>
          Lewati panduan
        </button>
      </div>

      {/* Keyboard ditaruh DI ATAS teks (umpan balik uji pemula kedua,
          2026-09-12): pengguna baru langsung memusatkan perhatian ke papan
          tombolnya, lalu membaca rinciannya di bawah. Urutan sebaliknya membuat
          gambar acuannya tertutup enam paragraf. */}
      <div className="pg-keys" aria-hidden="true">
        <VirtualKeyboard onReady={noop} emphasis="home" showHands />
      </div>
      <p className="pg-caption">
        Baris awal disorot. Warna menunjukkan jari yang bertanggung jawab atas tiap
        tombol — perhatikan <kbd className="ul-key">h</kbd> dan{' '}
        <kbd className="ul-key">j</kbd> berwarna sama: satu jari, dua tugas berbeda.
      </p>

      <ol className="pg-steps">
        <li className="pg-step">
          <h2 className="pg-step-title">Duduk dulu, baru tangan</h2>
          <p>
            Punggung tegak, kaki menapak lantai, siku sekitar 90°. Pergelangan
            <strong> menggantung</strong>, tidak menumpu meja — pergelangan yang menumpu
            memaksa jari bergerak dari buku jari, dan itu yang bikin pegal setelah lima
            menit.
          </p>
        </li>

        <li className="pg-step">
          <h2 className="pg-step-title">Delapan jari di baris awal</h2>
          <p>
            Kiri: <kbd className="ul-key">a</kbd> <kbd className="ul-key">s</kbd>{' '}
            <kbd className="ul-key">d</kbd> <kbd className="ul-key">f</kbd> · kanan:{' '}
            <kbd className="ul-key">j</kbd> <kbd className="ul-key">k</kbd>{' '}
            <kbd className="ul-key">l</kbd> <kbd className="ul-key">;</kbd>. Kedua jempol
            menggantung di spasi dan tidak pernah pindah ke tombol lain.
          </p>
        </li>

        <li className="pg-step">
          <h2 className="pg-step-title">Raba tonjolannya, jangan lihat</h2>
          <p>
            <kbd className="ul-key">f</kbd> dan <kbd className="ul-key">j</kbd> punya
            tonjolan kecil di keyboardmu. Itu bukan hiasan — itu cara tangan menemukan
            jalan pulang tanpa mata. Tutup mata, letakkan kedua telunjuk di tonjolan itu,
            lalu biarkan enam jari lain jatuh di sebelahnya.
          </p>
        </li>

        <li className="pg-step pg-step-warn">
          <h2 className="pg-step-title">Periksa telunjuk kananmu sekarang</h2>
          <p>
            Ini kesalahan yang paling sering terjadi, dan paling mahal: telunjuk kanan
            mendarat di <kbd className="ul-key">h</kbd>, bukan{' '}
            <kbd className="ul-key">j</kbd>. Kalau itu terjadi,{' '}
            <strong>seluruh tangan kananmu bergeser satu tombol</strong> — jari tengah
            jatuh di <kbd className="ul-key">j</kbd>, manis di{' '}
            <kbd className="ul-key">k</kbd>, dan setiap lesson berikutnya melatih jari
            yang salah. <kbd className="ul-key">h</kbd> memang tugas telunjuk kanan, tapi
            ia <strong>dijangkau</strong>, bukan tempat istirahat.
          </p>
        </li>

        <li className="pg-step">
          <h2 className="pg-step-title">Kalau salah, jangan cari dengan mata</h2>
          <p>
            <kbd className="ul-key">Backspace</kbd> ada di ujung kanan atas, tepat di atas{' '}
            <kbd className="ul-key">\</kbd>, dan ditekan{' '}
            <strong>kelingking kanan</strong> — kelingking naik, tekan, lalu pulang ke{' '}
            <kbd className="ul-key">;</kbd>. Menoleh ke keyboard untuk mencarinya
            membatalkan yang sedang kamu latih, dan koreksi adalah hal yang paling sering
            kamu lakukan di minggu pertama.
          </p>
        </li>

        <li className="pg-step">
          <h2 className="pg-step-title">Hilang arah? Ulangi, jangan mengintip</h2>
          <p>
            Semua orang kehilangan posisi. Yang membedakan: angkat kedua tangan, lalu
            letakkan ulang dengan meraba tonjolan — bukan melirik. Mengintip sekali
            terasa hemat; mengintip seratus kali adalah kebiasaan yang harus dibongkar
            lagi nanti.
          </p>
        </li>
      </ol>


      <div className="pg-actions">
        <button type="button" className="ul-cta ul-cta-primary" onClick={start}>
          Siap — mulai Lesson 1
        </button>
        <Link to="/learn" className="ul-cta">
          Lihat kurikulum dulu
        </Link>
      </div>
    </section>
  );
}

/** Halaman ini tidak punya sesi, jadi tidak ada yang perlu dilukis. */
function noop(): void {}
