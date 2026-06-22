import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: string;
  change?: number;
  subtitle?: string;
}

export default function MetricCard({ label, value, icon, change, subtitle }: MetricCardProps) {
  return (
    <div className="section" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{value}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {icon && (
          <div style={{ fontSize: 24, opacity: 0.5 }}>{icon}</div>
        )}
      </div>
      {change !== undefined && (
        <div style={{ marginTop: 8, fontSize: 13, color: change >= 0 ? 'var(--success)' : 'var(--error)' }}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last period
        </div>
      )}
    </div>
  );
}
