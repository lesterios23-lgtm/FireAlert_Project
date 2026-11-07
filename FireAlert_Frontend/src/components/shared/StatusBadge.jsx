import React from 'react';

export default function StatusBadge({ status }) {
  const config = {
    pending: { label: 'Pending', className: 'pending' },
    accepted: { label: 'Accepted', className: 'accepted' },
    responding: { label: 'Responding', className: 'responding' },
    resolved: { label: 'Resolved', className: 'resolved' },
    rejected: { label: 'Rejected', className: 'rejected' },
  };

  const item = config[status] || { label: status || 'Unknown', className: '' };

  return (
    <span className={`status-badge ${item.className}`}>
      {item.label}
    </span>
  );
}