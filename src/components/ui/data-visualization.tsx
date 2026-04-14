import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: ChartData[];
  className?: string;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
  colorScheme?: 'primary' | 'success' | 'warning' | 'destructive';
}

export function BarChart({ 
  data, 
  className, 
  height = 200, 
  showLabels = true, 
  animated = true,
  colorScheme = 'primary'
}: BarChartProps) {
  const [animatedData, setAnimatedData] = useState<ChartData[]>(data.map(d => ({ ...d, value: 0 })));
  const maxValue = Math.max(...data.map(d => d.value));

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setAnimatedData(data);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedData(data);
    }
  }, [data, animated]);

  const getColorClass = (colorScheme: string) => {
    const schemes = {
      primary: 'bg-primary',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      destructive: 'bg-red-500',
    };
    return schemes[colorScheme as keyof typeof schemes] || schemes.primary;
  };

  return (
    <div className={cn("w-full", className)}>
      <div 
        className="flex items-end gap-2 h-full"
        style={{ height: `${height}px` }}
      >
        {animatedData.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center">
              {showLabels && (
                <span className="text-xs text-muted-foreground mb-1">
                  {item.value}
                </span>
              )}
              <div
                className={cn(
                  "w-full rounded-t-md transition-all duration-500 ease-out",
                  getColorClass(item.color || colorScheme)
                )}
                style={{
                  height: `${(item.value / maxValue) * height}px`,
                  animationDelay: `${index * 100}ms`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground text-center truncate w-full">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: { x: string; y: number }[];
  className?: string;
  height?: number;
  showGrid?: boolean;
  color?: string;
  smooth?: boolean;
}

export function LineChart({ 
  data, 
  className, 
  height = 200, 
  showGrid = true, 
  color = "rgb(var(--primary))",
  smooth = true
}: LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathLength, setPathLength] = useState(0);

  const width = 100;
  const heightPercent = 100;
  const maxValue = Math.max(...data.map(d => d.y));
  const minValue = Math.min(...data.map(d => d.y));
  const range = maxValue - minValue;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = heightPercent - ((point.y - minValue) / range) * heightPercent;
    return `${x},${y}`;
  });

  const pathData = smooth 
    ? `M ${points.join(' L ')}`
    : `M ${points.join(' L ')}`;

  useEffect(() => {
    if (svgRef.current) {
      const path = svgRef.current.querySelector('.chart-line') as SVGPathElement;
      if (path && path.getTotalLength) {
        const length = path.getTotalLength();
        setPathLength(length);
      }
    }
  }, [data]);

  return (
    <div className={cn("w-full", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${heightPercent}`}
        className="w-full h-full"
        style={{ height: `${height}px` }}
      >
        {showGrid && (
          <g className="opacity-20">
            {[...Array(5)].map((_, i) => (
              <line
                key={i}
                x1="0"
                y1={i * 25}
                x2={width}
                y2={i * 25}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </g>
        )}
        <path
          className="chart-line"
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin={smooth ? "round" : "miter"}
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength,
            animation: 'drawPath 1s ease-out forwards',
          }}
        />
        {data.map((point, index) => (
          <circle
            key={index}
            cx={(index / (data.length - 1)) * width}
            cy={heightPercent - ((point.y - minValue) / range) * heightPercent}
            r="3"
            fill={color}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          />
        ))}
      </svg>
    </div>
  );
}

interface ProgressCircleProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  backgroundColor?: string;
  showValue?: boolean;
  animated?: boolean;
}

export function ProgressCircle({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  color = "rgb(var(--primary))",
  backgroundColor = "rgb(var(--muted))",
  showValue = true,
  animated = true,
}: ProgressCircleProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setAnimatedValue(percentage);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setAnimatedValue(percentage);
    }
  }, [percentage, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold">{Math.round(animatedValue)}%</span>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  trend?: 'up' | 'down' | 'stable';
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  className,
  color = 'primary',
  trend = 'stable',
}: MetricCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    success: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    destructive: 'text-red-500 bg-red-500/10 border-red-500/20',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    stable: '→',
  };

  return (
    <Card className={cn("card-hover card-elevated", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-xs font-medium",
                  change.type === 'increase' ? 'text-emerald-500' :
                  change.type === 'decrease' ? 'text-red-500' :
                  'text-muted-foreground'
                )}>
                  {trendIcons[trend]} {change.value}
                </span>
              </div>
            )}
          </div>
          {icon && (
            <div className={cn(
              "p-3 rounded-xl border",
              colorClasses[color]
            )}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface HeatmapProps {
  data: { x: number; y: number; value: number }[];
  className?: string;
  cellSize?: number;
  colorScheme?: 'blue' | 'green' | 'red' | 'purple';
}

export function Heatmap({
  data,
  className,
  cellSize = 20,
  colorScheme = 'blue',
}: HeatmapProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;

  const getColor = (value: number) => {
    const intensity = (value - minValue) / range;
    
    const schemes = {
      blue: `rgba(59, 130, 246, ${intensity})`,
      green: `rgba(34, 197, 94, ${intensity})`,
      red: `rgba(239, 68, 68, ${intensity})`,
      purple: `rgba(139, 92, 246, ${intensity})`,
    };
    
    return schemes[colorScheme];
  };

  const gridSize = Math.ceil(Math.sqrt(data.length));

  return (
    <div className={cn("inline-block", className)}>
      <div 
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
        }}
      >
        {data.map((cell, index) => (
          <div
            key={index}
            className="rounded-sm transition-all duration-200 hover:scale-110 cursor-pointer"
            style={{
              backgroundColor: getColor(cell.value),
              width: `${cellSize}px`,
              height: `${cellSize}px`,
            }}
            title={`Value: ${cell.value}`}
          />
        ))}
      </div>
    </div>
  );
}
