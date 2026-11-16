import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { date, errorMessage, number } from '../lib/format';
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
  customerId: '',
  name: '',
  species: 'Perro',
  breed: '',
  birthdate: '',
  weight: '',
  notes: '',
  active: true,
};

const SPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Reptil', 'Otro'];

export default function PetsPage() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const pets = useQuery({
    queryKey: ['pets'],
    queryFn: () => api('/vet/pets').then((response) => response.data),
    enabled: tenant.vertical === 'veterinaria',
  });
  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api('/customers?active=true').then((response) => response.data),
    enabled: tenant.vertical === 'veterinaria',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pets.data ?? [];
    return (pets.data ?? []).filter((pet) =>
      [pet.name, pet.customerName, pet.species, pet.breed]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [pets.data, search]);

  if (tenant.vertical !== 'veterinaria') return <Navigate to="/app" replace />;

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/vet/pets/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/vet/pets', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/vet/pets/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (pet) => {
    setEditing(pet);
    setForm({
      customerId: pet.customerId ? String(pet.customerId) : '',
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? '',
      birthdate: pet.birthdate ? String(pet.birthdate).slice(0, 10) : '',
      weight: pet.weight == null ? '' : String(pet.weight),
      notes: pet.notes ?? '',
      active: pet.active ?? true,
    });
    setError(null);
    setModalOpen(true);
  };

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    saveMutation.mutate({
      customerId: form.customerId ? Number(form.customerId) : null,
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || null,
      birthdate: form.birthdate || null,
      weight: form.weight === '' ? null : Number(form.weight),
      notes: form.notes.trim() || null,
      active: form.active,
    });
  };

  const remove = (pet) => {
    if (!window.confirm(`¿Eliminar el registro de ${pet.name}?`)) return;
    deleteMutation.mutate(pet.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Veterinaria"
        title="Pacientes"
        description="Cada mascota con su tutor, su especie y su historia."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Nuevo paciente
          </button>
        }
      />

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por paciente, tutor o especie…"
            />
          </div>
          <span className="toolbar-count">{filtered.length} pacientes</span>
        </div>

        {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

        {pets.isLoading ? (
          <Skeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="paw"
            title={pets.data?.length ? 'Sin coincidencias' : 'Aún no hay pacientes'}
            description="Registra la primera mascota para agendar consultas y llevar su historial."
            action={
              <button type="button" className="btn btn-outline" onClick={openCreate}>
                Registrar paciente
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Tutor</th>
                  <th>Especie / raza</th>
                  <th>Nacimiento</th>
                  <th className="align-right">Peso</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pet) => (
                  <tr key={pet.id}>
                    <td><strong>{pet.name}</strong></td>
                    <td>
                      <div className="cell-main">
                        <span>{pet.customerName || 'Sin tutor'}</span>
                        <span>{pet.customerPhone || ''}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <span>{pet.species}</span>
                        <span>{pet.breed || '—'}</span>
                      </div>
                    </td>
                    <td className="muted">{date(pet.birthdate)}</td>
                    <td className="align-right">{pet.weight ? `${number(pet.weight, 1)} kg` : '—'}</td>
                    <td><StatusPill status={pet.active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => openEdit(pet)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => remove(pet)} title="Eliminar">
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar paciente' : 'Nuevo paciente'}
        eyebrow="Veterinaria"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="pet-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar paciente'}
            </button>
          </>
        }
      >
        <form id="pet-form" className="form-grid" onSubmit={submit}>
          <Field label="Nombre del paciente" required>
            <input value={form.name} onChange={update('name')} placeholder="Luna" required />
          </Field>
          <Field label="Tutor">
            <select value={form.customerId} onChange={update('customerId')}>
              <option value="">Sin tutor registrado</option>
              {customers.data?.map((customer) => (
                <option value={customer.id} key={customer.id}>{customer.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Especie" required>
            <select value={form.species} onChange={update('species')}>
              {SPECIES.map((species) => (
                <option value={species} key={species}>{species}</option>
              ))}
            </select>
          </Field>
          <Field label="Raza">
            <input value={form.breed} onChange={update('breed')} placeholder="Labrador" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" value={form.birthdate} onChange={update('birthdate')} />
          </Field>
          <Field label="Peso (kg)">
            <input type="number" min="0" step="0.01" value={form.weight} onChange={update('weight')} placeholder="24.5" />
          </Field>
          <Field label="Notas clínicas" span={2}>
            <textarea rows={3} value={form.notes} onChange={update('notes')} placeholder="Alergias, condiciones, observaciones…" />
          </Field>
          <div className="field field-span-2">
            <label className="check-control">
              <input type="checkbox" checked={form.active} onChange={update('active')} />
              <span>Paciente activo</span>
            </label>
          </div>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
