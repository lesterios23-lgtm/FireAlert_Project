import React from 'react';

export default function StatCard({ label, value, color, icon }) {
  return (
    <div className='stat-card'>
      <div className='stat-icon'>{icon}</div>
      <div className='stat-label'>{label}</div>
      <div className='stat-value' style={{ color }}>{value}</div>
    </div>
  );
}