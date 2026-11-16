import { useState } from 'react';
import { Navigate } from 'react-router-dom';
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

const EMPTY = {
  name: '',
  email: '',
  password: '',
  role: 'staff',
  active: true,
};

export default function UsersPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api('/users').then((response) => response.data),
    enabled: isAdmin,
  });

  if (!isAdmin) return <Navigate to="/app" replace />;

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      id ? api(`/users/${id}`, { method: 'PATCH', body: payload }) : api('/users', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      role: member.role,
      active: member.active,
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
    const payload = {
      name: form.name.trim(),
      role: form.role,
      active: form.active,
    };
    if (form.password) payload.password = form.password;
    if (!editing) {
      payload.email = form.email.trim().toLowerCase();
      payload.password = form.password;
    }
    saveMutation.mutate({ id: editing?.id, payload });
  };

  const remove = (member) => {
    if (!window.confirm(`¿Eliminar a ${member.name}?`)) return;
    deleteMutation.mutate(member.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sistema"
        title="Usuarios y roles"
        description="Quién entra, qué puede hacer y quién responde por la empresa."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Invitar usuario
          </button>
        }
      />

      {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

      <section className="panel">
        {users.isLoading ? (
          <Skeleton rows={5} />
        ) : users.data?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="cell-main">
                        <strong>
                          {member.name}
                          {member.id === user.id && <span className="self-tag">Tú</span>}
                        </strong>
                        <span>Desde {dateTime(member.createdAt)}</span>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td><StatusPill status={member.role} /></td>
                    <td className="muted">{member.lastLoginAt ? dateTime(member.lastLoginAt) : '—'}</td>
                    <td><StatusPill status={member.active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => openEdit(member)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() => remove(member)}
                          title="Eliminar"
                          disabled={member.id === user.id}
                        >
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
          <EmptyState icon="users" title="Sin usuarios" description="Invita a tu equipo para repartir el trabajo." />
        )}
      </section>

      <section className="panel role-guide">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Permisos</p>
            <h2>Cómo se reparten los roles</h2>
          </div>
        </div>
        <div className="role-grid">
          <div>
            <StatusPill status="owner" />
            <p>Control total: usuarios, ajustes, empresa y operación.</p>
          </div>
          <div>
            <StatusPill status="admin" />
            <p>Operación y equipo. No puede quitar al propietario.</p>
          </div>
          <div>
            <StatusPill status="staff" />
            <p>Operación diaria: ventas, clientes y módulos del oficio.</p>
          </div>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar usuario' : 'Invitar usuario'}
        eyebrow="Equipo"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </>
        }
      >
        <form id="user-form" className="form-grid" onSubmit={submit}>
          <Field label="Nombre" span={2} required>
            <input value={form.name} onChange={update('name')} placeholder="Nombre completo" required />
          </Field>
          <Field label="Correo" span={2} required>
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="persona@empresa.com"
              disabled={Boolean(editing)}
              required
            />
          </Field>
          <Field label="Rol" required>
            <select value={form.role} onChange={update('role')}>
              <option value="staff">Equipo</option>
              <option value="admin">Administrador</option>
              <option value="owner">Propietario</option>
            </select>
          </Field>
          <Field
            label={editing ? 'Nueva contraseña' : 'Contraseña'}
            hint={editing ? 'Déjala vacía para no cambiarla.' : 'Mínimo 8 caracteres.'}
            required={!editing}
          >
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              minLength={8}
              required={!editing}
            />
          </Field>
          <div className="field field-span-2">
            <label className="check-control">
              <input type="checkbox" checked={form.active} onChange={update('active')} />
              <span>Usuario activo</span>
            </label>
          </div>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
