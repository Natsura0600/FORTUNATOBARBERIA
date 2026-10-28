// Copia de seguridad completa: configuración, clientes, turnos y movimientos de caja.
import { db, k, PREFIX } from "./db";
import { BookingError } from "./errors";
import { getAllRaw } from "./clients";
import { getConfig, saveConfig, lockKeys, ttlFor } from "./store";
import { nowParts, isYMD } from "./time";

const VERSION = 1;

async function byDay(kind) {
  const keys = (await db.keys(`${PREFIX}:${kind}:*`)).sort();
  const out = {};
  for (let i = 0; i < keys.length; i += 150) {
    const chunk = keys.slice(i, i + 150);
    const res = await db.hgetallMany(chunk);
    chunk.forEach((key, j) => {
      const date = key.slice(`${PREFIX}:${kind}:`.length);
      const items = Object.values(res[j] || {});
      if (isYMD(date) && items.length) out[date] = items;
    });
  }
  return out;
}

export async function exportAll() {
  const [config, clients, bookings, movements] = await Promise.all([getConfig(), getAllRaw(), byDay("bk"), byDay("mv")]);
  return {
    app: "fortunato-barberia",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      clients: Object.keys(clients).length,
      bookings: Object.values(bookings).reduce((s, l) => s + l.length, 0),
      movements: Object.values(movements).reduce((s, l) => s + l.length, 0),
    },
    config,
    clients: Object.values(clients),
    bookings,
    movements,
  };
}

// Vuelve a cargar una copia. No borra nada: pisa lo que tenga el mismo turno, cliente o movimiento.
export async function restoreAll(data) {
  if (!data || data.app !== "fortunato-barberia" || data.version !== VERSION) {
    throw new BookingError("Ese archivo no es una copia de seguridad de esta web");
  }
  const done = { clients: 0, bookings: 0, movements: 0 };

  if (data.config && typeof data.config === "object") await saveConfig(data.config);

  const clients = (data.clients || []).filter((c) => c && c.key);
  for (let i = 0; i < clients.length; i += 400) {
    const chunk = {};
    for (const c of clients.slice(i, i + 400)) chunk[c.key] = c;
    await db.hsetMany(k("clients"), chunk);
  }
  done.clients = clients.length;

  const today = nowParts().date;
  for (const [date, list] of Object.entries(data.bookings || {})) {
    if (!isYMD(date)) continue;
    const chunk = {};
    for (const b of list) if (b && b.id) chunk[b.id] = b;
    await db.hsetMany(k("bk", date), chunk);
    done.bookings += Object.keys(chunk).length;
    // los horarios futuros vuelven a quedar tomados
    if (date >= today) {
      for (const b of Object.values(chunk)) {
        if (b.status === "cancelado") continue;
        for (const key of lockKeys(b.date, b.barberId, b.start, b.duration)) await db.claim(key, b.id, ttlFor(b.date));
      }
    }
  }
  for (const [date, list] of Object.entries(data.movements || {})) {
    if (!isYMD(date)) continue;
    const chunk = {};
    for (const m of list) if (m && m.id) chunk[m.id] = m;
    await db.hsetMany(k("mv", date), chunk);
    done.movements += Object.keys(chunk).length;
  }
  return done;
}
