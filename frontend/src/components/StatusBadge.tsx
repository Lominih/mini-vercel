import React from 'react';

type Status = 'queued' | 'building' | 'ready' | 'failed';

interface StatusBadgeProps {
  status: Status;
  label?: string;
}

const statusLabels: Record<Status, string> = {
  queued: 'Queued',
  building: 'Building',
  ready: 'Ready',
  failed: 'Failed',
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${status}`}>
      {label || statusLabels[status]}
    </span>
  );
}
