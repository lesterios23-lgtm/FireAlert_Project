import React from 'react';

const STAGES = [
  { key: 'submitted', label: 'Report Submitted' },
  { key: 'received', label: 'Report Received' },
  { key: 'dispatched', label: 'Firetruck Dispatched' },
  { key: 'en-route', label: 'En Route' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'resolved', label: 'Incident Resolved' },
];

const STATUS_PROGRESS = {
  pending: 0,
  accepted: 1,
  responding: 3,
  resolved: 5,
};

export default function TrackingTimeline({ status, reportedAt }) {
  const progress = STATUS_PROGRESS[status];
  const rejected = status === 'rejected';

  return (
    <div className='tracking-timeline'>
      {STAGES.map((stage, index) => {
        const done = Number.isInteger(progress) && index < progress;
        const active = Number.isInteger(progress) && index === progress;
        const stageClass = rejected && index === 1
          ? 'rejected'
          : done
            ? 'done'
            : active
              ? 'active'
              : 'pending';

        return (
          <div className={`timeline-stage ${stageClass}`} key={stage.key}>
            <div className='stage-dot'>{done ? '✓' : rejected && index === 1 ? '!' : index + 1}</div>
            <div>
              <div className='stage-label'>{rejected && index === 1 ? 'Report Rejected' : stage.label}</div>
              <div className='stage-time'>
                {index === 0 && reportedAt
                  ? new Date(reportedAt).toLocaleString()
                  : done
                    ? 'Completed · time not recorded'
                    : active
                      ? 'Current report status'
                      : 'Awaiting update'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
