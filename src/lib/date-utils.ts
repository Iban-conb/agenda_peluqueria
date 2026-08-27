const pad = (n: number) => String(n).padStart(2, "0");

/** Convierte una fecha local a clave yyyy-mm-dd (sin problemas de zona horaria). */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDaysKey(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Lunes de la semana de la fecha dada. */
export function startOfWeekKey(key: string): string {
  const d = fromKey(key);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  return toKey(d);
}

export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function minutesToLabel(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function rangeLabel(start: number, duration: number): string {
  return `${minutesToLabel(start)}–${minutesToLabel(start + duration)}`;
}

const longFmt = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortFmt = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});
const weekdayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const dayNumFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export function fmtLong(key: string): string {
  return longFmt.format(fromKey(key));
}
export function fmtShort(key: string): string {
  return shortFmt.format(fromKey(key));
}
export function fmtMonth(key: string): string {
  return monthFmt.format(fromKey(key));
}
export function fmtWeekday(key: string): string {
  return weekdayFmt.format(fromKey(key));
}
export function fmtDayNum(key: string): string {
  return dayNumFmt.format(fromKey(key));
}
export function fmtShortDate(key: string): string {
  return shortDateFmt.format(fromKey(key));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "en 1 h 20 min" / "en 25 min" / "ahora" */
export function inLabel(minutesFromNow: number): string {
  if (minutesFromNow <= 0) return "ahora";
  const h = Math.floor(minutesFromNow / 60);
  const m = minutesFromNow % 60;
  if (h === 0) return `en ${m} min`;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

/** Normaliza texto para búsquedas sin acentos. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Devuelve el día de la semana (0=Dom, 1=Lun, ..., 6=Sáb) de una fecha YYYY-MM-DD. */
export function weekdayOf(key: string): number {
  return fromKey(key).getDay();
}

/** Comprueba si una fecha está permitida según los settings del salón. */
export function isDayOpen(
  key: string,
  openDays: number[],
  closedDates: string[]
): boolean {
  if (closedDates.includes(key)) return false;
  return openDays.includes(weekdayOf(key));
}

/** Devuelve el primer día abierto a partir de `key` inclusive. */
export function nextOpenDay(
  key: string,
  openDays: number[],
  closedDates: string[],
  maxIterations = 60
): string {
  let current = key;
  let i = 0;
  while (i < maxIterations) {
    if (isDayOpen(current, openDays, closedDates)) return current;
    current = addDaysKey(current, 1);
    i++;
  }
  return key;
}

/** Genera la cuadrícula mensual: array de semanas, cada una con 7 días.
 *  Empieza en lunes. Incluye días del mes anterior/posterior para completar
 *  la primera/última semana. */
export function getMonthMatrix(
  year: number,
  month: number // 0-indexed
): { key: string; date: Date; inMonth: boolean }[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 si lunes
  const start = new Date(year, month, 1 - offset);

  const weeks: { key: string; date: Date; inMonth: boolean }[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: { key: string; date: Date; inMonth: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      row.push({
        key: toKey(date),
        date,
        inMonth: date.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}
