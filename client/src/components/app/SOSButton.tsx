interface SOSButtonProps {
  onTrigger: () => void;
  isActive: boolean;
  onResolve: () => void;
  disabled: boolean;
}

export default function SOSButton({ onTrigger, isActive, onResolve, disabled }: SOSButtonProps) {
  return (
    <div className="sos-container">
      {isActive ? (
        <button
          className="sos-btn active"
          onClick={onResolve}
          disabled={disabled}
        >
          I'M SAFE
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
