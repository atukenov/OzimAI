import { createContext, useContext, useEffect, useState } from 'react';
import { OrganizationDto, AppUserDto } from '@ozimai/shared';
import { api, getToken, setToken } from '../../lib/api';
import { reconnectSocketWithToken } from '../../lib/useConversationsSocket';

interface AuthState {
  user: (Pick<AppUserDto, 'id' | 'email' | 'role' | 'displayName'> & { isSuperAdmin?: boolean }) | null;
  org: Pick<OrganizationDto, 'id' | 'name' | 'logo' | 'plan' | 'locale' | 'billingStatus'> | null;
  loading: boolean;
  requestCode: (email: string, orgName?: string) => Promise<{ sent: true; devCode?: string }>;
  verify: (email: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null);
  const [org, setOrg] = useState<AuthState['org']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: AuthState['user']; org: AuthState['org'] }>('/auth/me')
      .then((res) => {
        setUser(res.user);
        setOrg(res.org);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const requestCode = (email: string, orgName?: string) =>
    api.post<{ sent: true; devCode?: string }>('/auth/request-code', { email, orgName });

  const verify = async (email: string, code: string) => {
    const res = await api.post<{ accessToken: string; user: AuthState['user']; org: AuthState['org'] }>('/auth/verify', { email, code });
    setToken(res.accessToken);
    reconnectSocketWithToken();
    setUser(res.user);
    setOrg(res.org);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrg(null);
    reconnectSocketWithToken();
  };

  return <AuthContext.Provider value={{ user, org, loading, requestCode, verify, logout }}>{children}</AuthContext.Provider>;
}
