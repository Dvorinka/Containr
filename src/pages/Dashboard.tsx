import { SalesMetricCard } from '@/components/dashboard/SalesMetricCard';
import { VisitorsMetricCard } from '@/components/dashboard/VisitorsMetricCard';
import { ConversionRateCard } from '@/components/dashboard/ConversionRateCard';
import { VisitorChannelsChart } from '@/components/dashboard/VisitorChannelsChart';
import { UserRetentionChart } from '@/components/dashboard/UserRetentionChart';
import { WeeklyVisitorsChart } from '@/components/dashboard/WeeklyVisitorsChart';
import { ShippingTrackingCard } from '@/components/dashboard/ShippingTrackingCard';
import { RecentActivitiesCard } from '@/components/dashboard/RecentActivitiesCard';
import { ProjectCanvas } from '@/components/dashboard/ProjectCanvas';
import { SupportAnalyticsCard } from '@/components/dashboard/SupportAnalyticsCard';
import { CampaignDataCard } from '@/components/dashboard/CampaignDataCard';
import { ProductCategoriesCard } from '@/components/dashboard/ProductCategoriesCard';
import { Button } from '@/components/ui/button';
import { GitBranch, Activity, Server, Users } from 'lucide-react';

const stats = [
  {
    title: 'Active Services',
    value: '12',
    change: '+2 from last week',
    icon: Server,
    trend: 'up'
  },
  {
    title: 'Deployments',
    value: '48',
    change: '+8 from last week',
    icon: GitBranch,
    trend: 'up'
  },
  {
    title: 'Team Members',
    value: '6',
    change: 'No change',
    icon: Users,
    trend: 'neutral'
  },
  {
    title: 'Uptime',
    value: '99.9%',
    change: '0.1% improvement',
    icon: Activity,
    trend: 'up'
  }
];

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Welcome to your Containr dashboard - Monitor your infrastructure and deployments
          </p>
        </div>
        <Button className="w-full sm:w-auto">
          <GitBranch className="w-4 h-4 mr-2" />
          New Deployment
        </Button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SalesMetricCard />
        <VisitorsMetricCard />
        <ConversionRateCard />
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <VisitorChannelsChart />
        </div>
        <UserRetentionChart />
        <WeeklyVisitorsChart />
      </div>

      {/* Additional Components Row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <ShippingTrackingCard />
        <RecentActivitiesCard />
        <SupportAnalyticsCard />
      </div>

      {/* Analytics Row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <CampaignDataCard />
        <ProductCategoriesCard />
      </div>

      {/* Project Canvas */}
      <ProjectCanvas />

      {/* Quick Stats Overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.title} className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-xl md:text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
