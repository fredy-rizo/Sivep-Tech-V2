import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { errorMessage, money } from '../lib/format';
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

const EMPTY = {
  number: '',
  type: 'Doble',
  capacity: '2',
  rate: '',
  floor: '',
  status: 'available',
  notes: '',
};

const ROOM_STATUS = [
  ['available', 'Disponible'],
  ['occupied', 'Ocupada'],
  ['cleaning', 'Limpieza'],
  ['maintenance', 'Mantenimiento'],
];

export default function RoomsPage() {
  const { tenant, currency } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api('/hotels/rooms').then((response) => response.data),
    enabled: tenant.vertical === 'hotel',
  });

  if (tenant.vertical !== 'hotel') return <Navigate to="/app" replace />;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['reservations'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/hotels/rooms/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/hotels/rooms', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api(`/hotels/rooms/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/hotels/rooms/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditing(room);
    setForm({
      number: room.number,
      type: room.type,
      capacity: String(room.capacity),
      rate: String(room.rate),
      floor: room.floor ?? '',
      status: room.status,
      notes: room.notes ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      number: form.number.trim(),
      type: form.type.trim(),
      capacity: Number(form.capacity || 1),
      rate: Number(form.rate || 0),
      floor: form.floor.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  const remove = (room) => {
    if (!window.confirm(`¿Eliminar la habitación ${room.number}?`)) return;
    deleteMutation.mutate(room.id);
  };

  const counts = (rooms.data ?? []).reduce(
    (acc, room) => ({ ...acc, [room.status]: (acc[room.status] ?? 0) + 1 }),
    {},
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Hotel"
        title="Habitaciones"
        description="El estado de cada cuarto, su tarifa y su capacidad."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Nueva habitación
          </button>
        }
      />

      {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

      <section className="room-summary">
        <div><span className="summary-dot dot-green" /><strong>{counts.available ?? 0}</strong> disponibles</div>
        <div><span className="summary-dot dot-wine" /><strong>{counts.occupied ?? 0}</strong> ocupadas</div>
        <div><span className="summary-dot dot-amber" /><strong>{counts.cleaning ?? 0}</strong> en limpieza</div>
        <div><span className="summary-dot dot-neutral" /><strong>{counts.maintenance ?? 0}</strong> en mantenimiento</div>
      </section>

      {rooms.isLoading ? (
        <div className="room-grid">
          {[0, 1, 2, 3].map((item) => (
            <div className="room-card" key={item}><Skeleton rows={4} /></div>
          ))}
        </div>
      ) : rooms.data?.length ? (
        <div className="room-grid">
          {rooms.data.map((room) => (
            <article className={`room-card room-${room.status}`} key={room.id}>
              <div className="room-card-head">
                <div>
                  <p className="room-number">{room.number}</p>
                  <p className="room-type">{room.type} · Piso {room.floor || '—'}</p>
                </div>
                <StatusPill status={room.status} />
              </div>
              <div className="room-card-body">
                <div className="room-figures">
                  <div><span>Tarifa</span><strong>{money(room.rate, currency)}</strong></div>
                  <div><span>Capacidad</span><strong>{room.capacity} huésped{room.capacity === 1 ? '' : 'es'}</strong></div>
                </div>
                {room.notes && <p className="room-notes">{room.notes}</p>}
              </div>
              <div className="room-card-foot">
                <select
                  value={room.status}
                  onChange={(event) => statusMutation.mutate({ id: room.id, status: event.target.value })}
                  aria-label={`Estado de habitación ${room.number}`}
                >
                  {ROOM_STATUS.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
                <div className="row-actions">
                  <button type="button" className="icon-button" onClick={() => openEdit(room)} title="Editar">
                    <Icon name="edit" size={16} />
                  </button>
                  <button type="button" className="icon-button danger" onClick={() => remove(room)} title="Eliminar">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="bed"
          title="Aún no hay habitaciones"
          description="Crea las habitaciones del hotel para empezar a recibir reservas."
          action={
            <button type="button" className="btn btn-outline" onClick={openCreate}>
              Crear habitación
            </button>
          }
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Habitación ${editing.number}` : 'Nueva habitación'}
        eyebrow="Hotel"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="room-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear habitación'}
            </button>
          </>
        }
      >
        <form id="room-form" className="form-grid" onSubmit={submit}>
          <Field label="Número" required>
            <input value={form.number} onChange={update('number')} placeholder="101" required />
          </Field>
          <Field label="Tipo" required>
            <input value={form.type} onChange={update('type')} placeholder="Doble" required />
          </Field>
          <Field label="Capacidad" required>
            <input type="number" min="1" value={form.capacity} onChange={update('capacity')} required />
          </Field>
          <Field label="Tarifa por noche" required>
            <input type="number" min="0" step="1000" value={form.rate} onChange={update('rate')} required />
          </Field>
          <Field label="Piso">
            <input value={form.floor} onChange={update('floor')} placeholder="1" />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={update('status')}>
              {ROOM_STATUS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Notas" span={2}>
            <textarea rows={2} value={form.notes} onChange={update('notes')} placeholder="Vista, servicios, observaciones…" />
          </Field>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
