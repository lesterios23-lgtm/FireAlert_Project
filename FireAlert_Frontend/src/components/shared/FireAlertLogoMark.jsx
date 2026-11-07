import React from 'react';

export default function FireAlertLogoMark({ className }) {
  return (
    <span className={className} aria-hidden='true'>
      <svg viewBox='0 0 24 24' focusable='false'>
        <path
          fill='currentColor'
          d='M13.4 1.5c.3 3.1-1 5.2-3.1 7.3-1.6 1.6-2.8 3.3-2.8 5.8a4.5 4.5 0 0 0 9 0c0-.7-.2-1.4-.5-2 2 1.4 3.3 3.7 3.3 6.2a7.3 7.3 0 0 1-14.6 0c0-3.6 2.1-6.1 4.3-8.5 2.1-2.4 4.1-4.7 4.4-8.8Z'
        />
      </svg>
    </span>
  );
}
