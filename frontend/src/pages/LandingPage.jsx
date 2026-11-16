import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { VERTICAL_LIST } from "../lib/verticals";
import { api } from "../lib/api";

const FEATURES = {
  hotel: [
    "Habitaciones y estados",
    "Reservas sin cruces",
    "Check-in / check-out",
    "Consumo y ventas",
  ],
  farmacia: [
    "Inventario de medicamentos",
    "Lotes y vencimientos",
    "Alertas de reposición",
    "Ventas de mostrador",
  ],
  veterinaria: [
    "Tutores y pacientes",
    "Agenda clínica",
    "Historial por visita",
    "Servicios y productos",
  ],
  tienda: [
    "Ventas rápidas",
    "Control de inventario",
    "Clientes frecuentes",
    "Resumen del día",
  ],
};

export default function LandingPage() {
  const [idea, setIdea] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    businessType: "",
    message: "",
  });
  const [ideaStatus, setIdeaStatus] = useState("idle");
  const [ideaError, setIdeaError] = useState("");

  const updateIdea = (field) => (event) =>
    setIdea((current) => ({ ...current, [field]: event.target.value }));

  const mailtoLink = `mailto:siveptech@gmail.com?subject=${encodeURIComponent(
    "Idea de sistema",
  )}&body=${encodeURIComponent(
    `Hola SIVEP Tech,\n\nMi nombre es ${idea.name}.\n\nMi idea de sistema:\n${idea.message}\n\nNegocio: ${idea.business || ""}\nTeléfono: ${idea.phone || ""}`,
  )}`;

  const submitIdea = async (event) => {
    event.preventDefault();
    setIdeaStatus("sending");
    setIdeaError("");
    try {
      await api("/public/ideas", { method: "POST", body: idea, token: null });
      setIdeaStatus("sent");
    } catch (error) {
      setIdeaStatus("error");
      const detail = Array.isArray(error?.details)
        ? error.details[0]?.message
        : "";
      setIdeaError(
        detail ||
          error?.message ||
          "No pudimos enviar tu idea. Intenta de nuevo o escríbenos directo.",
      );
    }
  };

  const startAnotherIdea = () => {
    setIdea({
      name: "",
      business: "",
      email: "",
      phone: "",
      businessType: "",
      message: "",
    });
    setIdeaError("");
    setIdeaStatus("idle");
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" />
          <span>
            SIVEP <em>Tech</em>
          </span>
        </Link>
        <nav className="landing-links">
          <a href="#verticales">Para tu negocio</a>
          <a href="#arquitectura">Tu información segura</a>
          <a href="#como-funciona">Cómo empezar</a>
          <a href="#ideas">Cuéntanos tu idea</a>
        </nav>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-ghost">
            Iniciar sesión
          </Link>
          <Link to="/registro" className="btn btn-primary">
            Crear empresa
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              Sistemas a la medida · Hechos para tu oficio
            </p>
            <h1>
              Software que echa raíces <em>en tu negocio</em>.
            </h1>
            <p className="hero-lead">
              Una base seria para hoteles, farmacias, veterinarias y tiendas de
              barrio. Cada empresa con su espacio, sus datos y su operación; la
              misma tecnología cuidando el detalle.
            </p>
            <div className="hero-actions">
              <Link to="/registro" className="btn btn-primary btn-lg">
                Empezar ahora
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg">
                Ver una demostración
              </Link>
            </div>
            <div className="hero-trust">
              <div className="trust-item">
                <span className="trust-number">4</span>
                <span className="trust-label">oficios, una base</span>
              </div>
              <div className="trust-rule" />
              <div className="trust-item">
                <span className="trust-number">100%</span>
                <span className="trust-label">datos separados por empresa</span>
              </div>
              <div className="trust-rule" />
              <div className="trust-item">
                <span className="trust-number">24/7</span>
                <span className="trust-label">operación en la nube</span>
              </div>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="art-frame">
              <img
                src="/brand/sivep-tech-01-monograma-brote.svg"
                alt=""
                className="art-main"
              />
              <div className="art-caption">
                <span>SIVEP / TECH</span>
                <span>EST. 2026</span>
              </div>
            </div>
            <div className="art-card">
              <p className="eyebrow">La base</p>
              <p className="art-card-title">Un panel, cuatro oficios.</p>
              <div className="art-tags">
                <span>Hoteles</span>
                <span>Farmacia</span>
                <span>Veterinaria</span>
                <span>Tienda</span>
              </div>
            </div>
            <img
              src="/brand/sivep-tech-04-nodo-red.svg"
              alt=""
              className="art-side"
            />
            <div className="art-seal">
              <Icon name="leaf" size={22} />
              <span>hecho para durar</span>
            </div>
          </div>
        </section>

        <div className="landing-strip">
          <span>Hoteles</span>
          <i>·</i>
          <span>Farmacia</span>
          <i>·</i>
          <span>Veterinaria</span>
          <i>·</i>
          <span>Tienda de barrio</span>
          <i>·</i>
          <span>SIVEP Tech</span>
        </div>

        <section id="verticales" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">01 — Para tu negocio</p>
              <h2>
                Cuatro oficios. Distintas rutinas.
                <br />
                La misma base bien hecha.
              </h2>
            </div>
            <p className="section-aside">
              No forzamos un programa genérico a hacer algo que no le queda.
              Partimos de una base sólida y dejamos activo solo lo que tu
              negocio de verdad usa.
            </p>
          </div>

          <div className="vertical-grid">
            {VERTICAL_LIST.map((vertical, index) => (
              <article className="vertical-card" key={vertical.slug}>
                <div className="vertical-card-top">
                  <img src={vertical.asset} alt="" />
                  <span className="vertical-index">0{index + 1}</span>
                </div>
                <p className="eyebrow">{vertical.eyebrow}</p>
                <h3>{vertical.name}</h3>
                <p className="vertical-description">{vertical.description}</p>
                <ul className="feature-list">
                  {FEATURES[vertical.slug].map((feature) => (
                    <li key={feature}>
                      <Icon name="check" size={14} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to="/login" className="text-link">
                  Entrar a la demo
                  <Icon name="arrowRight" size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="arquitectura" className="section section-architecture">
          <div className="section-head">
            <div>
              <p className="eyebrow">02 — Tranquilidad</p>
              <h2>
                Tu información,
                <br />
                guardada con cuidado.
              </h2>
            </div>
            <p className="section-aside">
              Lo que te identifica como negocio y lo que pasa cada día se
              guardan por separado, a propósito. Así todo se mantiene ordenado,
              rápido y listo para cuando lo necesites.
            </p>
          </div>

          <div className="architecture-grid">
            <div className="architecture-panel">
              <span className="panel-mark">01</span>
              <h3>Tu empresa</h3>
              <p className="panel-label">Lo que te hace único</p>
              <ul>
                <li>El nombre y la imagen de tu negocio</li>
                <li>Las personas de tu equipo y sus permisos</li>
                <li>Tus colores y preferencias</li>
                <li>La información que casi no cambia</li>
              </ul>
            </div>
            <div className="architecture-panel panel-wine">
              <span className="panel-mark">02</span>
              <h3>Tu día a día</h3>
              <p className="panel-label">El pulso de tu operación</p>
              <ul>
                <li>Ventas y movimientos de caja</li>
                <li>Inventario, lotes y precios</li>
                <li>Reservas, agenda y clientes</li>
                <li>Todo lo que pasa hoy, al instante</li>
              </ul>
            </div>
            <div className="architecture-diagram">
              <div className="diagram-label">
                <p className="eyebrow">Cada negocio en su espacio</p>
                <h4>
                  Un mismo sistema.
                  <br />
                  Cada negocio aparte.
                </h4>
                <p>
                  La información de tu negocio está separada de la de los demás.
                  Solo tú y las personas que autorices pueden verla y
                  trabajarla.
                </p>
              </div>
              <div className="tenant-diagram">
                {["Hotel", "Farmacia", "Veterinaria", "Tienda"].map(
                  (name, index) => (
                    <div className="tenant-node" key={name}>
                      <span>0{index + 1}</span>
                      {name}
                    </div>
                  ),
                )}
                <div className="tenant-core">
                  <Icon name="leaf" size={18} />
                  SIVEP
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">03 — Cómo empezar</p>
              <h2>
                De la idea al mostrador,
                <br />
                sin complicarte.
              </h2>
            </div>
            <p className="section-aside">
              Abrimos tu empresa, dejamos cargada una base acorde a tu oficio y
              el panel queda listo para el primer día. Lo demás lo ajustamos
              conversando.
            </p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <h3>Creas tu empresa</h3>
              <p>
                Nombre, oficio y un nombre corto para identificarte. Sin
                instalar nada ni contratar servidores.
              </p>
            </article>
            <article className="step-card">
              <span className="step-number">02</span>
              <h3>Recibes tu base</h3>
              <p>
                Productos, clientes y lo esencial ya cargado, listo para que lo
                ajustes a tu manera.
              </p>
            </article>
            <article className="step-card">
              <span className="step-number">03</span>
              <h3>Operas el día</h3>
              <p>
                Ventas, reservas, agenda e inventario en un panel claro, con
                permisos para cada persona del equipo.
              </p>
            </article>
          </div>
        </section>

        <section id="ideas" className="section section-ideas">
          <div className="section-head">
            <div>
              <p className="eyebrow">04 — Tu idea</p>
              <h2>
                ¿Necesitas un sistema
                <br />
                que aún no existe?
              </h2>
            </div>
            <p className="section-aside">
              Cuéntanos cómo trabajas hoy y qué te gustaría resolver. Leemos
              cada mensaje y te respondemos con una propuesta clara, sin
              compromiso.
            </p>
          </div>

          <div className="idea-grid">
            <div className="idea-copy">
              <p className="eyebrow">Hagámoslo juntos</p>
              <p className="idea-lead">
                No importa si tu negocio es pequeño o si la idea todavía está
                desordenada. Escríbenos y la ordenamos contigo.
              </p>
              <ul className="idea-points">
                <li>
                  <Icon name="check" size={15} />
                  Un sistema pensado para tu oficio
                </li>
                <li>
                  <Icon name="check" size={15} />
                  Te respondemos por correo o teléfono
                </li>
                <li>
                  <Icon name="check" size={15} />
                  Sin costo y sin compromiso
                </li>
              </ul>
              <div className="idea-contact">
                <span>¿Prefieres escribir directo?</span>
                <a href="mailto:siveptech@gmail.com">siveptech@gmail.com</a>
              </div>
            </div>

            {ideaStatus === "sent" ? (
              <div className="idea-form idea-receipt">
                <span className="idea-receipt-mark">
                  <Icon name="check" size={22} />
                </span>
                <h3>¡Recibimos tu idea!</h3>
                <p>
                  Gracias por escribirnos{idea.name ? `, ${idea.name}` : ""}. Te
                  responderemos muy pronto a <strong>{idea.email}</strong>.
                </p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={startAnotherIdea}
                >
                  Enviar otra idea
                </button>
              </div>
            ) : (
              <form className="idea-form" onSubmit={submitIdea}>
                <div className="form-grid">
                  <label className="field">
                    <span className="field-label">
                      Tu nombre<span className="field-required">*</span>
                    </span>
                    <input
                      type="text"
                      value={idea.name}
                      onChange={updateIdea("name")}
                      placeholder="María Gómez"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Tu correo<span className="field-required">*</span>
                    </span>
                    <input
                      type="email"
                      value={idea.email}
                      onChange={updateIdea("email")}
                      placeholder="tucorreo@ejemplo.com"
                      autoComplete="email"
                      required
                      maxLength={160}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Nombre de tu negocio <small>(opcional)</small>
                    </span>
                    <input
                      type="text"
                      value={idea.business}
                      onChange={updateIdea("business")}
                      placeholder="Panadería La Espiga"
                      autoComplete="organization"
                      maxLength={160}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      Teléfono <small>(opcional)</small>
                    </span>
                    <input
                      type="tel"
                      value={idea.phone}
                      onChange={updateIdea("phone")}
                      placeholder="300 123 4567"
                      autoComplete="tel"
                      maxLength={40}
                    />
                  </label>
                  <label className="field field-span-2">
                    <span className="field-label">
                      ¿Qué tipo de negocio tienes?
                    </span>
                    <select
                      value={idea.businessType}
                      onChange={updateIdea("businessType")}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="Hotel">Hotel</option>
                      <option value="Farmacia">Farmacia</option>
                      <option value="Veterinaria">Veterinaria</option>
                      <option value="Tienda de barrio">Tienda de barrio</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </label>
                  <label className="field field-span-2">
                    <span className="field-label">
                      Cuéntanos tu idea<span className="field-required">*</span>
                    </span>
                    <textarea
                      value={idea.message}
                      onChange={updateIdea("message")}
                      placeholder="Ejemplo: llevo el inventario en un cuaderno y quiero saber qué me falta, qué se vence pronto y cuánto vendí en el día."
                      rows={5}
                      required
                      minLength={20}
                      maxLength={2000}
                    />
                    <span className="field-hint">
                      Cuéntanos qué necesitas resolver. No hace falta usar
                      palabras técnicas.
                    </span>
                  </label>
                </div>

                {ideaError && (
                  <p className="idea-alert">
                    {ideaError} <a href={mailtoLink}>Escríbenos directo</a>
                  </p>
                )}

                <div className="idea-actions">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={ideaStatus === "sending"}
                  >
                    {ideaStatus === "sending" ? "Enviando…" : "Enviar mi idea"}
                    {ideaStatus !== "sending" && (
                      <Icon name="arrowRight" size={16} />
                    )}
                  </button>
                  <span>Usamos tus datos solo para responderte.</span>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="cta-band">
          <img
            src="/brand/sivep-tech-01-monograma-brote-vino.svg"
            alt=""
            className="cta-mark"
          />
          <div className="cta-copy">
            <p className="eyebrow eyebrow-light">SIVEP Tech</p>
            <h2>
              Tu operación merece
              <br />
              una base bien hecha.
            </h2>
            <p>
              Crea tu empresa hoy y explora el panel con datos de ejemplo. Sin
              tarjeta, sin letra pequeña.
            </p>
          </div>
          <div className="cta-actions">
            <Link to="/registro" className="btn btn-paper btn-lg">
              Crear mi empresa
              <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/login" className="btn btn-outline-light btn-lg">
              Iniciar sesión
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-brand">
          <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" />
          <div>
            <span className="footer-word">
              SIVEP <em>Tech</em>
            </span>
            <p>Sistemas a la medida. Arauca, Colombia.</p>
          </div>
        </div>
        <div className="footer-columns">
          <div>
            <p className="eyebrow">Tu negocio</p>
            <a href="#verticales">Hoteles</a>
            <a href="#verticales">Farmacia</a>
            <a href="#verticales">Veterinaria</a>
            <a href="#verticales">Tienda de barrio</a>
          </div>
          <div>
            <p className="eyebrow">Sistema</p>
            <Link to="/login">Acceso</Link>
            <Link to="/registro">Crear empresa</Link>
            <a href="#arquitectura">Tu información segura</a>
          </div>
          <div>
            <p className="eyebrow">Contacto</p>
            <a href="#ideas">Cuéntanos tu idea</a>
            <a href="mailto:siveptech@gmail.com">siveptech@gmail.com</a>
            <a href="tel:+576017421180">+57 320 431 7765</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} SIVEP Tech. Todos los derechos
            reservados.
          </span>
          <span>Hecho con cuidado, no con prisa.</span>
        </div>
      </footer>
    </div>
  );
}
