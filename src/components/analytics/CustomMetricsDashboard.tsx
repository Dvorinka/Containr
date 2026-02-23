import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Cpu,
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  MemoryStick,
  Network,
  Timer,
  Users
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface CustomMetricsDashboardProps {
  projectId?: string;
  timeRange: string;
}

export function CustomMetricsDashboard({ projectId, timeRange }: CustomMetricsDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState('performance');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock custom metrics data - in real implementation, this would come from your monitoring system
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['custom-metrics', projectId, timeRange],
    queryFn: async () => {
      // This would integrate with your monitoring system (Prometheus, Grafana, etc.)
      return {
        performance: {
          responseTime: {
            current: 245,
            average: 312,
            p95: 567,
            p99: 892,
            trend: 'down' as const,
            change: -12.3
          },
          throughput: {
            current: 1250,
            average: 1180,
            peak: 2340,
            trend: 'up' as const,
            change: 8.7
          },
          errorRate: {
            current: 0.2,
            average: 0.3,
            trend: 'down' as const,
            change: -33.3
          },
          availability: {
            current: 99.95,
            average: 99.91,
            trend: 'up' as const,
            change: 0.04
          }
        },
        infrastructure: {
          cpu: {
            current: 45.2,
            average: 52.8,
            peak: 78.9,
            trend: 'down' as const,
            change: -14.5
          },
          memory: {
            current: 62.7,
            average: 68.4,
            peak: 85.2,
            trend: 'down' as const,
            change: -8.3
          },
          disk: {
            current: 34.8,
            average: 38.1,
            peak: 45.6,
            trend: 'stable' as const,
            change: -8.7
          },
          network: {
            inbound: 125.6,
            outbound: 89.3,
            trend: 'up' as const,
            change: 15.2
          }
        },
        business: {
          conversions: {
            current: 156,
            goal: 200,
            completion: 78,
            trend: 'up' as const,
            change: 12.5
          },
          revenue: {
            current: 45678,
            goal: 50000,
            completion: 91.4,
            trend: 'up' as const,
            change: 8.9
          },
          userSatisfaction: {
            current: 4.6,
            goal: 4.8,
            completion: 95.8,
            trend: 'stable' as const,
            change: 0
          },
          activeUsers: {
            current: 12845,
            goal: 15000,
            completion: 85.6,
            trend: 'up' as const,
            change: 6.2
          }
        }
      };
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return <Badge variant="default" className="bg-green-500">Good</Badge>;
    if (value <= thresholds.warning) return <Badge variant="secondary" className="bg-yellow-500">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Custom Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Monitor your application performance and business KPIs
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="w-4 h-4 mr-2" />
            Auto-refresh
          </Button>
          <Button variant="outline" size="sm">
            <Timer className="w-4 h-4 mr-2" />
            Set Alerts
          </Button>
        </div>
      </div>

      {/* Metric Categories */}
      <Tabs value={selectedMetric} onValueChange={setSelectedMetric}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="business">Business KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* Response Time */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.performance.responseTime.current}ms</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.performance.responseTime.trend || 'stable')}
                  <span className={getStatusColor(metricsData?.performance.responseTime.current || 0, { good: 200, warning: 500 })}>
                    {Math.abs(metricsData?.performance.responseTime.change || 0)}%
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.performance.responseTime.average}ms</div>
                  <div>P95: {metricsData?.performance.responseTime.p95}ms</div>
                  <div>P99: {metricsData?.performance.responseTime.p99}ms</div>
                </div>
                <div className="mt-2">
                  {getStatusBadge(metricsData?.performance.responseTime.current || 0, { good: 200, warning: 500 })}
                </div>
              </CardContent>
            </Card>

            {/* Throughput */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.performance.throughput.current.toLocaleString()}</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.performance.throughput.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.performance.throughput.change || 0)}%
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.performance.throughput.average.toLocaleString()}/min</div>
                  <div>Peak: {metricsData?.performance.throughput.peak.toLocaleString()}/min</div>
                </div>
                <div className="mt-2">
                  <Badge variant="default" className="bg-green-500">Healthy</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Error Rate */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.performance.errorRate.current}%</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.performance.errorRate.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.performance.errorRate.change || 0)}%
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.performance.errorRate.average}%</div>
                  <div>Target: {'<1%'}</div>
                </div>
                <div className="mt-2">
                  {getStatusBadge(metricsData?.performance.errorRate.current || 0, { good: 1, warning: 5 })}
                </div>
              </CardContent>
            </Card>

            {/* Availability */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Availability</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.performance.availability.current}%</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.performance.availability.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.performance.availability.change || 0)}%
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.performance.availability.average}%</div>
                  <div>Target: {'>99.9%'}</div>
                </div>
                <div className="mt-2">
                  {getStatusBadge(100 - (metricsData?.performance.availability.current || 0), { good: 0.1, warning: 0.5 })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* CPU Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.infrastructure.cpu.current}%</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.infrastructure.cpu.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.infrastructure.cpu.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.infrastructure.cpu.current} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.infrastructure.cpu.average}%</div>
                  <div>Peak: {metricsData?.infrastructure.cpu.peak}%</div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.infrastructure.memory.current}%</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.infrastructure.memory.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.infrastructure.memory.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.infrastructure.memory.current} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.infrastructure.memory.average}%</div>
                  <div>Peak: {metricsData?.infrastructure.memory.peak}%</div>
                </div>
              </CardContent>
            </Card>

            {/* Disk Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.infrastructure.disk.current}%</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.infrastructure.disk.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.infrastructure.disk.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.infrastructure.disk.current} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Avg: {metricsData?.infrastructure.disk.average}%</div>
                  <div>Peak: {metricsData?.infrastructure.disk.peak}%</div>
                </div>
              </CardContent>
            </Card>

            {/* Network Traffic */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Network Traffic</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ↓{metricsData?.infrastructure.network.inbound}Mbps
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.infrastructure.network.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.infrastructure.network.change || 0)}%
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Inbound: {metricsData?.infrastructure.network.inbound}Mbps</div>
                  <div>Outbound: {metricsData?.infrastructure.network.outbound}Mbps</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {/* Conversions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.business.conversions.current}</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.business.conversions.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.business.conversions.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.business.conversions.completion} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Goal: {metricsData?.business.conversions.goal}</div>
                  <div>Completion: {metricsData?.business.conversions.completion}%</div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${(metricsData?.business.revenue.current || 0).toLocaleString()}</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.business.revenue.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.business.revenue.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.business.revenue.completion} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Goal: ${(metricsData?.business.revenue.goal || 0).toLocaleString()}</div>
                  <div>Completion: {metricsData?.business.revenue.completion}%</div>
                </div>
              </CardContent>
            </Card>

            {/* User Satisfaction */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metricsData?.business.userSatisfaction.current}/5</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.business.userSatisfaction.trend || 'stable')}
                  <span className="text-gray-600">
                    {Math.abs(metricsData?.business.userSatisfaction.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={(metricsData?.business.userSatisfaction.current || 0) * 20} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Goal: {metricsData?.business.userSatisfaction.goal}/5</div>
                  <div>Completion: {metricsData?.business.userSatisfaction.completion}%</div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(metricsData?.business.activeUsers.current || 0).toLocaleString()}</div>
                <div className="flex items-center space-x-1 text-xs">
                  {getTrendIcon(metricsData?.business.activeUsers.trend || 'stable')}
                  <span className="text-green-600">
                    {Math.abs(metricsData?.business.activeUsers.change || 0)}%
                  </span>
                </div>
                <div className="mt-2">
                  <Progress value={metricsData?.business.activeUsers.completion} className="h-2" />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>Goal: {(metricsData?.business.activeUsers.goal || 0).toLocaleString()}</div>
                  <div>Completion: {metricsData?.business.activeUsers.completion}%</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
