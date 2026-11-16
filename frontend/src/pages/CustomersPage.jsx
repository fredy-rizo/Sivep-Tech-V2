import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { errorMessage } from '../lib/format';
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
  name: '',
  doc: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  active: true,
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: () => api('/customers').then((response) => response.data),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.data ?? [];
    return (customers.data ?? []).filter((customer) =>
      [customer.name, customer.doc, customer.phone, customer.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [customers.data, search]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/customers/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/customers', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name ?? '',
      doc: customer.doc ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
      active: customer.active ?? true,
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
      name: form.name.trim(),
      doc: form.doc.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    });
  };

  const remove = (customer) => {
    if (!window.confirm(`¿Eliminar a "${customer.name}"?`)) return;
    deleteMutation.mutate(customer.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Base"
        title="Clientes"
        description="Quién compra, quién vuelve y cómo contactarlo."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Nuevo cliente
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
              placeholder="Buscar por nombre, documento o teléfono…"
            />
          </div>
          <span className="toolbar-count">{filtered.length} clientes</span>
        </div>

        {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

        {customers.isLoading ? (
          <Skeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={customers.data?.length ? 'Sin coincidencias' : 'Aún no hay clientes'}
            description="Agrega a tus clientes para asociar ventas, reservas y pacientes."
            action={
              <button type="button" className="btn btn-outline" onClick={openCreate}>
                Agregar cliente
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="cell-main">
                        <strong>{customer.name}</strong>
                        {customer.notes && <span className="ellipsis">{customer.notes}</span>}
                      </div>
                    </td>
                    <td className="mono">{customer.doc || '—'}</td>
                    <td>
                      <div className="cell-main">
                        <span>{customer.phone || '—'}</span>
                        <span>{customer.email || ''}</span>
                      </div>
                    </td>
                    <td className="muted">{customer.address || '—'}</td>
                    <td><StatusPill status={customer.active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => openEdit(customer)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => remove(customer)} title="Eliminar">
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
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        eyebrow="Directorio"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </>
        }
      >
        <form id="customer-form" className="form-grid" onSubmit={submit}>
          <Field label="Nombre completo" span={2} required>
            <input value={form.name} onChange={update('name')} placeholder="Mariana Torres" required />
          </Field>
          <Field label="Documento">
            <input value={form.doc} onChange={update('doc')} placeholder="CC 10203040" />
          </Field>
          <Field label="Teléfono">
            <input value={form.phone} onChange={update('phone')} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="Correo" span={2}>
            <input type="email" value={form.email} onChange={update('email')} placeholder="cliente@correo.com" />
          </Field>
          <Field label="Dirección" span={2}>
            <input value={form.address} onChange={update('address')} placeholder="Calle 00 # 00-00" />
          </Field>
          <Field label="Notas" span={2}>
            <textarea rows={3} value={form.notes} onChange={update('notes')} placeholder="Preferencias, observaciones…" />
          </Field>
          <div className="field field-span-2">
            <label className="check-control">
              <input type="checkbox" checked={form.active} onChange={update('active')} />
              <span>Cliente activo</span>
            </label>
          </div>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
