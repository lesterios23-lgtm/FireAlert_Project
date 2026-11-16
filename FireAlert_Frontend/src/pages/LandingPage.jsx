import React from 'react';
import FireAlertLogoMark from '../components/shared/FireAlertLogoMark';
import '../styles/landing.css';

const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'For residents', href: '#who' },
  { label: 'For BFP personnel', href: '#who' },
  { label: 'Safety tips', href: '#safety' },
];

const HOW_CARDS = [
  {
    step: '1',
    title: 'Sign in',
    body: "Residents register once. Reports are tied to the account so you can find them later.",
  },
  {
    step: '2',
    title: 'Pin the location',
    body: 'Use your device location or drop a pin on the map, then describe what is happening.',
  },
  {
    step: '3',
    title: 'BFP responds',
    body: 'BFP personnel see the report on the dashboard map, assign a firetruck, and update the status.',
  },
  {
    step: '4',
    title: 'Follow the status',
    body: 'Open your report to see where it stands. Refresh to get the latest stage.',
  },
];

const STATUS_STAGES = [
  'Report Submitted',
  'Report Received',
  'Firetruck Dispatched',
  'En Route',
  'Arrived',
  'Incident Resolved',
];

const RESIDENT_POINTS = [
  'Report a fire with a pinned location and a short description',
  "See each report's status as BFP updates it",
  'Keep a history of your own reports',
  'Install it from the browser: open the page, then choose Add to Home screen',
];

const BFP_POINTS = [
  'Incoming report queue with search and filters',
  'Map pins for each reported location',
  'Assign a firetruck and update the response status',
  'Incident records kept for later review',
];

const SAFETY_STEPS = [
  {
    step: '1',
    title: 'Get out and stay out.',
    body: ' Do not go back inside for belongings.',
  },
  {
    step: '2',
    title: 'Call 911 from a safe place.',
    body: " FireAlert adds a record and a location pin; it does not replace the call.",
  },
  {
    step: '3',
    title: 'Then send the report.',
    body: ' Do not approach the fire to take a photo.',
  },
];

export default function LandingPage() {
  const reportHref = '/login';
  const signInHref = '/login';

  return (
    <div className='landing-page'>
      <a className='landing-skip-link' href='#landing-main'>
        Skip to main content
      </a>

      {/* emergency strip */}
      <div className='landing-strip'>
        <div className='landing-container landing-strip-inner'>
          <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#c92a2a' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <path d='M12 3 2 21h20L12 3z' />
            <path d='M12 10v5' />
            <path d='M12 18h.01' />
          </svg>
          <span>
            <strong>Fire happening now?</strong> Get to safety and call 911 first. FireAlert is for reporting and tracking. It does not replace calling for help.
          </span>
        </div>
      </div>

      {/* header */}
      <header className='landing-header'>
        <div className='landing-container landing-header-inner'>
          <a href='/#top' className='landing-brand'>
            <span className='landing-brand-mark'>
              <FireAlertLogoMark className='landing-brand-logo' />
            </span>
            <span className='landing-brand-text'>
              <span className='landing-brand-name'>FireAlert</span>
              <span className='landing-brand-sub'>BFP Mansalay</span>
            </span>
          </a>
          <nav aria-label='Main' className='landing-nav'>
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href}>{link.label}</a>
            ))}
          </nav>
          <div className='landing-header-actions'>
            <a className='landing-button landing-button-outline' href={signInHref}>BFP login</a>
            <a className='landing-button landing-button-red' href={reportHref}>Report a fire</a>
          </div>
        </div>
      </header>

      <main id='landing-main'>
        {/* hero */}
        <section id='top' className='landing-hero'>
          <div className='landing-container landing-hero-inner'>
            <div className='landing-hero-copy'>
              <span className='landing-hero-badge'>Bureau of Fire Protection, Mansalay, Oriental Mindoro</span>
              <h1>
                Report a fire.
                <br />
                Follow the response.
              </h1>
              <p>
                Residents send a fire report with a pinned location from their phone browser. BFP Mansalay receives it on one dashboard, dispatches, and updates the status you can follow until the incident is resolved.
              </p>
              <div id='report' className='landing-hero-actions'>
                <a className='landing-button landing-button-red landing-button-large' href={reportHref}>
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                    <path d='M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z' />
                    <circle cx='12' cy='9.5' r='2.5' />
                  </svg>
                  Report a fire
                </a>
                <a className='landing-button landing-button-outline landing-button-large' href={signInHref}>
                  Sign in to track a report
                </a>
              </div>
              <p className='landing-hero-note'>
                Works in your phone's browser. No app store. Add it to your home screen to install it like an app.
              </p>
            </div>

            {/* phone mockup */}
            <div className='landing-hero-phone'>
              <div className='landing-phone'>
                <div className='landing-phone-topbar'>
                  <span>FireAlert</span>
                  <span className='landing-phone-topbar-profile'>Profile</span>
                </div>
                <div className='landing-phone-body'>
                  <div className='landing-phone-status'>
                    <div className='landing-phone-status-ref'>FA-000123 · YOUR EMERGENCY REPORT</div>
                    <div className='landing-phone-status-label'>En route</div>
                  </div>
                  <div className='landing-phone-map' role='img' aria-label='Map view of the reported fire location'>
                    <svg width='30' height='30' viewBox='0 0 24 24' fill='#c92a2a' aria-hidden='true'>
                      <path d='M12 22s-7-6.2-7-12A7 7 0 0 1 19 10c0 5.8-7 12-7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' />
                    </svg>
                  </div>
                  <div className='landing-phone-progress'>
                    <div className='landing-phone-progress-title'>RESPONSE PROGRESS</div>
                    {STATUS_STAGES.map((stage, index) => {
                      const done = index < 3;
                      const active = index === 3;
                      return (
                        <div key={stage} className={`landing-phone-stage${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}>
                          <span className='landing-phone-stage-dot'>
                            {done && (
                              <svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='#fff' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                                <path d='M5 12l5 5L20 7' />
                              </svg>
                            )}
                            {active && <span className='landing-phone-stage-center' />}
                          </span>
                          <span className='landing-phone-stage-label'>{stage}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <span className='landing-phone-caption'>Sample screen. Sample reference number.</span>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id='how' className='landing-how'>
          <div className='landing-container landing-how-inner'>
            <div className='landing-section-copy'>
              <h2>How a report moves</h2>
              <p>
                Four steps from the resident's phone to the BFP response, and back to the resident as status updates.
              </p>
            </div>
            <div className='landing-how-grid'>
              {HOW_CARDS.map((card) => (
                <article key={card.step} className='landing-card-step'>
                  <span className='landing-step-num'>{card.step}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
            <div className='landing-status-row'>
              <span className='landing-status-row-label'>Status stages:</span>
              {STATUS_STAGES.map((stage, index) => (
                <span
                  key={stage}
                  className={`landing-chip${index === STATUS_STAGES.length - 1 ? ' landing-chip-resolved' : ''}`}
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* two audiences */}
        <section id='who' className='landing-audiences'>
          <div className='landing-container landing-audiences-inner'>
            <article className='landing-audience-card landing-audience-residents'>
              <span className='landing-audience-eyebrow'>FOR RESIDENTS</span>
              <h2>A mobile app in your browser</h2>
              <ul>
                {RESIDENT_POINTS.map((point) => (
                  <li key={point}>
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#17745a' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                      <path d='M5 12l5 5L20 7' />
                    </svg>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <a className='landing-button landing-button-red landing-button-medium' href={reportHref}>
                Open the resident app
              </a>
            </article>
            <article className='landing-audience-card landing-audience-bfp'>
              <span className='landing-audience-eyebrow'>FOR BFP PERSONNEL</span>
              <h2>One dashboard for every report</h2>
              <ul>
                {BFP_POINTS.map((point) => (
                  <li key={point}>
                    <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='#7fd6b4' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                      <path d='M5 12l5 5L20 7' />
                    </svg>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <a className='landing-button landing-button-white landing-button-medium' href={signInHref}>
                BFP login
              </a>
              <span className='landing-audience-note'>
                Accounts for BFP personnel are created by the BFP administrator.
              </span>
            </article>
          </div>
        </section>

        {/* safety + roadmap */}
        <section id='safety' className='landing-safety'>
          <div className='landing-container landing-safety-inner'>
            <div className='landing-safety-copy'>
              <h2>Before you report</h2>
              <div className='landing-safety-steps'>
                {SAFETY_STEPS.map((item) => (
                  <div key={item.step} className='landing-safety-step'>
                    <span className='landing-safety-num'>{item.step}</span>
                    <p><strong>{item.title}</strong>{item.body}</p>
                  </div>
                ))}
              </div>
              <p className='landing-hotline'>
                BFP Mansalay hotline: <strong>0915-603-1507</strong> · <strong>0921-850-7600</strong>. Fire happening now? Call 911 first.
              </p>
            </div>
            <aside className='landing-roadmap'>
              <span className='landing-roadmap-badge'>Planned, not yet available</span>
              <h3>High-risk area view</h3>
              <p>
                A ranking of barangays by past fire incidents for BFP planning. It needs BFP's historical incident records first, so it stays off until that data is loaded and checked.
              </p>
            </aside>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className='landing-footer'>
        <div className='landing-container landing-footer-inner'>
          <div className='landing-footer-brand'>
            <span className='landing-footer-name'>FireAlert</span>
            <span>
              Fire emergency reporting and incident records for the Bureau of Fire Protection, Mansalay, Oriental Mindoro.
            </span>
          </div>
          <div className='landing-footer-meta'>
            <span>Capstone project, Mindoro State University, Bongabong Campus</span>
            <span>Rios, Lester Jhon M. · Guray, Piolo E. · Casihan, John Avril</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
