import { useEffect } from 'react';
import Icon from './Icon';

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Field({ label, hint, error, children, span = 1, required }) {
  return (
    <label className={`field field-span-${span}`}>
      <span className="field-label">
        {label}
        {required && <span className="field-required">*</span>}
      </span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Modal({ open, title, eyebrow, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    available: ['Disponible', 'green'],
    occupied: ['Ocupada', 'wine'],
    cleaning: ['Limpieza', 'amber'],
    maintenance: ['Mantenimiento', 'neutral'],
    confirmed: ['Confirmada', 'green'],
    checked_in: ['En casa', 'wine'],
    checked_out: ['Finalizada', 'neutral'],
    cancelled: ['Cancelada', 'neutral'],
    no_show: ['No asistió', 'amber'],
    scheduled: ['Programada', 'amber'],
    in_progress: ['En consulta', 'wine'],
    completed: ['Completada', 'green'],
    paid: ['Pagada', 'green'],
    pending: ['Pendiente', 'amber'],
    owner: ['Propietario', 'wine'],
    admin: ['Administrador', 'green'],
    staff: ['Equipo', 'neutral'],
    active: ['Activo', 'green'],
    inactive: ['Inactivo', 'neutral'],
  };
  const [label, tone] = map[status] ?? [
    String(status ?? '—').replace(/_/g, ' '),
    'neutral',
  ];
  return (
    <span className={`pill pill-${tone}`}>
      <span className="pill-dot" />
      {label}
    </span>
  );
}

export function EmptyState({ icon = 'leaf', title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4, className = '' }) {
  return (
    <div className={`skeleton-stack ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index} style={{ width: `${100 - index * 4}%` }} />
      ))}
    </div>
  );
}

export function InlineError({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-error">
      <Icon name="alert" size={18} />
      <div>
        <strong>No se pudo completar</strong>
        <span>{error.message || String(error)}</span>
      </div>
    </div>
  );
}

export function Notice({ tone = 'green', title, children }) {
  return (
    <div className={`alert alert-${tone}`}>
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={18} />
      <div>
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
    </div>
  );
}
