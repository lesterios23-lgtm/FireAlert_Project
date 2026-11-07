import React, { useEffect, useState } from 'react';
import MapContainer from '../shared/MapContainer';
import { apiRequest, normalizeReport } from '../../sharedApi';

const INITIAL_FORM = {
  incidentAddress: '',
  incidentDescription: '',
  accessNotes: '',
  latitude: '',
  longitude: '',
  locationSource: 'manual',
  fireSize: 'medium',
};

export default function EmergencyReportScreen({ onReportSubmitted }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [geolocationLoading, setGeolocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [evidencePhoto, setEvidencePhoto] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState('');

  useEffect(() => {
    if (!evidencePhoto) {
      setEvidencePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(evidencePhoto);
    setEvidencePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [evidencePhoto]);

  const updateForm = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const selectMapLocation = ({ latitude, longitude }) => {
    setForm((current) => ({
      ...current,
      latitude: String(latitude),
      longitude: String(longitude),
      locationSource: 'manual',
    }));
  };

  const selectEvidencePhoto = (event) => {
    const file = event.target.files?.[0] || null;
    setError('');

    if (!file) {
      setEvidencePhoto(null);
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = '';
      setError('Choose a JPG, PNG, or WebP image for incident evidence.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setError('The evidence photo must be 5 MB or smaller.');
      return;
    }

    setEvidencePhoto(file);
  };

  const useCurrentLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Location services are not supported by this browser. Enter the address or coordinates instead.');
      return;
    }

    setGeolocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          locationSource: 'device',
          incidentAddress: current.incidentAddress || 'Current device location',
        }));
        setGeolocationLoading(false);
      },
      (locationError) => {
        setError(locationError.code === 1
          ? 'Location access was denied. Tap the map to place the pin manually.'
          : locationError.message || 'Unable to retrieve your location. Tap the map to place the pin manually.');
        setGeolocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submitReport = async (event) => {
    event.preventDefault();
    const hasLatitude = form.latitude.trim() !== '';
    const hasLongitude = form.longitude.trim() !== '';
    if (!form.incidentDescription.trim()) {
      setError('Describe what is happening before submitting the report.');
      return;
    }
    if (hasLatitude !== hasLongitude) {
      setError('Enter both latitude and longitude, or use an incident address.');
      return;
    }
    if (!form.incidentAddress.trim() && !hasLatitude) {
      setError('Enter an incident address or select a location.');
      return;
    }
    if (hasLatitude && (
      Number(form.latitude) < -90 || Number(form.latitude) > 90
      || Number(form.longitude) < -180 || Number(form.longitude) > 180
      || !Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude))
    )) {
      setError('Enter valid latitude and longitude coordinates.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const additionalDetails = [
        `Estimated fire size: ${form.fireSize}.`,
        form.accessNotes.trim() ? `Access notes: ${form.accessNotes.trim()}` : null,
      ].filter(Boolean);
      const description = [
        form.incidentDescription.trim(),
        ...additionalDetails,
      ].join('\n\n');
      const reportBody = new FormData();
      reportBody.set('data', JSON.stringify({
        type: 'fire_report',
        attributes: {
          incidentDescription: description,
          incidentAddress: form.incidentAddress.trim() || null,
          ...(form.latitude && form.longitude ? {
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
            locationSource: form.locationSource,
          } : {}),
        },
      }));
      if (evidencePhoto) {
        reportBody.set('evidencePhoto', evidencePhoto);
      }

      const payload = await apiRequest('/reports', {
        method: 'POST',
        body: reportBody,
      });

      const submittedReport = normalizeReport(payload);
      setForm(INITIAL_FORM);
      setEvidencePhoto(null);
      onReportSubmitted(submittedReport);
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit the emergency report.');
    } finally {
      setLoading(false);
    }
  };

  const locationMarkers = form.latitude && form.longitude
    ? [{ id: 'report-location', lat: form.latitude, lng: form.longitude }]
    : [];
  const mapSelection = form.latitude && form.longitude
    ? { latitude: form.latitude, longitude: form.longitude }
    : null;

  return (
    <div className='resident-page'>
      <div className='resident-page-heading'>
        <div>
          <p className='resident-eyebrow'>Emergency reporting</p>
          <h1>Report a fire</h1>
        </div>
        <span className='resident-location-tag'>BFP Mansalay</span>
      </div>

      <div className='resident-warning' role='note'>
        <span aria-hidden='true'>⚠</span>
        <div>
          <strong>Move to safety before reporting</strong>
          <p>Do not approach the fire or put yourself at risk to take a photo.</p>
        </div>
      </div>

      <form className='resident-report-form' onSubmit={submitReport}>
        <section className='resident-form-section'>
          <div className='resident-section-heading'>
            <div><h2>Fire location</h2><p>Share the address or your device location.</p></div>
            <span className='location-mode'>{form.locationSource === 'device' ? 'Device location' : 'Manual selection'}</span>
          </div>

          <button type='button' className='resident-location-button' onClick={useCurrentLocation} disabled={geolocationLoading}>
            {geolocationLoading ? 'Getting location…' : '◎  Use my location'}
          </button>

          <label className='resident-field'>
            <span>Address or landmark <em>*</em></span>
            <input
              type='text'
              name='incidentAddress'
              value={form.incidentAddress}
              onChange={updateForm}
              placeholder='Enter a street, barangay, or nearby landmark'
              required={!form.latitude || !form.longitude}
            />
          </label>

          <details className='resident-coordinate-details'>
            <summary>Enter coordinates manually</summary>
            <div className='resident-coordinate-fields'>
              <label className='resident-field'>
                <span>Latitude</span>
                <input type='number' name='latitude' value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value, locationSource: 'manual' }))} min='-90' max='90' step='any' />
              </label>
              <label className='resident-field'>
                <span>Longitude</span>
                <input type='number' name='longitude' value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value, locationSource: 'manual' }))} min='-180' max='180' step='any' />
              </label>
            </div>
          </details>

          <MapContainer
            markers={locationMarkers}
            selected={mapSelection}
            height='195px'
            onLocationSelect={selectMapLocation}
          />
          <p className='resident-map-help'>Use my location or tap the map to place the pin. Drag the pin to adjust it; you can also enter coordinates manually.</p>
          {form.latitude && form.longitude && (
            <p className='resident-coordinate-caption'>Selected location: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</p>
          )}
        </section>

        <section className='resident-form-section'>
          <div className='resident-section-heading'>
            <div><h2>What is happening?</h2><p>Provide details that help responders assess the situation.</p></div>
          </div>
          <label className='resident-field'>
            <span>Incident description <em>*</em></span>
            <textarea
              name='incidentDescription'
              value={form.incidentDescription}
              onChange={updateForm}
              placeholder='Describe what is burning, visible smoke, and any immediate hazards.'
              required
              rows='4'
            />
          </label>

          <fieldset className='resident-fire-size'>
            <legend>Fire size · best estimate (optional)</legend>
            <div>
              {['small', 'medium', 'large'].map((size) => (
                <button
                  type='button'
                  key={size}
                  className={form.fireSize === size ? 'active' : ''}
                  aria-pressed={form.fireSize === size}
                  onClick={() => setForm((current) => ({ ...current, fireSize: size }))}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className='resident-field'>
            <span>Landmark or access notes (optional)</span>
            <textarea
              name='accessNotes'
              value={form.accessNotes}
              onChange={updateForm}
              placeholder='Nearby landmarks or the best way for responders to reach the location.'
              rows='2'
            />
          </label>

          <label className='resident-evidence-upload'>
            <span className='resident-evidence-heading'>Incident photo evidence <small>Optional · JPG, PNG, or WebP · up to 5 MB</small></span>
            <span className='resident-evidence-picker'>
              <span aria-hidden='true'>＋</span>
              <span>{evidencePhoto ? 'Choose a different photo' : 'Take or choose a photo'}</span>
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                capture='environment'
                onChange={selectEvidencePhoto}
                aria-label='Incident photo evidence'
              />
            </span>
            {evidencePreview && (
              <span className='resident-evidence-preview'>
                <img src={evidencePreview} alt='Selected incident evidence preview' />
                <button type='button' onClick={() => setEvidencePhoto(null)}>Remove photo</button>
              </span>
            )}
          </label>
        </section>

        {error && <div className='resident-form-error' role='alert'>{error}</div>}
        <button type='submit' className='resident-submit-button' disabled={loading}>
          {loading ? 'Submitting report…' : 'Submit emergency report'}
        </button>
        <p className='resident-privacy-note'>Your report and location go to authorized BFP personnel. Internet is required; call emergency services if unavailable.</p>
      </form>
    </div>
  );
}
