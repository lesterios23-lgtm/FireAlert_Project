import React from 'react';
import logo from '../../assets/firealert-logo-new.png';

export default function FireAlertLogoMark({ className }) {
  return (
    <span className={className} aria-hidden='true'>
      <img src={logo} alt='' className='firealert-logo-img' />
    </span>
  );
}
