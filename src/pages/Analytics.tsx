import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  MousePointer,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Search,
  BarChart3,
  Activity,
  Download,
  Calendar
} from 'lucide-react';
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview';
import { VisitorAnalytics } from '@/components/analytics/VisitorAnalytics';
import { TrafficAnalytics } from '@/components/analytics/TrafficAnalytics';
import { ContentAnalytics } from '@/components/analytics/ContentAnalytics';
import { RealTimeAnalytics } from '@/components/analytics/RealTimeAnalytics';
import { CustomMetricsDashboard } from '@/components/analytics/CustomMetricsDashboard';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('visitors');

  const timeRanges = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '1y', label: '1 Year' }
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Monitor your application performance and user behavior
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule Report
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2">
        {timeRanges.map((range) => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* Analytics Overview */}
      <AnalyticsOverview timeRange={timeRange} />

      {/* Custom Metrics Dashboard */}
      <CustomMetricsDashboard timeRange={timeRange} />

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="visitors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="traffic">Traffic Sources</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
        </TabsList>

        <TabsContent value="visitors">
          <VisitorAnalytics timeRange={timeRange} />
        </TabsContent>

        <TabsContent value="traffic">
          <TrafficAnalytics timeRange={timeRange} />
        </TabsContent>

        <TabsContent value="content">
          <ContentAnalytics timeRange={timeRange} />
        </TabsContent>

        <TabsContent value="realtime">
          <RealTimeAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
