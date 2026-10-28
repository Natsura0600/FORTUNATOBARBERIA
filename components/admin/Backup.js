"use client";
import { useState } from "react";
import { api } from "./AdminApp";

const isDemo = () => typeof window !== "undefined" && !!window.__FT_DEMO__;

// Copia de seguridad: baja todo (config, clientes, turnos, caja) en un archivo y permite volver a cargarlo.
export default function Backup({ notify }) {
  const [busy, setBusy] = useState("");

  const download = async () => {
    setBusy("Armando la copia…");
    try {
      const r = await fetch("/api/admin/backup", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "No se pudo armar la copia");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (r.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/)?.[1] || "copia-fortunato.json";
      a.click();
      notify("Copia descargada. Guardala en un lugar seguro (Drive, mail, compu).");
    } catch (e) { notify(e.message); }
    setBusy("");
  };

  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { notify("La copia pesa más de 4 MB y no se puede cargar desde el panel. Pedile ayuda a quien administra la web."); return; }
    let data;
    try { data = JSON.parse(await file.text()); } catch { notify("Ese archivo no es una copia válida."); return; }
    if (data?.app !== "fortunato-barberia") { notify("Ese archivo no es una copia de seguridad de esta web."); return; }
    const c = data.counts || {};
    if (!confirm(`Vas a cargar la copia del ${String(data.exportedAt || "").slice(0, 10)}: ${c.clients ?? "?"} clientes, ${c.bookings ?? "?"} turnos y ${c.movements ?? "?"} movimientos de caja.\n\nSe reemplaza la configuración (precios, horarios, avisos) y se vuelven a cargar los datos de la copia. ¿Seguro?`)) return;
    setBusy("Restaurando…");
    try {
      const j = await api("/api/admin/backup", { method: "POST", body: { backup: data } });
      notify(`Copia cargada: ${j.done.clients} clientes, ${j.done.bookings} turnos, ${j.done.movements} movimientos. Recargá la página.`);
    } catch (err) { notify(err.message); }
    setBusy("");
  };

  return (
    <section className="box grid" style={{ marginTop: 40 }}>
      <h3 style={{ marginBottom: 0 }}>Copia de seguridad</h3>
      <p className="muted">
        Un solo archivo con todo: precios y horarios, clientes, turnos y caja. Conviene bajarlo una vez por semana (o antes de cambiar algo grande) y guardarlo en Drive o en el mail.
        Si algún día se pierden datos, se vuelve a cargar desde acá.
      </p>
      {isDemo() ? (
        <p className="muted">En la demo la descarga está desactivada. En la web real, estos botones bajan y cargan el archivo.</p>
      ) : (
        <div className="row">
          <button className="sbtn solid" onClick={download} disabled={!!busy}>Descargar copia</button>
          <input id="restoreFile" type="file" accept="application/json,.json" className="sr" onChange={restore} disabled={!!busy} />
          <label htmlFor="restoreFile" className={`sbtn ${busy ? "dis" : ""}`} role="button">Cargar una copia</label>
          {busy && <span className="muted">{busy}</span>}
        </div>
      )}
    </section>
  );
}
