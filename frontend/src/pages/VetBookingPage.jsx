import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { dateTime, errorMessage, money } from '../lib/format';
import Icon from '../components/Icon';
import {
  EmptyState,
  Field,
  InlineError,
  Modal,
  PageHeader,
  Skeleton,
  StatusPill,
} from '../components/ui';

function serviceFormFrom(services) {
  if (!services?.length) return [];
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    duration: String(service.duration ?? 30),
    price: String(service.price ?? 0),
  }));
}

function blankService() {
  return { id: '', name: '', duration: '30', price: '0' };
}

function CopyButton({ value, label = 'Copiar enlace' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyText(value);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" className="btn btn-outline" onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? 'Copiado' : label}
    </button>
  );
}

export default function VetBookingPage() {
  const { tenant, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [form, setForm] = useState({
    enabled: true,
    openTime: '08:00',
    closeTime: '18:00',
    slotMinutes: '30',
    daysAhead: '30',
    intro: '',
    services: [],
  });

  const settingsQuery = useQuery({
    queryKey: ['vet-booking-settings'],
    queryFn: () => api('/vet/booking-settings').then((response) => response.data),
    enabled: tenant.vertical === 'veterinaria' && isAdmin,
  });

  const onlineQuery = useQuery({
    queryKey: ['vet-appointments', 'public'],
    queryFn: () =>
      api('/vet/appointments?source=public').then((response) => response.data),
    enabled: tenant.vertical === 'veterinaria',
  });

  const booking = settingsQuery.data?.booking;

  useEffect(() => {
    if (!booking) return;
    setForm({
      enabled: booking.enabled,
      openTime: booking.openTime,
      closeTime: booking.closeTime,
      slotMinutes: String(booking.slotMinutes),
      daysAhead: String(booking.daysAhead),
      intro: booking.intro ?? '',
      services: serviceFormFrom(booking.services),
    });
  }, [booking]);

  if (tenant.vertical !== 'veterinaria') return <Navigate to="/app" replace />;
  if (!isAdmin) return <Navigate to="/app/agenda" replace />;

  const link = booking?.token
    ? `${window.location.origin}/reservar/${booking.token}`
    : '';

  const appointments = onlineQuery.data ?? [];
  const pending = appointments.filter((item) => item.status === 'scheduled').length;
  const confirmed = appointments.filter((item) => item.status === 'confirmed').length;
  const upcoming = useMemo(
    () =>
      appointments
        .filter((item) => !['cancelled', 'completed', 'no_show'].includes(item.status))
        .slice(0, 30),
    [appointments],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vet-booking-settings'] });
    queryClient.invalidateQueries({ queryKey: ['vet-appointments'] });
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const toggleMutation = useMutation({
    mutationFn: (enabled) =>
      api('/vet/booking-settings', { method: 'PATCH', body: { enabled } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api(`/vet/appointments/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      api('/vet/booking-settings', { method: 'PATCH', body: payload }),
    onSuccess: () => {
      setSettingsOpen(false);
      setSettingsError(null);
      invalidate();
    },
    onError: (err) => setSettingsError(err),
  });

  const updateForm = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const updateService = (index, key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      services: current.services.map((service, position) =>
        position === index ? { ...service, [key]: value } : service,
      ),
    }));
  };

  const addService = () => {
    setForm((current) => ({ ...current, services: [...current.services, blankService()] }));
  };

  const removeService = (index) => {
    setForm((current) => ({
      ...current,
      services: current.services.filter((_, position) => position !== index),
    }));
  };

  const submitSettings = (event) => {
    event.preventDefault();
    if (!form.services.length || form.services.some((service) => !service.name.trim())) {
      setSettingsError({ message: 'Agrega al menos un servicio con nombre' });
      return;
    }
    saveMutation.mutate({
      enabled: form.enabled,
      openTime: form.openTime,
      closeTime: form.closeTime,
      slotMinutes: Number(form.slotMinutes),
      daysAhead: Number(form.daysAhead),
      intro: form.intro.trim() || null,
      services: form.services.map((service) => ({
        id: service.id || undefined,
        name: service.name.trim(),
        duration: Number(service.duration) || 30,
        price: Number(service.price) || 0,
      })),
    });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Veterinaria · Reservas en línea"
        title="Reservas"
        description="Comparte tu enlace y deja que los tutores agenden vacunas, baños y consultas sin llamar."
        actions={
          isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" size={17} />
              Configurar agenda
            </button>
          )
        }
      />

      {error && <InlineError error={{ message: errorMessage(error) }} />}

      {settingsQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : settingsQuery.isError ? (
        <InlineError error={{ message: errorMessage(settingsQuery.error) }} />
      ) : (
        <>
          <section className="booking-admin-card">
            <div className="booking-admin-copy">
              <div className="booking-admin-head">
                <span className={`pill ${booking?.enabled ? 'pill-green' : 'pill-neutral'}`}>
                  <span className="pill-dot" />
                  {booking?.enabled ? 'Recibiendo reservas' : 'Reservas pausadas'}
                </span>
                {booking?.enabled && pending > 0 && (
                  <span className="pill pill-amber">
                    <span className="pill-dot" />
                    {pending} por confirmar
                  </span>
                )}
              </div>
              <h2>Tu enlace público de reservas</h2>
              <p className="muted">
                Este enlace es único para {tenant.name}. Pégalo en Instagram, WhatsApp, Google o
                tu página web; cada reserva llega directo a tu agenda con los datos del tutor.
              </p>
              <div className="booking-link-box">
                <Icon name="link" size={17} />
                <input readOnly value={link} onFocus={(event) => event.target.select()} />
                <CopyButton value={link} />
                <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer">
                  <Icon name="external" size={16} />
                  Abrir
                </a>
              </div>
              <div className="booking-link-actions">
                <a
                  className="btn btn-outline btn-sm"
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Agenda tu cita en ${tenant.name}: ${link}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="share" size={15} />
                  Compartir por WhatsApp
                </a>
                <a
                  className="btn btn-outline btn-sm"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="external" size={15} />
                  Facebook
                </a>
              </div>
              {!booking?.enabled && (
                <p className="booking-admin-warning">
                  El enlace está pausado: los tutores verán que la agenda está cerrada.
                </p>
              )}
            </div>

            <div className="booking-admin-side">
              <div className="booking-admin-stat">
                <span>Reservas en línea</span>
                <strong>{appointments.length}</strong>
              </div>
              <div className="booking-admin-stat">
                <span>Por confirmar</span>
                <strong>{pending}</strong>
              </div>
              <div className="booking-admin-stat">
                <span>Confirmadas</span>
                <strong>{confirmed}</strong>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className={`btn ${booking?.enabled ? 'btn-outline' : 'btn-primary'} btn-block`}
                  onClick={() => toggleMutation.mutate(!booking?.enabled)}
                  disabled={toggleMutation.isPending}
                >
                  <Icon name={booking?.enabled ? 'clock' : 'check'} size={16} />
                  {booking?.enabled ? 'Pausar reservas' : 'Activar reservas'}
                </button>
              )}
            </div>
          </section>

          <div className="booking-admin-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Solicitudes</p>
                  <h2>Reservas desde el enlace</h2>
                </div>
                <span className="toolbar-count">{upcoming.length} próximas</span>
              </div>

              {onlineQuery.isLoading ? (
                <Skeleton rows={5} />
              ) : onlineQuery.isError ? (
                <InlineError error={{ message: errorMessage(onlineQuery.error) }} />
              ) : upcoming.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Mascota</th>
                        <th>Tutor</th>
                        <th>Servicio</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>
                            <span className="mono">{dateTime(appointment.scheduledAt)}</span>
                          </td>
                          <td>
                            <div className="cell-main">
                              <strong>{appointment.petName}</strong>
                              <span>{appointment.species || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="cell-main">
                              <strong>{appointment.customerName || '—'}</strong>
                              <span>{appointment.customerPhone || 'Sin teléfono'}</span>
                            </div>
                          </td>
                          <td>{appointment.reason}</td>
                          <td><StatusPill status={appointment.status} /></td>
                          <td>
                            <div className="row-actions">
                              {appointment.status !== 'confirmed' && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    statusMutation.mutate({ id: appointment.id, status: 'confirmed' })
                                  }
                                  disabled={statusMutation.isPending}
                                >
                                  <Icon name="check" size={14} />
                                  Confirmar
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-button danger"
                                title="Cancelar reserva"
                                onClick={() =>
                                  statusMutation.mutate({ id: appointment.id, status: 'cancelled' })
                                }
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon="calendar"
                  title="Aún no hay reservas en línea"
                  description="Comparte tu enlace y las solicitudes aparecerán aquí."
                  action={link ? <CopyButton value={link} /> : null}
                />
              )}
            </section>

            <aside className="panel booking-admin-guide">
              <p className="eyebrow">Cómo funciona</p>
              <h2>Agenda sin llamadas</h2>
              <ol className="booking-steps-list">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Comparte el enlace</strong>
                    <p>Solo tú tienes este enlace. Puedes pausarlo cuando quieras.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>El tutor elige</strong>
                    <p>Servicio, día y hora entre tus horarios disponibles.</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Llega a tu agenda</strong>
                    <p>La cita se crea con tutor, mascota y teléfono. Confírmala aquí.</p>
                  </div>
                </li>
              </ol>

              <div className="booking-admin-services">
                <p className="eyebrow">Servicios publicados</p>
                {booking?.services?.map((service) => (
                  <div className="booking-admin-service" key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>
                        {service.duration} min · {service.price > 0 ? money(service.price) : 'Sin costo'}
                      </span>
                    </div>
                    <span className="mono">{service.id}</span>
                  </div>
                ))}
              </div>

              <div className="booking-admin-hours">
                <Icon name="clock" size={16} />
                <span>
                  {booking?.openTime}–{booking?.closeTime} · turnos de {booking?.slotMinutes} min
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Icon name="edit" size={16} />
                  Editar servicios y horario
                </button>
              )}
            </aside>
          </div>
        </>
      )}

      <Modal
        open={settingsOpen}
        title="Configurar reservas en línea"
        eyebrow="Agenda pública"
        onClose={() => setSettingsOpen(false)}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              form="booking-settings-form"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </>
        }
      >
        <form id="booking-settings-form" className="form-grid" onSubmit={submitSettings}>
          <Field label="Recibiendo reservas">
            <label className="check-control">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span>Permitir que los tutores agenden en línea</span>
            </label>
          </Field>
          <Field label="Días visibles hacia adelante">
            <input
              type="number"
              min="1"
              max="120"
              value={form.daysAhead}
              onChange={updateForm('daysAhead')}
            />
          </Field>
          <Field label="Apertura">
            <input type="time" value={form.openTime} onChange={updateForm('openTime')} required />
          </Field>
          <Field label="Cierre">
            <input type="time" value={form.closeTime} onChange={updateForm('closeTime')} required />
          </Field>
          <Field label="Duración del turno">
            <select value={form.slotMinutes} onChange={updateForm('slotMinutes')}>
              {[15, 20, 30, 45, 60].map((value) => (
                <option value={value} key={value}>
                  {value} minutos
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mensaje de bienvenida" span={2}>
            <textarea
              rows={2}
              value={form.intro}
              onChange={updateForm('intro')}
              placeholder="Agenda tu cita en línea. Te esperamos con tu mascota."
            />
          </Field>

          <div className="field-span-2 booking-service-editor">
            <div className="booking-service-editor-head">
              <div>
                <span className="field-label">Servicios publicados</span>
                <p className="field-hint">
                  Nombre, duración y valor. El tutor verá esta lista en la página pública.
                </p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={addService}>
                <Icon name="plus" size={15} />
                Agregar servicio
              </button>
            </div>

            {form.services.map((service, index) => (
              <div className="booking-service-row" key={`${service.id || 'new'}-${index}`}>
                <input
                  value={service.name}
                  onChange={updateService(index, 'name')}
                  placeholder="Nombre del servicio"
                  aria-label="Nombre del servicio"
                  required
                />
                <select
                  value={service.duration}
                  onChange={updateService(index, 'duration')}
                  aria-label="Duración"
                >
                  {[15, 30, 45, 60, 90, 120].map((value) => (
                    <option value={value} key={value}>
                      {value} min
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={service.price}
                  onChange={updateService(index, 'price')}
                  placeholder="Valor"
                  aria-label="Valor"
                />
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => removeService(index)}
                  title="Quitar servicio"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
            {!form.services.length && (
              <p className="booking-empty">Agrega al menos un servicio para publicar la agenda.</p>
            )}
          </div>

          {settingsError && (
            <div className="field-span-2">
              <InlineError error={{ message: errorMessage(settingsError) }} />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
