// Utilidades de fecha y hora siempre en horario de Argentina (UTC-3, sin horario de verano).
export const TZ = "America/Argentina/Buenos_Aires";

export function nowParts(date = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const todayAR = () => nowParts().date;

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Día de la semana (0=domingo) de una fecha YYYY-MM-DD, sin depender del huso del servidor.
export const weekday = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

export function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Semana de lunes a domingo que contiene la fecha.
export function weekRange(ymd) {
  const wd = weekday(ymd);
  const from = addDays(ymd, wd === 0 ? -6 : 1 - wd);
  return { from, to: addDays(from, 6) };
}

export function monthRange(ymd) {
  const [y, m] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isHHMM = (s) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const dayName = (i) => DAYS[i];
export function longDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${DAYS[weekday(ymd)]} ${d} de ${MONTHS[m - 1]}`;
}
export const monthName = (ymd) => {
  const [y, m] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const money = (n) =>
  "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
