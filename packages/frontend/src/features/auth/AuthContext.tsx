import { createContext, useContext, useEffect, useState } from 'react';
import { OrganizationDto, AppUserDto } from '@ozimai/shared';
import { api, getToken, setToken } from '../../lib/api';
import { reconnectSocketWithToken } from '../../lib/useConversationsSocket';

interface AuthState {
  user: Pick<AppUserDto, 'id' | 'email' | 'role' | 'displayName'> | null;
  org: Pick<OrganizationDto, 'id' | 'name' | 'plan' | 'locale' | 'billingStatus'> | null;
  loading: boolean;
  requestMagicLink: (email: string, orgName?: string) => Promise<{ devMagicLink: string }>;
  verify: (token: string) => Promise<void>;
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

  const requestMagicLink = (email: string, orgName?: string) => api.post<{ devMagicLink: string }>('/auth/magic-link', { email, orgName });

  const verify = async (token: string) => {
    const res = await api.post<{ accessToken: string; user: AuthState['user']; org: AuthState['org'] }>('/auth/verify', { token });
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

  return <AuthContext.Provider value={{ user, org, loading, requestMagicLink, verify, logout }}>{children}</AuthContext.Provider>;
}
