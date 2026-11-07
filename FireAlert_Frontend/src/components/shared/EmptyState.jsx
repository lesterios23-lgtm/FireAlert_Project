import React from 'react';

export default function EmptyState({ title, description, icon = '📋', actionLabel, onAction }) {
  return (
    <div className='empty-state'>
      <div className='empty-state-icon'>{icon}</div>
      <h3 className='empty-state-title'>{title}</h3>
      <p className='empty-state-description'>{description}</p>
      {actionLabel && onAction && (
        <button className='btn btn-primary' onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}