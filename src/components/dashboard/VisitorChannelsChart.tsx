import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export function VisitorChannelsChart() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const channelsData = {
    '1D': {
      overall: 76,
      trend: '-0.8%',
      direction: 'down' as 'down',
      channels: [
        { name: 'Organic Search', percentage: 43, color: 'bg-gray-500', trend: '-1.2%' },
        { name: 'Direct Traffic', percentage: 42, color: 'bg-blue-500', trend: '-0.3%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+0.7%' }
      ]
    },
    '1W': {
      overall: 78,
      trend: '-0.4%',
      direction: 'down' as 'down',
      channels: [
        { name: 'Organic Search', percentage: 45, color: 'bg-gray-500', trend: '-0.8%' },
        { name: 'Direct Traffic', percentage: 40, color: 'bg-blue-500', trend: '-0.2%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+0.6%' }
      ]
    },
    '1M': {
      overall: 81,
      trend: '+1.2%',
      direction: 'up' as 'up',
      channels: [
        { name: 'Organic Search', percentage: 47, color: 'bg-gray-500', trend: '+2.1%' },
        { name: 'Direct Traffic', percentage: 38, color: 'bg-blue-500', trend: '+0.9%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+0.6%' }
      ]
    },
    '3M': {
      overall: 84,
      trend: '+2.8%',
      direction: 'up' as 'up',
      channels: [
        { name: 'Organic Search', percentage: 48, color: 'bg-gray-500', trend: '+4.2%' },
        { name: 'Direct Traffic', percentage: 37, color: 'bg-blue-500', trend: '+1.8%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+2.4%' }
      ]
    },
    '6M': {
      overall: 86,
      trend: '+4.3%',
      direction: 'up' as 'up',
      channels: [
        { name: 'Organic Search', percentage: 49, color: 'bg-gray-500', trend: '+6.7%' },
        { name: 'Direct Traffic', percentage: 36, color: 'bg-blue-500', trend: '+3.1%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+3.1%' }
      ]
    },
    '1Y': {
      overall: 89,
      trend: '+7.1%',
      direction: 'up' as 'up',
      channels: [
        { name: 'Organic Search', percentage: 51, color: 'bg-gray-500', trend: '+11.3%' },
        { name: 'Direct Traffic', percentage: 34, color: 'bg-blue-500', trend: '+5.2%' },
        { name: 'Social Media', percentage: 15, color: 'bg-green-500', trend: '+4.8%' }
      ]
    },
  };

  const currentData = channelsData[selectedPeriod as keyof typeof channelsData];

  return (
    <Card className="w-full shadow-sm border-0 ring-1 ring-inset ring-border/20">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <div className="text-sm text-muted-foreground font-medium">Visitors Channels</div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground">{currentData.overall}%</div>
              <Badge 
                variant={currentData.direction === 'up' ? 'default' : 'destructive'}
                className={`h-5 gap-1.5 px-2 text-xs font-medium ${
                  currentData.direction === 'up' 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : 'bg-red-100 text-red-800 border-red-200'
                }`}
              >
                {currentData.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {currentData.trend}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-2.5 px-2 text-xs hover:bg-muted/50 transition-colors">
            <BarChart3 className="w-3 h-3" />
            Details
          </Button>
        </div>

        {/* Chart */}
        <div className="flex flex-col gap-5">
          <div className="flex gap-[5px]">
            {currentData.channels.map((channel, index) => (
              <div 
                key={channel.name}
                className="h-2 rounded-sm transition-all duration-300 hover:opacity-80"
                style={{ width: `${channel.percentage}%` }}
              >
                <div 
                  className={`h-full rounded-sm ${channel.color} chart-category-cell-load`}
                  style={{ '--i': index } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
          
          {/* Channel Labels */}
          <div className="flex flex-wrap gap-4">
            {currentData.channels.map((channel) => (
              <div key={channel.name} className="flex items-center gap-1 text-left text-xs text-muted-foreground">
                <div className={`w-3 h-3 shrink-0 rounded-full border-2 border-background shadow-sm ${channel.color}`} />
                <span className="font-medium">{channel.name}</span>
                <span className="font-semibold text-foreground">{channel.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time Period Selector */}
        <div className="pt-3 border-t border-border/20">
          <div className="flex gap-0.5" role="radiogroup">
            {['1D', '1W', '1M', '3M', '6M', '1Y'].map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className={`h-6 px-3 text-xs first:rounded-l-md last:rounded-r-md transition-colors ${
                  selectedPeriod === period 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
