import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { date, errorMessage } from '../lib/format';
import { VERTICALS } from '../lib/verticals';
import Icon from '../components/Icon';
import {
  Field,
  InlineError,
  Notice,
  PageHeader,
  StatusPill,
} from '../components/ui';

export default function SettingsPage() {
  const { tenant, user, isAdmin, updateTenant, updateUser, logout } = useAuth();
  const vertical = VERTICALS[tenant.vertical];
  const [form, setForm] = useState({
    name: tenant.name ?? '',
    tagline: tenant.branding?.tagline ?? '',
    primary: tenant.branding?.primary ?? '#8B1E3F',
    accent: tenant.branding?.accent ?? '#5B8C4E',
    email: tenant.contact?.email ?? '',
    phone: tenant.contact?.phone ?? '',
    address: tenant.contact?.address ?? '',
    city: tenant.contact?.city ?? '',
    currency: tenant.settings?.currency ?? 'COP',
    locale: tenant.settings?.locale ?? 'es-CO',
    timezone: tenant.settings?.timezone ?? 'America/Bogota',
    taxRate: String(Math.round((tenant.settings?.taxRate ?? 0) * 100)),
    receiptPrefix: tenant.settings?.receiptPrefix ?? '',
    thankYouNote: tenant.settings?.thankYouNote ?? '',
  });
  const [profileName, setProfileName] = useState(user.name);
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordOk, setPasswordOk] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const saveMutation = useMutation({
    mutationFn: (payload) => api('/tenant', { method: 'PATCH', body: payload }),
    onSuccess: (response) => {
      updateTenant(response.data.tenant);
      setSaved(true);
      setSaveError(null);
      window.setTimeout(() => setSaved(false), 4000);
    },
    onError: (err) => setSaveError(err),
  });

  const profileMutation = useMutation({
    mutationFn: (payload) => api('/auth/profile', { method: 'PATCH', body: payload }),
    onSuccess: (response) => {
      updateUser(response.data.user);
      setProfileError(null);
    },
    onError: (err) => setProfileError(err),
  });

  const passwordMutation = useMutation({
    mutationFn: (payload) => api('/auth/change-password', { method: 'POST', body: payload }),
    onSuccess: () => {
      setPasswordOk(true);
      setPasswordError(null);
      setPassword({ currentPassword: '', newPassword: '' });
      window.setTimeout(() => setPasswordOk(false), 5000);
    },
    onError: (err) => setPasswordError(err),
  });

  const submit = (event) => {
    event.preventDefault();
    setSaved(false);
    saveMutation.mutate({
      name: form.name.trim(),
      branding: {
        tagline: form.tagline.trim() || null,
        primary: form.primary,
        accent: form.accent,
      },
      contact: {
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
      },
      settings: {
        currency: form.currency.trim().toUpperCase(),
        locale: form.locale.trim(),
        timezone: form.timezone.trim(),
        taxRate: Number(form.taxRate || 0) / 100,
        receiptPrefix: form.receiptPrefix.trim() || null,
        thankYouNote: form.thankYouNote.trim() || null,
      },
    });
  };

  const saveProfile = (event) => {
    event.preventDefault();
    profileMutation.mutate({ name: profileName.trim() });
  };

  const changePassword = (event) => {
    event.preventDefault();
    passwordMutation.mutate(password);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sistema"
        title="Ajustes"
        description="La identidad de la empresa, sus datos de contacto y las reglas de operación."
      />

      <div className="settings-grid">
        <form className="panel settings-form" onSubmit={submit}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Empresa</p>
              <h2>Identidad y operación</h2>
            </div>
          </div>

          {!isAdmin && (
            <Notice tone="green" title="Solo lectura">
              Tu rol puede consultar la configuración, pero solo propietarios y administradores
              pueden cambiarla.
            </Notice>
          )}
          {saved && <Notice title="Cambios guardados">La configuración de la empresa quedó actualizada.</Notice>}
          {saveError && <InlineError error={{ message: errorMessage(saveError) }} />}

          <fieldset className="form-section" disabled={!isAdmin}>
            <legend>Identidad</legend>
            <div className="form-grid">
              <Field label="Nombre del negocio" span={2}>
                <input value={form.name} onChange={update('name')} />
              </Field>
              <Field label="Frase corta" span={2} hint="Aparece como presentación de la empresa.">
                <input value={form.tagline} onChange={update('tagline')} placeholder="Hospedaje con memoria…" />
              </Field>
              <Field label="Color principal">
                <div className="color-field">
                  <input type="color" value={form.primary} onChange={update('primary')} />
                  <input value={form.primary} onChange={update('primary')} maxLength={7} />
                </div>
              </Field>
              <Field label="Color de acento">
                <div className="color-field">
                  <input type="color" value={form.accent} onChange={update('accent')} />
                  <input value={form.accent} onChange={update('accent')} maxLength={7} />
                </div>
              </Field>
            </div>
          </fieldset>

          <fieldset className="form-section" disabled={!isAdmin}>
            <legend>Contacto</legend>
            <div className="form-grid">
              <Field label="Correo de la empresa">
                <input type="email" value={form.email} onChange={update('email')} />
              </Field>
              <Field label="Teléfono">
                <input value={form.phone} onChange={update('phone')} />
              </Field>
              <Field label="Dirección">
                <input value={form.address} onChange={update('address')} />
              </Field>
              <Field label="Ciudad">
                <input value={form.city} onChange={update('city')} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="form-section" disabled={!isAdmin}>
            <legend>Operación</legend>
            <div className="form-grid">
              <Field label="Moneda" hint="Código ISO de 3 letras.">
                <input value={form.currency} onChange={update('currency')} maxLength={3} />
              </Field>
              <Field label="Impuesto (%)" hint="Se aplica a las ventas.">
                <input type="number" min="0" max="50" step="0.01" value={form.taxRate} onChange={update('taxRate')} />
              </Field>
              <Field label="Zona horaria">
                <input value={form.timezone} onChange={update('timezone')} />
              </Field>
              <Field label="Prefijo de comprobante">
                <input value={form.receiptPrefix} onChange={update('receiptPrefix')} maxLength={6} placeholder="H" />
              </Field>
              <Field label="Mensaje de agradecimiento" span={2}>
                <input value={form.thankYouNote} onChange={update('thankYouNote')} placeholder="Gracias por preferirnos." />
              </Field>
            </div>
          </fieldset>

          {isAdmin && (
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          )}
        </form>

        <aside className="settings-side">
          <section className="panel tenant-summary">
            <div className="tenant-summary-head">
              <img src={vertical.asset} alt="" />
              <div>
                <p className="eyebrow">{vertical.eyebrow}</p>
                <h3>{tenant.name}</h3>
              </div>
            </div>
            <div className="summary-rows">
              <div><span>Identificador</span><strong className="mono">{tenant.slug}</strong></div>
              <div><span>Vertical</span><strong>{vertical.short}</strong></div>
              <div><span>Plan</span><strong>{tenant.plan}</strong></div>
              <div><span>Estado</span><StatusPill status={tenant.status === 'active' ? 'active' : 'inactive'} /></div>
              <div><span>Alta</span><strong>{date(tenant.createdAt)}</strong></div>
            </div>
            <p className="tenant-note">
              El identificador y el vertical definen la puerta y los módulos de la empresa. Para
              cambiarlos, contacta a soporte.
            </p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tu cuenta</p>
                <h2>Perfil y seguridad</h2>
              </div>
            </div>

            <form className="stack" onSubmit={saveProfile}>
              <Field label="Nombre">
                <input value={profileName} onChange={(event) => setProfileName(event.target.value)} required />
              </Field>
              <Field label="Correo">
                <input value={user.email} disabled />
              </Field>
              {profileError && <InlineError error={{ message: errorMessage(profileError) }} />}
              <button type="submit" className="btn btn-outline" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Guardando…' : 'Actualizar perfil'}
              </button>
            </form>

            <hr className="rule" />

            <form className="stack" onSubmit={changePassword}>
              <p className="eyebrow">Contraseña</p>
              <Field label="Contraseña actual">
                <input
                  type="password"
                  value={password.currentPassword}
                  onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
                <input
                  type="password"
                  value={password.newPassword}
                  onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </Field>
              {passwordError && <InlineError error={{ message: errorMessage(passwordError) }} />}
              {passwordOk && <Notice title="Contraseña actualizada">La próxima vez usa la nueva clave.</Notice>}
              <div className="stack-row">
                <button type="submit" className="btn btn-outline" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
                </button>
                <button type="button" className="text-button" onClick={logout}>
                  <Icon name="logout" size={15} /> Cerrar sesión
                </button>
              </div>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
