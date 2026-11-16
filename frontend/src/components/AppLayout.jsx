import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { initials } from '../lib/format';
import { VERTICALS } from '../lib/verticals';
import Icon from './Icon';

function NavItem({ to, label, icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === '/app'}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, tenant, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const vertical = VERTICALS[tenant?.vertical] ?? VERTICALS.tienda;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <button
        type="button"
        className="sidebar-scrim"
        aria-label="Cerrar menú"
        onClick={() => setMenuOpen(false)}
      />

      <aside className="sidebar">
        <Link to="/app" className="sidebar-brand" onClick={() => setMenuOpen(false)}>
          <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" className="brand-mark" />
          <div className="brand-copy">
            <span className="brand-name">
              SIVEP <em>Tech</em>
            </span>
            <span className="brand-sub">Sistema a la medida</span>
          </div>
        </Link>

        <div className="tenant-card">
          <p className="tenant-eyebrow">{vertical.eyebrow}</p>
          <p className="tenant-name">{tenant?.name}</p>
          <div className="tenant-meta">
            <span className="tenant-slug">{tenant?.slug}</span>
            <span className={`mini-badge mini-${tenant?.vertical}`}>{vertical.short}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <p className="nav-label">Operación</p>
            <NavItem to="/app" label="Resumen" icon="dashboard" onNavigate={() => setMenuOpen(false)} />
            <NavItem to="/app/ventas" label="Ventas" icon="cart" onNavigate={() => setMenuOpen(false)} />
            {vertical.nav
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
          </div>

          <div className="nav-group">
            <p className="nav-label">Base</p>
            <NavItem
              to="/app/productos"
              label={tenant?.vertical === 'hotel' ? 'Productos y servicios' : 'Productos'}
              icon="box"
              onNavigate={() => setMenuOpen(false)}
            />
            <NavItem to="/app/clientes" label="Clientes" icon="users" onNavigate={() => setMenuOpen(false)} />
          </div>

          <div className="nav-group">
            <p className="nav-label">Sistema</p>
            {isAdmin && (
              <NavItem
                to="/app/usuarios"
                label="Usuarios"
                icon="user"
                onNavigate={() => setMenuOpen(false)}
              />
            )}
            <NavItem to="/app/ajustes" label="Ajustes" icon="settings" onNavigate={() => setMenuOpen(false)} />
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{initials(user?.name)}</span>
            <div className="user-chip-copy">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <button type="button" className="icon-button logout-button" onClick={logout} title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="app-area">
        <header className="mobile-bar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" size={22} />
          </button>
          <div className="mobile-brand">
            <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="" />
            <span>SIVEP Tech</span>
          </div>
          <span className="avatar avatar-small">{initials(user?.name)}</span>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
