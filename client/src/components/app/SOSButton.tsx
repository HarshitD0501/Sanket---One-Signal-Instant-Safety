import MagicRings from './MagicRings';

interface SOSButtonProps {
  onTrigger: () => void;
  isActive: boolean;
  isPending?: boolean;
  onResolve: () => void;
  disabled: boolean;
}

export default function SOSButton({ onTrigger, isActive, isPending = false, onResolve, disabled }: SOSButtonProps) {
  const showActiveState = isActive || isPending;

  return (
    <div className={`sos-container ${showActiveState ? 'sos-container-active' : ''}`}>
      <div className="sos-magic-rings" aria-hidden="true">
        <MagicRings
          color={showActiveState ? '#00D4AA' : '#dd0303'}
          colorTwo={showActiveState ? '#00F5C8' : '#f80000'}
          speed={1}
          ringCount={6}
          attenuation={10}
          lineThickness={2}
          baseRadius={0.35}
          radiusStep={0.1}
          scaleRate={0.1}
          opacity={1}
          noiseAmount={0.1}
          rotation={0}
          ringGap={1.5}
          fadeIn={0.7}
          fadeOut={0.5}
          followMouse={false}
          hoverScale={1.2}
          clickBurst
        />
      </div>
      {showActiveState ? (
        <button
          className="sos-btn active"
          onClick={onResolve}
          disabled={disabled || isPending}
        >
          {isPending ? 'TRIGGERING' : "I'M SAFE"}
        </button>
      ) : (
        <button
          className="sos-btn"
          onClick={onTrigger}
          disabled={disabled}
        >
          SOS
        </button>
      )}
    </div>
  );
}
