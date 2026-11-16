import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { errorMessage, money, quantity } from '../lib/format';
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
  sku: '',
  category: '',
  unit: 'unidad',
  price: '',
  cost: '',
  stock: '',
  minStock: '',
  trackStock: true,
  active: true,
};

function toForm(product) {
  if (!product) return EMPTY;
  return {
    name: product.name ?? '',
    sku: product.sku ?? '',
    category: product.category ?? '',
    unit: product.unit ?? 'unidad',
    price: String(product.price ?? ''),
    cost: String(product.cost ?? ''),
    stock: String(product.stock ?? ''),
    minStock: String(product.minStock ?? ''),
    trackStock: product.trackStock ?? true,
    active: product.active ?? true,
  };
}

export default function ProductsPage() {
  const { tenant, currency } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);

  const products = useQuery({
    queryKey: ['products'],
    queryFn: () => api('/products').then((response) => response.data),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products.data ?? []).filter((product) => {
      if (lowOnly && !product.lowStock) return false;
      if (!term) return true;
      return [product.name, product.sku, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [products.data, search, lowOnly]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing
        ? api(`/products/${editing.id}`, { method: 'PATCH', body: payload })
        : api('/products', { method: 'POST', body: payload }),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
    onError: (err) => setError(err),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm(toForm(product));
    setError(null);
    setModalOpen(true);
  };

  const update = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    saveMutation.mutate({
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      unit: form.unit.trim() || 'unidad',
      price: Number(form.price || 0),
      cost: Number(form.cost || 0),
      stock: Number(form.stock || 0),
      minStock: Number(form.minStock || 0),
      trackStock: form.trackStock,
      active: form.active,
    });
  };

  const remove = (product) => {
    if (!window.confirm(`¿Eliminar "${product.name}"? Si tiene ventas, se desactivará.`)) return;
    deleteMutation.mutate(product.id);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catálogo"
        title={tenant.vertical === 'hotel' ? 'Productos y servicios' : 'Productos'}
        description="Precios, existencias y mínimos. Lo que se vende y lo que hay que reponer."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={17} />
            Nuevo producto
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
              placeholder="Buscar por nombre, SKU o categoría…"
            />
          </div>
          <label className="check-control">
            <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
            <span>Solo stock bajo</span>
          </label>
          <span className="toolbar-count">{filtered.length} registros</span>
        </div>

        {error && !modalOpen && <InlineError error={{ message: errorMessage(error) }} />}

        {products.isLoading ? (
          <Skeleton rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="box"
            title={products.data?.length ? 'Sin coincidencias' : 'El catálogo está vacío'}
            description={
              products.data?.length
                ? 'Prueba con otra búsqueda o quita el filtro.'
                : 'Agrega tu primer producto o servicio para empezar a vender.'
            }
            action={
              <button type="button" className="btn btn-outline" onClick={openCreate}>
                Agregar producto
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="align-right">Precio</th>
                  <th className="align-right">Costo</th>
                  <th className="align-right">Stock</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="cell-main">
                        <strong>{product.name}</strong>
                        <span>{product.sku || 'Sin SKU'} · {product.unit}</span>
                      </div>
                    </td>
                    <td>{product.category || '—'}</td>
                    <td className="align-right strong">{money(product.price, currency)}</td>
                    <td className="align-right muted">{money(product.cost, currency)}</td>
                    <td className="align-right">
                      {product.trackStock ? (
                        <span className={`stock-value${product.lowStock ? ' low' : ''}`}>
                          {quantity(product.stock, product.unit)}
                          {product.lowStock && <small>Bajo</small>}
                        </span>
                      ) : (
                        <span className="muted">Servicio</span>
                      )}
                    </td>
                    <td><StatusPill status={product.active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" onClick={() => openEdit(product)} title="Editar">
                          <Icon name="edit" size={16} />
                        </button>
                        <button type="button" className="icon-button danger" onClick={() => remove(product)} title="Eliminar">
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
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        eyebrow={editing ? editing.sku || 'Catálogo' : 'Catálogo'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </>
        }
      >
        <form id="product-form" className="form-grid" onSubmit={submit}>
          <Field label="Nombre" span={2} required>
            <input value={form.name} onChange={update('name')} placeholder="Ej. Acetaminofén 500 mg" required />
          </Field>
          <Field label="SKU" hint="Opcional">
            <input value={form.sku} onChange={update('sku')} placeholder="SKU-001" />
          </Field>
          <Field label="Categoría">
            <input value={form.category} onChange={update('category')} placeholder="Analgésicos" />
          </Field>
          <Field label="Unidad">
            <input value={form.unit} onChange={update('unit')} placeholder="unidad" />
          </Field>
          <Field label="Precio de venta" required>
            <input type="number" min="0" step="0.01" value={form.price} onChange={update('price')} required />
          </Field>
          <Field label="Costo">
            <input type="number" min="0" step="0.01" value={form.cost} onChange={update('cost')} />
          </Field>
          <Field label="Stock mínimo">
            <input type="number" min="0" step="1" value={form.minStock} onChange={update('minStock')} />
          </Field>
          <Field label="Existencias actuales">
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={update('stock')}
              disabled={!form.trackStock}
            />
          </Field>
          <div className="field field-span-2 checkbox-row">
            <label className="check-control">
              <input type="checkbox" checked={form.trackStock} onChange={update('trackStock')} />
              <span>Controlar inventario</span>
            </label>
            <label className="check-control">
              <input type="checkbox" checked={form.active} onChange={update('active')} />
              <span>Producto activo</span>
            </label>
          </div>
          {error && <div className="field-span-2"><InlineError error={{ message: errorMessage(error) }} /></div>}
        </form>
      </Modal>
    </div>
  );
}
