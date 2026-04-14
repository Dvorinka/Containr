import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'shimmer';
}

export function Skeleton({ 
  className, 
  variant = 'text', 
  width, 
  height, 
  animation = 'pulse' 
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-bounce-subtle',
    shimmer: 'animate-shimmer bg-gradient-to-r from-transparent via-muted/50 to-transparent bg-[length:200%_100%]',
  };

  return (
    <div
      className={cn(
        'bg-muted',
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{ width, height }}
    />
  );
}

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  variant?: 'simple' | 'dots' | 'pulse' | 'bars';
}

export function LoadingSpinner({ 
  className, 
  size = 'md', 
  color = 'primary', 
  variant = 'simple' 
}: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorStyles = {
    primary: 'text-primary',
    secondary: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    destructive: 'text-red-500',
  };

  if (variant === 'dots') {
    return (
      <div className={cn('flex gap-1', className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-current animate-bounce',
              sizeStyles[size],
              colorStyles[color]
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('relative', sizeStyles[size], className)}>
        <div className={cn('absolute inset-0 rounded-full bg-current animate-ping opacity-25', colorStyles[color])} />
        <div className={cn('relative rounded-full bg-current', colorStyles[color])} />
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex gap-1 items-end', className)}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'bg-current animate-pulse',
              colorStyles[color],
              size === 'sm' ? 'w-1 h-3' :
              size === 'md' ? 'w-1.5 h-4' :
              size === 'lg' ? 'w-2 h-5' :
              'w-3 h-6'
            )}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'animate-spin border-2 border-current border-t-transparent rounded-full',
        sizeStyles[size],
        colorStyles[color],
        className
      )}
    />
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  showLabel?: boolean;
  label?: string;
}

export function ProgressRing({ 
  value, 
  max = 100, 
  size = 120, 
  strokeWidth = 8, 
  className,
  color = 'primary',
  showLabel = false,
  label
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const colorStyles = {
    primary: 'text-primary',
    secondary: 'text-muted-foreground',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    destructive: 'text-red-500',
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgb(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn('transition-all duration-500 ease-out', colorStyles[color])}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold">{Math.round(animatedValue)}%</span>
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}

interface LoadingDotsProps {
  className?: string;
  text?: string;
  dots?: number;
  speed?: 'slow' | 'normal' | 'fast';
}

export function LoadingDots({ 
  className, 
  text = 'Loading', 
  dots = 3, 
  speed = 'normal' 
}: LoadingDotsProps) {
  const [currentDots, setCurrentDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDots((prev) => (prev + 1) % (dots + 1));
    }, speed === 'slow' ? 400 : speed === 'fast' ? 200 : 300);

    return () => clearInterval(interval);
  }, [dots, speed]);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span>{text}</span>
      <span className="inline-block w-8 text-left">
        {'.'.repeat(currentDots)}
      </span>
    </div>
  );
}

interface WaveLoaderProps {
  className?: string;
  bars?: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
}

export function WaveLoader({ className, bars = 5, color = 'primary' }: WaveLoaderProps) {
  const colorStyles = {
    primary: 'bg-primary',
    secondary: 'bg-muted-foreground',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    destructive: 'bg-red-500',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-1 bg-current animate-bounce',
            colorStyles[color]
          )}
          style={{
            height: `${20 + Math.sin(i * 0.5) * 10}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}
