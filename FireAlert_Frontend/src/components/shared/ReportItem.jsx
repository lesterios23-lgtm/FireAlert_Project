import React from 'react';
import StatusBadge from './StatusBadge';

export default function ReportItem({ report, selected, onSelect }) {
  return (
    <div
      className={`report-item ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(report)}
    >
      <div className='report-priority'>🔥</div>
      <div className='report-info'>
        <div className='report-address'>
          {report.incidentAddress || 'No address provided'}
        </div>
        <div className='report-meta'>
          <span className='report-id'>#{report.id}</span>
          <span className='report-time'>
            {new Date(report.reportedAt || report.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <StatusBadge status={report.status} />
    </div>
  );
}