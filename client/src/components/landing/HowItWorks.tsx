import { useEffect, useRef } from 'react';

const steps = [
  { num: 1, title: 'Register & Add Contacts', desc: 'Create your account and add your trusted emergency contacts with their phone numbers.' },
  { num: 2, title: 'Press SOS or Shake', desc: 'In an emergency, tap the big red button or simply shake your phone — even from your pocket.' },
  { num: 3, title: 'Contacts Alerted Instantly', desc: 'Your contacts receive a WhatsApp message with your live location AND an automated voice call.' },
  { num: 4, title: 'Live Tracking Until Safe', desc: 'Your GPS location is streamed in real-time. Tap "I\'m Safe" when the danger passes.' },
];

export default function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.3 }
    );

    const items = stepsRef.current?.querySelectorAll('.timeline-step');
    items?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="how-section" id="how-it-works">
      <div className="section-badge">✦ How It Works</div>
      <h2 className="section-title">Simple When It Matters Most</h2>
      <p className="section-subtitle">
        Four steps between you and instant help. Designed for panic situations — no thinking required.
      </p>
      <div className="timeline" ref={stepsRef}>
        {steps.map((s) => (
          <div key={s.num} className="timeline-step">
            <div className="timeline-number">{s.num}</div>
            <div className="timeline-content">
              <h3 className="timeline-title">{s.title}</h3>
              <p className="timeline-desc">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
