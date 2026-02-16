import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export function WeeklyVisitorsChart() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const weeklyData = {
    '1D': {
      total: 15847,
      trend: '+0.3%',
      direction: 'up' as 'up',
      newVisitors: 9508,
      returningVisitors: 6339,
      data: {
        new: [1200, 1350, 1100, 1400, 1300, 1250, 1400],
        returning: [800, 900, 850, 950, 900, 880, 950]
      }
    },
    '1W': {
      total: 16008,
      trend: '+1.1%',
      direction: 'up' as 'up',
      newVisitors: 9605,
      returningVisitors: 6403,
      data: {
        new: [1200, 1350, 1100, 1400, 1300, 1250, 1400],
        returning: [800, 900, 850, 950, 900, 880, 950]
      }
    },
    '1M': {
      total: 16892,
      trend: '+2.8%',
      direction: 'up' as 'up',
      newVisitors: 10135,
      returningVisitors: 6757,
      data: {
        new: [1300, 1450, 1200, 1500, 1400, 1350, 1500],
        returning: [850, 950, 900, 1000, 950, 930, 1000]
      }
    },
    '3M': {
      total: 18234,
      trend: '+4.9%',
      direction: 'up' as 'up',
      newVisitors: 10940,
      returningVisitors: 7294,
      data: {
        new: [1400, 1550, 1300, 1600, 1500, 1450, 1600],
        returning: [900, 1000, 950, 1050, 1000, 980, 1050]
      }
    },
    '6M': {
      total: 19876,
      trend: '+7.2%',
      direction: 'up' as 'up',
      newVisitors: 11926,
      returningVisitors: 7950,
      data: {
        new: [1500, 1650, 1400, 1700, 1600, 1550, 1700],
        returning: [950, 1050, 1000, 1100, 1050, 1030, 1100]
      }
    },
    '1Y': {
      total: 22145,
      trend: '+11.3%',
      direction: 'up' as 'up',
      newVisitors: 13287,
      returningVisitors: 8858,
      data: {
        new: [1650, 1800, 1550, 1850, 1750, 1700, 1850],
        returning: [1050, 1150, 1100, 1200, 1150, 1130, 1200]
      }
    },
  };

  const currentData = weeklyData[selectedPeriod as keyof typeof weeklyData];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const maxValue = Math.max(
    ...currentData.data.new,
    ...currentData.data.returning
  );

  return (
    <Card className="w-full shadow-sm border-0 ring-1 ring-inset ring-border/20">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground font-medium">Weekly Visitors</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground">{currentData.total.toLocaleString()}</div>
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

        {/* Legend */}
        <div className="flex w-full gap-1.5 rounded-lg bg-muted/50 py-1.5 ring-1 ring-inset ring-border/20">
          <div className="flex flex-1 items-center justify-center gap-1">
            <div className="flex size-4 shrink-0 items-center justify-center">
              <div className="size-3 shrink-0 rounded-full border-2 border-background shadow-sm bg-warning-base" />
            </div>
            <span className="text-xs text-muted-foreground">New visitors</span>
          </div>
          <div className="relative w-0 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-border" />
          <div className="flex flex-1 items-center justify-center gap-1">
            <div className="flex size-4 shrink-0 items-center justify-center">
              <div className="size-3 shrink-0 rounded-full border-2 border-background shadow-sm bg-success-base" />
            </div>
            <span className="text-xs text-muted-foreground">Returning visitors</span>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-40">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {[0, 25, 50, 75, 100].map((line) => (
              <div 
                key={line} 
                className="w-full border-t border-border/20" 
                style={{ opacity: line === 0 ? 0 : 0.3 }}
              />
            ))}
          </div>
          
          {/* Chart lines */}
          <div className="relative h-full w-full">
            {/* New visitors line */}
            <svg className="absolute inset-0 w-full h-full">
              <polyline
                points={currentData.data.new.map((value, index) => {
                  const x = (index / (currentData.data.new.length - 1)) * 100;
                  const y = 100 - (value / maxValue) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
                fill="none"
                stroke="hsl(var(--warning))"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              {currentData.data.new.map((value, index) => (
                <circle
                  key={`new-${index}`}
                  cx={`${(index / (currentData.data.new.length - 1)) * 100}%`}
                  cy={`${100 - (value / maxValue) * 100}%`}
                  r="3"
                  fill="hsl(var(--warning))"
                  className="hover:r-4 transition-all"
                />
              ))}
            </svg>
            
            {/* Returning visitors line */}
            <svg className="absolute inset-0 w-full h-full">
              <polyline
                points={currentData.data.returning.map((value, index) => {
                  const x = (index / (currentData.data.returning.length - 1)) * 100;
                  const y = 100 - (value / maxValue) * 100;
                  return `${x}%,${y}%`;
                }).join(' ')}
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              {currentData.data.returning.map((value, index) => (
                <circle
                  key={`returning-${index}`}
                  cx={`${(index / (currentData.data.returning.length - 1)) * 100}%`}
                  cy={`${100 - (value / maxValue) * 100}%`}
                  r="3"
                  fill="hsl(var(--success))"
                  className="hover:r-4 transition-all"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid auto-cols-fr grid-flow-col gap-0.5 px-4 py-3 text-center">
          {days.map((day) => (
            <div key={day} className="text-xs text-muted-foreground">
              {day}
            </div>
          ))}
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
