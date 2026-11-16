import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { dateTime, errorMessage } from '../lib/format';
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

const STATUSES = [
  ['scheduled', 'Programada'],
  ['confirmed', 'Confirmada'],
  ['in_progress', 'En consulta'],
  ['completed', 'Completada'],
  ['cancelled', 'Cancelada'],
  ['no_show', 'No asistió'],
];

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function nextHour() {
  return toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
}

function blankForm() {
  return {
    petId: '',
    customerId: '',
    scheduledAt: nextHour(),
    reason: '',
    vetName: '',
    status: 'scheduled',
    notes: '',
  };
}

export default function AppointmentsPage() {
  const { tenant, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState(null);

  const pets = useQuery({
    queryKey: ['pets'],
    queryFn: () => api('/vet/pets?active=true').then((response) => response.data),
    enabled: tenant.vertical === 'veterinaria',
  });
  const appointments = useQuery({
    queryKey: ['appointments', view],
    queryFn: () =>
      api(`/vet/appointments${view === 'today' ? '?today=true' : ''}`).then(
        (response) => response.data,
      ),
    enabled: tenant.vertical === 'veterinaria',
  });

  if (tenant.vertical !== 'veterinaria') return <Navigate to="/app" replace />;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/vet/appointments/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/vet/appointments', { method: 'POST', body: payload }),
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
      api(`/vet/appointments/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/vet/appointments/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (appointment) => {
    setEditing(appointment);
    setForm({
      petId: String(appointment.petId),
      customerId: appointment.customerId ? String(appointment.customerId) : '',
      scheduledAt: toLocalInput(appointment.scheduledAt),
      reason: appointment.reason,
      vetName: appointment.vetName ?? '',
      status: appointment.status,
      notes: appointment.notes ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'petId') {
        const pet = pets.data?.find((item) => String(item.id) === value);
        if (pet) next.customerId = pet.customerId ? String(pet.customerId) : '';
      }
      return next;
    });
  };

  const submit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      petId: Number(form.petId),
      customerId: form.customerId ? Number(form.customerId) : null,
      scheduledAt: form.scheduledAt,
      reason: form.reason.trim(),
      vetName: form.vetName.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  const remove = (appointment) => {
    if (!window.confirm(`¿Eliminar la cita de ${appointment.petName}?`)) return;
    deleteMutation.mutate(appointment.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Veterinaria"
        title="Agenda"
        description="Las consultas del día, en orden y sin cruces."
        actions={
          <div className="row-actions">
            {isAdmin && (
              <Link to="/app/reservas-vet" className="btn btn-outline">
                <Icon name="link" size={16} />
                Reservas en línea
              </Link>
            )}
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={17} />
              Nueva cita
            </button>
          </div>
        }
      />

      {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

      <section className="panel">
        <div className="toolbar toolbar-split">
          <div className="segmented segmented-small">
            <button type="button" className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>
              Hoy
            </button>
            <button type="button" className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>
              Todas
            </button>
          </div>
          <span className="toolbar-count">{appointments.data?.length ?? 0} citas</span>
        </div>

        {appointments.isLoading ? (
          <Skeleton rows={6} />
        ) : appointments.data?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Tutor</th>
                  <th>Motivo</th>
                  <th>Atiende</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {appointments.data.map((appointment) => (
                  <tr key={appointment.id}>
                    <td><span className="mono">{dateTime(appointment.scheduledAt)}</span></td>
                    <td>
                      <div className="cell-main">
                        <strong>{appointment.petName}</strong>
                        <span>{appointment.species || '—'}</span>
                      </div>
                    </td>
                    <td>{appointment.customerName || '—'}</td>
                    <td>
                      <div className="cell-main">
                        <strong>{appointment.reason}</strong>
                        {appointment.source === 'public' && (
                          <span className="source-badge">
                            <Icon name="link" size={12} />
                            En línea
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="muted">{appointment.vetName || '—'}</td>
                    <td><StatusPill status={appointment.status} /></td>
                    <td>
                      <div className="row-actions">
                        <select
                          value={appointment.status}
                          onChange={(event) =>
                            statusMutation.mutate({ id: appointment.id, status: event.target.value })
                          }
                          aria-label="Cambiar estado"
                          className="compact-select"
                        >
                          {STATUSES.map(([value, label]) => (
                            <option value={value} key={value}>{label}</option>
                          ))}
                        </select>
                        <button type="button" className="icon-button" onClick={() => openEdit(appointment)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => remove(appointment)} title="Eliminar">
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
            title={view === 'today' ? 'No hay citas para hoy' : 'Sin citas registradas'}
            description="Agenda una consulta para comenzar el día clínico."
            action={
              <button type="button" className="btn btn-outline" onClick={openCreate}>
                Nueva cita
              </button>
            }
          />
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar cita' : 'Nueva cita'}
        eyebrow="Agenda clínica"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="appointment-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agendar cita'}
            </button>
          </>
        }
      >
        <form id="appointment-form" className="form-grid" onSubmit={submit}>
          <Field label="Paciente" span={2} required>
            <select value={form.petId} onChange={update('petId')} required>
              <option value="">Selecciona un paciente</option>
              {pets.data?.map((pet) => (
                <option value={pet.id} key={pet.id}>
                  {pet.name} · {pet.species}{pet.customerName ? ` · ${pet.customerName}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha y hora" required>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={update('scheduledAt')}
              required
            />
          </Field>
          <Field label="Estado">
            <select value={form.status} onChange={update('status')}>
              {STATUSES.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Motivo" span={2} required>
            <input value={form.reason} onChange={update('reason')} placeholder="Control, vacunación, revisión…" required />
          </Field>
          <Field label="Profesional que atiende" span={2}>
            <input value={form.vetName} onChange={update('vetName')} placeholder="Dra. Laura Méndez" />
          </Field>
          <Field label="Notas clínicas" span={2}>
            <textarea rows={3} value={form.notes} onChange={update('notes')} placeholder="Observaciones de la cita…" />
          </Field>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
