"use client";
import { useCallback, useEffect, useState } from "react";
import Agenda from "./Agenda";
import Cash from "./Cash";
import { Prices, Barbers, Notices, Shop } from "./Settings";

const TABS = [
  ["agenda", "Agenda"],
  ["caja", "Caja"],
  ["precios", "Servicios y precios"],
  ["barberos", "Barberos"],
  ["avisos", "Avisos"],
  ["local", "Local y horarios"],
];

export async function api(path, opts = {}) {
  const r = await fetch(path, {
    cache: "no-store",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error("auth"), { auth: true });
  if (!r.ok) throw new Error(j.error || "Error");
  return j;
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState("agenda");
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [storage, setStorage] = useState("");
  const [uploads, setUploads] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const notify = useCallback((m) => { setToast(m); setTimeout(() => setToast(""), 2800); }, []);

  const load = useCallback(async () => {
    try {
      const j = await api("/api/admin/config");
      setConfig(j.config); setDraft(j.config); setStorage(j.storage); setUploads(!!j.uploads); setAuthed(true);
    } catch (e) {
      if (e.auth) setAuthed(false); else notify(e.message);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = location.hash.replace("#", "");
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);

  const dirty = config && draft && JSON.stringify(config) !== JSON.stringify(draft);

  const save = async () => {
    setSaving(true);
    try {
      const j = await api("/api/admin/config", { method: "PUT", body: { config: draft } });
      setConfig(j.config); setDraft(j.config);
      notify("Cambios guardados. Ya se ven en la web.");
    } catch (e) { notify(e.message); }
    setSaving(false);
  };

  const logout = async () => { await api("/api/admin/logout", { method: "POST" }); setAuthed(false); };

  if (authed === null) return <div className="admin login"><p className="muted">Cargando…</p></div>;
  if (!authed) return <Login onOk={load} />;

  const go = (k) => { setTab(k); history.replaceState(null, "", `#${k}`); };
  const props = { config, draft, setDraft, notify };
  // La foto se guarda en el momento: actualiza la config guardada y el borrador sin pisar otros cambios.
  const onPhoto = (barberId, photo, saved) => {
    const clean = JSON.stringify(draft) === JSON.stringify(config);
    setConfig(saved);
    setDraft((d) => (clean ? saved : { ...d, barbers: d.barbers.map((b) => (b.id === barberId ? { ...b, photo } : b)) }));
  };

  return (
    <div className="admin">
      <div className="bar">
        <h1>FOЯTUNATO</h1>
        <nav className="tabs">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}>{l}</button>)}
        </nav>
        <div className="row">
          <a className="sbtn quiet" href="/" target="_blank">Ver web</a>
          <button className="sbtn quiet" onClick={logout}>Salir</button>
        </div>
      </div>
      <div className="body">
        {storage === "demo" && (
          <p className="warn">Demo con turnos y movimientos de ejemplo. Podés cobrar, cancelar y editar precios: nada se guarda al cerrar la página.</p>
        )}
        {storage === "memory" && (
          <p className="warn">Modo de prueba: no hay base de datos conectada y los datos se borran al reiniciar. Configurá Upstash Redis (ver README).</p>
        )}
        {tab === "agenda" && <Agenda config={config} notify={notify} />}
        {tab === "caja" && <Cash config={config} notify={notify} />}
        {tab === "precios" && <Prices {...props} />}
        {tab === "barberos" && <Barbers {...props} uploads={uploads} onPhoto={onPhoto} saved={config} />}
        {tab === "avisos" && <Notices {...props} />}
        {tab === "local" && <Shop {...props} />}
      </div>
      {dirty && (
        <div className="save">
          <span>Tenés cambios sin guardar</span>
          <button className="sbtn quiet" style={{ color: "#000" }} onClick={() => setDraft(config)}>Descartar</button>
          <button className="sbtn solid" style={{ background: "#fff", color: "#000" }} onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Login({ onOk }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api("/api/admin/login", { method: "POST", body: { password: pw } }); onOk(); }
    catch (e2) { setErr(e2.auth ? "Contraseña incorrecta" : e2.message); }
    setBusy(false);
  };
  return (
    <div className="admin login">
      <form onSubmit={submit}>
        <h1>Panel<br />del local</h1>
        <input type="password" autoFocus placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Contraseña" />
        <button className="btn" disabled={busy || !pw}>{busy ? "Entrando…" : "Entrar"}</button>
        {err && <p>{err}</p>}
      </form>
    </div>
  );
}
