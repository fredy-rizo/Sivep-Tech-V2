import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { date, dateTime, money, number } from '../lib/format';
import { VERTICALS } from '../lib/verticals';
import Icon from '../components/Icon';
import { EmptyState, InlineError, PageHeader, Skeleton, StatusPill } from '../components/ui';

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function SeriesChart({ series, currency }) {
  const max = Math.max(...series.map((point) => point.total), 1);
  const total = series.reduce((sum, point) => sum + point.total, 0);
  return (
    <div className="chart-block">
      <div className="chart-head">
        <div>
          <p className="eyebrow">Últimos 7 días</p>
          <p className="chart-total">{money(total, currency)}</p>
        </div>
        <span className="chart-note">Ingresos registrados</span>
      </div>
      <div className="bar-chart">
        {series.map((point) => {
          const parsed = new Date(`${point.date}T12:00:00`);
          const height = point.total > 0 ? Math.max(6, (point.total / max) * 100) : 2;
          return (
            <div className="bar-column" key={point.date} title={`${date(point.date)}: ${money(point.total, currency)}`}>
              <div className="bar-track">
                <div
                  className={`bar-fill${point.total === 0 ? ' empty' : ''}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span>{DAY_LABELS[parsed.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerticalPulse({ tenant, summary, currency }) {
  const vertical = tenant.vertical;
  const data = summary.vertical ?? {};

  if (vertical === 'hotel') {
    return (
      <>
        <div className="occupancy">
          <div className="occupancy-copy">
            <span className="big-number">{data.occupancy ?? 0}%</span>
            <span>de ocupación<br />en este momento</span>
          </div>
          <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.min(data.occupancy ?? 0, 100)}%` }} />
          </div>
        </div>
        <div className="mini-stats">
          <div><strong>{data.available ?? 0}</strong><span>Disponibles</span></div>
          <div><strong>{data.arrivalsToday ?? 0}</strong><span>Llegadas hoy</span></div>
          <div><strong>{data.departuresToday ?? 0}</strong><span>Salidas hoy</span></div>
          <div><strong>{data.upcoming ?? 0}</strong><span>Próximas</span></div>
        </div>
      </>
    );
  }

  if (vertical === 'farmacia') {
    return (
      <div className="alert-list">
        <div className="alert-row alert-amber">
          <Icon name="clock" size={18} />
          <div><strong>{data.expiringSoon ?? 0}</strong><span>Lotes vencen en 60 días</span></div>
        </div>
        <div className="alert-row alert-wine">
          <Icon name="alert" size={18} />
          <div><strong>{data.expired ?? 0}</strong><span>Lotes vencidos con existencias</span></div>
        </div>
        <div className="alert-row">
          <Icon name="flask" size={18} />
          <div><strong>{data.batches ?? 0}</strong><span>Lotes activos</span></div>
        </div>
        <Link to="/app/lotes" className="text-link">Revisar lotes <Icon name="arrowRight" size={15} /></Link>
      </div>
    );
  }

  if (vertical === 'veterinaria') {
    return (
      <div className="mini-stats mini-stats-2">
        <div><strong>{data.appointmentsToday ?? 0}</strong><span>Citas para hoy</span></div>
        <div><strong>{data.pending ?? 0}</strong><span>Por atender</span></div>
        <div><strong>{data.pets ?? 0}</strong><span>Pacientes activos</span></div>
        <div><strong>{data.completedMonth ?? 0}</strong><span>Completadas este mes</span></div>
      </div>
    );
  }

  return (
    <div className="mini-stats mini-stats-2">
      <div><strong>{number(data.stockUnits ?? 0)}</strong><span>Unidades en inventario</span></div>
      <div><strong>{data.categories ?? 0}</strong><span>Categorías activas</span></div>
      <div><strong>{summary.products}</strong><span>Productos activos</span></div>
      <div><strong>{summary.lowStock}</strong><span>Por reponer</span></div>
    </div>
  );
}

export default function DashboardPage() {
  const { tenant, user, currency } = useAuth();
  const vertical = VERTICALS[tenant.vertical];

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard').then((response) => response.data),
  });

  const lowStock = useQuery({
    queryKey: ['products', 'low-stock'],
    queryFn: () => api('/products?lowStock=true&active=true').then((response) => response.data),
  });

  const summary = dashboard.data;
  const firstName = user?.name?.split(' ')[0] ?? '';

  if (dashboard.isLoading) {
    return (
      <div className="page">
        <PageHeader eyebrow="Resumen" title={`${greeting()}, ${firstName}.`} />
        <div className="kpi-grid">
          {[0, 1, 2, 3].map((item) => (
            <div className="kpi-card" key={item}><Skeleton rows={3} /></div>
          ))}
        </div>
        <div className="panel"><Skeleton rows={6} /></div>
      </div>
    );
  }

  if (dashboard.isError) {
    return (
      <div className="page">
        <PageHeader eyebrow="Resumen" title="No pudimos cargar el resumen" />
        <InlineError error={dashboard.error} />
      </div>
    );
  }

  const salesToday = summary.salesToday ?? 0;
  const salesNote = salesToday === 1 ? '1 venta registrada' : `${salesToday} ventas registradas`;

  const cards = {
    hotel: [
      { label: 'Ingresos de hoy', value: money(summary.revenueToday, currency), note: salesNote },
      { label: 'Ocupación', value: `${summary.vertical.occupancy ?? 0}%`, note: `${summary.vertical.occupied ?? 0} de ${summary.vertical.rooms ?? 0} habitaciones` },
      { label: 'Disponibles', value: summary.vertical.available ?? 0, note: 'Listas para recibir' },
      { label: 'Llegadas hoy', value: summary.vertical.arrivalsToday ?? 0, note: `${summary.vertical.departuresToday ?? 0} salidas previstas` },
    ],
    farmacia: [
      { label: 'Ingresos de hoy', value: money(summary.revenueToday, currency), note: salesNote },
      { label: 'Ventas del mes', value: summary.salesMonth, note: money(summary.revenueMonth, currency) },
      { label: 'Por vencer', value: summary.vertical.expiringSoon ?? 0, note: 'Lotes en los próximos 60 días' },
      { label: 'Stock bajo', value: summary.lowStock, note: 'Productos por reponer' },
    ],
    veterinaria: [
      { label: 'Ingresos de hoy', value: money(summary.revenueToday, currency), note: salesNote },
      { label: 'Citas de hoy', value: summary.vertical.appointmentsToday ?? 0, note: `${summary.vertical.pending ?? 0} por atender` },
      { label: 'Pacientes', value: summary.vertical.pets ?? 0, note: 'Con historia activa' },
      { label: 'Stock bajo', value: summary.lowStock, note: 'Insumos por reponer' },
    ],
    tienda: [
      { label: 'Ingresos de hoy', value: money(summary.revenueToday, currency), note: salesNote },
      { label: 'Ventas del mes', value: summary.salesMonth, note: money(summary.revenueMonth, currency) },
      { label: 'Unidades en stock', value: number(summary.vertical.stockUnits ?? 0), note: `${summary.products} productos activos` },
      { label: 'Stock bajo', value: summary.lowStock, note: 'Productos por reponer' },
    ],
  }[tenant.vertical];

  return (
    <div className="page">
      <PageHeader
        eyebrow={`Resumen · ${vertical.short}`}
        title={`${greeting()}, ${firstName}.`}
        description={`Así va ${tenant.name} hoy. ${date(new Date())}.`}
        actions={
          <Link to="/app/ventas" className="btn btn-primary">
            <Icon name="plus" size={17} />
            Registrar venta
          </Link>
        }
      />

      <section className="kpi-grid">
        {cards.map((card) => (
          <article className="kpi-card" key={card.label}>
            <p className="kpi-label">{card.label}</p>
            <p className="kpi-value">{card.value}</p>
            <p className="kpi-note">{card.note}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Ritmo de la semana</p>
              <h2>Ingresos recientes</h2>
            </div>
            <Link to="/app/ventas" className="text-link">
              Ver ventas <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          <SeriesChart series={summary.series} currency={currency} />
        </section>

        <section className="panel panel-tinted">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Pulso de hoy</p>
              <h2>{vertical.dashboardTitle}</h2>
            </div>
          </div>
          <VerticalPulse tenant={tenant} summary={summary} currency={currency} />
        </section>
      </div>

      <div className="dashboard-grid lower">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Movimientos</p>
              <h2>Últimas ventas</h2>
            </div>
          </div>
          {summary.recentSales.length === 0 ? (
            <EmptyState
              icon="cart"
              title="Aún no hay ventas"
              description="Registra la primera venta desde el módulo de ventas."
              action={<Link to="/app/ventas" className="btn btn-outline">Ir a ventas</Link>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Comprobante</th>
                    <th>Cliente</th>
                    <th>Hora</th>
                    <th>Estado</th>
                    <th className="align-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td><span className="mono">{sale.number}</span></td>
                      <td>{sale.customerName || 'Consumidor final'}</td>
                      <td className="muted">{dateTime(sale.createdAt)}</td>
                      <td><StatusPill status={sale.status} /></td>
                      <td className="align-right strong">{money(sale.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Inventario</p>
              <h2>Por reponer</h2>
            </div>
            <Link to="/app/productos" className="text-link">
              Productos <Icon name="arrowRight" size={15} />
            </Link>
          </div>
          {lowStock.isLoading ? (
            <Skeleton rows={4} />
          ) : lowStock.data?.length ? (
            <ul className="stock-list">
              {lowStock.data.slice(0, 6).map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category || 'Sin categoría'}</span>
                  </div>
                  <div className="stock-count">
                    <strong>{number(product.stock, 0)}</strong>
                    <span>{product.unit}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="box"
              title="Inventario al día"
              description="No hay productos por debajo del mínimo."
            />
          )}
        </section>
      </div>
    </div>
  );
}
