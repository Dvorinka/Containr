import { MetricCard } from './MetricCard';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export function ConversionRateCard() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const conversionData = {
    '1D': { 
      rate: '15.2%', 
      trend: '+0.8%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 384, trend: '+3%' },
        checkout: { count: 215, trend: '+2%' },
        payment: { count: 184, trend: '+1%' }
      }
    },
    '1W': { 
      rate: '16.9%', 
      trend: '+2.1%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 3842, trend: '+12%' },
        checkout: { count: 2156, trend: '+8%' },
        payment: { count: 1842, trend: '+5%' }
      }
    },
    '1M': { 
      rate: '18.3%', 
      trend: '+3.4%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 16547, trend: '+18%' },
        checkout: { count: 9234, trend: '+14%' },
        payment: { count: 7892, trend: '+11%' }
      }
    },
    '3M': { 
      rate: '19.7%', 
      trend: '+4.8%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 52341, trend: '+28%' },
        checkout: { count: 29456, trend: '+22%' },
        payment: { count: 25123, trend: '+19%' }
      }
    },
    '6M': { 
      rate: '21.2%', 
      trend: '+6.3%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 108934, trend: '+41%' },
        checkout: { count: 61234, trend: '+35%' },
        payment: { count: 52345, trend: '+31%' }
      }
    },
    '1Y': { 
      rate: '23.8%', 
      trend: '+8.9%', 
      direction: 'up' as 'up',
      funnel: {
        cart: { count: 224567, trend: '+67%' },
        checkout: { count: 126789, trend: '+58%' },
        payment: { count: 108234, trend: '+52%' }
      }
    },
  };

  const currentData = conversionData[selectedPeriod as keyof typeof conversionData];

  return (
    <MetricCard
      title="Conversion Rate"
      value={currentData.rate}
      trend={{
        value: currentData.trend,
        direction: currentData.direction
      }}
      actionLabel="Details"
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
    >
      <div className="w-full flex-col gap-3">
        {/* Conversion Funnel */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 text-sm text-muted-foreground font-medium">Added to Cart</div>
            <div className="flex items-center gap-1.5">
              <div className="min-w-16 text-sm tabular-nums text-muted-foreground">{currentData.funnel.cart.count.toLocaleString()}</div>
              <Badge 
                variant={currentData.funnel.cart.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.funnel.cart.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.funnel.cart.trend}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="flex-1 text-sm text-muted-foreground font-medium">Checkout Started</div>
            <div className="flex items-center gap-1.5">
              <div className="min-w-16 text-sm tabular-nums text-muted-foreground">{currentData.funnel.checkout.count.toLocaleString()}</div>
              <Badge 
                variant={currentData.funnel.checkout.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.funnel.checkout.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.funnel.checkout.trend}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="flex-1 text-sm text-muted-foreground font-medium">Payment Completed</div>
            <div className="flex items-center gap-1.5">
              <div className="min-w-16 text-sm tabular-nums text-muted-foreground">{currentData.funnel.payment.count.toLocaleString()}</div>
              <Badge 
                variant={currentData.funnel.payment.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.funnel.payment.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.funnel.payment.trend}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Mini Sparkline Visualization */}
        <div className="mt-4 pt-3 border-t border-border/20">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Conversion trend</span>
            </div>
          </div>
          <div className="mt-2 h-8 w-full bg-muted/20 rounded-sm flex items-end justify-between gap-1 px-1">
            {[65, 72, 68, 75, 82, 79, 85, 88, 92, 87, 91, 95].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/60 rounded-sm transition-all duration-300 hover:bg-primary/80"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </MetricCard>
  );
}
