"use client";
import { useEffect, useRef, useState } from "react";
import { openState } from "@/lib/schedule";
import { money, nowParts, weekday, longDate } from "@/lib/time";
import { scrollToId } from "./Motion";

const WORD = "FORTUNATO".split("");
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const firstName = (n) => n.split(" ")[0];
const wa = (cfg, text) => `https://wa.me/${cfg.business.whatsapp}?text=${encodeURIComponent(text)}`;

function Mask({ children }) {
  return <span className="mask"><span>{children}</span></span>;
}

export function Wordmark({ mode, className = "" }) {
  return (
    <div className={`wordmark ${className}`} data-stretch={mode} aria-label="Fortunato" role="img">
      {WORD.map((c, i) => (
        <span key={i} aria-hidden className={i === 2 ? "flip" : ""} style={{ transitionDelay: `${i * 45}ms` }}>{c}</span>
      ))}
    </div>
  );
}

/* ───────── preloader ───────── */
export function Preloader() {
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let seen = null;
    try { seen = sessionStorage.getItem("ft-loaded"); } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduce) {
      setGone(true);
      window.__ftReady = true;
      window.dispatchEvent(new Event("ft:ready"));
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1500);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setTimeout(() => { setDone(true); window.__ftReady = true; window.dispatchEvent(new Event("ft:ready")); }, 200);
        setTimeout(() => setGone(true), 1400);
        try { sessionStorage.setItem("ft-loaded", "1"); } catch {}
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (gone) return null;
  return (
    <div className={`loader ${done ? "done" : ""}`} aria-hidden>
      <span className="count">{String(n).padStart(3, "0")}</span>
      <p>Colón 1156, Luján</p>
    </div>
  );
}

/* ───────── header ───────── */
export function Header({ cfg }) {
  const [state, setState] = useState(null);
  const [clock, setClock] = useState("");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const upd = () => {
      setState(openState(cfg));
      setClock(new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(new Date()));
    };
    upd();
    const t = setInterval(upd, 20000);
    return () => clearInterval(t);
  }, [cfg]);
  const links = [["#estudio", "Estudio"], ["#servicios", "Servicios"], ["#equipo", "Equipo"], ["#visita", "Cómo llegar"]];
  return (
    <>
      <header className="header">
        <a href="#top" className="brand" aria-label="Fortunato, inicio">FOЯTUNATO</a>
        <nav aria-label="Principal">
          {links.map(([h, l]) => <a key={h} href={h} className="link">{l}</a>)}
        </nav>
        <div className="right">
          {state && (
            <span className="status" title={state.label}>
              <i className={`dot ${state.open ? "" : "off"}`} />
              Luján {clock}
            </span>
          )}
          <a href="#reservar" className="cta">Reservar turno</a>
          <button className="menuBtn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            {menu ? "Cerrar" : "Menú"}
          </button>
        </div>
      </header>
      <div className={`mobileMenu ${menu ? "open" : ""}`} onClick={() => setMenu(false)} aria-hidden={!menu}>
        <div>
          {[...links, ["#reservar", "Reservar"]].map(([h, l]) => <a key={h} href={h}>{l}</a>)}
        </div>
        <p className="small">{state?.label}</p>
      </div>
    </>
  );
}

/* ───────── cinta de avisos ───────── */
export function Ticker({ cfg }) {
  const items = cfg.notices.filter((n) => n.highlight);
  if (!items.length) return null;
  const row = [...items, ...items, ...items];
  return (
    <div className="ticker" role="region" aria-label="Avisos" style={{ "--dur": `${Math.max(24, row.length * 6)}s` }}>
      <div className="track">
        {[...row, ...row].map((n, i) => (
          <span className="item" key={i} aria-hidden={i >= row.length}><b>{n.title}</b>{n.text}</span>
        ))}
      </div>
    </div>
  );
}

/* ───────── hero ───────── */
export function Hero({ cfg }) {
  const mark = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => {
      setReady(true);
      const el = mark.current?.firstElementChild;
      if (!el) return;
      el.classList.add("in");
      setTimeout(() => el.classList.add("ready"), 1200);
    };
    if (window.__ftReady) go();
    else window.addEventListener("ft:ready", go);
    return () => window.removeEventListener("ft:ready", go);
  }, []);
  return (
    <section className="hero" id="top">
      <div className="top">
        <div className={`intro ${ready ? "in" : ""}`}>
          <p><Mask>Barbería en el centro de Luján.</Mask><Mask>Cortes, barba y cejas</Mask><Mask>con turno y sin esperas.</Mask></p>
          <div className="actions">
            <a href="#reservar" className="btn">Reservar turno</a>
            <a href="#servicios" className="btn ghost">Ver precios</a>
          </div>
        </div>
        <span className="meta">{cfg.business.coords} — {cfg.business.address}</span>
        <div className={`frame photo ${ready ? "in" : ""}`} data-parallax>
          <img src={cfg.images.hero} alt="Interior de Fortunato Barbería" fetchPriority="high" />
        </div>
      </div>
      <div ref={mark}><Wordmark mode="out" /></div>
    </section>
  );
}

/* ───────── estudio ───────── */
export function Studio({ cfg }) {
  const [first, ...rest] = cfg.about;
  const minPrice = Math.min(...cfg.services.flatMap((s) => Object.values(s.prices)));
  const days = Object.values(cfg.hours).filter(Boolean).length;
  return (
    <section className="section wrap" id="estudio">
      <div className="studio">
        <div className="frame a" data-reveal data-parallax>
          <img src={cfg.images.gallery[1] || cfg.images.hero} alt="Puesto de trabajo en Fortunato" loading="lazy" style={{ objectPosition: "70% 50%" }} />
        </div>
        <div className="text">
          <h2 className="display h3" data-reveal><Mask>Tu estilo,</Mask><Mask>nuestra dedicación</Mask></h2>
          <p className="lead" style={{ marginTop: 32 }}>{first}</p>
          {rest.map((p, i) => <p key={i} className="grey">{p}</p>)}
        </div>
        <dl className="facts">
          <div><dt>Barberos</dt><dd>{cfg.barbers.length}</dd></div>
          <div><dt>Servicios desde</dt><dd>{money(minPrice)}</dd></div>
          <div><dt>Abrimos</dt><dd>{days} días</dd></div>
          <div><dt>Calificación de clientes</dt><dd>5,0 / 5</dd></div>
        </dl>
      </div>
    </section>
  );
}

/* ───────── servicios ───────── */
export function Services({ cfg }) {
  const pick = (serviceId, barberId) => {
    window.dispatchEvent(new CustomEvent("ft:book", { detail: { serviceId, barberId } }));
    scrollToId("reservar");
  };
  return (
    <section className="section wrap" id="servicios">
      <div className="sectionHead">
        <h2 className="display h2" data-reveal><Mask>Servicios</Mask><Mask>y precios</Mask></h2>
        <p className="grey">Cada barbero tiene su propio valor. Tocá un servicio para reservarlo directamente.</p>
      </div>
      <table className="priceTable">
        <thead>
          <tr>
            <th>Servicio</th><th></th><th className="num">Duración</th>
            {cfg.barbers.map((b) => <th key={b.id} className="num">{firstName(b.name)}</th>)}
          </tr>
        </thead>
        <tbody>
          {cfg.services.map((s) => (
            <tr key={s.id} onClick={() => pick(s.id)} tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && pick(s.id)}>
              <td className="name">{s.name}</td>
              <td className="desc">{s.description}</td>
              <td className="num dur" data-label="Duración">{s.duration} min</td>
              {cfg.barbers.map((b) => (
                <td key={b.id} className={`num ${s.prices[b.id] == null ? "na" : ""}`} data-label={firstName(b.name)}>
                  {s.prices[b.id] == null ? "No realiza" : money(s.prices[b.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ───────── equipo ───────── */
export function Team({ cfg }) {
  const book = (barberId) => {
    window.dispatchEvent(new CustomEvent("ft:book", { detail: { barberId } }));
    scrollToId("reservar");
  };
  return (
    <section className="section wrap dark" id="equipo">
      <div className="sectionHead">
        <h2 className="display h2" data-reveal><Mask>Quién</Mask><Mask>te atiende</Mask></h2>
        <p className="grey">Elegís con quién atenderte al reservar. Cada uno arma su agenda y sus precios.</p>
      </div>
      <div className="team">
        {cfg.barbers.map((b) => (
          <article className="barber" key={b.id}>
            <div className="frame portrait" data-reveal>
              {b.photo
                ? <img src={b.photo} alt={b.name} loading="lazy" />
                : <span className="mono" aria-hidden>{b.name.split(" ").map((w) => w[0]).join("")}</span>}
            </div>
            <div className="row">
              <h3 className="display">{b.name}</h3>
              <button className="btn ghost" onClick={() => book(b.id)}>Reservar con {firstName(b.name)}</button>
            </div>
            <p className="grey">{b.role}{b.offWeekdays?.length ? `. No atiende los ${b.offWeekdays.map((d) => DAYS[d].toLowerCase()).join(" y ")}` : ""}</p>
            {b.bio && <p>{b.bio}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

/* ───────── avisos ───────── */
export function Notices({ cfg }) {
  if (!cfg.notices.length) return null;
  return (
    <section className="section wrap" id="avisos">
      <div className="notices">
        <h2 className="display h2" data-reveal><Mask>Avisos</Mask></h2>
        <ul className="noticeList">
          {cfg.notices.map((n) => (
            <li key={n.id}>
              <h3>{n.title}{n.until && <span className="until">Vigente hasta el {longDate(n.until).toLowerCase()}</span>}</h3>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────── visita ───────── */
export function Visit({ cfg }) {
  const [today, setToday] = useState(-1);
  const [state, setState] = useState(null);
  useEffect(() => { setToday(weekday(nowParts().date)); setState(openState(cfg)); }, [cfg]);
  const order = [2, 3, 4, 5, 6, 0, 1];
  const q = encodeURIComponent(cfg.business.mapsQuery);
  return (
    <section className="section wrap" id="visita">
      <div className="visit">
        <div className="info">
          <div>
            <h2 className="display address" data-reveal><Mask>{cfg.business.address}</Mask></h2>
            <p style={{ marginTop: 18 }}>{cfg.business.addressNote}. {cfg.business.city}.</p>
          </div>
          {state && <span className="openNow"><i className={state.open ? "" : "off"} />{state.label}</span>}
          <table className="hours">
            <caption className="sr">Horarios de atención</caption>
            <tbody>
              {order.map((d) => {
                const h = cfg.hours[d];
                return (
                  <tr key={d} className={`${d === today ? "today" : ""} ${h ? "" : "closed"}`}>
                    <td>{DAYS[d]}{d === today ? " (hoy)" : ""}</td>
                    <td>{h ? `${h.open} a ${h.close}` : "Cerrado"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer">Cómo llegar</a>
            <a className="btn ghost" href={wa(cfg, "¡Hola! Tengo una consulta.")} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>
          </div>
        </div>
        <div className="frame map" data-reveal>
          {typeof window !== "undefined" && window.__FT_DEMO__ ? (
            <a className="mapFallback" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer">
              <img src={window.__FT_DEMO__.plan} alt="Plano de ubicación: Colón 1156, frente a la plaza Colón" />
              <span className="btn">Abrir en Google Maps</span>
            </a>
          ) : (
            <iframe title="Mapa de Fortunato Barbería" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${q}&z=16&output=embed`} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────── reseñas ───────── */
export function Reviews({ cfg }) {
  const [i, setI] = useState(0);
  const list = cfg.reviews;
  useEffect(() => {
    if (list.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % list.length), 6000);
    return () => clearTimeout(t);
  }, [i, list.length]);
  if (!list.length) return null;
  return (
    <section className="section wrap dark" aria-label="Opiniones de clientes">
      <div className="quotes">
        {list.map((r, k) => (
          <figure key={k} className={`quote ${k === i ? "on" : ""}`} aria-hidden={k !== i}>
            <blockquote>{r.text}</blockquote>
            <figcaption>{r.name}, {r.service.toLowerCase()}</figcaption>
          </figure>
        ))}
      </div>
      <div className="quoteNav">
        {list.map((r, k) => (
          <button key={`${k}-${i}`} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Opinión de ${r.name}`} />
        ))}
      </div>
    </section>
  );
}

/* ───────── pie ───────── */
export function Footer({ cfg }) {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="cols">
        <div>
          <p className="big">Te esperamos en el centro de Luján</p>
        </div>
        <div>
          <h3>Visitanos</h3>
          <span>{cfg.business.address}</span>
          <span>{cfg.business.city}</span>
          <a href="#visita" className="link" style={{ alignSelf: "start" }}>Ver mapa y horarios</a>
        </div>
        <div>
          <h3>Contacto</h3>
          <a href={wa(cfg, "¡Hola!")} target="_blank" rel="noreferrer" className="link" style={{ alignSelf: "start" }}>WhatsApp</a>
          {cfg.business.instagram && <a href={`https://instagram.com/${cfg.business.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="link" style={{ alignSelf: "start" }}>Instagram</a>}
          <a href="#reservar" className="link" style={{ alignSelf: "start" }}>Reservar turno</a>
        </div>
      </div>
      <Wordmark mode="in" className="in ready" />
      <div className="legal">
        <span>© {year} Fortunato Barbería</span>
        <span>Sitio y sistema de turnos por <a className="link" href="https://picturewebdev.vercel.app" target="_blank" rel="noreferrer">Picture Web Dev</a></span>
        <a href="/admin" className="link">Acceso del local</a>
      </div>
    </footer>
  );
}
