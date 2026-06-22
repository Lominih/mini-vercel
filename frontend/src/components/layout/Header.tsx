import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, removeToken, User } from '../../api/client';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {});
  }, []);

  function handleLogout() {
    removeToken();
    navigate('/login');
  }

  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <header
      style={{
        height: 'var(--header-height)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 32px',
        background: 'var(--bg-primary)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {initial}
          </div>
          <span style={{ fontSize: 14 }}>{user?.name || user?.email || 'User'}</span>
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 4,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              minWidth: 180,
              padding: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {user && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
            )}
            <button
              onClick={() => { setMenuOpen(false); navigate('/settings'); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 14,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: 'var(--error)',
                fontSize: 14,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
