import { useEffect, useRef, useState } from 'react';

interface DonutChartProps {
  percent?: number;
  percentage?: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  segments?: number;
  gap?: number;
  animated?: boolean;
}

export function DonutChart({
  percent,
  percentage,
  size = 160,
  thickness = 16,
  color = '#9c7ef0',
  trackColor = 'rgba(255, 255, 255, 0.07)',
  segments = 28,
  gap = 0.048,
  animated = true,
}: DonutChartProps) {
  const resolvedPercent = percentage ?? percent ?? 0;
  const [isVisible, setIsVisible] = useState(false);
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animatedPercentRef = useRef(0);

  useEffect(() => {
    animatedPercentRef.current = animatedPercent;
  }, [animatedPercent]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animated) {
      const frame = requestAnimationFrame(() => setAnimatedPercent(resolvedPercent));
      return () => cancelAnimationFrame(frame);
    }

    if (isVisible && animated) {
      const duration = 800;
      const startTime = Date.now();
      const startPercent = animatedPercentRef.current;
      const targetPercent = resolvedPercent;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setAnimatedPercent(startPercent + (targetPercent - startPercent) * eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [animated, isVisible, resolvedPercent]);

  const R = size / 2 - 4;
  const r = R - thickness;
  const cx = size / 2;
  const cy = size - 8;

  const filled = Math.round(segments * (animatedPercent / 100));

  const segmentPaths = [];
  for (let i = 0; i < segments; i++) {
    const a0 = Math.PI + (Math.PI / segments) * i + gap / 2;
    const a1 = Math.PI + (Math.PI / segments) * (i + 1) - gap / 2;
    const isFilled = i < filled;

    const x1Start = cx + R * Math.cos(a0);
    const y1Start = cy + R * Math.sin(a0);
    const x1End = cx + R * Math.cos(a1);
    const y1End = cy + R * Math.sin(a1);
    const x2Start = cx + r * Math.cos(a1);
    const y2Start = cy + r * Math.sin(a1);
    const x2End = cx + r * Math.cos(a0);
    const y2End = cy + r * Math.sin(a0);

    const path = `M ${x1Start} ${y1Start} A ${R} ${R} 0 0 1 ${x1End} ${y1End} L ${x2Start} ${y2Start} A ${r} ${r} 0 0 0 ${x2End} ${y2End} Z`;

    segmentPaths.push(
      <path
        key={i}
        d={path}
        fill={isFilled ? color : trackColor}
        className="transition-colors duration-300"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ width: size, height: size * 0.6 }}>
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
        {segmentPaths}
      </svg>
    </div>
  );
}

interface SegmentedBarProps {
  segments: Array<{ width: number; color: string }>;
  height?: number;
  className?: string;
}

export function SegmentedBar({ segments, height = 32, className = '' }: SegmentedBarProps) {
  return (
    <div className={`flex items-center gap-[5px] h-[${height}px] ${className}`}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full transition-all duration-200 hover:brightness-110 cursor-pointer"
          style={{
            width: `${seg.width}%`,
            background: seg.color,
            borderRadius: i === 0 ? '10px 4px 4px 10px' : i === segments.length - 1 ? '4px 10px 10px 4px' : '5px',
          }}
        />
      ))}
    </div>
  );
}
