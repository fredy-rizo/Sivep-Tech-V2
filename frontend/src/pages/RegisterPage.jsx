import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { VERTICAL_LIST } from '../lib/verticals';
import { errorMessage, slugify } from '../lib/format';
import Icon from '../components/Icon';
import { Field, InlineError } from '../components/ui';

const INITIAL = {
  businessName: '',
  slug: '',
  vertical: 'hotel',
  ownerName: '',
  email: '',
  password: '',
  phone: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'businessName' && !slugEdited) next.slug = slugify(value);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({
        ...form,
        businessName: form.businessName.trim(),
        slug: form.slug.trim().toLowerCase(),
        ownerName: form.ownerName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <header className="register-top">
        <Link to="/" className="landing-brand">
          <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" />
          <span>
            SIVEP <em>Tech</em>
          </span>
        </Link>
        <Link to="/login" className="text-link">
          Ya tengo cuenta
          <Icon name="arrowRight" size={15} />
        </Link>
      </header>

      <main className="register-main">
        <aside className="register-aside">
          <p className="eyebrow">Nueva empresa</p>
          <h1>Un sistema que empieza contigo.</h1>
          <p>
            En pocos minutos tendrás tu espacio con productos, clientes y módulos iniciales
            según el oficio de tu negocio.
          </p>
          <div className="register-points">
            <div>
              <span>01</span>
              <p>
                <strong>Tu identificador.</strong> La puerta de tu empresa dentro de SIVEP.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Tu vertical.</strong> Los módulos justos para tu operación.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Tu cuenta.</strong> Tú quedas como propietario y puedes sumar equipo.
              </p>
            </div>
          </div>
          <img src="/brand/sivep-tech-02-surco-datos.svg" alt="" className="register-art" />
          <p className="register-note">
            Al crear la empresa aceptas operar con datos de demostración que puedes editar o
            eliminar en cualquier momento.
          </p>
        </aside>

        <form className="register-form" onSubmit={submit}>
          <div className="register-form-head">
            <p className="eyebrow">Paso único</p>
            <h2>Datos de la empresa</h2>
          </div>

          <div className="vertical-choice">
            {VERTICAL_LIST.map((vertical) => (
              <button
                type="button"
                key={vertical.slug}
                className={`vertical-choice-item${form.vertical === vertical.slug ? ' selected' : ''}`}
                onClick={() => setForm((current) => ({ ...current, vertical: vertical.slug }))}
              >
                <img src={vertical.asset} alt="" />
                <span>
                  <strong>{vertical.short}</strong>
                  <small>{vertical.eyebrow}</small>
                </span>
                {form.vertical === vertical.slug && (
                  <span className="choice-check">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <Field label="Nombre del negocio" span={2} required>
              <input
                value={form.businessName}
                onChange={update('businessName')}
                placeholder="Hotel Casa Bruma"
                required
              />
            </Field>

            <Field
              label="Identificador"
              span={2}
              required
              hint="Será la puerta de acceso: minúsculas, números y guiones."
            >
              <div className="input-with-prefix">
                <span>sivep.tech/</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setForm((current) => ({ ...current, slug: slugify(event.target.value) }));
                  }}
                  placeholder="mi-empresa"
                  required
                />
              </div>
            </Field>

            <Field label="Tu nombre" required>
              <input
                value={form.ownerName}
                onChange={update('ownerName')}
                placeholder="Camila Ríos"
                autoComplete="name"
                required
              />
            </Field>

            <Field label="Teléfono" hint="Opcional">
              <input
                value={form.phone}
                onChange={update('phone')}
                placeholder="+57 300 000 0000"
                autoComplete="tel"
              />
            </Field>

            <Field label="Correo del propietario" span={2} required>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="tu@empresa.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Contraseña" span={2} required hint="Mínimo 8 caracteres.">
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          </div>

          {error && <InlineError error={{ message: errorMessage(error) }} />}

          <div className="register-submit">
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Creando empresa…' : 'Crear mi empresa'}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
            <span>Podrás invitar a tu equipo después.</span>
          </div>
        </form>
      </main>
    </div>
  );
}
