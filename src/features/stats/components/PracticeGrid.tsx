import type { PracticeDay } from '../stats.ts';

/**
 * Grid 30 hari berlatih (dok. 07 §10). Tanpa animasi, tanpa warna menyala:
 * hari kosong hanya kotak kosong, bukan "kegagalan".
 */
export function PracticeGrid({ days, streak }: { days: PracticeDay[]; streak: number }) {
  const practiced = days.filter((d) => d.stat !== null).length;
  return (
    <section aria-labelledby="st-days-title">
      <h2 id="st-days-title" className="st-h2">
        Hari berlatih
      </h2>
      <p className="st-question">
        {practiced} dari {days.length} hari terakhir
        {streak > 1 && <span className="st-secondary"> · beruntun {streak} hari</span>}
      </p>
      <ol className="st-days">
        {days.map((d) => (
          <li
            key={d.date}
            className="st-day"
            data-practiced={d.stat !== null}
            title={
              d.stat
                ? `${d.date}: ${d.stat.sessions} sesi · ${Math.max(1, Math.round(d.stat.ms / 60000))} menit · ${Math.round(d.stat.avgWpm)} WPM`
                : `${d.date}: tidak berlatih`
            }
          />
        ))}
      </ol>
    </section>
  );
}
