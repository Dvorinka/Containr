import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export function UserRetentionChart() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const retentionData = {
    '1D': {
      rate: 22,
      trend: '+0.5%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [84, 90, 85, 79, 94, 92, 87, 81],
        [76, 83, 80, 77, 86, 84, 82, 78],
        [63, 70, 68, 66, 73, 71, 69, 67],
        [50, 56, 54, 52, 58, 57, 55, 53],
        [36, 40, 39, 37, 42, 41, 40, 38],
        [23, 26, 25, 24, 27, 26, 25, 24],
        [13, 15, 14, 13, 16, 15, 14, 13],
        [6, 7, 6, 6, 8, 7, 7, 6]
      ]
    },
    '1W': {
      rate: 24,
      trend: '+2.0%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [86, 92, 87, 81, 96, 94, 89, 83],
        [78, 85, 82, 79, 88, 86, 84, 80],
        [65, 72, 70, 68, 75, 73, 71, 69],
        [52, 58, 56, 54, 60, 59, 57, 55],
        [38, 42, 41, 39, 44, 43, 42, 40],
        [25, 28, 27, 26, 29, 28, 27, 26],
        [15, 17, 16, 15, 18, 17, 16, 15],
        [8, 9, 8, 8, 10, 9, 9, 8]
      ]
    },
    '1M': {
      rate: 28,
      trend: '+3.2%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [88, 94, 89, 83, 98, 96, 91, 85],
        [80, 87, 84, 81, 90, 88, 86, 82],
        [67, 74, 72, 70, 77, 75, 73, 71],
        [54, 60, 58, 56, 62, 61, 59, 57],
        [40, 44, 43, 41, 46, 45, 44, 42],
        [27, 30, 29, 28, 31, 30, 29, 28],
        [17, 19, 18, 17, 20, 19, 18, 17],
        [10, 11, 10, 10, 12, 11, 11, 10]
      ]
    },
    '3M': {
      rate: 31,
      trend: '+4.8%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [90, 96, 91, 85, 100, 98, 93, 87],
        [82, 89, 86, 83, 92, 90, 88, 84],
        [69, 76, 74, 72, 79, 77, 75, 73],
        [56, 62, 60, 58, 64, 63, 61, 59],
        [42, 46, 45, 43, 48, 47, 46, 44],
        [29, 32, 31, 30, 33, 32, 31, 30],
        [19, 21, 20, 19, 22, 21, 20, 19],
        [12, 13, 12, 12, 14, 13, 13, 12]
      ]
    },
    '6M': {
      rate: 35,
      trend: '+6.1%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [92, 98, 93, 87, 102, 100, 95, 89],
        [84, 91, 88, 85, 94, 92, 90, 86],
        [71, 78, 76, 74, 81, 79, 77, 75],
        [58, 64, 62, 60, 66, 65, 63, 61],
        [44, 48, 47, 45, 50, 49, 48, 46],
        [31, 34, 33, 32, 35, 34, 33, 32],
        [21, 23, 22, 21, 24, 23, 22, 21],
        [14, 15, 14, 14, 16, 15, 15, 14]
      ]
    },
    '1Y': {
      rate: 41,
      trend: '+9.2%',
      direction: 'up' as 'up',
      weeks: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      data: [
        [94, 100, 95, 89, 104, 102, 97, 91],
        [86, 93, 90, 87, 96, 94, 92, 88],
        [73, 80, 78, 76, 83, 81, 79, 77],
        [60, 66, 64, 62, 68, 67, 65, 63],
        [46, 50, 49, 47, 52, 51, 50, 48],
        [33, 36, 35, 34, 37, 36, 35, 34],
        [23, 25, 24, 23, 26, 25, 24, 23],
        [16, 17, 16, 16, 18, 17, 17, 16]
      ]
    },
  };

  const currentData = retentionData[selectedPeriod as keyof typeof retentionData];

  const getOpacity = (value: number) => (value / 100).toFixed(2);

  return (
    <Card className="w-full shadow-sm border-0 ring-1 ring-inset ring-border/20">
      <CardContent className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground font-medium">User Retention</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="text-2xl font-bold text-foreground">{currentData.rate}%</div>
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

        {/* Retention Heatmap */}
        <div className="relative">
          <div 
            className="h-[194px] w-full border-collapse"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--border)) 1px, #0000 1px 100%) 0 0 / 100% calc(152px / 4) no-repeat repeat'
            }}
          >
            <table className="-m-px h-full w-full border-collapse" cellPadding="0">
              <tbody>
                {currentData.data.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((value, colIndex) => (
                      <td 
                        key={`${rowIndex}-${colIndex}`} 
                        className="p-px"
                        data-value={value}
                      >
                        <div 
                          className="h-full w-full rounded-[1px] bg-primary transition-all duration-200 hover:opacity-100"
                          style={{ opacity: getOpacity(value) }}
                          title={`${currentData.weeks[colIndex]}: ${value}%`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Corner decorations */}
          <div className="absolute bottom-6 left-0 z-10 size-4 overflow-hidden">
            <div className="size-4 rounded-bl-lg" style={{ boxShadow: '-100px 100px 0 100px hsl(var(--background))' }} />
          </div>
          <div className="absolute bottom-6 right-0 z-10 size-4 overflow-hidden">
            <div className="size-4 rounded-br-lg" style={{ boxShadow: '100px 100px 0 100px hsl(var(--background))' }} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="font-medium">Cohort Analysis</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary opacity-20 rounded" />
              <span>Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary opacity-60 rounded" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-primary rounded" />
              <span>High</span>
            </div>
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
