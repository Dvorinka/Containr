import { MetricCard } from './MetricCard';
import { useState } from 'react';

export function SalesMetricCard() {
  const [selectedPeriod, setSelectedPeriod] = useState('1W');

  const salesData = {
    '1D': { value: '$128.32', trend: '+2%', direction: 'up' as const },
    '1W': { value: '$897.24', trend: '+5.2%', direction: 'up' as const },
    '1M': { value: '$3,847.92', trend: '+12.8%', direction: 'up' as const },
    '3M': { value: '$11,543.76', trend: '+18.3%', direction: 'up' as const },
    '6M': { value: '$23,087.52', trend: '+24.1%', direction: 'up' as const },
    '1Y': { value: '$46,175.04', trend: '+31.7%', direction: 'up' as const },
  };

  const currentData = salesData[selectedPeriod as keyof typeof salesData];

  return (
    <MetricCard
      title="Total Sales"
      value={currentData.value}
      trend={{
        value: currentData.trend,
        direction: currentData.direction
      }}
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
    />
  );
}
