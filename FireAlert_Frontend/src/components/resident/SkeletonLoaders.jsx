import React from 'react';

export function SkeletonBlock({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  style = {},
  className = '',
}) {
  return (
    <span
      className={`resident-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden='true'
    />
  );
}

export function SkeletonHistoryCard() {
  return (
    <article className='resident-skeleton-card' aria-hidden='true'>
      <div className='resident-skeleton-row' style={{ justifyContent: 'space-between', marginBottom: '10px' }}>
        <SkeletonBlock width='120px' height='13px' />
        <SkeletonBlock width='88px' height='20px' borderRadius='12px' />
      </div>
      <SkeletonBlock width='75%' height='19px' style={{ marginBottom: '8px' }} />
      <SkeletonBlock width='95%' height='13px' style={{ marginBottom: '5px' }} />
      <SkeletonBlock width='60%' height='13px' style={{ marginBottom: '14px' }} />
      <div className='resident-skeleton-row' style={{ justifyContent: 'flex-start' }}>
        <SkeletonBlock width='130px' height='16px' borderRadius='4px' />
      </div>
    </article>
  );
}

export function SkeletonHistoryList({ count = 3 }) {
  return (
    <div className='resident-skeleton-list' aria-busy='true' aria-label='Loading reports history'>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonHistoryCard key={idx} />
      ))}
    </div>
  );
}

export function SkeletonTrackingScreen() {
  return (
    <div className='resident-page resident-skeleton-page' aria-busy='true' aria-label='Loading incident response tracking'>
      <div className='resident-page-heading' style={{ marginBottom: '14px' }}>
        <div>
          <SkeletonBlock width='130px' height='13px' style={{ marginBottom: '6px' }} />
          <SkeletonBlock width='210px' height='26px' />
        </div>
        <SkeletonBlock width='96px' height='26px' borderRadius='14px' />
      </div>

      <div className='resident-skeleton-card' style={{ marginBottom: '14px' }}>
        <div className='resident-skeleton-row' style={{ gap: '12px' }}>
          <SkeletonBlock width='40px' height='40px' borderRadius='50%' style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SkeletonBlock width='60%' height='16px' style={{ marginBottom: '6px' }} />
            <SkeletonBlock width='90%' height='12px' />
          </div>
        </div>
      </div>

      <div className='resident-skeleton-card' style={{ padding: '8px', marginBottom: '14px' }}>
        <SkeletonBlock width='100%' height='210px' borderRadius='8px' />
      </div>

      <div className='resident-skeleton-card'>
        <SkeletonBlock width='140px' height='16px' style={{ marginBottom: '14px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className='resident-skeleton-row'>
            <SkeletonBlock width='20px' height='20px' borderRadius='50%' style={{ flexShrink: 0 }} />
            <SkeletonBlock width='80%' height='14px' />
          </div>
          <div className='resident-skeleton-row'>
            <SkeletonBlock width='20px' height='20px' borderRadius='50%' style={{ flexShrink: 0 }} />
            <SkeletonBlock width='65%' height='14px' />
          </div>
          <div className='resident-skeleton-row'>
            <SkeletonBlock width='20px' height='20px' borderRadius='50%' style={{ flexShrink: 0 }} />
            <SkeletonBlock width='50%' height='14px' />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonHomeScreen() {
  return (
    <div className='resident-page resident-home resident-skeleton-page' aria-busy='true' aria-label='Loading resident home'>
      <div className='resident-home-welcome'>
        <SkeletonBlock width='120px' height='13px' style={{ marginBottom: '6px' }} />
        <SkeletonBlock width='220px' height='28px' style={{ marginBottom: '6px' }} />
        <SkeletonBlock width='280px' height='15px' />
      </div>

      <div className='resident-skeleton-card' style={{ height: '74px', marginBottom: '14px' }}>
        <SkeletonBlock width='100%' height='100%' borderRadius='8px' />
      </div>

      <div className='resident-skeleton-card' style={{ height: '190px', marginBottom: '14px' }}>
        <SkeletonBlock width='100%' height='100%' borderRadius='8px' />
      </div>

      <div className='resident-skeleton-card' style={{ height: '140px' }}>
        <SkeletonBlock width='100%' height='100%' borderRadius='8px' />
      </div>
    </div>
  );
}

export function ResidentAppSkeleton() {
  return (
    <div className='resident-app' aria-busy='true' aria-label='Loading FireAlert application'>
      <header className='resident-topbar'>
        <div className='resident-brand'>
          <SkeletonBlock width='32px' height='32px' borderRadius='8px' style={{ flexShrink: 0 }} />
          <div>
            <SkeletonBlock width='85px' height='15px' style={{ marginBottom: '4px' }} />
            <SkeletonBlock width='70px' height='10px' />
          </div>
        </div>
        <SkeletonBlock width='34px' height='34px' borderRadius='50%' />
      </header>

      <main className='resident-content'>
        <SkeletonHomeScreen />
      </main>
    </div>
  );
}
