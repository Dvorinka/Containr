import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface SparkleProps {
  className?: string;
  size?: number;
  color?: string;
}

export function Sparkle({ className, size = 4, color = "rgb(var(--primary) / 0.8)" }: SparkleProps) {
  return (
    <div
      className={cn("animate-pulse absolute pointer-events-none", className)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: `radial-gradient(circle, ${color}, transparent)`,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
    />
  );
}

interface ParticleFieldProps {
  className?: string;
  particleCount?: number;
  particleSize?: number;
  particleColor?: string;
  animationDuration?: number;
}

export function ParticleField({
  className,
  particleCount = 20,
  particleSize = 2,
  particleColor = "rgb(var(--primary) / 0.3)",
  animationDuration = 20,
}: ParticleFieldProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * animationDuration,
    }));
    setParticles(newParticles);
  }, [particleCount, animationDuration]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full animate-float"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particleSize}px`,
            height: `${particleSize}px`,
            background: particleColor,
            boxShadow: `0 0 ${particleSize * 4}px ${particleColor}`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${animationDuration}s`,
          }}
        />
      ))}
    </div>
  );
}

interface GlowEffectProps {
  className?: string;
  intensity?: number;
  color?: string;
  size?: number;
  pulse?: boolean;
}

export function GlowEffect({ 
  className, 
  intensity = 0.5, 
  color = "rgb(var(--primary))", 
  size = 200,
  pulse = false 
}: GlowEffectProps) {
  return (
    <div 
      className={cn(
        "absolute rounded-full pointer-events-none",
        pulse && "animate-pulse-slow",
        className
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: `radial-gradient(circle, ${color} / ${intensity}, transparent)`,
        filter: 'blur(40px)',
      }}
    />
  );
}

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  magnetStrength?: number;
  onClick?: () => void;
}

export function MagneticButton({ children, className, magnetStrength = 0.3, onClick }: MagneticButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * magnetStrength;
    const deltaY = (e.clientY - centerY) * magnetStrength;
    
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className={cn("relative transition-transform duration-200 ease-out cursor-pointer", className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {children}
    </div>
  );
}

interface ParallaxLayerProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function ParallaxLayer({ children, className, speed = 0.5, direction = 'up' }: ParallaxLayerProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const parallax = scrolled * speed;
      
      switch (direction) {
        case 'up':
          setOffset({ x: 0, y: -parallax });
          break;
        case 'down':
          setOffset({ x: 0, y: parallax });
          break;
        case 'left':
          setOffset({ x: -parallax, y: 0 });
          break;
        case 'right':
          setOffset({ x: parallax, y: 0 });
          break;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, direction]);

  return (
    <div 
      className={cn("absolute inset-0", className)}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      {children}
    </div>
  );
}

interface RippleEffectProps {
  className?: string;
  color?: string;
  duration?: number;
  trigger?: boolean;
}

export function RippleEffect({ className, color = "rgb(var(--primary) / 0.3)", duration = 600, trigger }: RippleEffectProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (trigger) {
      const newRipple = {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 100,
      };
      
      setRipples(prev => [...prev, newRipple]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, duration);
    }
  }, [trigger, duration]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute rounded-full animate-ping"
          style={{
            left: `${ripple.x}%`,
            top: `${ripple.y}%`,
            width: '20px',
            height: '20px',
            background: color,
            animationDuration: `${duration}ms`,
          }}
        />
      ))}
    </div>
  );
}
