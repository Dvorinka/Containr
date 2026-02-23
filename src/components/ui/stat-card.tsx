import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

const statusColors = {
  success: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  danger: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  neutral: 'text-muted-foreground bg-muted',
}

const statusDots = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  neutral: 'bg-gray-400',
}

function _StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = 'neutral',
  className,
}: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight">
                {value}
              </p>
              {trend && (
                <Badge 
                  variant={trend.direction === 'up' ? 'default' : 'destructive'}
                  className={cn(
                    "text-xs",
                    trend.direction === 'up' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                      : trend.direction === 'down'
                      ? 'bg-red-100 text-red-800 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                  )}
                >
                  {trend.direction === 'up' ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : trend.direction === 'down' ? (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  ) : null}
                  {trend.value}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              statusColors[status]
            )}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
        {status !== 'neutral' && (
          <div className="absolute bottom-0 left-0 right-0 h-1">
            <div className={cn(
              "h-full w-full",
              statusDots[status]
            )} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
