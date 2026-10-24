"use client";
import { useEffect, useMemo, useState } from "react";
import { addDays, nowParts, weekday, longDate, money } from "@/lib/time";
import { dayBookable } from "@/lib/schedule";

const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function Booking({ cfg }) {
  const [step, setStep] = useState(0);
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", note: "", website: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [today, setToday] = useState("");

  useEffect(() => { setToday(nowParts().date); }, []);

  const barber = cfg.barbers.find((b) => b.id === barberId);
  const service = cfg.services.find((s) => s.id === serviceId);
  const price = barber && service ? service.prices[barber.id] : null;

  // preselección desde la lista de precios o desde el equipo
  useEffect(() => {
    const on = (e) => {
      const { barberId: b, serviceId: s } = e.detail || {};
      setDone(null); setError(""); setTime(""); setDate("");
      if (b) setBarberId(b);
      if (s) setServiceId(s);
      if (b && s) setStep(2);
      else if (b) setStep(1);
      else setStep(0);
    };
    window.addEventListener("ft:book", on);
    return () => window.removeEventListener("ft:book", on);
  }, []);

  const days = useMemo(() => {
    if (!today) return [];
    return Array.from({ length: cfg.business.bookingDaysAhead + 1 }, (_, i) => {
      const d = addDays(today, i);
      return { d, ok: dayBookable(cfg, d, barber) };
    });
  }, [today, cfg, barber]);

  useEffect(() => {
    if (!date || !barberId || !serviceId) return;
    let alive = true;
    setSlots(null); setReason("");
    fetch(`/api/availability?date=${date}&barberId=${barberId}&serviceId=${serviceId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) { setSlots(j.slots || []); setReason(j.reason || ""); } })
      .catch(() => alive && (setSlots([]), setReason("No pudimos cargar los horarios. Probá de nuevo.")));
    return () => { alive = false; };
  }, [date, barberId, serviceId]);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true); setError("");
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId, serviceId, date, time, ...form }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "No pudimos guardar el turno.");
        if (/horario/i.test(j.error || "")) { setTime(""); setStep(2); setDate((d) => d); }
      } else {
        setDone(j.booking);
      }
    } catch {
      setError("Sin conexión. Revisá internet y volvé a confirmar.");
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setDone(null); setStep(0); setBarberId(""); setServiceId(""); setDate(""); setTime("");
    setForm({ name: "", phone: "", note: "", website: "" });
  };

  const labels = [
    ["Barbero", barber?.name],
    ["Servicio", service ? `${service.name}${price != null ? `, ${money(price)}` : ""}` : null],
    ["Día y hora", date && time ? `${longDate(date)}, ${time}` : date ? longDate(date) : null],
    ["Tus datos", form.name || null],
  ];

  const waText = done
    ? `¡Hola! Reservé un turno en la web: ${done.serviceName} con ${done.barberName}, ${longDate(done.date).toLowerCase()} a las ${done.time}. Código ${done.code}.`
    : "";

  return (
    <section className="section wrap dark" id="reservar">
      <div className="booking">
        <aside className="side">
          <h2 className="display h2" data-reveal>
            <span className="mask"><span>Reservá</span></span>
            <span className="mask"><span>tu turno</span></span>
          </h2>
          <ol className="steps">
            {labels.map(([l, v], i) => (
              <li key={l} className={done ? "done" : i === step ? "now" : i < step ? "done" : ""}
                onClick={() => !done && i < step && setStep(i)}>
                <span>{l}{v && <small>{v}</small>}</span>
              </li>
            ))}
          </ol>
        </aside>

        <div className="main" aria-live="polite">
          {done ? (
            <div className="pane" key="ok">
              <p className="grey">Turno confirmado. Guardá este código.</p>
              <div className="okCode">{done.code}</div>
              <dl className="summary">
                <dt>Cuándo</dt><dd>{longDate(done.date)}, {done.time} h</dd>
                <dt>Con</dt><dd>{done.barberName}</dd>
                <dt>Servicio</dt><dd>{done.serviceName}, {done.duration} min</dd>
                <dt>Precio</dt><dd>{money(done.price)}, se abona en el local</dd>
                <dt>Dónde</dt><dd>{cfg.business.address}, {cfg.business.city}</dd>
              </dl>
              <div className="paneNav">
                <a className="btn" href={`https://wa.me/${cfg.business.whatsapp}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer">Avisar por WhatsApp</a>
                <button className="btn ghost" onClick={reset}>Reservar otro turno</button>
              </div>
            </div>
          ) : step === 0 ? (
            <div className="pane" key="s0">
              <h3 className="display">¿Con quién?</h3>
              <div className="choice">
                {cfg.barbers.map((b) => (
                  <button key={b.id} className={`opt ${b.id === barberId ? "sel" : ""}`}
                    onClick={() => { setBarberId(b.id); setDate(""); setTime(""); if (serviceId && cfg.services.find((s) => s.id === serviceId)?.prices[b.id] == null) setServiceId(""); setStep(1); }}>
                    <span><span className="t">{b.name}</span><span className="s">{b.role}</span></span>
                    <span className="p">Elegir</span>
                  </button>
                ))}
              </div>
            </div>
          ) : step === 1 ? (
            <div className="pane" key="s1">
              <h3 className="display">¿Qué te hacés?</h3>
              <div className="choice">
                {cfg.services.filter((s) => s.prices[barberId] != null).map((s) => (
                  <button key={s.id} className={`opt ${s.id === serviceId ? "sel" : ""}`}
                    onClick={() => { setServiceId(s.id); setTime(""); setStep(2); }}>
                    <span><span className="t">{s.name}</span><span className="s">{s.duration} min · {s.description}</span></span>
                    <span className="p">{money(s.prices[barberId])}</span>
                  </button>
                ))}
              </div>
              <div className="paneNav"><button className="btn ghost" onClick={() => setStep(0)}>Cambiar barbero</button></div>
            </div>
          ) : step === 2 ? (
            <div className="pane" key="s2">
              <h3 className="display">¿Cuándo?</h3>
              <div className="days" role="listbox" aria-label="Día">
                {days.map(({ d, ok }) => {
                  const [, m, dd] = d.split("-").map(Number);
                  return (
                    <button key={d} className={`day ${d === date ? "sel" : ""}`} disabled={!ok}
                      onClick={() => { setDate(d); setTime(""); }} aria-label={longDate(d)}>
                      <span>{d === today ? "hoy" : WD[weekday(d)]}</span>
                      <b>{dd}</b>
                      <span>{MO[m - 1]}</span>
                    </button>
                  );
                })}
              </div>
              {date && (
                slots === null ? <p className="note" style={{ marginTop: 28 }}>Buscando horarios libres…</p>
                : slots.length === 0 ? <p className="error">{reason}</p>
                : (
                  <div className="slots" key={date}>
                    {slots.map((t, i) => (
                      <button key={t} className={`slot ${t === time ? "sel" : ""}`} style={{ animationDelay: `${i * 18}ms` }}
                        onClick={() => { setTime(t); setStep(3); }}>{t}</button>
                    ))}
                  </div>
                )
              )}
              {error && <p className="error">{error}</p>}
              <div className="paneNav"><button className="btn ghost" onClick={() => setStep(1)}>Cambiar servicio</button></div>
            </div>
          ) : (
            <form className="pane" key="s3" onSubmit={submit}>
              <h3 className="display">Tus datos</h3>
              <div className="fields">
                <div className="field">
                  <label htmlFor="bk-name">Nombre y apellido</label>
                  <input id="bk-name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="bk-phone">Celular, para avisarte si hay un cambio</label>
                  <input id="bk-phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="2323 123456" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="bk-note">Comentario (opcional)</label>
                  <input id="bk-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
                <input className="sr" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} name="website" />
              </div>
              <dl className="summary">
                <dt>Barbero</dt><dd>{barber?.name}</dd>
                <dt>Servicio</dt><dd>{service?.name}, {service?.duration} min</dd>
                <dt>Día y hora</dt><dd>{date && longDate(date)}, {time} h</dd>
                <dt>Precio</dt><dd>{money(price)}, se abona en el local</dd>
              </dl>
              <p className="note">Podés cancelar hasta {cfg.business.cancelHours} horas antes con tu código.</p>
              {error && <p className="error">{error}</p>}
              <div className="paneNav">
                <button type="button" className="btn ghost" onClick={() => setStep(2)}>Cambiar horario</button>
                <button className="btn" disabled={sending}>{sending ? "Confirmando…" : "Confirmar turno"}</button>
              </div>
            </form>
          )}

          <CancelBox cfg={cfg} />
        </div>
      </div>
    </section>
  );
}

function CancelBox({ cfg }) {
  const [f, setF] = useState({ date: "", code: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Turno cancelado. El horario quedó libre para otra persona." : j.error || "No pudimos cancelar el turno.");
    setBusy(false);
  };
  return (
    <details className="cancelBox">
      <summary>¿Necesitás cancelar un turno?</summary>
      <form onSubmit={send}>
        <div className="field"><label htmlFor="c-date">Día del turno</label><input id="c-date" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="field"><label htmlFor="c-code">Código</label><input id="c-code" required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
        <div className="field"><label htmlFor="c-phone">Celular</label><input id="c-phone" required type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <button className="btn ghost" disabled={busy}>Cancelar turno</button>
      </form>
      {msg && <p className="note" style={{ marginTop: 14 }}>{msg}</p>}
    </details>
  );
}
