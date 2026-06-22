import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/projects', label: 'Projects', icon: '📁' },
  { to: '/deployments', label: 'Deployments', icon: '🚀' },
  { to: '/domains', label: 'Domains', icon: '🌐' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <nav
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 22 }}>▲</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Mini Vercel</span>
      </div>
      <div style={{ padding: '16px 12px', flex: 1 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 2,
              transition: 'all 0.15s',
            })}
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        Mini Vercel v1.0
      </div>
    </nav>
  );
}
