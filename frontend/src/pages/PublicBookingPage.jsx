import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { addDaysISO, date as formatDate, errorMessage, money, todayISO } from '../lib/format';
import Icon from '../components/Icon';
import { Field, InlineError, Skeleton } from '../components/ui';

const SPECIES = ['Perro', 'Gato', 'Conejo', 'Ave', 'Reptil', 'Otro'];

const WEEKDAY = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
const DAY_NUMBER = new Intl.DateTimeFormat('es-CO', { day: '2-digit' });
const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short' });

function dateFromISO(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function prettyDate(iso) {
  if (!iso) return '—';
  return formatDate(dateFromISO(iso), { weekday: 'long' });
}

function capitalize(value = '') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function googleCalendarUrl({ business, service, date, time, reference }) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + (service?.duration ?? 30) * 60000);
  const stamp = (value) =>
    `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}${String(
      value.getDate(),
    ).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}${String(
      value.getMinutes(),
    ).padStart(2, '0')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${service?.name ?? 'Cita'} · ${business?.name ?? ''}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `Reserva ${reference ?? ''} en ${business?.name ?? ''}`,
    location: business?.address || business?.name || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function PublicBookingPage() {
  const { token } = useParams();
  const [serviceId, setServiceId] = useState('');
  const [dateISO, setDateISO] = useState(todayISO());
  const [time, setTime] = useState('');
  const [form, setForm] = useState({
    tutorName: '',
    phone: '',
    petName: '',
    species: 'Perro',
    email: '',
    notes: '',
  });
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [copied, setCopied] = useState(false);

  const configQuery = useQuery({
    queryKey: ['public-booking', token],
    queryFn: () => api(`/public/booking/${token}`, { token: null }).then((response) => response.data),
    retry: 0,
  });

  const business = configQuery.data?.business;
  const booking = configQuery.data?.booking;
  const services = booking?.services ?? [];

  useEffect(() => {
    if (services.length && !serviceId) setServiceId(services[0].id);
  }, [services, serviceId]);

  const service = useMemo(
    () => services.find((item) => item.id === serviceId) ?? null,
    [services, serviceId],
  );

  const maxDate = useMemo(
    () => addDaysISO(todayISO(), booking?.daysAhead ?? 30),
    [booking?.daysAhead],
  );

  const availability = useQuery({
    queryKey: ['public-availability', token, serviceId, dateISO],
    queryFn: () =>
      api(`/public/booking/${token}/availability?date=${dateISO}&service=${serviceId}`, {
        token: null,
      }).then((response) => response.data),
    enabled: Boolean(booking?.enabled && serviceId && dateISO),
    retry: 0,
  });

  const slots = availability.data?.slots ?? [];

  useEffect(() => {
    setTime('');
  }, [serviceId, dateISO]);

  useEffect(() => {
    if (!time) return;
    const stillOpen = slots.some((slot) => slot.time === time && slot.available);
    if (!stillOpen) setTime('');
  }, [slots, time]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      api(`/public/booking/${token}`, { method: 'POST', body: payload, token: null }).then(
        (response) => response.data,
      ),
    onSuccess: (data) => {
      setConfirmed(data);
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => {
      setError(err);
      availability.refetch();
    },
  });

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const pickDate = (iso) => {
    setDateISO(iso);
    setTime('');
  };

  const submit = (event) => {
    event.preventDefault();
    if (!service) {
      setError({ message: 'Selecciona un servicio' });
      return;
    }
    if (!time) {
      setError({ message: 'Selecciona una hora disponible' });
      return;
    }
    if (!form.tutorName.trim() || !form.phone.trim() || !form.petName.trim()) {
      setError({ message: 'Completa tu nombre, teléfono y el nombre de tu mascota' });
      return;
    }
    setError(null);
    mutation.mutate({
      serviceId: service.id,
      date: dateISO,
      time,
      tutorName: form.tutorName.trim(),
      phone: form.phone.trim(),
      petName: form.petName.trim(),
      species: form.species,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  const resetBooking = () => {
    setConfirmed(null);
    setTime('');
    setForm({
      tutorName: '',
      phone: '',
      petName: '',
      species: 'Perro',
      email: '',
      notes: '',
    });
  };

  const copyAddress = async () => {
    const ok = await copyText(window.location.href);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1800);
  };

  const brand = business?.branding ?? {};
  const pageStyle = {
    '--booking-brand': brand.primary || '#8B1E3F',
    '--booking-accent': brand.accent || '#5B8C4E',
  };

  if (configQuery.isLoading) {
    return (
      <div className="booking-page booking-loading" style={pageStyle}>
        <div className="booking-loading-card">
          <span className="booking-mark">
            <img src="/brand/sivep-tech-03-escudo-nodo.svg" alt="" />
          </span>
          <Skeleton rows={4} />
          <p className="muted">Cargando la agenda…</p>
        </div>
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="booking-page booking-loading" style={pageStyle}>
        <div className="booking-loading-card">
          <span className="booking-mark">
            <img src="/brand/sivep-tech-03-escudo-nodo.svg" alt="" />
          </span>
          <p className="eyebrow">Reservas en línea</p>
          <h1>Enlace no disponible</h1>
          <p className="muted">
            {errorMessage(configQuery.error)}. Pide a la veterinaria un enlace actualizado.
          </p>
        </div>
      </div>
    );
  }

  const closed = !booking?.enabled;

  return (
    <div className="booking-page" style={pageStyle}>
      <div className="booking-orbe booking-orbe-one" aria-hidden="true" />
      <div className="booking-orbe booking-orbe-two" aria-hidden="true" />

      <header className="booking-topbar">
        <div className="booking-brandline">
          <span className="booking-mark">
            <img src="/brand/sivep-tech-03-escudo-nodo.svg" alt="" />
          </span>
          <div>
            <p className="eyebrow">Reservas en línea</p>
            <strong>{business?.name}</strong>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm booking-share" onClick={copyAddress}>
          <Icon name="share" size={16} />
          {copied ? 'Enlace copiado' : 'Compartir'}
        </button>
      </header>

      <main className="booking-main">
        {confirmed ? (
          <section className="booking-confirm">
            <span className="booking-confirm-icon">
              <Icon name="check" size={30} strokeWidth={1.4} />
            </span>
            <p className="eyebrow">Reserva recibida</p>
            <h1>Tu cita quedó agendada</h1>
            <p className="booking-lead">
              {business?.name} recibió tu solicitud. Guarda el código{' '}
              <strong className="mono">{confirmed.reference}</strong> para identificarte al llegar.
            </p>

            <div className="booking-confirm-grid">
              <div>
                <span>Servicio</span>
                <strong>{confirmed.service?.name}</strong>
              </div>
              <div>
                <span>Fecha</span>
                <strong>{prettyDate(confirmed.date)}</strong>
              </div>
              <div>
                <span>Hora</span>
                <strong>{confirmed.time}</strong>
              </div>
              <div>
                <span>Mascota</span>
                <strong>{confirmed.petName}</strong>
              </div>
              <div>
                <span>Tutor</span>
                <strong>{confirmed.tutorName}</strong>
              </div>
              <div>
                <span>Teléfono</span>
                <strong>{confirmed.phone}</strong>
              </div>
            </div>

            <div className="booking-confirm-actions">
              <a
                className="btn btn-primary"
                href={googleCalendarUrl({
                  business: confirmed.business,
                  service: confirmed.service,
                  date: confirmed.date,
                  time: confirmed.time,
                  reference: confirmed.reference,
                })}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="calendar" size={17} />
                Añadir a mi calendario
              </a>
              <button type="button" className="btn btn-outline" onClick={resetBooking}>
                Agendar otra cita
              </button>
            </div>

            {(confirmed.business?.phone || confirmed.business?.address) && (
              <div className="booking-contact-strip">
                <Icon name="phone" size={16} />
                <span>
                  {confirmed.business.phone}
                  {confirmed.business.address ? ` · ${confirmed.business.address}` : ''}
                </span>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="booking-hero">
              <div className="booking-hero-copy">
                <p className="eyebrow">Agenda tu visita</p>
                <h1>{business?.name}</h1>
                <p className="booking-lead">
                  {booking?.intro ||
                    brand.tagline ||
                    'Elige el servicio, la fecha y la hora. Nosotros confirmamos tu cita.'}
                </p>
                <div className="booking-hero-tags">
                  {business?.contact?.phone && (
                    <span>
                      <Icon name="phone" size={15} /> {business.contact.phone}
                    </span>
                  )}
                  {business?.contact?.city && (
                    <span>
                      <Icon name="building" size={15} /> {business.contact.city}
                    </span>
                  )}
                  <span>
                    <Icon name="clock" size={15} /> {booking?.openTime}–{booking?.closeTime}
                  </span>
                </div>
              </div>
              <div className="booking-hero-art" aria-hidden="true">
                <img src="/brand/sivep-tech-02-surco-datos.svg" alt="" />
              </div>
            </section>

            {closed ? (
              <section className="booking-closed">
                <Icon name="clock" size={26} />
                <h2>Reservas temporalmente cerradas</h2>
                <p>
                  La agenda en línea no está recibiendo citas en este momento.
                  {business?.contact?.phone ? ` Llama al ${business.contact.phone}.` : ''}
                </p>
              </section>
            ) : (
              <form className="booking-form" onSubmit={submit}>
                <div className="booking-column">
                  <section className="booking-block">
                    <div className="booking-block-head">
                      <span className="booking-step">01</span>
                      <div>
                        <h2>¿Qué necesita tu mascota?</h2>
                        <p>Consulta, vacunas, baño o control.</p>
                      </div>
                    </div>
                    <div className="booking-services">
                      {services.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`booking-service${serviceId === item.id ? ' active' : ''}`}
                          onClick={() => setServiceId(item.id)}
                        >
                          <span className="booking-service-top">
                            <strong>{item.name}</strong>
                            <span className="booking-price">
                              {item.price > 0 ? money(item.price) : 'Sin costo'}
                            </span>
                          </span>
                          <span className="booking-service-meta">
                            <Icon name="clock" size={14} /> {item.duration} min
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="booking-block">
                    <div className="booking-block-head">
                      <span className="booking-step">02</span>
                      <div>
                        <h2>Elige el día</h2>
                        <p>Disponibilidad para los próximos días.</p>
                      </div>
                    </div>

                    <div className="booking-days">
                      {Array.from({ length: 7 }).map((_, index) => {
                        const iso = addDaysISO(todayISO(), index);
                        const value = dateFromISO(iso);
                        return (
                          <button
                            type="button"
                            key={iso}
                            className={`booking-day${dateISO === iso ? ' active' : ''}`}
                            onClick={() => pickDate(iso)}
                          >
                            <span>{WEEKDAY.format(value).replace('.', '')}</span>
                            <strong>{DAY_NUMBER.format(value)}</strong>
                            <small>{MONTH.format(value).replace('.', '')}</small>
                          </button>
                        );
                      })}
                    </div>

                    <label className="booking-date-input">
                      <span>O elige otra fecha</span>
                      <input
                        type="date"
                        min={todayISO()}
                        max={maxDate}
                        value={dateISO}
                        onChange={(event) => pickDate(event.target.value)}
                      />
                    </label>
                  </section>

                  <section className="booking-block">
                    <div className="booking-block-head">
                      <span className="booking-step">03</span>
                      <div>
                        <h2>Elige la hora</h2>
                        <p>Los espacios ocupados aparecen desactivados.</p>
                      </div>
                    </div>

                    {availability.isLoading ? (
                      <Skeleton rows={3} />
                    ) : availability.isError ? (
                      <InlineError error={{ message: errorMessage(availability.error) }} />
                    ) : slots.length ? (
                      <div className="booking-slots">
                        {slots.map((slot) => (
                          <button
                            type="button"
                            key={slot.time}
                            disabled={!slot.available}
                            className={`booking-slot${time === slot.time ? ' active' : ''}`}
                            onClick={() => setTime(slot.time)}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="booking-empty">
                        No hay horarios para este día. Prueba con otra fecha.
                      </p>
                    )}
                  </section>

                  <section className="booking-block">
                    <div className="booking-block-head">
                      <span className="booking-step">04</span>
                      <div>
                        <h2>Tus datos</h2>
                        <p>Así te esperamos y te contactamos si algo cambia.</p>
                      </div>
                    </div>

                    <div className="booking-fields">
                      <Field label="Tu nombre" required>
                        <input
                          value={form.tutorName}
                          onChange={update('tutorName')}
                          placeholder="María Fernanda López"
                          required
                        />
                      </Field>
                      <Field label="Teléfono / WhatsApp" required>
                        <input
                          value={form.phone}
                          onChange={update('phone')}
                          placeholder="300 123 4567"
                          inputMode="tel"
                          required
                        />
                      </Field>
                      <Field label="Nombre de la mascota" required>
                        <input
                          value={form.petName}
                          onChange={update('petName')}
                          placeholder="Luna"
                          required
                        />
                      </Field>
                      <Field label="Especie">
                        <select value={form.species} onChange={update('species')}>
                          {SPECIES.map((item) => (
                            <option value={item} key={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Correo (opcional)" span={2}>
                        <input
                          type="email"
                          value={form.email}
                          onChange={update('email')}
                          placeholder="maria@correo.com"
                        />
                      </Field>
                      <Field label="Notas para la veterinaria (opcional)" span={2}>
                        <textarea
                          rows={3}
                          value={form.notes}
                          onChange={update('notes')}
                          placeholder="Alergias, comportamiento, detalles del servicio…"
                        />
                      </Field>
                    </div>
                  </section>

                  {error && <InlineError error={{ message: errorMessage(error) }} />}
                </div>

                <aside className="booking-summary">
                  <p className="eyebrow">Tu reserva</p>
                  <h3>Resumen</h3>
                  <div className="booking-summary-lines">
                    <div>
                      <span>Servicio</span>
                      <strong>{service?.name ?? 'Selecciona un servicio'}</strong>
                    </div>
                    <div>
                      <span>Duración</span>
                      <strong>{service ? `${service.duration} min` : '—'}</strong>
                    </div>
                    <div>
                      <span>Fecha</span>
                      <strong>{capitalize(prettyDate(dateISO))}</strong>
                    </div>
                    <div>
                      <span>Hora</span>
                      <strong>{time || 'Selecciona una hora'}</strong>
                    </div>
                    <div>
                      <span>Mascota</span>
                      <strong>{form.petName || '—'}</strong>
                    </div>
                  </div>
                  <div className="booking-summary-total">
                    <span>Valor</span>
                    <strong>{service ? (service.price > 0 ? money(service.price) : 'Sin costo') : '—'}</strong>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-block"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? 'Enviando…' : 'Confirmar reserva'}
                    {!mutation.isPending && <Icon name="check" size={18} />}
                  </button>
                  <p className="booking-summary-note">
                    Recibirás un código de reserva. El pago se realiza en la veterinaria.
                  </p>
                </aside>
              </form>
            )}
          </>
        )}
      </main>

      <footer className="booking-footer">
        <span>
          Agenda en línea de <strong>{business?.name}</strong>
        </span>
        <span className="booking-powered">
          con <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" /> SIVEP Tech
        </span>
      </footer>
    </div>
  );
}
