import crypto from "node:crypto";
import { db, k } from "./db";
import { BookingError } from "./errors";
import { syncBooking } from "./clients";
import { DEFAULT_CONFIG } from "./defaults";
import {
  nowParts, toMin, toHHMM, weekday, addDays, daysBetween, isYMD, isHHMM,
} from "./time";

const id = () => crypto.randomBytes(5).toString("hex");

/* ───────────────────────── Configuración ───────────────────────── */

export async function getConfig() {
  let cfg = await db.get(k("config"));
  if (!cfg) {
    cfg = DEFAULT_CONFIG;
    await db.set(k("config"), cfg);
  }
  // completa claves nuevas si la config guardada es de una versión anterior
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    business: { ...DEFAULT_CONFIG.business, ...(cfg.business || {}) },
    images: { ...DEFAULT_CONFIG.images, ...(cfg.images || {}) },
  };
}

export async function saveConfig(next) {
  const clean = sanitizeConfig(next);
  await db.set(k("config"), clean);
  return clean;
}

export async function setBarberPhoto(barberId, photo) {
  const cfg = await getConfig();
  return saveConfig({ ...cfg, barbers: cfg.barbers.map((b) => (b.id === barberId ? { ...b, photo } : b)) });
}

function sanitizeConfig(c) {
  const str = (v, max = 400) => String(v ?? "").slice(0, max);
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const slug = (v) => str(v, 40).toLowerCase().replace(/[^a-z0-9-]/g, "-") || id();

  const barbers = (c.barbers || []).map((b) => ({
    id: slug(b.id),
    name: str(b.name, 80),
    role: str(b.role, 40),
    bio: str(b.bio, 300),
    photo: str(b.photo, 500),
    commission: Math.min(100, Math.max(0, num(b.commission, 50))),
    offWeekdays: (b.offWeekdays || []).map(Number).filter((d) => d >= 0 && d <= 6),
    active: !!b.active,
  }));
  const ids = new Set(barbers.map((b) => b.id));

  const services = (c.services || []).map((s) => {
    const prices = {};
    for (const [bid, p] of Object.entries(s.prices || {})) {
      if (ids.has(bid) && p !== "" && p != null && Number.isFinite(Number(p))) prices[bid] = Math.max(0, Number(p));
    }
    return {
      id: slug(s.id),
      name: str(s.name, 80),
      description: str(s.description, 240),
      duration: Math.max(15, Math.round(num(s.duration, 30) / 15) * 15),
      prices,
      active: !!s.active,
    };
  });

  const hours = {};
  for (let d = 0; d < 7; d++) {
    const h = c.hours?.[d];
    hours[d] = h && isHHMM(h.open) && isHHMM(h.close) && toMin(h.close) > toMin(h.open)
      ? { open: h.open, close: h.close } : null;
  }

  return {
    business: { ...DEFAULT_CONFIG.business, ...Object.fromEntries(
      Object.entries(c.business || {}).map(([key, v]) => [key, typeof v === "number" ? v : str(v)]),
    ) },
    images: {
      hero: str(c.images?.hero, 600),
      logo: str(c.images?.logo, 600),
      gallery: (c.images?.gallery || []).map((u) => str(u, 600)).filter(Boolean).slice(0, 12),
    },
    hours,
    closedDates: (c.closedDates || []).filter((d) => isYMD(d.date)).map((d) => ({ date: d.date, reason: str(d.reason, 120) })),
    barbers,
    services,
    notices: (c.notices || []).map((n) => ({
      id: n.id || id(), title: str(n.title, 80), text: str(n.text, 300),
      active: !!n.active, highlight: !!n.highlight, until: isYMD(n.until) ? n.until : "",
    })),
    reviews: (c.reviews || []).map((r) => ({ name: str(r.name, 40), service: str(r.service, 60), text: str(r.text, 240) })),
    about: (c.about || []).map((p) => str(p, 500)).filter(Boolean),
  };
}

// Lo que ve el público: sin comisiones ni avisos vencidos/inactivos.
export function publicConfig(cfg) {
  const today = nowParts().date;
  return {
    ...cfg,
    barbers: cfg.barbers.filter((b) => b.active).map(({ commission, ...b }) => b),
    services: cfg.services.filter((s) => s.active),
    notices: cfg.notices.filter((n) => n.active && (!n.until || n.until >= today)),
  };
}

/* ───────────────────────── Turnos ───────────────────────── */

const ACTIVE = (b) => b.status !== "cancelado";

export async function getBookings(date) {
  const h = await db.hgetall(k("bk", date));
  return Object.values(h).sort((a, b) => a.start - b.start);
}

function dayHours(cfg, date) {
  if (cfg.closedDates.some((d) => d.date === date)) return null;
  return cfg.hours[weekday(date)] || null;
}

export async function availability(cfg, { date, barberId, duration, ignoreRules = false }) {
  if (!isYMD(date)) return { slots: [], reason: "Fecha inválida" };
  const barber = cfg.barbers.find((b) => b.id === barberId);
  if (!barber || !barber.active) return { slots: [], reason: "Barbero no disponible" };
  const hours = dayHours(cfg, date);
  if (!hours) return { slots: [], reason: "El local está cerrado ese día" };
  if (barber.offWeekdays.includes(weekday(date))) return { slots: [], reason: `${barber.name.split(" ")[0]} no atiende ese día` };

  const now = nowParts();
  if (!ignoreRules) {
    if (date < now.date) return { slots: [], reason: "Esa fecha ya pasó" };
    if (date > addDays(now.date, cfg.business.bookingDaysAhead)) return { slots: [], reason: "Todavía no abrimos la agenda para esa fecha" };
  }

  const step = Number(cfg.business.slotStep) || 15;
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  const taken = (await getBookings(date)).filter((b) => ACTIVE(b) && b.barberId === barberId);
  const minStart = !ignoreRules && date === now.date ? now.minutes + Number(cfg.business.leadMinutes || 0) : -1;

  const slots = [];
  for (let t = open; t + duration <= close; t += step) {
    if (t < minStart) continue;
    const clash = taken.some((b) => t < b.start + b.duration && b.start < t + duration);
    if (!clash) slots.push(toHHMM(t));
  }
  return { slots, reason: slots.length ? "" : "No quedan horarios libres ese día" };
}

export function lockKeys(date, barberId, start, duration, step = 15) {
  const keys = [];
  for (let t = start; t < start + duration; t += step) keys.push(k("slot", date, barberId, toHHMM(t).replace(":", "")));
  return keys;
}

export function ttlFor(date) {
  const ms = new Date(`${addDays(date, 2)}T12:00:00Z`).getTime() - Date.now();
  return Math.max(3600, Math.round(ms / 1000));
}

async function claimSlots(date, barberId, start, duration, bookingId) {
  const keys = lockKeys(date, barberId, start, duration);
  const got = [];
  for (const key of keys) {
    if (await db.claim(key, bookingId, ttlFor(date))) got.push(key);
    else { await db.del(...got); return false; }
  }
  return true;
}

export { BookingError };

// Los datos de clientes son un extra: si algo falla ahí, el turno igual se guarda.
const safe = async (fn) => { try { await fn(); } catch (e) { console.error("[clientes]", e); } };

export async function createBooking(cfg, input, { admin = false } = {}) {
  const { date, time, barberId } = input;
  const kind = admin && input.kind === "bloqueo" ? "bloqueo" : "turno";
  if (!isYMD(date) || !isHHMM(time)) throw new BookingError("Fecha u hora inválida");

  const barber = cfg.barbers.find((b) => b.id === barberId && b.active);
  if (!barber) throw new BookingError("Elegí un barbero");

  let service = null;
  let price = 0;
  let duration = Number(input.duration) || 30;

  if (kind === "turno") {
    service = cfg.services.find((s) => s.id === input.serviceId && s.active);
    if (!service) throw new BookingError("Elegí un servicio");
    price = service.prices[barber.id];
    if (price == null) throw new BookingError(`${barber.name} no realiza ese servicio`);
    duration = service.duration;
  }

  const name = String(input.name || "").trim().slice(0, 60);
  const phone = String(input.phone || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (kind === "turno" && !admin) {
    if (name.length < 2) throw new BookingError("Ingresá tu nombre");
    if (phone.replace(/\D/g, "").length < 8) throw new BookingError("Ingresá un teléfono válido");
  }

  const { slots } = await availability(cfg, { date, barberId, duration, ignoreRules: admin });
  if (!slots.includes(time)) throw new BookingError("Ese horario ya no está disponible");

  const bookingId = id();
  const start = toMin(time);
  if (!(await claimSlots(date, barberId, start, duration, bookingId))) {
    throw new BookingError("Alguien tomó ese horario recién. Elegí otro.");
  }

  const booking = {
    id: bookingId,
    code: bookingId.slice(0, 6).toUpperCase(),
    kind,
    date, time, start, duration,
    barberId, barberName: barber.name,
    serviceId: service?.id || null,
    serviceName: kind === "bloqueo" ? (String(input.note || "").slice(0, 80) || "Horario bloqueado") : service.name,
    price,
    name: kind === "bloqueo" ? "" : name,
    phone,
    note: String(input.note || "").slice(0, 200),
    status: kind === "bloqueo" ? "bloqueo" : "reservado",
    source: admin ? "local" : "web",
    payment: null,
    paid: 0,
    createdAt: new Date().toISOString(),
  };
  await db.hset(k("bk", date), bookingId, booking);
  if (kind === "turno") await safe(() => syncBooking(null, booking));
  return booking;
}

export async function updateBooking(date, bookingId, patch) {
  const b = await db.hget(k("bk", date), bookingId);
  if (!b) throw new BookingError("Turno no encontrado");
  const next = { ...b };

  if (patch.status) {
    if (!["reservado", "atendido", "cancelado", "ausente", "bloqueo"].includes(patch.status)) throw new BookingError("Estado inválido");
    next.status = patch.status;
  }
  if (next.status === "atendido") {
    next.payment = patch.payment || next.payment || "efectivo";
    next.paid = patch.paid != null && patch.paid !== "" ? Math.max(0, Number(patch.paid)) : (next.paid || next.price);
    next.closedAt = new Date().toISOString();
  } else {
    next.payment = null;
    next.paid = 0;
  }
  if (patch.note != null) next.note = String(patch.note).slice(0, 200);

  if (["cancelado"].includes(next.status) || patch.remove) {
    await db.del(...lockKeys(b.date, b.barberId, b.start, b.duration));
  }
  if (patch.remove) {
    await db.hdel(k("bk", date), bookingId);
    await safe(() => syncBooking(b, null));
    return null;
  }
  await db.hset(k("bk", date), bookingId, next);
  await safe(() => syncBooking(b, next));
  return next;
}

// Cancelación del cliente: necesita código + teléfono y respeta la anticipación mínima.
export async function cancelByClient(cfg, { date, code, phone }) {
  if (!isYMD(date)) throw new BookingError("Fecha inválida");
  const list = await getBookings(date);
  const digits = String(phone || "").replace(/\D/g, "");
  const b = list.find((x) => x.code === String(code || "").trim().toUpperCase() && x.phone.replace(/\D/g, "").endsWith(digits.slice(-8)));
  if (!b || digits.length < 8) throw new BookingError("No encontramos un turno con esos datos");
  if (b.status !== "reservado") throw new BookingError("Ese turno ya no se puede cancelar");
  const now = nowParts();
  const minutesLeft = (new Date(`${date}T12:00:00Z`) - new Date(`${now.date}T12:00:00Z`)) / 60000 + b.start - now.minutes;
  if (minutesLeft < cfg.business.cancelHours * 60) throw new BookingError(`Solo se puede cancelar hasta ${cfg.business.cancelHours} horas antes. Escribinos por WhatsApp.`);
  return updateBooking(date, b.id, { status: "cancelado" });
}

/* ───────────────────────── Caja ───────────────────────── */

export async function addMovement(input) {
  if (!isYMD(input.date)) throw new BookingError("Fecha inválida");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new BookingError("Monto inválido");
  const mv = {
    id: id(),
    date: input.date,
    type: input.type === "egreso" ? "egreso" : "ingreso",
    concept: String(input.concept || "").trim().slice(0, 100) || (input.type === "egreso" ? "Gasto" : "Ingreso"),
    amount,
    method: String(input.method || "efectivo"),
    createdAt: new Date().toISOString(),
  };
  await db.hset(k("mv", input.date), mv.id, mv);
  return mv;
}

export async function deleteMovement(date, mvId) {
  await db.hdel(k("mv", date), mvId);
}

export async function cashReport(cfg, from, to) {
  if (!isYMD(from) || !isYMD(to) || from > to) throw new BookingError("Rango inválido");
  const days = daysBetween(from, to);
  if (days.length > 62) throw new BookingError("Rango demasiado largo");

  const [bks, mvs] = await Promise.all([
    db.hgetallMany(days.map((d) => k("bk", d))),
    db.hgetallMany(days.map((d) => k("mv", d))),
  ]);

  const barberById = Object.fromEntries(cfg.barbers.map((b) => [b.id, b]));
  const r = {
    from, to,
    services: 0, extra: 0, expenses: 0, net: 0,
    counts: { atendido: 0, reservado: 0, cancelado: 0, ausente: 0 },
    byMethod: {}, byBarber: {}, byService: {},
    byDay: days.map((d) => ({ date: d, total: 0, count: 0 })),
    movements: [],
  };

  days.forEach((d, i) => {
    for (const b of Object.values(bks[i] || {})) {
      if (b.kind === "bloqueo") continue;
      if (r.counts[b.status] != null) r.counts[b.status]++;
      if (b.status !== "atendido") continue;
      const amount = Number(b.paid) || 0;
      r.services += amount;
      r.byDay[i].total += amount;
      r.byDay[i].count++;
      r.byMethod[b.payment] = (r.byMethod[b.payment] || 0) + amount;
      const bb = (r.byBarber[b.barberId] ||= {
        id: b.barberId, name: barberById[b.barberId]?.name || b.barberName,
        commissionPct: barberById[b.barberId]?.commission ?? 0, count: 0, total: 0, commission: 0,
      });
      bb.count++; bb.total += amount;
      const ss = (r.byService[b.serviceName] ||= { name: b.serviceName, count: 0, total: 0 });
      ss.count++; ss.total += amount;
    }
    for (const m of Object.values(mvs[i] || {})) {
      r.movements.push(m);
      if (m.type === "egreso") r.expenses += m.amount;
      else {
        r.extra += m.amount;
        r.byDay[i].total += m.amount;
        r.byMethod[m.method] = (r.byMethod[m.method] || 0) + m.amount;
      }
    }
  });

  for (const b of Object.values(r.byBarber)) b.commission = Math.round(b.total * b.commissionPct / 100);
  const commissions = Object.values(r.byBarber).reduce((s, b) => s + b.commission, 0);
  r.commissions = commissions;
  r.net = r.services + r.extra - r.expenses;
  r.netAfterCommissions = r.net - commissions;
  r.ticket = r.counts.atendido ? Math.round(r.services / r.counts.atendido) : 0;
  r.movements.sort((a, b) => (a.date + a.createdAt < b.date + b.createdAt ? 1 : -1));
  r.byBarber = Object.values(r.byBarber).sort((a, b) => b.total - a.total);
  r.byService = Object.values(r.byService).sort((a, b) => b.total - a.total);
  return r;
}
