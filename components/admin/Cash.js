"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./AdminApp";
import { addDays, longDate, money, monthName, monthRange, nowParts, weekRange } from "@/lib/time";
import { PAYMENT_METHODS } from "@/lib/defaults";

const methodLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label || id;
const short = (ymd) => { const [, m, d] = ymd.split("-"); return `${Number(d)}/${Number(m)}`; };

export default function Cash({ config, notify }) {
  const [mode, setMode] = useState("semana");
  const [anchor, setAnchor] = useState(() => nowParts().date);
  const [r, setR] = useState(null);
  const range = mode === "semana" ? weekRange(anchor) : monthRange(anchor);

  const load = useCallback(async () => {
    try { setR((await api(`/api/admin/cash?from=${range.from}&to=${range.to}`)).report); }
    catch (e) { notify(e.message); }
  }, [range.from, range.to, notify]);
  useEffect(() => { setR(null); load(); }, [load]);

  const move = (dir) => {
    if (mode === "semana") setAnchor(addDays(anchor, dir * 7));
    else { const [y, m] = anchor.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + dir, 1)); setAnchor(d.toISOString().slice(0, 10)); }
  };

  const title = mode === "semana" ? `Semana del ${short(range.from)} al ${short(range.to)}` : monthName(anchor);

  const csv = () => {
    const rows = [["Fecha", "Tipo", "Concepto", "Medio", "Monto"]];
    r.byDay.forEach((d) => d.count && rows.push([d.date, "Servicios", `${d.count} turnos cobrados`, "", d.total]));
    r.movements.forEach((m) => rows.push([m.date, m.type, m.concept, methodLabel(m.method), m.type === "egreso" ? -m.amount : m.amount]));
    const blob = new Blob(["﻿" + rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `caja-fortunato-${range.from}-a-${range.to}.csv`; a.click();
  };

  const max = r ? Math.max(1, ...r.byDay.map((d) => d.total)) : 1;

  return (
    <>
      <div className="head">
        <div>
          <p className="muted">Caja {mode === "semana" ? "semanal" : "mensual"}</p>
          <h2>{title}</h2>
        </div>
        <div className="row">
          <div className="tabs" style={{ flex: "none" }}>
            <button className={mode === "semana" ? "on" : ""} onClick={() => setMode("semana")}>Semana</button>
            <button className={mode === "mes" ? "on" : ""} onClick={() => setMode("mes")}>Mes</button>
          </div>
          <button className="sbtn quiet" onClick={() => move(-1)}>Anterior</button>
          <button className="sbtn quiet" onClick={() => setAnchor(nowParts().date)}>Actual</button>
          <button className="sbtn quiet" onClick={() => move(1)}>Siguiente</button>
          {r && !(typeof window !== "undefined" && window.__FT_DEMO__) && <button className="sbtn" onClick={csv}>Descargar planilla</button>}
        </div>
      </div>

      {!r ? <p className="muted">Calculando…</p> : (
        <>
          <dl className="kpis">
            <div><dt>Servicios cobrados</dt><dd>{money(r.services)}</dd></div>
            <div><dt>Otros ingresos</dt><dd>{money(r.extra)}</dd></div>
            <div><dt>Gastos</dt><dd>{money(r.expenses)}</dd></div>
            <div className="big"><dt>Caja neta</dt><dd>{money(r.net)}</dd></div>
            <div><dt>Comisiones barberos</dt><dd>{money(r.commissions)}</dd></div>
            <div className="big"><dt>Queda para el local</dt><dd>{money(r.netAfterCommissions)}</dd></div>
            <div><dt>Ticket promedio</dt><dd>{money(r.ticket)}</dd></div>
            <div><dt>Atendidos / no vinieron / cancelados</dt><dd>{r.counts.atendido} / {r.counts.ausente} / {r.counts.cancelado}</dd></div>
          </dl>

          <h3>Ingresos por día</h3>
          <div className="chart">
            {r.byDay.map((d, i) => (
              <div key={d.date} className="b" style={{ height: `${(d.total / max) * 100}%`, animationDelay: `${i * 20}ms` }}>
                <span>{longDate(d.date)}: {money(d.total)}</span>
              </div>
            ))}
          </div>
          <div className="chartLabels">
            {r.byDay.map((d, i) => <span key={d.date}>{mode === "semana" || i % 3 === 0 ? short(d.date) : ""}</span>)}
          </div>

          <div className="split">
            <div className="grid" style={{ gap: 36 }}>
              <div className="scroll">
                <h3>Por barbero</h3>
                <table className="t">
                  <thead><tr><th>Barbero</th><th className="r">Atendidos</th><th className="r">Facturado</th><th className="r">Comisión</th><th className="r">A pagarle</th></tr></thead>
                  <tbody>
                    {r.byBarber.length === 0 && <tr><td colSpan={5} className="muted">Todavía no hay cobros en este período.</td></tr>}
                    {r.byBarber.map((b) => (
                      <tr key={b.id}><td>{b.name}</td><td className="r">{b.count}</td><td className="r">{money(b.total)}</td><td className="r">{b.commissionPct}%</td><td className="r"><strong>{money(b.commission)}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="scroll">
                <h3>Por servicio</h3>
                <table className="t">
                  <thead><tr><th>Servicio</th><th className="r">Cantidad</th><th className="r">Total</th></tr></thead>
                  <tbody>
                    {r.byService.length === 0 && <tr><td colSpan={3} className="muted">Sin datos.</td></tr>}
                    {r.byService.map((s) => <tr key={s.name}><td>{s.name}</td><td className="r">{s.count}</td><td className="r">{money(s.total)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>Por medio de pago</h3>
                <table className="t">
                  <tbody>
                    {Object.keys(r.byMethod).length === 0 && <tr><td className="muted">Sin datos.</td></tr>}
                    {Object.entries(r.byMethod).map(([m, v]) => <tr key={m}><td>{methodLabel(m)}</td><td className="r">{money(v)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3>Movimientos de caja</h3>
              <p className="muted" style={{ marginBottom: 14 }}>Los cobros de turnos entran solos desde la agenda. Acá cargás ventas de productos, propinas o gastos (alquiler, insumos, luz).</p>
              <MovementForm defaultDate={nowParts().date >= range.from && nowParts().date <= range.to ? nowParts().date : range.from} onDone={load} notify={notify} />
              <table className="t" style={{ marginTop: 18 }}>
                <tbody>
                  {r.movements.length === 0 && <tr><td className="muted">No hay movimientos cargados en este período.</td></tr>}
                  {r.movements.map((m) => (
                    <tr key={m.id}>
                      <td>{short(m.date)}</td>
                      <td>{m.concept}<div className="muted" style={{ fontSize: 13 }}>{methodLabel(m.method)}</div></td>
                      <td className="r">{m.type === "egreso" ? "−" : "+"}{money(m.amount)}</td>
                      <td className="r"><button className="muted" onClick={async () => {
                        if (!confirm("¿Borrar este movimiento?")) return;
                        try { await api("/api/admin/cash", { method: "DELETE", body: { date: m.date, id: m.id } }); load(); } catch (e) { notify(e.message); }
                      }}>Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MovementForm({ defaultDate, onDone, notify }) {
  const blank = { date: defaultDate, type: "ingreso", concept: "", amount: "", method: "efectivo" };
  const [f, setF] = useState(blank);
  useEffect(() => setF((x) => ({ ...x, date: defaultDate })), [defaultDate]);
  const submit = async (e) => {
    e.preventDefault();
    try { await api("/api/admin/cash", { method: "POST", body: f }); setF({ ...blank, date: f.date }); onDone(); notify(f.type === "egreso" ? "Gasto cargado" : "Ingreso cargado"); }
    catch (err) { notify(err.message); }
  };
  return (
    <form className="box grid" onSubmit={submit}>
      <div className="grid g2">
        <label className="f">Tipo
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="ingreso">Ingreso</option><option value="egreso">Gasto</option>
          </select>
        </label>
        <label className="f">Fecha<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="f">Concepto<input required value={f.concept} onChange={(e) => setF({ ...f, concept: e.target.value })} placeholder={f.type === "egreso" ? "Insumos" : "Venta de cera"} /></label>
        <label className="f">Monto<input type="number" required min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="f">Medio
          <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <div><button className="sbtn solid">{f.type === "egreso" ? "Cargar gasto" : "Cargar ingreso"}</button></div>
    </form>
  );
}
