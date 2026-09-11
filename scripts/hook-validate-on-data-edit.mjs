/**
 * Hook PostToolUse: jalankan validator kurikulum HANYA saat file di src/data/
 * baru saja diubah. Tujuannya menutup celah "kurikulum rusak dan baru ketahuan
 * di CI" — aturan kumulatif dok. 04 §5 ditegakkan di detik yang sama.
 *
 * Diam total kalau tidak relevan atau kalau validator lulus.
 */
import { execFileSync } from 'node:child_process';
import { sep } from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let path = '';
try {
  path = JSON.parse(raw)?.tool_input?.file_path ?? '';
} catch {
  process.exit(0);
}

// Path bisa absolut atau relatif terhadap akar proyek — terima keduanya.
const normalized = path.split(sep).join('/');
if (!/(^|\/)src\/data\//.test(normalized)) process.exit(0);

try {
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/validate-curriculum.ts'],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
} catch (err) {
  const detail = err?.stderr?.toString() ?? String(err);
  console.error(
    'Validator kurikulum GAGAL setelah perubahan di src/data/ (dok. 04 §5).\n' +
      'Perbaiki sebelum lanjut — jangan biarkan drill memuat tombol yang belum diajarkan.\n\n' +
      detail,
  );
  process.exit(2); // 2 = umpan balik dikembalikan ke agent
}
