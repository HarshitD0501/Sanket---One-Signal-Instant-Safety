import { useEffect, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const steps = [
  {
    num: '01',
    title: 'Register & Add Contacts',
    desc: 'Create your account and add trusted emergency contacts with their phone numbers.',
  },
  {
    num: '02',
    title: 'Press SOS',
    desc: 'In an emergency, tap the big red button to alert your trusted contacts instantly.',
  },
  {
    num: '03',
    title: 'Contacts Alerted Instantly',
    desc: 'Contacts receive a WhatsApp message with your live location and an automated voice call.',
  },
  {
    num: '04',
    title: 'Live Tracking Until Safe',
    desc: 'Your GPS location streams in real time. Tap "I\'m Safe" when the danger passes.',
  },
];

gsap.registerPlugin(ScrollTrigger);

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !stackRef.current) return;

    const ctx = gsap.context(() => {
      const intro = sectionRef.current!.querySelector<HTMLElement>('.how-intro');
      const eyebrow = sectionRef.current!.querySelector<HTMLElement>('.how-kicker');
      const cards = gsap.utils.toArray<HTMLElement>('.scroll-stack-card');
      const introItems = [
        eyebrow,
        intro?.querySelector<HTMLElement>('.section-title'),
        intro?.querySelector<HTMLElement>('.section-subtitle'),
      ].filter(Boolean) as HTMLElement[];

      gsap.set(cards, {
        y: 56,
        opacity: 0.86,
        scale: (index: number) => 1 - index * 0.018,
        transformOrigin: 'top center',
      });

      gsap.fromTo(
        introItems,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 76%',
            toggleActions: 'play none none reverse',
          },
        },
      );

      cards.forEach((card, index) => {
        if (index === 0) {
          gsap.to(card, {
            y: 0,
            opacity: 1,
            scale: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              start: 'top 88%',
              end: 'top 42%',
              scrub: 0.55,
            },
          });
        }

        if (index > 0) {
          const previousCard = cards[index - 1];
          const isFinalHandoff = index === cards.length - 1;

          gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: isFinalHandoff ? 'top 68%' : 'top 62%',
              end: isFinalHandoff ? 'top 22%' : 'top 30%',
              scrub: isFinalHandoff ? 0.9 : 0.65,
            },
          })
            .to(previousCard, {
              y: isFinalHandoff ? -10 : -14,
              scale: isFinalHandoff ? 0.93 : 0.945,
              opacity: isFinalHandoff ? 0.78 : 0.74,
              ease: 'none',
            }, 0)
            .to(card, {
              y: 0,
              scale: 1 - index * 0.008,
              opacity: 1,
              ease: 'none',
            }, 0);
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="how-section" id="how-it-works" ref={sectionRef}>
      <div className="how-intro">
        <span className="how-kicker">How It Works</span>
        <h2 className="section-title features-title-red">Simple When It Matters Most</h2>
        <p className="section-subtitle">
          Four steps between you and instant help. Designed for panic situations - no thinking required.
        </p>
      </div>

      <div className="scroll-stack" ref={stackRef}>
        {steps.map((step, index) => (
          <article
            key={step.num}
            className="scroll-stack-card"
            style={{ '--stack-index': index } as CSSProperties}
          >
            <div className="scroll-stack-card__number">{step.num}</div>
            <div className="scroll-stack-card__content">
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
