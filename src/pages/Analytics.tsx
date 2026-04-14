import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Calendar, Activity, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { 
  IconDownload, 
  IconCalendar, 
  IconActivity, 
  IconUsers, 
  IconTrendingUp, 
  IconChartBar, 
  IconChartLine,
  IconChartPie,
  IconDeviceAnalytics,
  IconRefresh
} from '@tabler/icons-react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useToast } from '@/components/ui/toaster';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function AnalyticsPage() {
  const { isFeatureEnabled } = useAppConfig();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState('7d');

  const { data: analyticsData, isLoading, error } = useQuery({
    queryKey: ['analytics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    enabled: isFeatureEnabled('analytics'),
  });

  if (!isFeatureEnabled('analytics')) {
    return (
      <div className="p-6 text-center">
        <IconDeviceAnalytics className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Analytics Not Available</h2>
        <p className="text-muted-foreground">Upgrade to production mode to access analytics features</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Analytics"
        description="Monitor your application performance and user behavior"
        action={{
          label: 'Export',
          icon: IconDownload,
          onClick: () => toast({ title: 'Export started', description: 'Analytics data is being prepared' })
        }}
      />

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-center">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">Failed to load analytics data</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        <Card className="card-hover card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconUsers className="w-5 h-5 text-blue-500" />
              Total Visitors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{analyticsData?.visitors || 0}</div>
            <div className="flex items-center gap-2 text-sm">
              <IconTrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">+12.5%</span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconChartBar className="w-5 h-5 text-green-500" />
              Page Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{analyticsData?.pageViews || 0}</div>
            <div className="flex items-center gap-2 text-sm">
              <IconTrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">+8.2%</span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconActivity className="w-5 h-5 text-purple-500" />
              Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{analyticsData?.activeUsers || 0}</div>
            <div className="flex items-center gap-2 text-sm">
              <IconTrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">+23.1%</span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconChartPie className="w-5 h-5 text-orange-500" />
              Bounce Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">32.4%</div>
            <div className="flex items-center gap-2 text-sm">
              <IconTrendingUp className="w-4 h-4 text-red-500 rotate-180" />
              <span className="text-red-500">-5.3%</span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
