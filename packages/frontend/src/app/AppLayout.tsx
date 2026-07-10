import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ConversationDto } from '@ozimai/shared';
import { api } from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import './layout.css';

const NAV_ITEMS = [
  { to: '/dialogues', label: 'Диалоги', icon: '💬' },
  { to: '/calendar', label: 'Календарь', icon: '📅' },
  { to: '/patients', label: 'Пациенты', icon: '👤' },
  { to: '/ai', label: '✦ Айым', icon: '✦' },
  { to: '/reports', label: 'Отчёты', icon: '📊' },
];

export function AppLayout() {
  const { user, org, logout } = useAuth();

  const { data: attention } = useQuery({
    queryKey: ['conversations', 'attention'],
    queryFn: () => api.get<ConversationDto[]>('/conversations?filter=attention'),
    refetchInterval: 15_000,
  });
  const attentionCount = attention?.length ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-wordmark">
            Ozim<span style={{ color: 'var(--accent-600)' }}>AI</span>
          </div>
          <div className="type-small" style={{ marginTop: 4 }}>
            {org?.name}
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span>{item.label}</span>
              {item.to === '/dialogues' && attentionCount > 0 && <span className="nav-badge">{attentionCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar-circle">{(user?.displayName ?? user?.email ?? '?')[0]?.toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="type-small" style={{ color: 'var(--text-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName ?? user?.email}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Выйти">
            ⎋
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="tab-bar">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `tab-bar-item ${isActive ? 'active' : ''}`}>
            <span>{item.icon}</span>
            <span>{item.label.replace('✦ ', '')}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
