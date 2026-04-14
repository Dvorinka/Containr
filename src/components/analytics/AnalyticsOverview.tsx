import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  MousePointer,
  Clock,
  Activity,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface AnalyticsOverviewProps {
  timeRange: string;
}

export function AnalyticsOverview({ timeRange }: AnalyticsOverviewProps) {
  const { data: overviewData, isLoading, error } = useQuery({
    queryKey: ['analytics-overview', timeRange],
    queryFn: () => analyticsApi.getOverview(timeRange),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load analytics data. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      title: 'Unique Visitors',
      value: overviewData?.visitors.current.toLocaleString() || '0',
      change: overviewData?.visitors.change || 0,
      trend: overviewData?.visitors.trend || 'up',
      icon: Users,
      format: 'number'
    },
    {
      title: 'Page Views',
      value: overviewData?.pageviews.current.toLocaleString() || '0',
      change: overviewData?.pageviews.change || 0,
      trend: overviewData?.pageviews.trend || 'up',
      icon: Eye,
      format: 'number'
    },
    {
      title: 'Sessions',
      value: overviewData?.sessions.current.toLocaleString() || '0',
      change: overviewData?.sessions.change || 0,
      trend: overviewData?.sessions.trend || 'up',
      icon: MousePointer,
      format: 'number'
    },
    {
      title: 'Bounce Rate',
      value: `${overviewData?.bounceRate.current || 0}%`,
      change: overviewData?.bounceRate.change || 0,
      trend: overviewData?.bounceRate.trend || 'up',
      icon: Activity,
      format: 'percentage'
    },
    {
      title: 'Session Duration',
      value: overviewData ? 
        `${Math.floor(overviewData.sessionDuration.current / 60)}m ${overviewData.sessionDuration.current % 60}s` : 
        '0m 0s',
      change: overviewData?.sessionDuration.change || 0,
      trend: overviewData?.sessionDuration.trend || 'up',
      icon: Clock,
      format: 'duration'
    },
    {
      title: 'Conversion Rate',
      value: `${overviewData?.conversionRate.current || 0}%`,
      change: overviewData?.conversionRate.change || 0,
      trend: overviewData?.conversionRate.trend || 'up',
      icon: TrendingUp,
      format: 'percentage'
    }
  ];

  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? (
      <ArrowUp className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDown className="w-4 h-4 text-red-500" />
    );
  };

  const getTrendColor = (trend: 'up' | 'down') => {
    return trend === 'up' ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <Card key={metric.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <div className="flex items-center space-x-1 text-xs">
              {getTrendIcon(metric.trend)}
              <span className={getTrendColor(metric.trend)}>
                {Math.abs(metric.change)}%
              </span>
              <span className="text-muted-foreground">
                from last period
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
