import React, { useEffect, useRef, useState } from "react";
import { NotebookPen, ClipboardCheck, BarChart3, Target, Wallet, ArrowRight, Check, ShieldCheck, Lock, ChevronDown } from "lucide-react";

// Pequeño hook para animaciones de aparición al hacer scroll.
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "in" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

const TICKER_ITEMS = [
  "REGISTRO DE OPERACIONES",
  "CURVA DE CAPITAL",
  "CHECKLIST DE ESTRATEGIA",
  "OBJETIVOS Y HÁBITOS",
  "CONTABILIDAD DE CUENTAS",
  "INFORMES EN TIEMPO REAL",
];

const FEATURES = [
  {
    icon: NotebookPen,
    title: "Journal",
    desc: "Registra cada operación con su contexto: entrada, salida, resultado y notas. Nada se te escapa dos veces.",
  },
  {
    icon: ClipboardCheck,
    title: "Estrategia de trading",
    desc: "Un checklist antes de operar para seguir tu plan y no la impulsividad del momento.",
  },
  {
    icon: BarChart3,
    title: "Informes",
    desc: "Estadísticas y curva de capital para ver tu evolución real, no la que crees que tienes.",
  },
  {
    icon: Target,
    title: "Objetivos",
    desc: "Metas semanales, mensuales o anuales — de trading o personales — con seguimiento de logrados y fallidos.",
  },
  {
    icon: Wallet,
    title: "Contabilidad",
    desc: "Seguimiento de tus cuentas de fondeo y retiros, todo centralizado en un solo sitio.",
  },
];

const PASOS = [
  {
    n: "01",
    title: "Crea tu cuenta",
    desc: "Regístrate en segundos con tu correo. Sin tarjeta, sin compromiso.",
  },
  {
    n: "02",
    title: "Registra cada operación",
    desc: "Anota entradas, salidas, resultado y contexto justo después de operar.",
  },
  {
    n: "03",
    title: "Analiza y ajusta",
    desc: "Usa los informes y la curva de capital para ver qué funciona y corregir lo que no.",
  },
];

const FAQS = [
  {
    q: "¿Necesito tarjeta para crear una cuenta?",
    a: "No. El registro es gratis mientras la plataforma está en fase inicial, sin necesidad de tarjeta ni compromiso de pago.",
  },
  {
    q: "¿Mis datos son privados?",
    a: "Sí. Cada cuenta tiene sus datos aislados a nivel de base de datos (Row Level Security) — nadie más puede ver tus operaciones, cuentas o notas.",
  },
  {
    q: "¿Cuándo empezará a costar 6,99 €/mes?",
    a: "Todavía no hay fecha ni cobro activo. Cuando se active el plan de pago, se avisará con antelación antes de cobrar nada.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. En cuanto exista el plan de pago, podrás cancelarlo cuando quieras, sin permanencia.",
  },
  {
    q: "¿Sirve solo para futuros, o para cualquier instrumento?",
    a: "Está pensado para trading activo en general — tú decides qué instrumentos y estrategias registrar.",
  },
];

// Vista previa estilizada del panel real de la app (sidebar + tarjetas +
// gráfico), sin datos ni cifras concretas — es una ilustración de la
// interfaz, no una captura con resultados reales.
function ProductMockup() {
  const ref = useRef(null);
  function handleMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateX(${py * -3}deg) rotateY(${px * 4}deg)`;
  }
  function handleLeave() {
    if (ref.current) ref.current.style.transform = "rotateX(0) rotateY(0)";
  }
  const navItems = [
    { icon: NotebookPen, label: "Journal", active: true },
    { icon: ClipboardCheck, label: "Estrategia" },
    { icon: BarChart3, label: "Informes" },
    { icon: Target, label: "Objetivos" },
    { icon: Wallet, label: "Contabilidad" },
  ];
  return (
    <div className="landing-mockup-wrap">
      <div className="landing-mockup" ref={ref} onMouseMove={handleMove} onMouseLeave={handleLeave} aria-hidden="true">
        <div className="landing-mockup-chrome">
          <span className="landing-mockup-dot" />
          <span className="landing-mockup-dot" />
          <span className="landing-mockup-dot" />
          <div className="landing-mockup-url">pv-growth-capital-bitacora.netlify.app</div>
        </div>
        <div className="landing-mockup-body">
          <div className="landing-mockup-sidebar">
            {navItems.map((n) => (
              <div className={`landing-mockup-nav-item ${n.active ? "active" : ""}`} key={n.label}>
                <n.icon size={13} /> {n.label}
              </div>
            ))}
          </div>
          <div className="landing-mockup-main">
            <div className="landing-mockup-heading">Resumen</div>
            <div className="landing-mockup-stats">
              <div className="landing-mockup-stat">
                <div className="landing-mockup-stat-label">Operaciones</div>
                <div className="landing-mockup-bar"><div className="landing-mockup-bar-fill" style={{ width: "70%" }} /></div>
              </div>
              <div className="landing-mockup-stat">
                <div className="landing-mockup-stat-label">Racha</div>
                <div className="landing-mockup-bar"><div className="landing-mockup-bar-fill" style={{ width: "45%" }} /></div>
              </div>
              <div className="landing-mockup-stat">
                <div className="landing-mockup-stat-label">Objetivo del mes</div>
                <div className="landing-mockup-bar"><div className="landing-mockup-bar-fill" style={{ width: "85%" }} /></div>
              </div>
            </div>
            <div className="landing-mockup-chart">
              <svg viewBox="0 0 400 70" width="100%" height="100%" preserveAspectRatio="none">
                <polyline
                  points="0,55 30,58 60,45 90,50 120,32 150,38 180,20 210,28 240,14 270,22 300,8 330,15 360,4 400,10"
                  fill="none" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
                />
              </svg>
            </div>
            <div className="landing-mockup-rows">
              {[62, 40, 78, 30].map((w, i) => (
                <div className="landing-mockup-row" key={i}>
                  <div className="landing-mockup-row-bar" style={{ maxWidth: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="landing-faq">
      {FAQS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div className={`landing-faq-item ${open ? "open" : ""}`} key={item.q}>
            <button className="landing-faq-question" onClick={() => setOpenIndex(open ? -1 : i)} aria-expanded={open}>
              {item.q}
              <ChevronDown size={17} className="landing-faq-chevron" />
            </button>
            <div className="landing-faq-answer-wrap">
              <div className="landing-faq-answer-inner">
                <div className="landing-faq-answer">{item.a}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// Barra de progreso de scroll — puro adorno, pero le da vida a la portada
// según el usuario va bajando.
function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const height = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(height > 0 ? Math.min(100, (scrollTop / height) * 100) : 0);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
}

// Genera partículas doradas con posiciones/tiempos aleatorios, una sola vez.
function useParticles(count) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.round(Math.random() * 100),
      size: Math.round(3 + Math.random() * 4),
      duration: Math.round(9 + Math.random() * 8),
      delay: Math.round(Math.random() * 10 * 10) / 10,
      drift: Math.round((Math.random() - 0.5) * 80),
    }))
  );
  return particles;
}

export default function LandingPage({ onGoLogin, onGoSignup, onOpenLegal }) {
  const progress = useScrollProgress();
  const particles = useParticles(18);
  const pricingCardRef = useRef(null);

  function handlePricingMouseMove(e) {
    const el = pricingCardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  function handleFeatureTilt(e) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `translateY(-2px) perspective(600px) rotateX(${py * -6}deg) rotateY(${px * 8}deg)`;
  }
  function resetFeatureTilt(e) {
    e.currentTarget.style.transform = "translateY(0) perspective(600px) rotateX(0) rotateY(0)";
  }

  return (
    <div className="landing-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        .landing-root {
          min-height: 100vh;
          background: #0A0D13;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
          color: #ECEFF3;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .reveal.in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }

        /* ---------- Header ---------- */
        .landing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 32px;
          border-bottom: 1px solid #1B212C;
          position: sticky;
          top: 0;
          background: rgba(10, 13, 19, 0.85);
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .landing-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12.5px;
          letter-spacing: 0.06em;
          color: #8891A1;
        }
        .landing-monogram {
          width: 32px; height: 32px; border-radius: 8px;
          background: linear-gradient(160deg, #1A2028, #12161F);
          border: 1px solid #3A3018;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .landing-header-actions { display: flex; align-items: center; gap: 10px; }
        .landing-btn-ghost {
          background: transparent;
          border: 1px solid #262C39;
          color: #ECEFF3;
          padding: 9px 16px;
          border-radius: 8px;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
        }
        .landing-btn-ghost:hover { border-color: #3A4252; background: #12161F; }
        .landing-btn-gold {
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(180deg, #D8B876, #C6A15A);
          color: #1A1408;
          border: 1px solid #C6A15A;
          padding: 9px 16px;
          border-radius: 8px;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 2px 16px rgba(198,161,90,0.25);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .landing-btn-gold:hover { transform: translateY(-1px); box-shadow: 0 4px 22px rgba(198,161,90,0.35); }
        .landing-btn-gold.large { padding: 13px 24px; font-size: 14.5px; }
        .landing-btn-ghost.large { padding: 13px 24px; font-size: 14.5px; }

        /* ---------- Hero ---------- */
        .landing-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 76px 24px 30px;
          position: relative;
        }
        .landing-hero::before {
          content: "";
          position: absolute;
          top: -120px;
          left: 50%;
          transform: translateX(-50%);
          width: 640px;
          height: 420px;
          background: radial-gradient(ellipse at center, rgba(198,161,90,0.14), transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .landing-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.08em;
          color: #E2C589;
          background: rgba(198,161,90,0.08);
          border: 1px solid rgba(198,161,90,0.35);
          padding: 6px 14px;
          border-radius: 999px;
          margin-bottom: 22px;
          position: relative;
          z-index: 1;
        }
        .landing-badge-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #E2C589;
          box-shadow: 0 0 0 3px rgba(226,197,137,0.2);
        }
        .landing-title {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: clamp(32px, 5vw, 56px);
          line-height: 1.08;
          color: #F2F4F7;
          max-width: 760px;
          margin: 0 0 18px;
          position: relative;
          z-index: 1;
        }
        .landing-title em {
          font-style: italic;
          background: linear-gradient(90deg, #E2C589, #C6A15A);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .landing-subtitle {
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 15.5px;
          color: #8891A1;
          max-width: 480px;
          line-height: 1.55;
          margin-bottom: 30px;
          position: relative;
          z-index: 1;
        }
        .landing-cta-row { display: flex; gap: 12px; margin-bottom: 14px; position: relative; z-index: 1; }
        .landing-cta-note {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          color: #5C6472;
          margin-bottom: 48px;
          position: relative;
          z-index: 1;
        }

        .landing-chart-wrap { width: 100%; max-width: 640px; position: relative; z-index: 1; }
        .landing-chart-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-line 2.2s cubic-bezier(0.65, 0, 0.35, 1) 0.3s forwards;
        }
        .landing-chart-fill { opacity: 0; animation: fade-in 1.4s ease 1.6s forwards; }
        .landing-chart-dot { opacity: 0; animation: pop-in 0.5s ease 2.3s forwards; }
        @keyframes draw-line { to { stroke-dashoffset: 0; } }
        @keyframes fade-in { to { opacity: 1; } }
        @keyframes pop-in {
          0% { opacity: 0; transform: scale(0); }
          70% { opacity: 1; transform: scale(1.4); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-chart-path, .landing-chart-fill, .landing-chart-dot {
            animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important;
          }
        }

        /* ---------- Ticker ---------- */
        .landing-ticker {
          border-top: 1px solid #1B212C;
          border-bottom: 1px solid #1B212C;
          background: #0C1017;
          overflow: hidden;
          padding: 13px 0;
        }
        .landing-ticker-track {
          display: flex;
          width: max-content;
          animation: ticker-scroll 34s linear infinite;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-ticker-track { animation: none; }
        }
        .landing-ticker-item {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.1em;
          color: #5C6472;
          padding: 0 22px;
          display: flex;
          align-items: center;
          gap: 22px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .landing-ticker-item .dot { color: #C6A15A; }

        /* ---------- Secciones genéricas ---------- */
        .landing-section { padding: 72px 24px; max-width: 1080px; margin: 0 auto; width: 100%; box-sizing: border-box; }
        .landing-section-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11.5px;
          letter-spacing: 0.14em;
          color: #8891A1;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 14px;
        }
        .landing-section-title {
          font-family: 'Fraunces', serif;
          font-size: clamp(24px, 3vw, 32px);
          font-weight: 600;
          color: #F2F4F7;
          text-align: center;
          margin-bottom: 48px;
        }

        /* ---------- Cómo funciona ---------- */
        .landing-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .landing-step { position: relative; padding: 4px 4px 4px 0; }
        .landing-step-num {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          font-weight: 600;
          color: #C6A15A;
          border: 1px solid rgba(198,161,90,0.4);
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .landing-step-title { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 15.5px; color: #ECEFF3; margin-bottom: 8px; }
        .landing-step-desc { font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; color: #8891A1; line-height: 1.6; }
        .landing-step-connector {
          position: absolute; top: 18px; left: 100%; width: 28px; height: 1px;
          background: linear-gradient(90deg, rgba(198,161,90,0.4), transparent);
        }

        /* ---------- Features ---------- */
        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          background: #1B212C;
          border: 1px solid #1B212C;
          border-radius: 14px;
          overflow: hidden;
        }
        .landing-feature-card {
          background: #10141C;
          padding: 28px 24px;
          text-align: left;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .landing-feature-card:hover { background: #131923; }
        .landing-feature-icon {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: linear-gradient(160deg, #1A2028, #12161F);
          border: 1px solid #2A3038;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          color: #C6A15A;
        }
        .landing-feature-title { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 14.5px; color: #ECEFF3; margin-bottom: 7px; }
        .landing-feature-desc { font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; color: #8891A1; line-height: 1.55; }

        /* ---------- Pricing ---------- */
        .landing-pricing-wrap { display: flex; justify-content: center; }
        .landing-pricing-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: linear-gradient(180deg, #171D28, #12161F);
          border: 1px solid #3A3018;
          border-radius: 18px;
          padding: 34px 30px 30px;
          box-shadow: 0 30px 80px -30px rgba(198,161,90,0.18);
          box-sizing: border-box;
        }
        .landing-pricing-ribbon {
          position: absolute;
          top: -13px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(180deg, #D8B876, #C6A15A);
          color: #1A1408;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 5px 14px;
          border-radius: 999px;
          box-shadow: 0 4px 14px rgba(198,161,90,0.4);
        }
        .landing-pricing-plan { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.1em; color: #8891A1; text-transform: uppercase; margin-bottom: 10px; text-align: center; }
        .landing-pricing-price-row { display: flex; align-items: baseline; justify-content: center; gap: 6px; margin-bottom: 6px; }
        .landing-pricing-price { font-family: 'Fraunces', serif; font-size: 46px; font-weight: 600; color: #F2F4F7; }
        .landing-pricing-period { font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #8891A1; }
        .landing-pricing-note { text-align: center; font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; color: #E2C589; margin-bottom: 26px; }
        .landing-pricing-list { display: flex; flex-direction: column; gap: 11px; margin-bottom: 28px; }
        .landing-pricing-item { display: flex; align-items: flex-start; gap: 9px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; color: #C9D0DB; }
        .landing-pricing-item svg { flex-shrink: 0; margin-top: 2px; color: #C6A15A; }
        .landing-pricing-fine { text-align: center; font-family: 'IBM Plex Sans', sans-serif; font-size: 11.5px; color: #5C6472; margin-top: 14px; line-height: 1.5; }

        /* ---------- CTA final ---------- */
        .landing-final-cta {
          text-align: center;
          padding: 20px 24px 76px;
        }
        .landing-final-cta-title {
          font-family: 'Fraunces', serif;
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 600;
          color: #F2F4F7;
          margin-bottom: 12px;
        }
        .landing-final-cta-sub {
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 14px;
          color: #8891A1;
          margin-bottom: 26px;
        }
        .landing-trust-row {
          display: flex; align-items: center; justify-content: center; gap: 22px;
          margin-top: 30px; flex-wrap: wrap;
        }
        .landing-trust-item {
          display: flex; align-items: center; gap: 7px;
          font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #5C6472;
        }
        .landing-trust-item svg { color: #4A5262; }

        @media (max-width: 860px) {
          .landing-features-grid { grid-template-columns: repeat(2, 1fr); }
          .landing-steps { grid-template-columns: 1fr; gap: 24px; }
          .landing-step-connector { display: none; }
        }
        @media (max-width: 720px) {
          .landing-features-grid { grid-template-columns: 1fr; }
          .landing-header { padding: 16px 18px; }
          .landing-header-actions .landing-btn-ghost { display: none; }
          .landing-section { padding: 56px 20px; }
        }

        /* ---------- Footer ---------- */
        .landing-footer {
          border-top: 1px solid #1B212C;
          padding: 24px 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 12.5px;
          color: #5C6472;
        }
        .landing-footer-link {
          background: none; border: none; color: #8891A1; cursor: pointer;
          font-size: 12.5px; font-family: inherit; padding: 0;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .landing-footer-link:hover { color: #C6A15A; }

        /* ---------- Movimiento: barra de progreso ---------- */
        .landing-progress-track {
          position: fixed; top: 0; left: 0; right: 0; height: 2px;
          z-index: 20; background: transparent; pointer-events: none;
        }
        .landing-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8891A1, #D8B876, #E2C589);
          transition: width 0.1s linear;
        }

        /* ---------- Movimiento: orbes ambientales ---------- */
        .landing-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
          opacity: 0.5;
          z-index: 0;
        }
        .landing-orb-1 {
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(198,161,90,0.35), transparent 70%);
          top: -60px; left: 8%;
          animation: orb-drift-1 16s ease-in-out infinite;
        }
        .landing-orb-2 {
          width: 260px; height: 260px;
          background: radial-gradient(circle, rgba(226,197,137,0.28), transparent 70%);
          top: 40px; right: 6%;
          animation: orb-drift-2 20s ease-in-out infinite;
        }
        .landing-orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(198,161,90,0.22), transparent 70%);
          bottom: -80px; left: 50%;
          animation: orb-drift-3 22s ease-in-out infinite;
        }
        @keyframes orb-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.15); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-35px, 25px) scale(1.1); }
        }
        @keyframes orb-drift-3 {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50% { transform: translate(-50%, -25px) scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-orb { animation: none; }
        }

        /* ---------- Movimiento: partículas flotantes ---------- */
        .landing-particles {
          position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
        }
        .landing-particle {
          position: absolute;
          bottom: -10px;
          width: var(--size);
          height: var(--size);
          border-radius: 50%;
          background: radial-gradient(circle, #E2C589, rgba(198,161,90,0));
          opacity: 0;
          animation: particle-rise var(--duration) ease-in var(--delay) infinite;
        }
        @keyframes particle-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.8; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-380px) translateX(var(--drift)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-particle { animation: none; display: none; }
        }

        /* ---------- Movimiento: texto con brillo ---------- */
        .landing-title em {
          background-size: 200% auto;
          animation: shimmer 5s linear infinite;
        }
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-title em { animation: none; }
        }

        /* ---------- Movimiento: foco que sigue el cursor en el precio ---------- */
        .landing-pricing-card { position: relative; overflow: hidden; }
        .landing-pricing-spotlight {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(280px circle at var(--mx, 50%) var(--my, 0%), rgba(198,161,90,0.16), transparent 70%);
          opacity: 0; transition: opacity 0.25s ease;
        }
        .landing-pricing-card:hover .landing-pricing-spotlight { opacity: 1; }
        .landing-pricing-card > *:not(.landing-pricing-spotlight) { position: relative; z-index: 1; }

        /* ---------- Movimiento: tarjetas de features con leve inclinación 3D ---------- */
        .landing-feature-card {
          transform-style: preserve-3d;
          transition: transform 0.15s ease-out, background 0.2s ease;
        }

        /* ---------- Navegación con anclas ---------- */
        html { scroll-behavior: smooth; }
        .landing-root section[id] { scroll-margin-top: 84px; }
        .landing-nav-links { display: flex; align-items: center; gap: 26px; }
        .landing-nav-links a {
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #8891A1;
          text-decoration: none; position: relative; padding: 4px 0;
        }
        .landing-nav-links a::after {
          content: ""; position: absolute; left: 0; right: 100%; bottom: -2px; height: 1px;
          background: #C6A15A; transition: right 0.2s ease;
        }
        .landing-nav-links a:hover { color: #ECEFF3; }
        .landing-nav-links a:hover::after { right: 0; }
        @media (max-width: 900px) {
          .landing-nav-links { display: none; }
        }

        /* ---------- Vista previa del producto (mockup) ---------- */
        .landing-mockup-wrap { display: flex; justify-content: center; perspective: 1400px; }
        .landing-mockup {
          width: 100%; max-width: 860px;
          background: #10141C;
          border: 1px solid #262C39;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 40px 90px -30px rgba(0,0,0,0.8);
          transition: transform 0.2s ease-out;
        }
        .landing-mockup-chrome {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px; background: #161B24; border-bottom: 1px solid #232A36;
        }
        .landing-mockup-dot { width: 9px; height: 9px; border-radius: 50%; background: #333B48; }
        .landing-mockup-url {
          margin-left: 8px; flex: 1; max-width: 320px;
          background: #10141C; border: 1px solid #232A36; border-radius: 6px;
          padding: 4px 10px; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #5C6472;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .landing-mockup-body { display: flex; min-height: 320px; }
        .landing-mockup-sidebar {
          width: 168px; flex-shrink: 0; background: #12161F; border-right: 1px solid #232A36;
          padding: 14px 10px; display: flex; flex-direction: column; gap: 3px;
        }
        .landing-mockup-nav-item {
          display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #6E7889;
        }
        .landing-mockup-nav-item.active { background: #1D2733; color: #C9A23F; }
        .landing-mockup-main { flex: 1; padding: 20px 22px; min-width: 0; }
        .landing-mockup-heading {
          font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.08em;
          color: #5C6472; text-transform: uppercase; margin-bottom: 14px;
        }
        .landing-mockup-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .landing-mockup-stat {
          background: #171D28; border: 1px solid #232A36; border-radius: 9px; padding: 12px;
        }
        .landing-mockup-stat-label { font-family: 'IBM Plex Sans', sans-serif; font-size: 10px; color: #5C6472; margin-bottom: 8px; }
        .landing-mockup-bar { height: 6px; border-radius: 999px; background: #232A36; overflow: hidden; }
        .landing-mockup-bar-fill { height: 100%; background: linear-gradient(90deg, #8891A1, #C6A15A); border-radius: 999px; }
        .landing-mockup-chart { height: 90px; border-radius: 9px; background: #171D28; border: 1px solid #232A36; margin-bottom: 16px; padding: 10px; }
        .landing-mockup-rows { display: flex; flex-direction: column; gap: 7px; }
        .landing-mockup-row { display: flex; align-items: center; gap: 10px; }
        .landing-mockup-row-bar { height: 8px; border-radius: 999px; background: #1E2530; flex: 1; }
        @media (max-width: 640px) {
          .landing-mockup-sidebar { display: none; }
          .landing-mockup-stats { grid-template-columns: 1fr; }
        }

        /* ---------- FAQ ---------- */
        .landing-faq { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .landing-faq-item { border: 1px solid #1B212C; border-radius: 12px; background: #10141C; overflow: hidden; }
        .landing-faq-question {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: none; border: none; cursor: pointer; padding: 16px 18px;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; font-weight: 500; color: #ECEFF3; text-align: left;
        }
        .landing-faq-chevron { color: #C6A15A; flex-shrink: 0; transition: transform 0.25s ease; }
        .landing-faq-item.open .landing-faq-chevron { transform: rotate(180deg); }
        .landing-faq-answer-wrap {
          display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.28s ease;
        }
        .landing-faq-item.open .landing-faq-answer-wrap { grid-template-rows: 1fr; }
        .landing-faq-answer-inner { overflow: hidden; }
        .landing-faq-answer {
          padding: 0 18px 16px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; color: #8891A1; line-height: 1.6;
        }
      `}</style>

      <div className="landing-progress-track">
        <div className="landing-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <header className="landing-header">
        <div className="landing-brand">
          <span className="landing-monogram" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 18V9" stroke="#C6A15A" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 9L4 7M6 9L8 7" stroke="#C6A15A" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M18 15V6" stroke="#E2C589" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 15L16 17M18 15L20 17" stroke="#E2C589" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          PV GROWTH CAPITAL — BITÁCORA
        </div>
        <nav className="landing-nav-links">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#vista-previa">Vista previa</a>
          <a href="#precio">Precio</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-header-actions">
          <button className="landing-btn-ghost" onClick={onGoLogin}>Iniciar sesión</button>
          <button className="landing-btn-gold" onClick={onGoSignup}>Crear cuenta</button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-particles" aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.id}
              className="landing-particle"
              style={{
                left: `${p.left}%`,
                "--size": `${p.size}px`,
                "--duration": `${p.duration}s`,
                "--delay": `${p.delay}s`,
                "--drift": `${p.drift}px`,
              }}
            />
          ))}
        </div>
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          GRATIS DURANTE LA FASE INICIAL
        </div>
        <h1 className="landing-title">
          Registra cada operación.<br />Confía en los <em>datos</em>, no en la emoción.
        </h1>
        <p className="landing-subtitle">
          Un espacio privado para llevar el diario de tus operaciones, medir tu progreso
          real y ver con claridad qué está funcionando y qué no.
        </p>
        <div className="landing-cta-row">
          <button className="landing-btn-gold large" onClick={onGoSignup}>
            Crear cuenta gratis <ArrowRight size={15} />
          </button>
          <button className="landing-btn-ghost large" onClick={onGoLogin}>
            Ya tengo cuenta
          </button>
        </div>
        <div className="landing-cta-note">Sin tarjeta · Acceso inmediato</div>

        <div className="landing-chart-wrap" aria-hidden="true">
          <svg viewBox="0 0 640 200" width="100%" height="auto">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8891A1" />
                <stop offset="55%" stopColor="#D8B876" />
                <stop offset="100%" stopColor="#E2C589" />
              </linearGradient>
              <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C6A15A" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#C6A15A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="landing-chart-fill"
              d="M0,150 L40,158 L80,140 L120,150 L160,120 L200,132 L240,98 L280,110 L320,78 L360,90 L400,58 L440,70 L480,44 L520,54 L560,26 L600,34 L620,20 L640,26 L640,200 L0,200 Z"
              fill="url(#fillGrad)"
            />
            <path
              className="landing-chart-path"
              d="M0,150 L40,158 L80,140 L120,150 L160,120 L200,132 L240,98 L280,110 L320,78 L360,90 L400,58 L440,70 L480,44 L520,54 L560,26 L600,34 L620,20 L640,26"
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="landing-chart-dot" cx="640" cy="26" r="5" fill="#E2C589" />
          </svg>
        </div>
      </section>

      <div className="landing-ticker" aria-hidden="true">
        <div className="landing-ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div className="landing-ticker-item" key={i}>
              <span className="dot">◆</span> {item}
            </div>
          ))}
        </div>
      </div>

      <section className="landing-section" id="como-funciona">
        <Reveal>
          <div className="landing-section-eyebrow">Cómo funciona</div>
          <div className="landing-section-title">De la operación al dato, sin fricción</div>
        </Reveal>
        <div className="landing-steps">
          {PASOS.map((p, i) => (
            <Reveal key={p.n} delay={i * 100}>
              <div className="landing-step">
                <div className="landing-step-num">{p.n}</div>
                <div className="landing-step-title">{p.title}</div>
                <div className="landing-step-desc">{p.desc}</div>
                {i < PASOS.length - 1 && <div className="landing-step-connector" />}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="vista-previa" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="landing-section-eyebrow">Así se ve por dentro</div>
          <div className="landing-section-title">Tu bitácora, ordenada de verdad</div>
        </Reveal>
        <Reveal>
          <ProductMockup />
        </Reveal>
      </section>

      <section className="landing-section" style={{ paddingTop: 0 }} id="features">
        <Reveal>
          <div className="landing-section-eyebrow">Lo que incluye tu bitácora</div>
          <div className="landing-section-title">Todo lo necesario, nada de más</div>
        </Reveal>
        <Reveal>
          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div
                className="landing-feature-card"
                key={f.title}
                onMouseMove={handleFeatureTilt}
                onMouseLeave={resetFeatureTilt}
              >
                <div className="landing-feature-icon"><f.icon size={18} /></div>
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="landing-section" id="precio" style={{ position: "relative" }}>
        <div className="landing-orb landing-orb-3" />
        <Reveal>
          <div className="landing-section-eyebrow">Precio</div>
          <div className="landing-section-title">Un único plan, sin letra pequeña</div>
        </Reveal>
        <Reveal className="landing-pricing-wrap">
          <div className="landing-pricing-card" ref={pricingCardRef} onMouseMove={handlePricingMouseMove}>
            <div className="landing-pricing-spotlight" />
            <div className="landing-pricing-ribbon">PRÓXIMAMENTE</div>
            <div className="landing-pricing-plan">Acceso completo</div>
            <div className="landing-pricing-price-row">
              <span className="landing-pricing-price">6,99 €</span>
              <span className="landing-pricing-period">/ mes</span>
            </div>
            <div className="landing-pricing-note">Ahora mismo, gratis durante la fase inicial</div>

            <div className="landing-pricing-list">
              <div className="landing-pricing-item"><Check size={15} /> Journal de operaciones ilimitado</div>
              <div className="landing-pricing-item"><Check size={15} /> Estrategia y checklist de trading</div>
              <div className="landing-pricing-item"><Check size={15} /> Informes y curva de capital</div>
              <div className="landing-pricing-item"><Check size={15} /> Objetivos y seguimiento de resultados</div>
              <div className="landing-pricing-item"><Check size={15} /> Contabilidad de cuentas y retiros</div>
            </div>

            <button className="landing-btn-gold large" style={{ width: "100%", justifyContent: "center" }} onClick={onGoSignup}>
              Crear cuenta gratis <ArrowRight size={15} />
            </button>
            <div className="landing-pricing-fine">
              Sin necesidad de tarjeta. Todavía no hay cobro activo — te avisaremos
              con tiempo antes de activar el plan de pago.
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-section" id="faq" style={{ paddingTop: 0 }}>
        <Reveal>
          <div className="landing-section-eyebrow">Preguntas frecuentes</div>
          <div className="landing-section-title">Antes de que preguntes</div>
        </Reveal>
        <Reveal>
          <FaqAccordion />
        </Reveal>
      </section>

      <section className="landing-final-cta">
        <Reveal>
          <div className="landing-final-cta-title">Empieza tu bitácora hoy</div>
          <div className="landing-final-cta-sub">Gratis mientras la plataforma está en fase inicial.</div>
          <button className="landing-btn-gold large" onClick={onGoSignup}>
            Crear cuenta <ArrowRight size={15} />
          </button>
          <div className="landing-trust-row">
            <div className="landing-trust-item"><Lock size={13} /> Datos privados por usuario</div>
            <div className="landing-trust-item"><ShieldCheck size={13} /> Cumplimiento RGPD</div>
          </div>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} René Crespo Campos</span>
        <button className="landing-footer-link" onClick={() => onOpenLegal("aviso")}>Aviso legal</button>
        <button className="landing-footer-link" onClick={() => onOpenLegal("privacidad")}>Política de privacidad</button>
        <button className="landing-footer-link" onClick={() => onOpenLegal("cookies")}>Política de cookies</button>
      </footer>
    </div>
  );
}
