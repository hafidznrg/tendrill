import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Validator kurikulum dijalankan sebagai gerbang test (dok. 04 §5, dok. 09).
 * Dipanggil sebagai subproses karena skripnya sengaja tanpa dependensi dan
 * memakai `process.exit` — supaya tetap bisa jadi gerbang CI sendirian.
 */
describe('kurikulum', () => {
  it('lulus validate-curriculum.ts', () => {
    // cwd Vitest = akar proyek; import.meta.url di sini bukan skema file.
    const script = resolve('scripts/validate-curriculum.ts');
    const out = execFileSync(process.execPath, ['--experimental-strip-types', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(out).toContain('Kurikulum valid.');
  }, 30_000);
});
