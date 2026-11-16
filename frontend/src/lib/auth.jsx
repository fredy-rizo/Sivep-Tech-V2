import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  api,
  clearSession,
  getToken,
  readStoredTenant,
  readStoredUser,
  saveSession,
} from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [tenant, setTenant] = useState(() => readStoredTenant());
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setTenant(null);
  }, []);

  const applySession = useCallback((session) => {
    saveSession(session);
    if (session.user) setUser(session.user);
    if (session.tenant) setTenant(session.tenant);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('sivep:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sivep:unauthorized', onUnauthorized);
  }, [logout]);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const response = await api('/auth/me');
        if (!alive) return;
        setUser(response.data.user);
        setTenant(response.data.tenant);
        saveSession(response.data);
      } catch {
        if (alive) {
          clearSession();
          setUser(null);
          setTenant(null);
        }
      } finally {
        if (alive) setReady(true);
      }
    }
    bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(
    async (credentials) => {
      const response = await api('/auth/login', { method: 'POST', body: credentials, token: null });
      applySession(response.data);
      return response.data;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const response = await api('/public/register', { method: 'POST', body: payload, token: null });
      applySession(response.data);
      return response.data;
    },
    [applySession],
  );

  const updateTenant = useCallback((nextTenant) => {
    setTenant(nextTenant);
    saveSession({ tenant: nextTenant });
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
    saveSession({ user: nextUser });
  }, []);

  const value = useMemo(
    () => ({
      user,
      tenant,
      ready,
      isAuthenticated: Boolean(user && tenant && getToken()),
      isAdmin: ['owner', 'admin'].includes(user?.role),
      isOwner: user?.role === 'owner',
      login,
      register,
      logout,
      updateTenant,
      updateUser,
      currency: tenant?.settings?.currency || 'COP',
    }),
    [user, tenant, ready, login, register, logout, updateTenant, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
