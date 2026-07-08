/** Lightweight date/time helpers for the claim calendar — no native picker,
 *  no external lib. Scheduled times are stored as ISO strings. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local YYYY-MM-DD key for grouping by calendar day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Mon, Aug 3" */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "2:30 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "Mon, Aug 3 · 2:30 PM" */
export function formatDateTime(iso: string): string {
  return `${formatDayLabel(iso)} · ${formatTime(iso)}`;
}

/** Relative age for assignment timestamps ("just now", "2h ago", "Aug 3"). */
export function relativeSince(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDayLabel(iso);
}

/** Parse MM/DD/YYYY (or M/D/YY) + optional HH:MM (24h) or H:MM AM/PM into an
 *  ISO string in local time. Returns undefined if the date can't be parsed. */
export function parseSchedule(dateStr: string, timeStr: string): string | undefined {
  const dm = dateStr.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!dm) return undefined;
  let [, mo, da, yr] = dm;
  let year = Number(yr);
  if (year < 100) year += 2000;
  let hours = 9;
  let minutes = 0;
  const t = timeStr.trim();
  if (t) {
    const tm = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
    if (!tm) return undefined;
    hours = Number(tm[1]);
    minutes = Number(tm[2]);
    const ap = tm[3]?.toLowerCase();
    if (ap === 'pm' && hours < 12) hours += 12;
    if (ap === 'am' && hours === 12) hours = 0;
  }
  const d = new Date(year, Number(mo) - 1, Number(da), hours, minutes, 0, 0);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export interface MonthGrid {
  label: string;
  year: number;
  month: number;
  /** 42 cells (6 weeks); null = padding day outside this month. */
  cells: (Date | null)[];
}

export function buildMonthGrid(year: number, month: number): MonthGrid {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return { label: `${MONTHS[month]} ${year}`, year, month, cells };
}

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
