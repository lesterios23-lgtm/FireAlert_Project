import React, { useState, useEffect } from 'react';
import EmptyState from '../shared/EmptyState';

export default function HighRiskPrediction() {
  const [available, setAvailable] = useState(null);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    // Check if prediction model is available
    // Per design requirements: do not fabricate prediction results
    // Display unavailable state when no model output exists
    setAvailable(false);
    setPredictions([]);
  }, []);

  if (available === false) {
    return (
      <div className='resident-screen'>
        <div className='section-header'>
          <h3>High-Risk Fire Incident Locations</h3>
        </div>

        <div className='empty-state'>
          <div className='empty-state-icon'>🔮</div>
          <h3 className='empty-state-title'>Prediction Model Unavailable</h3>
          <p className='empty-state-description'>
            The high-risk fire location prediction model is not yet available or has no historical data to generate predictions.
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginTop: '1rem' }}>
            <strong>Important:</strong> Predictions are estimates only and do not automatically trigger emergency dispatch.
          </p>
        </div>

        <div className='card'>
          <div className='card-header'>
            <h3>Model Information</h3>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: '1.6' }}>
            <p><strong>Model Version:</strong> Not available</p>
            <p><strong>Prediction Date:</strong> Not available</p>
            <p><strong>Prediction Period:</strong> Not available</p>
            <p><strong>Risk Classification:</strong> Not available</p>
            <p><strong>Historical Incident Summary:</strong> Not available</p>
            <p style={{ marginTop: '1rem', color: 'var(--red)', fontSize: '0.8125rem' }}>
              No prediction data to display. The model will show results here once trained and available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='resident-screen'>
      <div className='section-header'>
        <h3>High-Risk Fire Incident Locations</h3>
      </div>

      <div className='resident-map'>
        <div className='map-placeholder'>
          <div className='map-placeholder-icon'>🗺️</div>
          <h3>Prediction Map</h3>
          <p>Map will show predicted high-risk fire locations.</p>
        </div>
      </div>

      <div className='card'>
        <div className='card-header'>
          <h3>Prediction Details</h3>
        </div>
        {predictions.map((p) => (
          <div key={p.id} className='card' style={{ marginBottom: '1rem' }}>
            <div className='detail-field'>
              <label>Location</label>
              <span>{p.location}</span>
            </div>
            <div className='detail-field'>
              <label>Risk Level</label>
              <span>{p.riskLevel}</span>
            </div>
            <div className='detail-field'>
              <label>Prediction Date</label>
              <span>{p.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}