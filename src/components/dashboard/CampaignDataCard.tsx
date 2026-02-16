import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign,
  MoreHorizontal,
  Target,
  Calendar,
  Eye,
  MousePointer,
  ShoppingCart,
  Activity,
  Clock
} from 'lucide-react';
import { useState } from 'react';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'paused' | 'draft';
  reach: number;
  engagement: number;
  conversions: number;
  revenue: number;
  trend: string;
  startDate: string;
  endDate?: string;
  budget: number;
  spent: number;
  ctr: number; // Click-through rate
  cpc: number; // Cost per click
  platform: 'google' | 'facebook' | 'instagram' | 'email' | 'linkedin';
}

const campaignData: Campaign[] = [
  {
    id: 'CAMP-001',
    name: 'Summer Launch 2024',
    status: 'active',
    reach: 45234,
    engagement: 68,
    conversions: 892,
    revenue: 12450,
    trend: '+15%',
    startDate: '2024-06-01',
    endDate: '2024-08-31',
    budget: 15000,
    spent: 8750,
    ctr: 2.8,
    cpc: 0.45,
    platform: 'google'
  },
  {
    id: 'CAMP-002',
    name: 'Product Demo Series',
    status: 'completed',
    reach: 28901,
    engagement: 72,
    conversions: 456,
    revenue: 8900,
    trend: '+8%',
    startDate: '2024-05-15',
    endDate: '2024-06-15',
    budget: 8000,
    spent: 7200,
    ctr: 3.2,
    cpc: 0.38,
    platform: 'facebook'
  },
  {
    id: 'CAMP-003',
    name: 'Newsletter Campaign',
    status: 'active',
    reach: 18923,
    engagement: 54,
    conversions: 234,
    revenue: 3450,
    trend: '-2%',
    startDate: '2024-07-01',
    budget: 5000,
    spent: 2100,
    ctr: 1.8,
    cpc: 0.12,
    platform: 'email'
  }
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
    case 'completed':
      return <Badge variant="secondary">Completed</Badge>;
    case 'paused':
      return <Badge variant="outline">Paused</Badge>;
    case 'draft':
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'google':
      return <Target className="w-4 h-4 text-blue-600" />;
    case 'facebook':
      return <Users className="w-4 h-4 text-blue-500" />;
    case 'instagram':
      return <Eye className="w-4 h-4 text-pink-600" />;
    case 'email':
      return <Activity className="w-4 h-4 text-orange-600" />;
    case 'linkedin':
      return <Users className="w-4 h-4 text-blue-700" />;
    default:
      return <Target className="w-4 h-4" />;
  }
};

const getTrendIcon = (trend: string) => {
  if (trend.startsWith('+')) {
    return <TrendingUp className="w-3 h-3 text-green-600" />;
  } else if (trend.startsWith('-')) {
    return <TrendingDown className="w-3 h-3 text-red-600" />;
  }
  return <Activity className="w-3 h-3 text-gray-600" />;
};

const getTrendColor = (trend: string) => {
  if (trend.startsWith('+')) {
    return 'text-green-600 bg-green-50';
  } else if (trend.startsWith('-')) {
    return 'text-red-600 bg-red-50';
  }
  return 'text-gray-600 bg-gray-50';
};

export function CampaignDataCard() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  
  const totalRevenue = campaignData.reduce((sum, item) => sum + item.revenue, 0);
  const totalConversions = campaignData.reduce((sum, item) => sum + item.conversions, 0);
  const totalBudget = campaignData.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = campaignData.reduce((sum, item) => sum + item.spent, 0);
  const avgEngagement = Math.round(campaignData.reduce((sum, item) => sum + item.engagement, 0) / campaignData.length);
  const activeCampaigns = campaignData.filter(c => c.status === 'active').length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Campaign Data</CardTitle>
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Metrics Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Revenue</span>
            </div>
            <div className="text-lg font-bold">${totalRevenue.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-green-600">+18% vs last month</span>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Conversions</span>
            </div>
            <div className="text-lg font-bold">{totalConversions.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3 text-green-600" />
              <span className="text-green-600">+12% vs last month</span>
            </div>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Budget Utilization</span>
            <span className="font-medium">${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}</span>
          </div>
          <Progress value={(totalSpent / totalBudget) * 100} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round((totalSpent / totalBudget) * 100)}% spent</span>
            <span>${(totalBudget - totalSpent).toLocaleString()} remaining</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">{avgEngagement}%</div>
            <div className="text-xs text-muted-foreground">Avg Engagement</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">{activeCampaigns}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-sm font-bold">2.6%</div>
            <div className="text-xs text-muted-foreground">Avg CTR</div>
          </div>
        </div>

        {/* Campaign List */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Active Campaigns</div>
          <div className="space-y-2">
            {campaignData.filter(c => c.status === 'active').slice(0, 3).map((campaign) => (
              <div
                key={campaign.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedCampaign === campaign.id 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/30 border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedCampaign(campaign.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getPlatformIcon(campaign.platform)}
                      <span className="text-sm font-medium truncate">{campaign.name}</span>
                      {getStatusBadge(campaign.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div>
                        <div className="text-muted-foreground">Reach</div>
                        <div className="font-medium">{campaign.reach.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Revenue</div>
                        <div className="font-medium">${campaign.revenue.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          <span>{campaign.ctr}% CTR</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MousePointer className="w-3 h-3 text-muted-foreground" />
                          <span>${campaign.cpc} CPC</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs ${getTrendColor(campaign.trend)}`}>
                        {getTrendIcon(campaign.trend)}
                        {campaign.trend}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign Timeline */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Recent Activity</div>
          <div className="space-y-2">
            {campaignData.slice(0, 2).map((campaign) => (
              <div key={campaign.id} className="flex items-center gap-3 text-xs">
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="w-3 h-3" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{campaign.name}</div>
                  <div className="text-muted-foreground">
                    {campaign.status === 'active' ? 'Started' : 'Completed'} {campaign.startDate}
                  </div>
                </div>
                <div className="text-muted-foreground">
                  {campaign.status === 'active' ? (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <span>Ended {campaign.endDate}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            View All Campaigns
          </Button>
          <Button size="sm" className="flex-1 text-xs">
            Create Campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
