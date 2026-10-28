"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./AdminApp";
import { money, nowParts, addDays } from "@/lib/time";

const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dmy = (ymd) => (ymd ? ymd.split("-").reverse().join("/") : "—");
const waLink = (c) => (/^\d{10}$/.test(c.key) ? `https://wa.me/549${c.key}` : "");
const isDemo = () => typeof window !== "undefined" && !!window.__FT_DEMO__;

const SORTS = [
  ["name", "Nombre"],
  ["last", "Última visita"],
  ["visits", "Más visitas"],
  ["spent", "Más gastaron"],
];
const SOURCE = { agendapro: "AgendaPro", web: "Web", local: "Local", manual: "Cargado a mano" };

async function readFile(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}

export default function Clients({ notify }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [shown, setShown] = useState(50);
  const [open, setOpen] = useState(null); // clave del cliente o "nuevo"
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api("/api/admin/clients")).clients); }
    catch (e) { notify(e.message); }
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!list) return [];
    const term = fold(q).trim();
    const digits = term.replace(/\D/g, "");
    let r = list;
    if (term) {
      r = r.filter((c) =>
        fold(c.name).includes(term) || fold(c.email).includes(term) || (c.aka || []).some((a) => fold(a).includes(term)) ||
        (digits.length >= 3 && (c.key.includes(digits) || c.phone.replace(/\D/g, "").includes(digits))));
    }
    const by = {
      name: (a, b) => a.name.localeCompare(b.name, "es"),
      last: (a, b) => (b.lastVisit || "").localeCompare(a.lastVisit || "") || a.name.localeCompare(b.name, "es"),
      visits: (a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "es"),
      spent: (a, b) => b.spent - a.spent || a.name.localeCompare(b.name, "es"),
    }[sort];
    return [...r].sort(by);
  }, [list, q, sort]);

  useEffect(() => { setShown(50); }, [q, sort]);

  const stats = useMemo(() => {
    if (!list) return null;
    const today = nowParts().date;
    const since = addDays(today, -60);
    const month = today.slice(0, 7);
    return {
      total: list.length,
      active: list.filter((c) => c.lastVisit && c.lastVisit >= since).length,
      fresh: list.filter((c) => c.createdAt?.slice(0, 7) === month).length,
      noPhone: list.filter((c) => !/^\d{10}$/.test(c.key)).length,
    };
  }, [list]);

  const csv = () => {
    const out = [["Nombre", "Celular", "Mail", "Visitas", "Gastado", "Última visita", "Cumpleaños", "Notas"]];
    [...list].sort((a, b) => a.name.localeCompare(b.name, "es")).forEach((c) =>
      out.push([c.name, c.phone, c.email, c.visits, c.spent, c.lastVisit, c.birthday, c.notes]));
    const blob = new Blob(["\uFEFF" + out.map((x) => x.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-fortunato-${nowParts().date}.csv`;
    a.click();
  };

  return (
    <>
      <div className="head">
        <div>
          <p className="muted">Base de clientes</p>
          <h2>Clientes</h2>
        </div>
        <div className="row">
          <button className="sbtn" onClick={() => setImporting((v) => !v)}>{importing ? "Cerrar importador" : "Importar archivo"}</button>
          {list && list.length > 0 && !isDemo() && <button className="sbtn" onClick={csv}>Descargar lista</button>}
          <button className="sbtn solid" onClick={() => setOpen("nuevo")}>Nuevo cliente</button>
        </div>
      </div>

      {importing && <Importer notify={notify} onDone={() => { setImporting(false); load(); }} />}

      {stats && (
        <dl className="kpis">
          <div className="big"><dt>Clientes</dt><dd>{stats.total}</dd></div>
          <div><dt>Vinieron en los últimos 60 días</dt><dd>{stats.active}</dd></div>
          <div><dt>Nuevos este mes</dt><dd>{stats.fresh}</dd></div>
          <div><dt>Sin celular válido</dt><dd>{stats.noPhone}</dd></div>
        </dl>
      )}

      <div className="row" style={{ marginBottom: 14 }}>
        <input type="search" className="grow" placeholder="Buscar por nombre, celular o mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {list === null ? <p className="muted">Cargando clientes…</p> : list.length === 0 ? (
        <div className="box">
          <strong>Todavía no hay clientes cargados.</strong>
          <p className="muted" style={{ marginTop: 6 }}>Cada persona que reserve se suma sola. Para traer los de AgendaPro, usá “Importar archivo” con la lista exportada en CSV.</p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 6 }}>{rows.length === list.length ? `${rows.length} clientes` : `${rows.length} de ${list.length} clientes`}</p>
          <div className="scroll">
            <table className="t clientsT">
              <thead>
                <tr><th>Nombre</th><th>Celular</th><th className="r">Visitas</th><th className="r hideSm">Gastado</th><th className="hideSm">Última visita</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((c) => (
                  <tr key={c.key} onClick={() => setOpen(c.key)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(c.key)}>
                    <td><strong>{c.name}</strong>{c.next && <span className="tag" style={{ marginLeft: 8 }}>Turno {dmy(c.next).slice(0, 5)}</span>}</td>
                    <td>{c.phone || <span className="muted">—</span>}</td>
                    <td className="r">{c.visits}</td>
                    <td className="r hideSm">{c.spent ? money(c.spent) : "—"}</td>
                    <td className="hideSm">{dmy(c.lastVisit)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="muted">Nadie coincide con “{q}”.</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > shown && (
            <div style={{ marginTop: 16 }}><button className="sbtn" onClick={() => setShown((n) => n + 100)}>Ver más ({rows.length - shown} restantes)</button></div>
          )}
        </>
      )}

      {open && <Ficha id={open} notify={notify} onClose={() => setOpen(null)} onChange={() => { setOpen(null); load(); }} />}
    </>
  );
}

/* ───────── importar archivo ───────── */

function Importer({ notify, onDone }) {
  const [csv, setCsv] = useState("");
  const [name, setName] = useState("");
  const [prev, setPrev] = useState(null);
  const [busy, setBusy] = useState("");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) { notify("Es un Excel. Abrilo y usá Guardar como → CSV, y subí ese archivo."); return; }
    if (file.size > 3.5 * 1024 * 1024) { notify("El archivo es muy grande (máximo 3,5 MB)."); return; }
    setBusy("Leyendo archivo…");
    try {
      const text = await readFile(file);
      const j = await api("/api/admin/clients", { method: "POST", body: { action: "preview", csv: text } });
      setCsv(text); setName(file.name); setPrev(j.result);
    } catch (err) { setPrev(null); notify(err.message); }
    setBusy("");
  };

  const go = async () => {
    setBusy("Importando…");
    try {
      const j = await api("/api/admin/clients", { method: "POST", body: { action: "import", csv } });
      notify(`Listo: ${j.result.created} clientes nuevos y ${j.result.updated} actualizados.`);
      onDone();
    } catch (err) { notify(err.message); setBusy(""); }
  };

  return (
    <div className="box grid" style={{ marginBottom: 28 }}>
      <h3 style={{ marginBottom: 0 }}>Importar clientes desde un archivo CSV</h3>
      <div className="row">
        <input id="csvFile" type="file" accept=".csv,.txt,text/csv" className="sr" onChange={pick} disabled={!!busy} />
        <label htmlFor="csvFile" className={`sbtn solid ${busy ? "dis" : ""}`} role="button">{prev ? "Elegir otro archivo" : "Elegir archivo"}</label>
        {name && <span className="muted">{name}</span>}
        {busy && <span className="muted">{busy}</span>}
      </div>

      {prev && (
        <div className="grid" style={{ gap: 14 }}>
          <div className="kpis" style={{ margin: 0, borderTop: "1px solid var(--line)" }}>
            <div><dt>Filas en el archivo</dt><dd>{prev.rows}</dd></div>
            <div className="big"><dt>Clientes nuevos</dt><dd>{prev.created}</dd></div>
            <div><dt>Ya existían</dt><dd>{prev.updated}</dd></div>
            <div><dt>Sin celular válido</dt><dd>{prev.noPhone}</dd></div>
          </div>
          <div>
            <strong>Columnas que reconocí</strong>
            <ul className="mapList">
              {prev.mapping.map((m, i) => <li key={i}><span>{m.field}</span><span className="muted">columna “{m.column}”</span></li>)}
            </ul>
            {prev.ignored.length > 0 && <p className="muted" style={{ marginTop: 6 }}>No se usan: {prev.ignored.join(", ")}.</p>}
          </div>
          {(prev.skipped > 0 || prev.repeated > 0 || prev.noPhone > 0) && (
            <ul className="muted notes">
              {prev.repeated > 0 && <li>{prev.repeated} filas repetidas (mismo celular) se unieron en una sola ficha.</li>}
              {prev.skipped > 0 && <li>{prev.skipped} filas sin nombre ni celular se salteron.</li>}
              {prev.noPhone > 0 && <li>{prev.noPhone} clientes no tienen un celular válido: se cargan igual, pero no se van a unir con sus turnos nuevos.</li>}
            </ul>
          )}
          <div className="scroll">
            <table className="t">
              <thead><tr><th>Nombre</th><th>Celular</th><th>Mail</th><th className="r">Visitas</th><th>Última visita</th></tr></thead>
              <tbody>
                {prev.sample.map((s, i) => (
                  <tr key={i}><td>{s.name}</td><td>{s.phone || "—"}</td><td>{s.email || "—"}</td><td className="r">{s.visits}</td><td>{dmy(s.lastVisit)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Ejemplo con los primeros {prev.sample.length} del archivo.</p>
          <div className="row">
            <button className="sbtn solid" onClick={go} disabled={!!busy || prev.total === 0}>Importar {prev.total} clientes</button>
            <button className="sbtn quiet" onClick={() => { setPrev(null); setCsv(""); setName(""); }} disabled={!!busy}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── ficha del cliente ───────── */

const STATUS = { reservado: "Reservado", atendido: "Cobrado", cancelado: "Cancelado", ausente: "No vino" };

function Ficha({ id, notify, onClose, onChange }) {
  const isNew = id === "nuevo";
  const [c, setC] = useState(isNew ? { key: "", name: "", phone: "", email: "", birthday: "", notes: "", history: [], aka: [] } : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api(`/api/admin/clients?key=${encodeURIComponent(id)}`).then((j) => setC(j.client)).catch((e) => { notify(e.message); onClose(); });
  }, [id, isNew, notify, onClose]);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/clients", { method: "PUT", body: { ...c, key: isNew ? undefined : c.key } });
      notify(isNew ? "Cliente agregado" : "Cliente guardado");
      onChange();
    } catch (err) { notify(err.message); setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`¿Borrar la ficha de ${c.name}? Sus turnos pasados no se tocan.`)) return;
    setBusy(true);
    try { await api("/api/admin/clients", { method: "DELETE", body: { key: c.key } }); notify("Cliente borrado"); onChange(); }
    catch (err) { notify(err.message); setBusy(false); }
  };

  const wa = c && !isNew ? waLink(c) : "";
  const set = (f) => (e) => setC({ ...c, [f]: e.target.value });

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ficha del cliente">
        {!c ? <p className="muted">Cargando…</p> : (
          <form className="grid" onSubmit={save}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ marginBottom: 0 }}>{isNew ? "Nuevo cliente" : c.name}</h3>
              <button type="button" className="sbtn quiet" onClick={onClose}>Cerrar</button>
            </div>

            {!isNew && (
              <dl className="kpis" style={{ margin: 0 }}>
                <div><dt>Visitas</dt><dd>{c.visits}</dd></div>
                <div><dt>Gastado</dt><dd>{c.spent ? money(c.spent) : "—"}</dd></div>
                <div><dt>Última visita</dt><dd style={{ fontSize: 22 }}>{dmy(c.lastVisit)}</dd></div>
                <div><dt>No vino</dt><dd>{c.noShows}</dd></div>
              </dl>
            )}

            <div className="grid g2">
              <label className="f">Nombre<input required value={c.name} onChange={set("name")} /></label>
              <label className="f">Celular<input inputMode="tel" value={c.phone} onChange={set("phone")} placeholder="2323 456789" /></label>
              <label className="f">Mail<input type="email" value={c.email} onChange={set("email")} /></label>
              <label className="f">Cumpleaños<input type="date" value={c.birthday} onChange={set("birthday")} /></label>
            </div>
            <label className="f">Notas del local<textarea rows={3} value={c.notes} onChange={set("notes")} placeholder="Ej: se hace degradé bajo, viene con su hijo, prefiere a Lauti" /></label>

            {!isNew && !/^\d{10}$/.test(c.key) && <p className="muted">Esta ficha no tiene un celular válido: no se une automáticamente con sus turnos. Cargale el celular para que sí.</p>}
            {!isNew && c.aka?.length > 0 && <p className="muted">También reservó con el nombre: {c.aka.join(", ")}. (Mismo celular.)</p>}
            {!isNew && <p className="muted" style={{ fontSize: 12 }}>Origen: {SOURCE[c.source] || c.source}</p>}

            {!isNew && c.history?.length > 0 && (
              <div>
                <strong>Últimos turnos</strong>
                <ul className="hist">
                  {c.history.slice(0, 8).map((h) => (
                    <li key={h.id}>
                      <span className="when">{dmy(h.date)} · {h.time}</span>
                      <span>{h.service} con {String(h.barber || "").split(" ")[0]}</span>
                      <span className="tag">{STATUS[h.status] || h.status}{h.status === "atendido" ? ` · ${money(h.paid)}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="row">
              <button className="sbtn solid" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
              {wa && <a className="sbtn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
              {!isNew && <button type="button" className="sbtn quiet" onClick={remove} disabled={busy}>Borrar cliente</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
