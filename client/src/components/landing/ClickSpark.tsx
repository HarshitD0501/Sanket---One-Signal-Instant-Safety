import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  extraScale?: number;
  className?: string;
  fixed?: boolean;
  children: ReactNode;
}

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

const getEase = (easing: ClickSparkProps['easing']) => {
  if (easing === 'linear') return (t: number) => t;
  if (easing === 'ease-in') return (t: number) => t * t;
  if (easing === 'ease-in-out') {
    return (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  }
  return (t: number) => 1 - Math.pow(1 - t, 3);
};

export default function ClickSpark({
  sparkColor = '#fff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1,
  className = '',
  fixed = false,
  children,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animationRef = useRef<number | null>(null);
  const ease = getEase(easing);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) {
      animationRef.current = null;
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const now = performance.now();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = sparkColor;

    sparksRef.current = sparksRef.current.filter((spark) => {
      const progress = Math.min((now - spark.startTime) / duration, 1);
      if (progress >= 1) return false;

      const eased = ease(progress);
      const distance = eased * sparkRadius * extraScale;
      const lineLength = sparkSize * (1 - eased);
      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      if (x2 < 0 || x2 > width || y2 < 0 || y2 > height) return true;

      ctx.globalAlpha = 1 - progress;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      return true;
    });

    ctx.restore();

    if (sparksRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(draw);
    } else {
      animationRef.current = null;
    }
  }, [duration, ease, extraScale, sparkColor, sparkRadius, sparkSize]);

  const startAnimation = useCallback(() => {
    if (animationRef.current !== null) return;
    animationRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();
    const rect = canvas.getBoundingClientRect();
    const x = fixed ? event.clientX : event.clientX - rect.left;
    const y = fixed ? event.clientY : event.clientY - rect.top;
    const now = performance.now();

    sparksRef.current.push(
      ...Array.from({ length: sparkCount }, (_, index) => ({
        x,
        y,
        angle: (2 * Math.PI * index) / sparkCount,
        startTime: now,
      })),
    );

    startAnimation();
  };

  useEffect(() => {
    resizeCanvas();

    const canvas = canvasRef.current;
    const observer = canvas ? new ResizeObserver(resizeCanvas) : null;
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [resizeCanvas]);

  return (
    <div
      className={`click-spark ${fixed ? 'click-spark--fixed' : ''} ${className}`}
      onPointerDownCapture={handlePointerDown}
    >
      <canvas ref={canvasRef} className="click-spark__canvas" aria-hidden="true" />
      {children}
    </div>
  );
}
