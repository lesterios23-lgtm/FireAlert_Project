import React, { useEffect, useRef } from 'react';

export default function LogoutConfirmModal({ open, userName, onCancel, onConfirm }) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className='modal-overlay' onClick={handleOverlayClick} data-testid='logout-confirm-overlay'>
      <div
        className='modal-dialog logout-confirm-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='logout-confirm-title'
        aria-describedby='logout-confirm-description'
      >
        <div className='logout-confirm-icon' aria-hidden='true'>
          <span>⏻</span>
        </div>
        <h2 id='logout-confirm-title'>Sign out?</h2>
        <p id='logout-confirm-description'>
          {userName ? `${userName}, are you sure` : 'Are you sure'} you want to sign out of FireAlert? You will need to sign in again to continue.
        </p>
        <div className='modal-actions logout-confirm-actions'>
          <button type='button' className='btn btn-outline modal-cancel' onClick={onCancel}>
            Cancel
          </button>
          <button
            type='button'
            ref={confirmButtonRef}
            className='btn btn-primary modal-confirm-danger'
            onClick={onConfirm}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
