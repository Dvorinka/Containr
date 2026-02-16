import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, FileText, BarChart3 } from 'lucide-react';
import { useState } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
  timePeriods?: string[];
  actionLabel?: string;
  children?: React.ReactNode;
  selectedPeriod?: string;
  onPeriodChange?: (period: string) => void;
}

export function MetricCard({ 
  title, 
  value, 
  trend, 
  timePeriods = ['1D', '1W', '1M', '3M', '6M', '1Y'], 
  actionLabel = 'Report',
  children,
  selectedPeriod = '1W',
  onPeriodChange
}: MetricCardProps) {
  const [currentPeriod, setCurrentPeriod] = useState(selectedPeriod);

  const handlePeriodChange = (period: string) => {
    setCurrentPeriod(period);
    onPeriodChange?.(period);
  };

  return (
    <Card className="w-full shadow-sm border-0 ring-1 ring-inset ring-border/20">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground font-medium">{title}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground">{value}</div>
              {trend && (
                <Badge 
                  variant={trend.direction === 'up' ? 'default' : 'destructive'}
                  className={`h-5 gap-1.5 px-2 text-xs font-medium ${
                    trend.direction === 'up' 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-red-100 text-red-800 border-red-200'
                  }`}
                >
                  {trend.direction === 'up' ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {trend.value}
                </Badge>
              )}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 gap-2.5 px-2 text-xs hover:bg-muted/50 transition-colors"
          >
            {actionLabel === 'Report' ? <FileText className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
            {actionLabel}
          </Button>
        </div>

        {/* Content */}
        {children && (
          <>
            <div className="w-full h-px bg-border/20" />
            {children}
          </>
        )}

        {/* Time Period Selector */}
        {timePeriods && (
          <>
            <div className="w-full h-px bg-border/20" />
            <div className="flex gap-0.5" role="radiogroup">
              {timePeriods.map((period) => (
                <Button
                  key={period}
                  variant={currentPeriod === period ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handlePeriodChange(period)}
                  className={`h-6 px-3 text-xs first:rounded-l-md last:rounded-r-md transition-colors ${
                    currentPeriod === period 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {period}
                </Button>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
