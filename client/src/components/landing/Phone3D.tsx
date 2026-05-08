import { useEffect, useState } from 'react';

const messages = [
  {
    text: '🚨 *SOS ALERT from Sanket!*\n\n*Harshit* needs help RIGHT NOW!\n\n📍 *Location:* Tiwariganj, Faizabad road, SRMCEM College Rd, Uttar Pradesh 226028, India\n🗺️ *Map:* maps.google.com/?q=26.89...\n\n🔴 *Live Tracking:* sanket.app/track/eeb...\n\n🕐 *Time:* 8/5/2026, 2:05:52 pm\n📞 *Contact:* +9118001035298\n\n*Please check on them immediately!*',
    time: '2:05 PM',
    delay: 600,
  },
  {
    text: '✅ *All Clear — Sanket Update*\n\n*Harshit* has marked themselves as SAFE.\n\n🕐 *Time:* 8/5/2026, 2:06:23 pm\n\n*The emergency alert has been resolved.*',
    time: '2:06 PM',
    delay: 4500,
  },
];

function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (line === '') return <br key={i} />;
    const parts = line.split(/\*(.*?)\*/g);
    return (
      <span key={i} style={{ display: 'block' }}>
        {parts.map((p, j) =>
          j % 2 === 1 ? <b key={j}>{p}</b> : <span key={j}>{p}</span>
        )}
      </span>
    );
  });
}

export default function Phone3D() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = messages.map((m, i) =>
      setTimeout(() => setVisible(i + 1), m.delay)
    );
    // Loop
    const loop = setTimeout(() => {
      setVisible(0);
      setTimeout(() => setVisible(1), 600);
      setTimeout(() => setVisible(2), 4500);
    }, 9000);
    return () => { timers.forEach(clearTimeout); clearTimeout(loop); };
  }, []);

  return (
    <div className="phone-mockup-wrapper">
      <div className="phone-glow" />
      <div className="phone-frame">
        <div className="phone-notch"><div className="phone-camera" /></div>
        <div className="phone-screen">
          {/* WhatsApp header */}
          <div className="wh-bar">
            <span className="wh-back">←</span>
            <div className="wh-avatar">S</div>
            <div style={{ flex: 1 }}>
              <div className="wh-name">Sanket</div>
              <div className="wh-status">online</div>
            </div>
            <span className="wh-actions">⋮</span>
          </div>

          {/* Chat */}
          <div className="wh-chat">
            {messages.map((m, i) => (
              <div key={i} className={`wh-bubble ${i < visible ? 'in' : ''}`}>
                <div className="wh-text">{renderText(m.text)}</div>
                <span className="wh-time">{m.time}</span>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="wh-input">
            <div className="wh-field">Message</div>
            <div className="wh-mic">🎙</div>
          </div>
        </div>
      </div>

      <div className="floating-badge badge-1">📍 Live Location Shared</div>
      <div className="floating-badge badge-2">📞 Voice Call Active</div>
      <div className="floating-badge badge-3">✅ 3 Contacts Notified</div>
    </div>
  );
}
