// Base de clientes: una ficha por celular.
// Se alimenta sola con cada turno y se puede cargar de golpe desde un CSV (AgendaPro u otro).
import { db, k } from "./db";
import { BookingError } from "./errors";
import { nowParts } from "./time";

const CK = () => k("clients");
const AREA = process.env.LOCAL_AREA_CODE || "2323"; // código de área de Luján

/* ───────────────────────── Normalización ───────────────────────── */

// Deja el celular en 10 dígitos (código de área + número) sin importar cómo lo escriban:
// "+54 9 2323 45-6789", "02323 15 456789", "15 456789", "2323456789"…
export function phoneKey(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^00/, "");
  if (d.startsWith("54") && d.length >= 11) {
    d = d.slice(2);
    if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  }
  d = d.replace(/^0/, "");
  if (d.length === 8 && d.startsWith("15")) d = AREA + d.slice(2);
  else if (d.length === 6) d = AREA + d;
  else if (d.length > 10) {
    for (const a of [2, 3, 4]) {
      if (d.slice(a, a + 2) === "15" && d.length - 2 === 10) { d = d.slice(0, a) + d.slice(a + 2); break; }
    }
  }
  return d.length >= 8 ? d.slice(-10) : "";
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function tidyName(raw) {
  const s = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (s && (s === s.toUpperCase() || s === s.toLowerCase())) {
    return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  }
  return s;
}

const fallbackKey = (name, email) => {
  const e = String(email || "").trim().toLowerCase();
  if (e) return `e:${e.slice(0, 80)}`;
  return `n:${fold(name).replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
};

const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "");

function parseDate(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) {
    const t = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (t) m = [null, t[3].length === 2 ? `20${t[3]}` : t[3], t[2], t[1]];
  }
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseMoney(v) {
  let s = String(v || "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/* ───────────────────────── Fichas ───────────────────────── */

function blank(key, from = {}) {
  return {
    key,
    name: tidyName(from.name) || "Sin nombre",
    phone: from.phone || "",
    email: "", notes: "", birthday: "",
    source: from.source || "web",
    aka: [],
    visits: 0, spent: 0, noShows: 0,
    importedVisits: 0, importedSpent: 0, importedLastVisit: "",
    history: [],
    createdAt: new Date().toISOString(),
  };
}

// Lo que se muestra: suma lo importado con lo que pasó en el sistema nuevo.
function view(c, full = false) {
  const hist = c.history || [];
  const today = nowParts().date;
  const lastLocal = hist.filter((h) => h.status === "atendido").map((h) => h.date).sort().pop() || "";
  const next = hist.filter((h) => h.status === "reservado" && h.date >= today).map((h) => h.date).sort()[0] || "";
  const out = {
    key: c.key, name: c.name, phone: c.phone, email: c.email || "", notes: c.notes || "",
    birthday: c.birthday || "", source: c.source, aka: c.aka || [], createdAt: c.createdAt,
    visits: (c.importedVisits || 0) + (c.visits || 0),
    spent: (c.importedSpent || 0) + (c.spent || 0),
    noShows: c.noShows || 0,
    lastVisit: [c.importedLastVisit || "", lastLocal].sort().pop(),
    next,
  };
  if (full) out.history = hist;
  return out;
}

export async function getAllRaw() {
  return db.hgetall(CK());
}

export async function listClients() {
  const all = await getAllRaw();
  return Object.values(all).map((c) => view(c));
}

export async function getClient(key) {
  const c = await db.hget(CK(), key);
  return c ? view(c, true) : null;
}

export async function saveClient(input) {
  const name = tidyName(input.name);
  const phoneRaw = String(input.phone || "").trim().slice(0, 30);
  const email = String(input.email || "").trim().slice(0, 80);
  if (name.length < 2) throw new BookingError("Ingresá el nombre del cliente");
  const key = phoneKey(phoneRaw) || fallbackKey(name, email);

  const old = input.key ? await db.hget(CK(), input.key) : null;
  if (input.key && !old) throw new BookingError("Cliente no encontrado");
  if (key !== input.key && (await db.hget(CK(), key))) throw new BookingError("Ya existe un cliente con ese celular");

  const c = { ...(old || blank(key, { source: "manual" })), key, name, phone: phoneRaw, email };
  c.notes = String(input.notes || "").slice(0, 600);
  c.birthday = cleanDate(input.birthday);
  if (old && old.key !== key) await db.hdel(CK(), old.key);
  await db.hset(CK(), key, c);
  return view(c, true);
}

export async function deleteClient(key) {
  await db.hdel(CK(), key);
}

// Se llama cada vez que un turno se crea, cambia de estado o se borra.
// prev/next: el turno antes y después (null si no existía / ya no existe).
export async function syncBooking(prev, next) {
  const ref = next || prev;
  if (!ref || ref.kind === "bloqueo") return;
  const key = phoneKey(ref.phone);
  if (!key) return;

  let c = await db.hget(CK(), key);
  if (!c) {
    if (!next) return;
    c = blank(key, { name: ref.name, phone: ref.phone, source: ref.source === "web" ? "web" : "local" });
  }

  const apply = (b, sign) => {
    if (!b) return;
    if (b.status === "atendido") { c.visits = (c.visits || 0) + sign; c.spent = (c.spent || 0) + sign * (Number(b.paid) || 0); }
    else if (b.status === "ausente") c.noShows = (c.noShows || 0) + sign;
  };
  apply(prev, -1);
  apply(next, +1);
  c.visits = Math.max(0, c.visits || 0);
  c.spent = Math.max(0, c.spent || 0);
  c.noShows = Math.max(0, c.noShows || 0);

  if (next && next.name) {
    const nm = tidyName(next.name);
    if (!c.name || c.name === "Sin nombre") c.name = nm;
    else if (fold(nm) !== fold(c.name) && !(c.aka || []).some((a) => fold(a) === fold(nm))) {
      c.aka = [...(c.aka || []), nm].slice(-5);
    }
  }

  const hist = (c.history || []).filter((h) => h.id !== ref.id);
  if (next) {
    hist.push({ id: next.id, date: next.date, time: next.time, service: next.serviceName, barber: next.barberName, status: next.status, paid: Number(next.paid) || 0 });
  }
  hist.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  c.history = hist.slice(0, 20);

  await db.hset(CK(), key, c);
}

/* ───────────────────────── Importación CSV ───────────────────────── */

export function parseCSV(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  const head = src.split(/\r?\n/, 1)[0] || "";
  const count = (ch) => head.split(ch).length - 1;
  const delim = [";", ",", "\t"].sort((a, b) => count(b) - count(a))[0];

  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (h) => fold(h).replace(/[^a-z0-9]+/g, " ").trim();
const hasWord = (h, words) => words.some((w) => ` ${h} `.includes(` ${w} `));

// Adivina qué columna es cada dato mirando los encabezados.
export function detectColumns(headers) {
  const H = headers.map(norm);
  const find = (words, skip = []) => H.findIndex((h, i) => !skip.includes(i) && hasWord(h, words));
  const col = {};
  col.lastVisit = find(["ultima visita", "ultima cita", "ultima reserva", "ultimo turno", "ultima atencion", "last visit"]);
  col.birthday = find(["fecha de nacimiento", "nacimiento", "cumpleanos", "cumple", "birthday"]);
  col.email = find(["email", "e mail", "mail", "correo", "correo electronico"]);
  col.notes = find(["notas", "nota", "observaciones", "observacion", "comentarios", "comentario"]);
  col.spent = find(["total gastado", "gasto total", "gastado", "total facturado", "monto total", "total pagado"]);
  col.visits = find(["visitas", "cantidad de visitas", "total visitas", "cantidad de citas", "citas", "reservas", "turnos", "asistencias"], [col.lastVisit]);
  col.full = find(["nombre completo", "nombre y apellido", "apellido y nombre", "cliente", "full name"]);
  col.last = find(["apellido", "apellidos", "last name"]);
  col.first = find(["nombre", "nombres", "first name", "primer nombre"], [col.full]);
  const cel = H.map((h, i) => (hasWord(h, ["celular", "movil", "whatsapp", "cel", "mobile"]) ? i : -1)).filter((i) => i >= 0);
  const tel = H.map((h, i) => (hasWord(h, ["telefono", "tel", "phone", "fono", "contacto"]) && !cel.includes(i) ? i : -1)).filter((i) => i >= 0);
  col.phones = [...cel, ...tel];
  return col;
}

const LABELS = {
  full: "Nombre", first: "Nombre", last: "Apellido", phones: "Celular", email: "Mail", notes: "Notas",
  birthday: "Cumpleaños", visits: "Cantidad de visitas", spent: "Total gastado", lastVisit: "Última visita",
};

function buildRecords(rows) {
  const headers = rows[0] || [];
  const col = detectColumns(headers);
  const mapping = [];
  const used = new Set();
  const add = (field, idx) => { if (idx >= 0) { mapping.push({ field: LABELS[field], column: headers[idx].trim() }); used.add(idx); } };

  if (col.full >= 0) add("full", col.full);
  else { add("first", col.first); add("last", col.last); }
  col.phones.forEach((i) => add("phones", i));
  for (const f of ["email", "notes", "birthday", "visits", "spent", "lastVisit"]) add(f, col[f]);
  const ignored = headers.map((h, i) => (used.has(i) ? null : h.trim())).filter(Boolean);

  const get = (row, i) => (i >= 0 ? String(row[i] ?? "").trim() : "");
  const out = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const name = col.full >= 0 ? get(row, col.full) : [get(row, col.first), get(row, col.last)].filter(Boolean).join(" ");
    let phone = "";
    let pk = "";
    for (const i of col.phones) {
      const raw = get(row, i).split(/[/,;]/)[0].trim();
      const key = phoneKey(raw);
      if (key) { phone = raw; pk = key; break; }
    }
    const email = get(row, col.email).slice(0, 80);
    if (!name && !pk) { skipped++; continue; }
    out.push({
      key: pk || fallbackKey(name, email),
      hasPhone: !!pk,
      name: tidyName(name) || "Sin nombre",
      phone, email,
      notes: get(row, col.notes).slice(0, 600),
      birthday: parseDate(get(row, col.birthday)),
      visits: Math.max(0, parseInt(get(row, col.visits), 10) || 0),
      spent: parseMoney(get(row, col.spent)),
      lastVisit: parseDate(get(row, col.lastVisit)),
    });
  }
  return { mapping, ignored, records: out, skipped, found: col.full >= 0 || col.first >= 0 };
}

// Une filas repetidas del archivo (mismo celular).
function dedupe(records) {
  const map = new Map();
  let repeated = 0;
  for (const r of records) {
    const prev = map.get(r.key);
    if (!prev) { map.set(r.key, { ...r }); continue; }
    repeated++;
    for (const f of ["email", "notes", "birthday", "phone"]) if (!prev[f] && r[f]) prev[f] = r[f];
    prev.visits = Math.max(prev.visits, r.visits);
    prev.spent = Math.max(prev.spent, r.spent);
    if (r.lastVisit > prev.lastVisit) prev.lastVisit = r.lastVisit;
  }
  return { list: [...map.values()], repeated };
}

export async function importClients(csv, { dryRun = true, source = "agendapro" } = {}) {
  const rows = parseCSV(csv);
  if (rows.length < 2) throw new BookingError("El archivo está vacío o no tiene filas de clientes");
  if (rows.length > 20001) throw new BookingError("El archivo tiene demasiadas filas (máximo 20.000)");
  const built = buildRecords(rows);
  if (!built.found) throw new BookingError("No encontré la columna del nombre. La primera fila tiene que tener los encabezados (Nombre, Celular…).");

  const { list, repeated } = dedupe(built.records);
  const existing = await getAllRaw();
  const created = list.filter((r) => !existing[r.key]).length;
  const result = {
    mapping: built.mapping,
    ignored: built.ignored,
    rows: rows.length - 1,
    total: list.length,
    created,
    updated: list.length - created,
    skipped: built.skipped,
    repeated,
    noPhone: list.filter((r) => !r.hasPhone).length,
    sample: list.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone, email: r.email, visits: r.visits, lastVisit: r.lastVisit })),
  };
  if (dryRun) return result;

  const now = new Date().toISOString();
  const write = {};
  for (const r of list) {
    const old = existing[r.key];
    const c = old ? { ...old } : { ...blank(r.key, { source }), createdAt: now };
    if (!old) { c.name = r.name; c.phone = r.phone; }
    else {
      if (!c.name || c.name === "Sin nombre") c.name = r.name;
      if (!c.phone) c.phone = r.phone;
    }
    if (!c.email) c.email = r.email;
    if (!c.notes) c.notes = r.notes;
    if (!c.birthday) c.birthday = r.birthday;
    // Lo importado va aparte de lo que pasa en el sistema nuevo: importar dos veces no duplica visitas.
    c.importedVisits = r.visits;
    c.importedSpent = r.spent;
    c.importedLastVisit = r.lastVisit;
    write[r.key] = c;
  }
  const keys = Object.keys(write);
  for (let i = 0; i < keys.length; i += 400) {
    const chunk = {};
    for (const key of keys.slice(i, i + 400)) chunk[key] = write[key];
    await db.hsetMany(CK(), chunk);
  }
  return result;
}
