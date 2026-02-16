import { MetricCard } from './MetricCard';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useState } from 'react';

export function VisitorsMetricCard() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const visitorsData = {
    '1D': { 
      value: '23,746', 
      trend: '-1.4%', 
      direction: 'down' as const,
      devices: {
        desktop: { percentage: 27, trend: '-3.2%' },
        mobile: { percentage: 63, trend: '+0.8%' },
        tablet: { percentage: 10, trend: '-1.1%' }
      }
    },
    '1W': { 
      value: '237,456', 
      trend: '-1.4%', 
      direction: 'down' as const,
      devices: {
        desktop: { percentage: 27, trend: '-3.2%' },
        mobile: { percentage: 63, trend: '+0.8%' },
        tablet: { percentage: 10, trend: '-1.1%' }
      }
    },
    '1M': { 
      value: '1,012,847', 
      trend: '+2.1%', 
      direction: 'up' as const,
      devices: {
        desktop: { percentage: 25, trend: '-2.1%' },
        mobile: { percentage: 65, trend: '+3.4%' },
        tablet: { percentage: 10, trend: '-1.3%' }
      }
    },
    '3M': { 
      value: '3,047,234', 
      trend: '+5.8%', 
      direction: 'up' as const,
      devices: {
        desktop: { percentage: 24, trend: '-4.2%' },
        mobile: { percentage: 66, trend: '+7.1%' },
        tablet: { percentage: 10, trend: '-2.9%' }
      }
    },
    '6M': { 
      value: '6,234,891', 
      trend: '+8.3%', 
      direction: 'up' as const,
      devices: {
        desktop: { percentage: 23, trend: '-5.8%' },
        mobile: { percentage: 67, trend: '+11.2%' },
        tablet: { percentage: 10, trend: '-5.4%' }
      }
    },
    '1Y': { 
      value: '12,891,234', 
      trend: '+12.7%', 
      direction: 'up' as const,
      devices: {
        desktop: { percentage: 22, trend: '-8.1%' },
        mobile: { percentage: 68, trend: '+18.3%' },
        tablet: { percentage: 10, trend: '-10.2%' }
      }
    },
  };

  const currentData = visitorsData[selectedPeriod as keyof typeof visitorsData];

  return (
    <MetricCard
      title="Total Visitors"
      value={currentData.value}
      trend={{
        value: currentData.trend,
        direction: currentData.direction
      }}
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
    >
      <div className="space-y-4">
        {/* Device Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Desktop</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{currentData.devices.desktop.percentage}%</span>
              <Badge 
                variant={currentData.devices.desktop.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.devices.desktop.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.devices.desktop.trend}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Mobile</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{currentData.devices.mobile.percentage}%</span>
              <Badge 
                variant={currentData.devices.mobile.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.devices.mobile.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.devices.mobile.trend}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tablet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tablet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{currentData.devices.tablet.percentage}%</span>
              <Badge 
                variant={currentData.devices.tablet.trend.startsWith('+') ? 'default' : 'destructive'}
                className="h-5 gap-1 px-2 text-xs"
              >
                {currentData.devices.tablet.trend.startsWith('+') ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.devices.tablet.trend}
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Device Progress Bars */}
        <div className="space-y-2">
          <div className="h-2 w-full rounded-sm bg-muted overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${currentData.devices.desktop.percentage}%` }}
            />
          </div>
          <div className="h-2 w-full rounded-sm bg-muted overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${currentData.devices.mobile.percentage}%` }}
            />
          </div>
          <div className="h-2 w-full rounded-sm bg-muted overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${currentData.devices.tablet.percentage}%` }}
            />
          </div>
        </div>
      </div>
    </MetricCard>
  );
}
