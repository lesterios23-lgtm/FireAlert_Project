import React, { useState } from 'react';

const SAFETY_TABS = [
  { id: 'prevent', label: 'Prevent fires', icon: '🛡️' },
  { id: 'warning', label: 'Warning signs', icon: '⚠️' },
  { id: 'firstaid', label: 'Burn first aid', icon: '⛑️' },
];

const SAFETY_CONTENT = {
  prevent: {
    heading: 'Fire prevention tips',
    intro: 'Based on BFP Mansalay Fire Station guidance — Be alert. Be prepared. Prevent fires.',
    tips: [
      { icon: '🔥', title: 'Keep matches and lighters away from children', detail: 'Store them in locked cabinets, out of reach and out of sight.' },
      { icon: '🍳', title: 'Never leave cooking unattended', detail: 'Stay in the kitchen while frying, grilling, or boiling. Turn handles inward.' },
      { icon: '🔌', title: 'Check electrical wires and avoid overloaded outlets', detail: 'Replace frayed cords, unplug unused appliances, and use one high-wattage device per outlet.' },
      { icon: '🕯️', title: 'Keep candles away from curtains and flammables', detail: 'Blow out candles before leaving a room or sleeping. Keep a 1-meter clearance.' },
      { icon: '🧯', title: 'Keep a fire extinguisher accessible and know how to use it', detail: 'Remember PASS: Pull the pin, Aim low, Squeeze the lever, Sweep side to side.' },
      { icon: '📞', title: 'In case of fire, evacuate immediately and call 911', detail: 'Get out first, stay out, then call for help. Never go back inside.' },
    ],
    footer: 'Plan two escape routes from every room and practice them with your family.',
  },
  warning: {
    heading: 'Fire warning signs to watch for',
    intro: 'Act early — these signs may mean a fire or electrical fault is starting.',
    tips: [
      { icon: '👃', title: 'Burning or unusual smells', detail: 'A sharp, acrid, or plastic-like odor near outlets or appliances means turn off power and investigate.' },
      { icon: '💡', title: 'Flickering lights or tripping breakers', detail: 'Repeated breaker trips, dimming lights, or buzzing outlets signal overloaded or faulty wiring.' },
      { icon: '🔥', title: 'Discolored outlets or warm plugs', detail: 'Scorch marks, melted plastic, or heat on cords and plugs — unplug and have them checked.' },
      { icon: '💨', title: 'Smoke or haze indoors', detail: 'Even light smoke is an emergency. Evacuate, stay low, and call 911 right away.' },
      { icon: '⚡', title: 'Sparking or crackling sounds', detail: 'Sparks from outlets, switches, or wires need immediate attention — cut power if it is safe.' },
      { icon: '🌡️', title: 'Unusually hot appliances or walls', detail: 'Hot wall areas near wiring may indicate hidden fire. Leave the area and call for help.' },
    ],
    footer: 'If in doubt, evacuate first and report — BFP Mansalay would rather respond to a false alarm.',
  },
  firstaid: {
    heading: 'First aid for fire injuries',
    intro: 'For serious burns, smoke inhalation, or collapse — call 911 immediately.',
    tips: [
      { icon: '🧊', title: 'Cool minor burns with running water', detail: 'Hold under cool (not ice-cold) running water for at least 20 minutes. Remove jewelry near the burn.' },
      { icon: '🩹', title: 'Cover burns loosely', detail: 'Use a clean, non-stick bandage or cloth. Do not pop blisters or apply toothpaste, butter, or oil.' },
      { icon: '🚭', title: 'Move to fresh air for smoke exposure', detail: 'Smoke inhalation is dangerous. Get to fresh air, stay seated, and watch for coughing or dizziness.' },
      { icon: '🛑', title: 'Stop, drop, and roll for burning clothes', detail: 'Smother flames with a blanket or coat. Cool the skin with water afterward.' },
      { icon: '🫀', title: 'Check breathing and call 911', detail: 'If someone collapses or stops breathing normally, call 911 and start CPR if trained.' },
      { icon: '🏥', title: 'Seek care for major burns', detail: 'Burns larger than the palm, on the face/hands/joints, or with white/charred skin need a hospital — do not delay.' },
    ],
    footer: 'This is general guidance, not medical advice. Always follow emergency responders’ instructions.',
  },
};

export default function FireSafetyTips() {
  const [activeTab, setActiveTab] = useState('prevent');
  const content = SAFETY_CONTENT[activeTab];

  return (
    <section className='resident-safety' aria-labelledby='safety-tips-heading'>
      <div className='resident-safety-header'>
        <div>
          <p className='resident-eyebrow'>BFP Mansalay · #ThinkFireSafetyNow</p>
          <h2 id='safety-tips-heading'>Fire safety tips</h2>
        </div>
        <span className='resident-safety-badge' aria-hidden='true'>🔥</span>
      </div>

      <div className='resident-safety-tabs' role='tablist' aria-label='Fire safety topics'>
        {SAFETY_TABS.map((tab) => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            aria-selected={activeTab === tab.id}
            aria-controls={`safety-panel-${tab.id}`}
            id={`safety-tab-${tab.id}`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            <span aria-hidden='true'>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className='resident-safety-panel'
        role='tabpanel'
        id={`safety-panel-${activeTab}`}
        aria-labelledby={`safety-tab-${activeTab}`}
      >
        <h3 className='resident-safety-panel-heading'>{content.heading}</h3>
        <p className='resident-safety-intro'>{content.intro}</p>
        <ul className='resident-safety-list'>
          {content.tips.map((tip) => (
            <li key={tip.title}>
              <span className='resident-safety-tip-icon' aria-hidden='true'>{tip.icon}</span>
              <div>
                <strong>{tip.title}</strong>
                <p>{tip.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className='resident-safety-footer'>{content.footer}</p>
      </div>
    </section>
  );
}
