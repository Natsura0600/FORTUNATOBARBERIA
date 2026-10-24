// Funciones de horario que corren tanto en el servidor como en el navegador.
import { nowParts, toMin, weekday, addDays } from "./time";

export function openState(cfg, at = new Date()) {
  const { date, minutes } = nowParts(at);
  const closedToday = cfg.closedDates?.some((d) => d.date === date);
  const h = closedToday ? null : cfg.hours[weekday(date)];
  if (h && minutes >= toMin(h.open) && minutes < toMin(h.close)) {
    return { open: true, label: `Abierto hasta las ${h.close}` };
  }
  // próxima apertura
  for (let i = 0; i < 8; i++) {
    const d = addDays(date, i);
    if (cfg.closedDates?.some((c) => c.date === d)) continue;
    const hh = cfg.hours[weekday(d)];
    if (!hh) continue;
    if (i === 0 && minutes >= toMin(hh.open)) continue;
    const when = i === 0 ? "hoy" : i === 1 ? "mañana" : ["el domingo", "el lunes", "el martes", "el miércoles", "el jueves", "el viernes", "el sábado"][weekday(d)];
    return { open: false, label: `Cerrado · abre ${when} a las ${hh.open}` };
  }
  return { open: false, label: "Cerrado" };
}

// ¿Se puede reservar ese día con ese barbero? (chequeo rápido para el calendario)
export function dayBookable(cfg, date, barber) {
  if (cfg.closedDates?.some((d) => d.date === date)) return false;
  if (!cfg.hours[weekday(date)]) return false;
  if (barber && barber.offWeekdays?.includes(weekday(date))) return false;
  return true;
}
