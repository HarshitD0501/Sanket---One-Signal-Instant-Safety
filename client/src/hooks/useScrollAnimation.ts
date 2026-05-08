import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollAnimationOptions {
  trigger?: string;
  start?: string;
  end?: string;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale';
  stagger?: number;
  children?: boolean;
}

export default function useScrollAnimation(opts: ScrollAnimationOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const {
      start = 'top 85%',
      animation = 'fade-up',
      stagger = 0.15,
      children = false,
    } = opts;

    const targets = children ? ref.current.children : [ref.current];

    const fromVars: gsap.TweenVars = { opacity: 0 };
    if (animation === 'fade-up') fromVars.y = 40;
    if (animation === 'fade-left') fromVars.x = -40;
    if (animation === 'fade-right') fromVars.x = 40;
    if (animation === 'scale') { fromVars.scale = 0.9; }

    gsap.fromTo(targets, fromVars, {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      duration: 0.8,
      stagger: children ? stagger : 0,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: ref.current,
        start,
        toggleActions: 'play none none none',
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return ref;
}
