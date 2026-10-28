"use client";
import { useState } from "react";
import { money } from "@/lib/time";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `id-${Date.now()}`;
const uid = () => Math.random().toString(36).slice(2, 9);

/* ───────── servicios y precios ───────── */
export function Prices({ draft, setDraft }) {
  const set = (i, patch) => setDraft({ ...draft, services: draft.services.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const setPrice = (i, bid, v) => {
    const prices = { ...draft.services[i].prices };
    if (v === "") delete prices[bid]; else prices[bid] = Number(v);
    set(i, { prices });
  };
  const add = () => setDraft({
    ...draft,
    services: [...draft.services, { id: `servicio-${uid()}`, name: "Nuevo servicio", description: "", duration: 30, active: true, prices: Object.fromEntries(draft.barbers.map((b) => [b.id, 0])) }],
  });
  const move = (i, d) => {
    const s = [...draft.services]; const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]]; setDraft({ ...draft, services: s });
  };
  return (
    <>
      <div className="head">
        <div><p className="muted">Lo que se muestra en la web y se cobra en la agenda</p><h2>Servicios y precios</h2></div>
        <button className="sbtn solid" onClick={add}>Agregar servicio</button>
      </div>
      <p className="muted" style={{ marginBottom: 20 }}>Cada barbero tiene su propio precio. Dejá el casillero vacío si ese barbero no hace el servicio. Los cambios de precio no tocan los turnos ya reservados.</p>
      <div className="scroll">
        <table className="t">
          <thead>
            <tr>
              <th>Orden</th><th>Servicio</th><th>Descripción</th><th>Duración</th>
              {draft.barbers.map((b) => <th key={b.id} className="r">{b.name.split(" ")[0]}</th>)}
              <th>Visible</th><th></th>
            </tr>
          </thead>
          <tbody>
            {draft.services.map((s, i) => (
              <tr key={s.id}>
                <td><button onClick={() => move(i, -1)} aria-label="Subir">↑</button> <button onClick={() => move(i, 1)} aria-label="Bajar">↓</button></td>
                <td><input value={s.name} onChange={(e) => set(i, { name: e.target.value })} /></td>
                <td><input value={s.description} onChange={(e) => set(i, { description: e.target.value })} style={{ width: 260 }} /></td>
                <td>
                  <select value={s.duration} onChange={(e) => set(i, { duration: Number(e.target.value) })}>
                    {[15, 30, 45, 60, 75, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m} min</option>)}
                  </select>
                </td>
                {draft.barbers.map((b) => (
                  <td key={b.id} className="r">
                    <input type="number" min="0" step="500" placeholder="No hace" value={s.prices[b.id] ?? ""} onChange={(e) => setPrice(i, b.id, e.target.value)} aria-label={`Precio de ${s.name} con ${b.name}`} />
                  </td>
                ))}
                <td><input type="checkbox" checked={s.active} onChange={(e) => set(i, { active: e.target.checked })} aria-label="Visible en la web" /></td>
                <td><button className="muted" onClick={() => confirm(`¿Eliminar "${s.name}"?`) && setDraft({ ...draft, services: draft.services.filter((_, k) => k !== i) })}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        Rango actual: {money(Math.min(...draft.services.flatMap((s) => Object.values(s.prices))))} a {money(Math.max(...draft.services.flatMap((s) => Object.values(s.prices))))}.
      </p>
    </>
  );
}

/* ───────── barberos ───────── */
export function Barbers({ draft, setDraft, notify, uploads, onPhoto, saved }) {
  const set = (i, patch) => setDraft({ ...draft, barbers: draft.barbers.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const add = () => {
    const id = `barbero-${uid()}`;
    setDraft({
      ...draft,
      barbers: [...draft.barbers, { id, name: "Nuevo barbero", role: "Barbero", bio: "", photo: "", commission: 50, offWeekdays: [], active: true }],
      services: draft.services.map((s) => ({ ...s, prices: { ...s.prices, [id]: Object.values(s.prices)[0] ?? 0 } })),
    });
  };
  const remove = (i) => {
    const b = draft.barbers[i];
    if (!confirm(`¿Eliminar a ${b.name}? Sus turnos ya cargados quedan en la agenda y en la caja. Si solo deja de atender un tiempo, mejor desactivalo.`)) return;
    setDraft({
      ...draft,
      barbers: draft.barbers.filter((_, k) => k !== i),
      services: draft.services.map((s) => { const p = { ...s.prices }; delete p[b.id]; return { ...s, prices: p }; }),
    });
  };
  return (
    <>
      <div className="head">
        <div><p className="muted">Equipo, días libres y comisiones</p><h2>Barberos</h2></div>
        <button className="sbtn solid" onClick={add}>Agregar barbero</button>
      </div>
      {draft.barbers.map((b, i) => (
        <div className="item" key={b.id}>
          <div className="grid g3">
            <label className="f">Nombre<input value={b.name} onChange={(e) => set(i, { name: e.target.value })} /></label>
            <label className="f">Rol<input value={b.role} onChange={(e) => set(i, { role: e.target.value })} /></label>
            <label className="f">Comisión del barbero (%)<input type="number" min="0" max="100" value={b.commission} onChange={(e) => set(i, { commission: Number(e.target.value) })} /></label>
          </div>
          <PhotoField barber={b} isSaved={!!saved?.barbers.some((x) => x.id === b.id)} uploads={uploads} onPhoto={onPhoto} notify={notify} />
          <label className="f">Descripción corta<input value={b.bio} onChange={(e) => set(i, { bio: e.target.value })} /></label>
          <div className="row">
            <span className="muted">No atiende los:</span>
            {DAYS.map((d, wd) => (
              <label key={d} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={b.offWeekdays.includes(wd)}
                  onChange={(e) => set(i, { offWeekdays: e.target.checked ? [...b.offWeekdays, wd] : b.offWeekdays.filter((x) => x !== wd) })} />
                {d.slice(0, 3)}
              </label>
            ))}
          </div>
          <div className="row">
            <label className="row"><input type="checkbox" checked={b.active} onChange={(e) => set(i, { active: e.target.checked })} /> Recibe turnos y aparece en la web</label>
            <button className="muted" onClick={() => remove(i)} style={{ marginLeft: "auto" }}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ───────── avisos ───────── */
export function Notices({ draft, setDraft }) {
  const set = (i, patch) => setDraft({ ...draft, notices: draft.notices.map((n, k) => (k === i ? { ...n, ...patch } : n)) });
  const add = () => setDraft({ ...draft, notices: [{ id: uid(), title: "", text: "", active: true, highlight: false, until: "" }, ...draft.notices] });
  return (
    <>
      <div className="head">
        <div><p className="muted">Feriados, vacaciones, promociones, cambios de horario</p><h2>Avisos</h2></div>
        <button className="sbtn solid" onClick={add}>Nuevo aviso</button>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>Los avisos activos aparecen en la sección Avisos de la web. Los marcados como destacados además corren en la cinta negra debajo de la portada. Con fecha de vencimiento se ocultan solos.</p>
      {draft.notices.length === 0 && <p className="muted">No hay avisos. Creá uno para comunicar un feriado o una promo.</p>}
      {draft.notices.map((n, i) => (
        <div className="item" key={n.id}>
          <div className="grid g3">
            <label className="f">Título<input value={n.title} placeholder="Feriado del lunes" onChange={(e) => set(i, { title: e.target.value })} /></label>
            <label className="f" style={{ gridColumn: "span 2" }}>Texto<input value={n.text} onChange={(e) => set(i, { text: e.target.value })} /></label>
          </div>
          <div className="row">
            <label className="row"><input type="checkbox" checked={n.active} onChange={(e) => set(i, { active: e.target.checked })} /> Activo</label>
            <label className="row"><input type="checkbox" checked={n.highlight} onChange={(e) => set(i, { highlight: e.target.checked })} /> Destacado en la cinta</label>
            <label className="row muted">Mostrar hasta <input type="date" value={n.until} onChange={(e) => set(i, { until: e.target.value })} /></label>
            <button className="muted" style={{ marginLeft: "auto" }} onClick={() => setDraft({ ...draft, notices: draft.notices.filter((_, k) => k !== i) })}>Eliminar</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* ───────── local, horarios, imágenes, textos ───────── */
export function Shop({ draft, setDraft }) {
  const biz = (patch) => setDraft({ ...draft, business: { ...draft.business, ...patch } });
  const hour = (d, h) => setDraft({ ...draft, hours: { ...draft.hours, [d]: h } });
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <>
      <div className="head"><div><p className="muted">Datos que se muestran en la web</p><h2>Local y horarios</h2></div></div>

      <div className="split" style={{ marginTop: 0 }}>
        <div className="grid" style={{ gap: 28 }}>
          <div>
            <h3>Horario de atención</h3>
            <table className="t">
              <tbody>
                {order.map((d) => {
                  const h = draft.hours[d];
                  return (
                    <tr key={d}>
                      <td>{DAYS[d]}</td>
                      <td><label className="row"><input type="checkbox" checked={!!h} onChange={(e) => hour(d, e.target.checked ? { open: "09:00", close: "20:00" } : null)} /> Abre</label></td>
                      <td>{h && <input type="time" value={h.open} onChange={(e) => hour(d, { ...h, open: e.target.value })} />}</td>
                      <td>{h && <input type="time" value={h.close} onChange={(e) => hour(d, { ...h, close: e.target.value })} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h3>Días cerrados (feriados, vacaciones)</h3>
            <p className="muted" style={{ marginBottom: 10 }}>Esos días no se pueden reservar turnos.</p>
            {draft.closedDates.map((c, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <input type="date" value={c.date} onChange={(e) => setDraft({ ...draft, closedDates: draft.closedDates.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)) })} />
                <input placeholder="Motivo" value={c.reason} onChange={(e) => setDraft({ ...draft, closedDates: draft.closedDates.map((x, k) => (k === i ? { ...x, reason: e.target.value } : x)) })} />
                <button className="muted" onClick={() => setDraft({ ...draft, closedDates: draft.closedDates.filter((_, k) => k !== i) })}>Quitar</button>
              </div>
            ))}
            <button className="sbtn" onClick={() => setDraft({ ...draft, closedDates: [...draft.closedDates, { date: "", reason: "" }] })}>Agregar día cerrado</button>
          </div>

          <div>
            <h3>Reglas de reserva</h3>
            <div className="grid g3">
              <label className="f">Días de agenda abierta<input type="number" min="1" max="90" value={draft.business.bookingDaysAhead} onChange={(e) => biz({ bookingDaysAhead: Number(e.target.value) })} /></label>
              <label className="f">Anticipación mínima (min)<input type="number" min="0" value={draft.business.leadMinutes} onChange={(e) => biz({ leadMinutes: Number(e.target.value) })} /></label>
              <label className="f">Cancelar hasta (horas antes)<input type="number" min="0" value={draft.business.cancelHours} onChange={(e) => biz({ cancelHours: Number(e.target.value) })} /></label>
              <label className="f">Separación entre horarios
                <select value={draft.business.slotStep} onChange={(e) => biz({ slotStep: Number(e.target.value) })}>
                  <option value={15}>Cada 15 min</option><option value={30}>Cada 30 min</option><option value={45}>Cada 45 min</option><option value={60}>Cada 60 min</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 28 }}>
          <div className="grid">
            <h3>Datos del local</h3>
            <label className="f">Dirección<input value={draft.business.address} onChange={(e) => biz({ address: e.target.value })} /></label>
            <label className="f">Referencia<input value={draft.business.addressNote} onChange={(e) => biz({ addressNote: e.target.value })} /></label>
            <label className="f">Ciudad<input value={draft.business.city} onChange={(e) => biz({ city: e.target.value })} /></label>
            <label className="f">Búsqueda para el mapa<input value={draft.business.mapsQuery} onChange={(e) => biz({ mapsQuery: e.target.value })} /></label>
            <label className="f">WhatsApp (con 54, sin espacios)<input value={draft.business.whatsapp} onChange={(e) => biz({ whatsapp: e.target.value.replace(/\D/g, "") })} /></label>
            <label className="f">Instagram (usuario)<input value={draft.business.instagram} placeholder="@fortunato.barberia" onChange={(e) => biz({ instagram: e.target.value })} /></label>
          </div>
          <div className="grid">
            <h3>Imágenes</h3>
            <label className="f">Foto de portada (link)<input value={draft.images.hero} onChange={(e) => setDraft({ ...draft, images: { ...draft.images, hero: e.target.value } })} /></label>
            <label className="f">Galería (un link por línea, o rutas como /img/local-1.jpg)
              <textarea rows={4} value={draft.images.gallery.join("\n")} onChange={(e) => setDraft({ ...draft, images: { ...draft.images, gallery: e.target.value.split("\n") } })} />
            </label>
          </div>
          <div className="grid">
            <h3>Texto "Nosotros"</h3>
            <label className="f">Un párrafo por línea
              <textarea rows={6} value={draft.about.join("\n")} onChange={(e) => setDraft({ ...draft, about: e.target.value.split("\n") })} />
            </label>
          </div>
          <div className="grid">
            <h3>Opiniones de clientes</h3>
            {draft.reviews.map((r, i) => (
              <div className="grid g3" key={i}>
                <input value={r.name} placeholder="Nombre" onChange={(e) => setDraft({ ...draft, reviews: draft.reviews.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })} />
                <input value={r.text} placeholder="Opinión" style={{ gridColumn: "span 2" }} onChange={(e) => setDraft({ ...draft, reviews: draft.reviews.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
            <div className="row">
              <button className="sbtn" onClick={() => setDraft({ ...draft, reviews: [...draft.reviews, { name: "", service: "Corte de cabello", text: "" }] })}>Agregar opinión</button>
              {draft.reviews.length > 0 && <button className="sbtn quiet" onClick={() => setDraft({ ...draft, reviews: draft.reviews.slice(0, -1) })}>Quitar la última</button>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────── foto del barbero (se sube a Cloudflare R2) ───────── */

// Achica la foto en el navegador: máximo 1200 px de lado, JPEG. Así sube rápido desde el celular.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("No se pudo leer la imagen"))), "image/jpeg", 0.86));
}

function PhotoField({ barber, isSaved, uploads, onPhoto, notify }) {
  const [busy, setBusy] = useState("");
  const inputId = `foto-${barber.id}`;

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify("Elegí un archivo de imagen (JPG, PNG o WEBP)."); return; }
    setBusy("Subiendo foto…");
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("barberId", barber.id);
      fd.append("file", blob, "foto.jpg");
      const r = await fetch("/api/admin/photo", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo subir la foto");
      onPhoto(barber.id, j.photo, j.config);
      notify(`Foto de ${barber.name.split(" ")[0]} publicada en la web`);
    } catch (err) { notify(err.message); }
    setBusy("");
  };

  const remove = async () => {
    setBusy("Quitando foto…");
    try {
      const r = await fetch("/api/admin/photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId: barber.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "No se pudo quitar la foto");
      onPhoto(barber.id, "", j.config);
      notify("Foto quitada. En la web se muestran las iniciales.");
    } catch (err) { notify(err.message); }
    setBusy("");
  };

  const initials = barber.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <div className="photoField">
      <div className="thumb">
        {barber.photo ? <img src={barber.photo} alt={`Foto de ${barber.name}`} /> : <span aria-hidden>{initials}</span>}
      </div>
      <div className="grid" style={{ gap: 8 }}>
        <strong>Foto</strong>
        {!uploads ? (
          <span className="muted">Para subir fotos falta conectar el almacenamiento de imágenes. Pedíselo a quien administra la web.</span>
        ) : !isSaved ? (
          <span className="muted">Guardá los cambios para poder subirle una foto a este barbero.</span>
        ) : (
          <>
            <span className="muted">Vertical, con buena luz. En la web se ve en blanco y negro. Se publica apenas la subís.</span>
            <div className="row">
              <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className="sr" onChange={upload} disabled={!!busy} />
              <label htmlFor={inputId} className={`sbtn solid ${busy ? "dis" : ""}`} role="button">{barber.photo ? "Cambiar foto" : "Subir foto"}</label>
              {barber.photo && !busy && <button className="sbtn quiet" onClick={remove}>Quitar foto</button>}
              {busy && <span className="muted">{busy}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
