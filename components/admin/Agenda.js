"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./AdminApp";
import { addDays, longDate, money, nowParts } from "@/lib/time";
import { PAYMENT_METHODS } from "@/lib/defaults";

const STATUS = { reservado: "Reservado", atendido: "Cobrado", cancelado: "Cancelado", ausente: "No vino", bloqueo: "Bloqueado" };
const methodLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label || id;

export default function Agenda({ config, notify }) {
  const [date, setDate] = useState(() => nowParts().date);
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api(`/api/admin/bookings?date=${date}`)).bookings); }
    catch (e) { notify(e.message); }
  }, [date, notify]);

  useEffect(() => { setList(null); load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const patch = async (b, body, msg) => {
    try { await api("/api/admin/bookings", { method: "PATCH", body: { date: b.date, id: b.id, ...body } }); notify(msg); load(); }
    catch (e) { notify(e.message); }
  };

  const real = (list || []).filter((b) => b.kind !== "bloqueo");
  const cobrado = real.filter((b) => b.status === "atendido").reduce((s, b) => s + (b.paid || 0), 0);
  const pendiente = real.filter((b) => b.status === "reservado").reduce((s, b) => s + (b.price || 0), 0);
  const barbers = config.barbers.filter((b) => b.active);

  return (
    <>
      <div className="head">
        <div>
          <p className="muted">{date === nowParts().date ? "Hoy" : "Agenda del día"}</p>
          <h2>{longDate(date)}</h2>
        </div>
        <div className="row">
          <button className="sbtn quiet" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">Anterior</button>
          <button className="sbtn quiet" onClick={() => setDate(nowParts().date)}>Hoy</button>
          <button className="sbtn quiet" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">Siguiente</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Elegir fecha" />
          <button className="sbtn solid" onClick={() => setAdding((a) => !a)}>{adding ? "Cerrar" : "Cargar turno"}</button>
        </div>
      </div>

      <dl className="kpis">
        <div><dt>Turnos del día</dt><dd>{real.filter((b) => b.status !== "cancelado").length}</dd></div>
        <div><dt>Por atender</dt><dd>{real.filter((b) => b.status === "reservado").length}</dd></div>
        <div className="big"><dt>Cobrado</dt><dd>{money(cobrado)}</dd></div>
        <div><dt>Falta cobrar</dt><dd>{money(pendiente)}</dd></div>
      </dl>

      {adding && <NewBooking config={config} date={date} onDone={() => { setAdding(false); load(); notify("Turno cargado"); }} notify={notify} />}

      {list === null ? <p className="muted">Cargando turnos…</p> : (
        <div className="cols" style={{ "--n": barbers.length }}>
          {barbers.map((br) => {
            const mine = list.filter((b) => b.barberId === br.id);
            return (
              <div className="col" key={br.id}>
                <h3><span>{br.name}</span><span className="muted">{mine.filter((b) => b.kind !== "bloqueo" && b.status !== "cancelado").length} turnos</span></h3>
                {mine.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Sin turnos este día.</p>}
                {mine.map((b) => <Card key={b.id} b={b} patch={patch} />)}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Card({ b, patch }) {
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState("efectivo");
  const [amount, setAmount] = useState(b.price);
  const end = (() => { const t = b.start + b.duration; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; })();
  const phone = (b.phone || "").replace(/\D/g, "");
  const waPhone = phone.startsWith("54") ? phone : `549${phone.replace(/^0/, "")}`;

  return (
    <div className={`bk ${b.status}`}>
      <div className="top">
        <span className="time">{b.time} a {end}</span>
        <span className="tag">{STATUS[b.status]}{b.status === "atendido" ? ` · ${methodLabel(b.payment)}` : ""}</span>
      </div>
      {b.kind === "bloqueo" ? (
        <>
          <span>{b.serviceName}</span>
          <div className="acts"><button onClick={() => patch(b, { remove: true }, "Horario liberado")}>Liberar horario</button></div>
        </>
      ) : (
        <>
          <strong>{b.name || "Cliente sin nombre"}</strong>
          <span>{b.serviceName} · {money(b.status === "atendido" ? b.paid : b.price)}</span>
          {b.phone && <a className="muted" href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer">{b.phone}</a>}
          {b.note && <span className="muted">“{b.note}”</span>}
          <span className="muted" style={{ fontSize: 12 }}>{b.source === "web" ? `Reservó en la web · código ${b.code}` : "Cargado en el local"}</span>

          {b.status === "reservado" && !paying && (
            <div className="acts">
              <button onClick={() => setPaying(true)}>Cobrar</button>
              <button onClick={() => patch(b, { status: "ausente" }, "Marcado como ausente")}>No vino</button>
              <button onClick={() => confirm("¿Cancelar este turno? El horario queda libre.") && patch(b, { status: "cancelado" }, "Turno cancelado")}>Cancelar</button>
            </div>
          )}
          {paying && (
            <div className="pay">
              <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Medio de pago">
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <input type="number" min="0" step="500" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Monto cobrado" />
              <button className="sbtn solid" onClick={() => { patch(b, { status: "atendido", payment: method, paid: amount }, "Cobro registrado en caja"); setPaying(false); }}>Registrar cobro</button>
              <button className="sbtn quiet" onClick={() => setPaying(false)}>Volver</button>
            </div>
          )}
          {["atendido", "ausente"].includes(b.status) && (
            <div className="acts"><button onClick={() => patch(b, { status: "reservado" }, "Turno reabierto")}>Deshacer</button></div>
          )}
        </>
      )}
    </div>
  );
}

function NewBooking({ config, date, onDone, notify }) {
  const barbers = config.barbers.filter((b) => b.active);
  const [f, setF] = useState({ kind: "turno", barberId: barbers[0]?.id || "", serviceId: "", duration: 30, time: "", name: "", phone: "", note: "" });
  const [slots, setSlots] = useState([]);
  const [known, setKnown] = useState([]);
  const services = config.services.filter((s) => s.active && s.prices[f.barberId] != null);
  const duration = f.kind === "turno" ? config.services.find((s) => s.id === f.serviceId)?.duration || 30 : Number(f.duration);

  // clientes ya cargados: al escribir el nombre se sugiere y se completa el celular
  useEffect(() => { api("/api/admin/clients").then((j) => setKnown(j.clients || [])).catch(() => {}); }, []);
  const setName = (name) => {
    const hit = known.filter((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setF((x) => ({ ...x, name, phone: hit.length === 1 && !x.phone ? hit[0].phone : x.phone }));
  };

  useEffect(() => {
    if (!f.barberId) return;
    api(`/api/admin/availability?date=${date}&barberId=${f.barberId}&duration=${duration}`)
      .then((j) => setSlots(j.slots || [])).catch(() => setSlots([]));
  }, [date, f.barberId, duration]);

  const submit = async (e) => {
    e.preventDefault();
    try { await api("/api/admin/bookings", { method: "POST", body: { ...f, date } }); onDone(); }
    catch (err) { notify(err.message); }
  };

  return (
    <form className="box grid" style={{ marginBottom: 32 }} onSubmit={submit}>
      <div className="row">
        <label className="row"><input type="radio" checked={f.kind === "turno"} onChange={() => setF({ ...f, kind: "turno" })} /> Turno de un cliente</label>
        <label className="row"><input type="radio" checked={f.kind === "bloqueo"} onChange={() => setF({ ...f, kind: "bloqueo" })} /> Bloquear horario (almuerzo, trámite…)</label>
      </div>
      <div className="grid g4">
        <label className="f">Barbero
          <select value={f.barberId} onChange={(e) => setF({ ...f, barberId: e.target.value, serviceId: "", time: "" })}>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {f.kind === "turno" ? (
          <label className="f">Servicio
            <select required value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value, time: "" })}>
              <option value="">Elegir</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.prices[f.barberId])}</option>)}
            </select>
          </label>
        ) : (
          <label className="f">Duración
            <select value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value, time: "" })}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
        )}
        <label className="f">Hora
          <select required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>
            <option value="">{slots.length ? "Elegir" : "Sin horarios libres"}</option>
            {slots.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {f.kind === "turno" ? (
          <label className="f">Nombre
            <input list="clientesConocidos" autoComplete="off" value={f.name} onChange={(e) => setName(e.target.value)} />
            <datalist id="clientesConocidos">{known.slice(0, 1500).map((c) => <option key={c.key} value={c.name}>{c.phone}</option>)}</datalist>
          </label>
        ) : (
          <label className="f">Motivo<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Almuerzo" /></label>
        )}
      </div>
      {f.kind === "turno" && (
        <div className="grid g4">
          <label className="f">Celular (opcional)<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label className="f" style={{ gridColumn: "span 2" }}>Nota (opcional)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        </div>
      )}
      <div><button className="sbtn solid">{f.kind === "turno" ? "Guardar turno" : "Bloquear horario"}</button></div>
    </form>
  );
}
