import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

export default function SOSButton({ onTrigger, isActive, onResolve, disabled }) {
  const containerRef = useRef(null);

  useGSAP(() => {
    if (!isActive) {
      gsap.to('.sos-btn-ring', {
        scale: 1.1,
        opacity: 0.2,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.4,
      });
    }
  }, { scope: containerRef, dependencies: [isActive] });

  const handleClick = () => {
    if (disabled) return;
    if (isActive) {
      onResolve?.();
    } else {
      onTrigger?.();
    }
  };

  return (
    <div className="sos-container" ref={containerRef}>
      <div className="sos-btn-wrapper">
        <div className="sos-btn-ring" />
        <div className="sos-btn-ring" />
        <div className="sos-btn-ring" />
        <button
          className={`sos-btn ${isActive ? 'active' : ''}`}
          onClick={handleClick}
          disabled={disabled}
          id="sos-trigger-button"
        >
          {isActive ? 'SAFE' : 'SOS'}
        </button>
      </div>
      <span className="sos-label">
        {isActive ? 'Tap to mark yourself safe' : 'Tap to trigger emergency alert'}
      </span>
    </div>
  );
}
