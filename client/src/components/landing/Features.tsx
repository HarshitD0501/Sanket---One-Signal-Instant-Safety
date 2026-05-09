import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const features = [
  'One-Tap SOS',
  'WhatsApp + Voice Alerts',
  'Live GPS Tracking',
  'Safe Zones',
  'Shareable Tracking',
];

gsap.registerPlugin(ScrollTrigger);

export default function Features() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const header = gsap.utils.toArray<HTMLElement>('.features-intro > *');
      const rows = gsap.utils.toArray<HTMLElement>('.feature-row');

      gsap.set(header, { opacity: 0, y: 42 });
      gsap.set(rows, { opacity: 0, y: 48 });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 72%',
          end: 'top 28%',
          toggleActions: 'play none none reverse',
        },
      });

      timeline
        .to(header, {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power3.out',
        })
        .to(
          rows,
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.1,
            ease: 'power3.out',
          },
          '-=0.28',
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="features-section" id="features" ref={sectionRef}>
      <div className="features-intro">
        <div className="section-badge">Features</div>
        <h2 className="section-title">Everything You Need to Stay Safe</h2>
        <p className="section-subtitle">
          Each safety tool is available instantly, with a cleaner flow from the hero into the details.
        </p>
      </div>

      <div className="features-flow-list">
        {features.map((feature) => (
          <article key={feature} className="feature-row">
            <div className="feature-row-title-wrap" aria-hidden="true">
              <div className="feature-row-title-track">
                <span className="feature-row-title">{feature}</span>
                <span className="feature-row-dot" />
                <span className="feature-row-title ghost">{feature}</span>
                <span className="feature-row-dot" />
                <span className="feature-row-title ghost">{feature}</span>
                <span className="feature-row-dot" />
                <span className="feature-row-title ghost">{feature}</span>
              </div>
            </div>
            <h3 className="sr-only">{feature}</h3>
          </article>
        ))}
      </div>
    </section>
  );
}
