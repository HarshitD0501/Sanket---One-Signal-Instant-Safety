import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const features = [
  {
    label: 'SOS',
    title: 'One-Tap SOS',
    description: 'A single emergency action alerts trusted contacts with the details they need.',
    className: 'magic-bento-card--sos',
  },
  {
    label: 'Alerts',
    title: 'WhatsApp + Voice',
    description: 'Bilingual WhatsApp messages and automated voice calls reach contacts fast.',
    className: 'magic-bento-card--alerts',
  },
  {
    label: 'Live',
    title: 'GPS Tracking',
    description: 'Real-time location sharing keeps responders updated with a movement trail.',
    className: 'magic-bento-card--gps',
  },
  {
    label: 'Nearby',
    title: 'Safe Zones',
    description: 'Police stations and hospitals are surfaced nearby so help is easier to find.',
    className: 'magic-bento-card--zones',
  },
  {
    label: 'Share',
    title: 'Public Tracking',
    description: 'Contacts can open a secure tracking link without creating an account.',
    className: 'magic-bento-card--share',
  },
];

gsap.registerPlugin(ScrollTrigger);

const glowColor = '255, 59, 92';
const spotlightRadius = 280;

export default function Features() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const header = gsap.utils.toArray<HTMLElement>('.features-intro > *');
      const cards = gsap.utils.toArray<HTMLElement>('.magic-bento-card');

      gsap.set(header, { opacity: 0, y: 42 });
      gsap.set(cards, { opacity: 0, y: 48 });

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
          cards,
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
          },
          '-=0.28',
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleGridMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll<HTMLElement>('.magic-bento-card'));

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
      const intensity = Math.max(0, 1 - distance / spotlightRadius);
      const relativeX = ((event.clientX - rect.left) / rect.width) * 100;
      const relativeY = ((event.clientY - rect.top) / rect.height) * 100;

      card.style.setProperty('--glow-x', `${relativeX}%`);
      card.style.setProperty('--glow-y', `${relativeY}%`);
      card.style.setProperty('--glow-intensity', intensity.toString());
    });
  };

  const handleGridMouseLeave = () => {
    gridRef.current?.querySelectorAll<HTMLElement>('.magic-bento-card').forEach((card) => {
      card.style.setProperty('--glow-intensity', '0');
      gsap.to(card, {
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        duration: 0.45,
        ease: 'power3.out',
      });
    });
  };

  const handleCardMouseMove = (event: MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateX = ((y / rect.height) - 0.5) * -7;
    const rotateY = ((x / rect.width) - 0.5) * 7;

    gsap.to(card, {
      x: (x - rect.width / 2) * 0.025,
      y: (y - rect.height / 2) * 0.025,
      rotateX,
      rotateY,
      transformPerspective: 900,
      duration: 0.28,
      ease: 'power2.out',
    });
  };

  const handleCardMouseLeave = (event: MouseEvent<HTMLElement>) => {
    gsap.to(event.currentTarget, {
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      duration: 0.45,
      ease: 'power3.out',
    });
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height),
    );

    const ripple = document.createElement('span');
    ripple.className = 'magic-bento-ripple';
    ripple.style.width = `${maxDistance * 2}px`;
    ripple.style.height = `${maxDistance * 2}px`;
    ripple.style.left = `${x - maxDistance}px`;
    ripple.style.top = `${y - maxDistance}px`;

    card.appendChild(ripple);

    gsap.fromTo(
      ripple,
      { scale: 0, opacity: 1 },
      {
        scale: 1,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        onComplete: () => ripple.remove(),
      },
    );
  };

  return (
    <section className="features-section" id="features" ref={sectionRef}>
      <div className="features-intro">
        <h2 className="section-title features-title-red">Safety Tools at a Glance</h2>
        <p className="section-subtitle">
          A compact safety command center with responsive cards, cursor glow, and click feedback.
        </p>
      </div>

      <div
        className="magic-bento-grid"
        ref={gridRef}
        onMouseMove={handleGridMouseMove}
        onMouseLeave={handleGridMouseLeave}
        style={{ '--glow-color': glowColor } as CSSProperties}
      >
        {features.map((feature) => (
          <article
            key={feature.title}
            className={`magic-bento-card ${feature.className ?? ''}`}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            onClick={handleCardClick}
          >
            <div className="magic-bento-card__header">
              <span className="magic-bento-card__label">{feature.label}</span>
              <span className="magic-bento-card__orb" aria-hidden="true" />
            </div>
            {feature.title === 'GPS Tracking' && (
              <div className="gps-map-preview">
                <img
                  src="https://assets-prod.sumo.prod.webservices.mozgcp.net/media/uploads/images/2018-02-21-15-54-54-01ca35.png"
                  alt=""
                />
              </div>
            )}
            <div className="magic-bento-card__content">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
