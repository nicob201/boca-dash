// ponytail: Argentina is fixed UTC−3 (no DST since 2009). If DST ever comes back,
// switch to Intl.DateTimeFormat with timeZone 'America/Argentina/Buenos_Aires'.
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Shifts a real instant so its getUTC* methods read Argentine wall-clock time.
const ar = (d: Date) => new Date(d.getTime() - OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');

/** "DD-MM-YYYY HH:mm" in Argentine time → Date. */
export function parseArDateTime(s: string): Date {
  const m = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Bad Argentine date: "${s}"`);
  const [, dd, mm, yyyy, hh, min] = m.map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh, min) + OFFSET_MS);
}

/** "15:00" */
export function formatArTime(d: Date): string {
  const a = ar(d);
  return `${pad(a.getUTCHours())}:${pad(a.getUTCMinutes())}`;
}

/** "dom 1/11" */
export function formatArDay(d: Date): string {
  const a = ar(d);
  return `${DAYS[a.getUTCDay()]} ${a.getUTCDate()}/${a.getUTCMonth() + 1}`;
}

/** 10:00 Argentine time on match day, or kickoff − 2 h if that comes first. */
export function matchdaySendAt(kickoff: Date): Date {
  const a = ar(kickoff);
  const tenAm = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 10) + OFFSET_MS;
  return new Date(Math.min(tenAm, kickoff.getTime() - 2 * 60 * 60 * 1000));
}
