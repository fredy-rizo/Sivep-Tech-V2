import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, VERTICALS } from '../lib/verticals';
import { errorMessage } from '../lib/format';
import Icon from '../components/Icon';
import { InlineError } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const chooseDemo = (demo) => {
    setForm({ tenantSlug: demo.slug, email: demo.email, password: DEMO_PASSWORD });
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({
        tenantSlug: form.tenantSlug.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const activeDemo = DEMO_ACCOUNTS.find((demo) => demo.slug === form.tenantSlug);

  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Link to="/" className="auth-brand">
          <img src="/brand/sivep-tech-01-monograma-brote-vino.svg" alt="" />
          <span>SIVEP Tech</span>
        </Link>
        <div className="auth-quote">
          <p className="eyebrow eyebrow-light">Acceso privado</p>
          <h1>El pulso de tu negocio, en un solo lugar.</h1>
          <p>
            Ventas, inventario, reservas y agenda. Cada empresa entra por su puerta y ve
            únicamente lo suyo.
          </p>
        </div>
        <div className="auth-art-foot">
          <div className="auth-vertical-list">
            {Object.values(VERTICALS).map((vertical) => (
              <span key={vertical.slug}>{vertical.short}</span>
            ))}
          </div>
          <span className="auth-copy">© {new Date().getFullYear()} SIVEP Tech</span>
        </div>
        <img src="/brand/sivep-tech-04-nodo-red.svg" alt="" className="auth-side-art" />
      </aside>

      <main className="auth-main">
        <div className="auth-form-wrap">
          <Link to="/" className="back-link">
            <Icon name="arrowLeft" size={16} />
            Volver al inicio
          </Link>

          <div className="auth-heading">
            <p className="eyebrow">Bienvenido de nuevo</p>
            <h2>Entra a tu empresa</h2>
            <p>Usa el identificador de tu negocio y tus credenciales.</p>
          </div>

          <form onSubmit={submit} className="stack">
            <label className="field">
              <span className="field-label">Empresa</span>
              <div className="input-with-prefix">
                <span>sivep.tech/</span>
                <input
                  type="text"
                  value={form.tenantSlug}
                  onChange={update('tenantSlug')}
                  placeholder="mi-empresa"
                  autoComplete="organization"
                  required
                />
              </div>
              {activeDemo && (
                <span className="field-hint">Entrando a {activeDemo.label}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">Correo</span>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="tu@empresa.com"
                autoComplete="username"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>

            {error && <InlineError error={{ message: errorMessage(error) }} />}

            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar al panel'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </form>

          <div className="demo-box">
            <div className="demo-box-head">
              <span className="eyebrow">Demostración</span>
              <span className="demo-password">Contraseña: {DEMO_PASSWORD}</span>
            </div>
            <p>Elige una empresa con datos de ejemplo para explorar el sistema.</p>
            <div className="demo-grid">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  type="button"
                  key={demo.slug}
                  className={`demo-chip${form.tenantSlug === demo.slug ? ' selected' : ''}`}
                  onClick={() => chooseDemo(demo)}
                >
                  <span className={`demo-dot demo-${demo.vertical}`} />
                  <span>
                    <strong>{demo.label}</strong>
                    <small>{VERTICALS[demo.vertical].short}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="auth-switch">
            ¿Aún no tienes empresa? <Link to="/registro">Crea una aquí</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
