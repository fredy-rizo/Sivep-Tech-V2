import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { date, errorMessage, money, quantity, todayISO } from '../lib/format';
import Icon from '../components/Icon';
import {
  EmptyState,
  Field,
  InlineError,
  Modal,
  PageHeader,
  Skeleton,
} from '../components/ui';

export default function BatchesPage() {
  const { tenant, currency } = useAuth();
  const queryClient = useQueryClient();
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    lot: '',
    expiresAt: '',
    quantity: '',
    cost: '',
  });
  const [error, setError] = useState(null);

  const batches = useQuery({
    queryKey: ['batches'],
    queryFn: () => api('/pharmacy/batch-list').then((response) => response.data),
    enabled: tenant.vertical === 'farmacia',
  });
  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => api('/products?active=true').then((response) => response.data),
    enabled: tenant.vertical === 'farmacia',
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (batches.data ?? []).filter((batch) => {
      if (expiringOnly && !(batch.daysToExpire !== null && batch.daysToExpire <= 60)) return false;
      if (!term) return true;
      return [batch.productName, batch.lot, batch.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [batches.data, expiringOnly, search]);

  const stats = useMemo(() => {
    const all = batches.data ?? [];
    return {
      total: all.length,
      expiring: all.filter((b) => b.daysToExpire !== null && b.daysToExpire >= 0 && b.daysToExpire <= 60).length,
      expired: all.filter((b) => b.daysToExpire !== null && b.daysToExpire < 0).length,
    };
  }, [batches.data]);

  if (tenant.vertical !== 'farmacia') return <Navigate to="/app" replace />;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) =>
      api(`/products/${payload.productId}/batches`, {
        method: 'POST',
        body: {
          lot: payload.lot || null,
          expiresAt: payload.expiresAt || null,
          quantity: payload.quantity,
          cost: payload.cost,
        },
      }),
    onSuccess: () => {
      setModalOpen(false);
      setForm({ productId: '', lot: '', expiresAt: '', quantity: '', cost: '' });
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ productId, id }) =>
      api(`/products/${productId}/batches/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => setError(err),
  });

  const submit = (event) => {
    event.preventDefault();
    createMutation.mutate({
      productId: Number(form.productId),
      lot: form.lot.trim(),
      expiresAt: form.expiresAt,
      quantity: Number(form.quantity || 0),
      cost: Number(form.cost || 0),
    });
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const remove = (batch) => {
    if (!window.confirm(`¿Eliminar el lote ${batch.lot || batch.id} de ${batch.productName}?`)) return;
    deleteMutation.mutate({ productId: batch.productId, id: batch.id });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Farmacia"
        title="Lotes y vencimientos"
        description="Qué entra, qué vence y qué hay que sacar del mostrador."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={17} />
            Registrar lote
          </button>
        }
      />

      {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

      <section className="batch-summary">
        <div>
          <span className="eyebrow">Lotes activos</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="summary-amber">
          <span className="eyebrow">Vencen en 60 días</span>
          <strong>{stats.expiring}</strong>
        </div>
        <div className="summary-wine">
          <span className="eyebrow">Ya vencidos</span>
          <strong>{stats.expired}</strong>
        </div>
        <div className="batch-rule">
          <p>
            Revisa los lotes vencidos antes de venderlos. El sistema no bloquea la venta por lote;
            esta bandeja es tu control de calidad.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar medicamento o lote…"
            />
          </div>
          <label className="check-control">
            <input type="checkbox" checked={expiringOnly} onChange={(event) => setExpiringOnly(event.target.checked)} />
            <span>Vencen en 60 días</span>
          </label>
          <span className="toolbar-count">{filtered.length} lotes</span>
        </div>

        {batches.isLoading ? (
          <Skeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="flask"
            title={batches.data?.length ? 'Sin coincidencias' : 'Sin lotes registrados'}
            description="Registra lotes para llevar control de vencimientos por medicamento."
            action={
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(true)}>
                Registrar lote
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Lote</th>
                  <th>Vence</th>
                  <th className="align-right">Cantidad</th>
                  <th className="align-right">Costo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((batch) => {
                  const expired = batch.daysToExpire !== null && batch.daysToExpire < 0;
                  const soon = batch.daysToExpire !== null && batch.daysToExpire >= 0 && batch.daysToExpire <= 60;
                  return (
                    <tr key={batch.id}>
                      <td>
                        <div className="cell-main">
                          <strong>{batch.productName}</strong>
                          <span>{batch.category || 'Sin categoría'}</span>
                        </div>
                      </td>
                      <td className="mono">{batch.lot || '—'}</td>
                      <td>
                        <div className="expiry-cell">
                          <span>{date(batch.expiresAt)}</span>
                          {expired && <span className="expiry-tag tag-wine">Vencido</span>}
                          {soon && <span className="expiry-tag tag-amber">Vence pronto</span>}
                        </div>
                      </td>
                      <td className="align-right">
                        {quantity(batch.quantity, batch.unit)}
                      </td>
                      <td className="align-right muted">{money(batch.cost, currency)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-button danger" onClick={() => remove(batch)} title="Eliminar lote">
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title="Registrar lote"
        eyebrow="Control de inventario"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="batch-form" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando…' : 'Registrar lote'}
            </button>
          </>
        }
      >
        <form id="batch-form" className="form-grid" onSubmit={submit}>
          <Field label="Medicamento" span={2} required>
            <select value={form.productId} onChange={update('productId')} required>
              <option value="">Selecciona un producto</option>
              {products.data?.map((product) => (
                <option value={product.id} key={product.id}>{product.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Lote">
            <input value={form.lot} onChange={update('lot')} placeholder="L-2401" />
          </Field>
          <Field label="Fecha de vencimiento">
            <input type="date" min={todayISO()} value={form.expiresAt} onChange={update('expiresAt')} />
          </Field>
          <Field label="Cantidad" required>
            <input type="number" min="0" step="1" value={form.quantity} onChange={update('quantity')} required />
          </Field>
          <Field label="Costo unitario">
            <input type="number" min="0" step="0.01" value={form.cost} onChange={update('cost')} />
          </Field>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
