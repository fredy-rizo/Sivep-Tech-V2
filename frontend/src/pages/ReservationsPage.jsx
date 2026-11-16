import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { addDaysISO, date, errorMessage, money, todayISO } from '../lib/format';
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

function blankForm() {
  return {
    roomId: '',
    customerId: '',
    guestName: '',
    checkIn: todayISO(),
    checkOut: addDaysISO(todayISO(), 2),
    guests: '1',
    total: '',
    status: 'confirmed',
    notes: '',
  };
}

const STATUS_ACTIONS = [
  ['confirmed', 'Confirmada'],
  ['checked_in', 'Check-in'],
  ['checked_out', 'Check-out'],
  ['cancelled', 'Cancelar'],
  ['no_show', 'No asistió'],
];

export default function ReservationsPage() {
  const { tenant, currency } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState(null);

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api('/hotels/rooms').then((response) => response.data),
    enabled: tenant.vertical === 'hotel',
  });
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api('/customers?active=true').then((response) => response.data),
    enabled: tenant.vertical === 'hotel',
  });
  const reservations = useQuery({
    queryKey: ['reservations', view],
    queryFn: () =>
      api(`/hotels/reservations${view === 'upcoming' ? '?upcoming=true' : ''}`).then(
        (response) => response.data,
      ),
    enabled: tenant.vertical === 'hotel',
  });

  const selectedRoom = useMemo(
    () => (rooms.data ?? []).find((room) => String(room.id) === String(form.roomId)),
    [rooms.data, form.roomId],
  );

  const projectedNights = useMemo(() => {
    const start = new Date(`${form.checkIn}T12:00:00`);
    const end = new Date(`${form.checkOut}T12:00:00`);
    const nights = Math.round((end - start) / 86400000);
    return Number.isFinite(nights) && nights > 0 ? nights : 0;
  }, [form.checkIn, form.checkOut]);

  if (tenant.vertical !== 'hotel') return <Navigate to="/app" replace />;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/hotels/reservations/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/hotels/reservations', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(blankForm());
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      api(`/hotels/reservations/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/hotels/reservations/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (reservation) => {
    setEditing(reservation);
    setForm({
      roomId: String(reservation.roomId),
      customerId: reservation.customerId ? String(reservation.customerId) : '',
      guestName: reservation.guestName,
      checkIn: String(reservation.checkIn).slice(0, 10),
      checkOut: String(reservation.checkOut).slice(0, 10),
      guests: String(reservation.guests),
      total: String(reservation.total),
      status: reservation.status,
      notes: reservation.notes ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'customerId') {
        const customer = customers.data?.find((item) => String(item.id) === value);
        if (customer && (!current.guestName || current.guestName === '')) next.guestName = customer.name;
      }
      if (key === 'roomId' && !current.total) {
        const room = rooms.data?.find((item) => String(item.id) === value);
        if (room) next.total = String(room.rate * projectedNights);
      }
      return next;
    });
  };

  const submit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      roomId: Number(form.roomId),
      customerId: form.customerId ? Number(form.customerId) : null,
      guestName: form.guestName.trim(),
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guests: Number(form.guests || 1),
      total: form.total === '' ? undefined : Number(form.total),
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  const remove = (reservation) => {
    if (!window.confirm(`¿Eliminar la reserva de ${reservation.guestName}?`)) return;
    deleteMutation.mutate(reservation.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Hotel"
        title="Reservas"
        description="Quién llega, qué habitación ocupa y cuándo sale."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Nueva reserva
          </button>
        }
      />

      {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

      <section className="panel">
        <div className="toolbar toolbar-split">
          <div className="segmented segmented-small">
            <button type="button" className={view === 'upcoming' ? 'active' : ''} onClick={() => setView('upcoming')}>
              Próximas
            </button>
            <button type="button" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
              Todas
            </button>
          </div>
          <span className="toolbar-count">{reservations.data?.length ?? 0} reservas</span>
        </div>

        {reservations.isLoading ? (
          <Skeleton rows={6} />
        ) : reservations.data?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Huésped</th>
                  <th>Habitación</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Noches</th>
                  <th>Estado</th>
                  <th className="align-right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reservations.data.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>
                      <div className="cell-main">
                        <strong>{reservation.guestName}</strong>
                        <span>{reservation.guests} huésped{reservation.guests === 1 ? '' : 'es'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <strong>{reservation.roomNumber}</strong>
                        <span>{reservation.roomType}</span>
                      </div>
                    </td>
                    <td>{date(reservation.checkIn)}</td>
                    <td>{date(reservation.checkOut)}</td>
                    <td className="align-center">{reservation.nights}</td>
                    <td><StatusPill status={reservation.status} /></td>
                    <td className="align-right strong">{money(reservation.total, currency)}</td>
                    <td>
                      <div className="row-actions">
                        <select
                          value={reservation.status}
                          onChange={(event) =>
                            statusMutation.mutate({ id: reservation.id, status: event.target.value })
                          }
                          aria-label="Cambiar estado"
                          className="compact-select"
                        >
                          {STATUS_ACTIONS.map(([value, label]) => (
                            <option value={value} key={value}>{label}</option>
                          ))}
                        </select>
                        <button type="button" className="icon-button" onClick={() => openEdit(reservation)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => remove(reservation)} title="Eliminar">
                          <Icon name="trash" size={16} />
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
            title="Sin reservas"
            description="Registra la primera reserva para empezar a llenar las habitaciones."
            action={
              <button type="button" className="btn btn-outline" onClick={openCreate}>
                Nueva reserva
              </button>
            }
          />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar reserva' : 'Nueva reserva'}
        eyebrow="Hotel"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="reservation-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear reserva'}
            </button>
          </>
        }
      >
        <form id="reservation-form" className="form-grid" onSubmit={submit}>
          <Field label="Habitación" required>
            <select value={form.roomId} onChange={update('roomId')} required>
              <option value="">Selecciona una habitación</option>
              {rooms.data?.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.number} · {room.type} · {money(room.rate, currency)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente registrado" hint="Opcional; puedes escribir otro huésped.">
            <select value={form.customerId} onChange={update('customerId')}>
              <option value="">Sin cliente registrado</option>
              {customers.data?.map((customer) => (
                <option value={customer.id} key={customer.id}>{customer.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre del huésped" span={2} required>
            <input value={form.guestName} onChange={update('guestName')} placeholder="Mariana Torres" required />
          </Field>
          <Field label="Entrada" required>
            <input type="date" value={form.checkIn} onChange={update('checkIn')} required />
          </Field>
          <Field label="Salida" required>
            <input type="date" value={form.checkOut} onChange={update('checkOut')} required />
          </Field>
          <Field label="Huéspedes" required>
            <input type="number" min="1" value={form.guests} onChange={update('guests')} required />
          </Field>
          <Field
            label="Total"
            hint={
              selectedRoom && projectedNights
                ? `Sugerido: ${money(selectedRoom.rate * projectedNights, currency)} (${projectedNights} noches)`
                : 'Se calcula con la tarifa × noches si lo dejas vacío.'
            }
          >
            <input type="number" min="0" step="1000" value={form.total} onChange={update('total')} placeholder="Automático" />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={update('status')}>
              {STATUS_ACTIONS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Notas" span={2}>
            <textarea rows={2} value={form.notes} onChange={update('notes')} placeholder="Solicitudes especiales…" />
          </Field>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
