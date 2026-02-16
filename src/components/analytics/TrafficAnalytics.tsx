import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Search,
  Globe,
  ExternalLink,
  MousePointer,
  TrendingUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface TrafficAnalyticsProps {
  timeRange: string;
}

export function TrafficAnalytics({ timeRange }: TrafficAnalyticsProps) {
  // Mock data - in real implementation, this would come from Umami API
  const trafficData = {
    sources: [
      { 
        name: 'Organic Search', 
        percentage: 35, 
        visitors: 15832,
        trend: 'up' as const,
        change: 12.5
      },
      { 
        name: 'Direct Traffic', 
        percentage: 28, 
        visitors: 12666,
        trend: 'up' as const,
        change: 8.3
      },
      { 
        name: 'Social Media', 
        percentage: 18, 
        visitors: 8142,
        trend: 'down' as const,
        change: -3.2
      },
      { 
        name: 'Referral', 
        percentage: 12, 
        visitors: 5428,
        trend: 'up' as const,
        change: 15.7
      },
      { 
        name: 'Email Marketing', 
        percentage: 4, 
        visitors: 1809,
        trend: 'up' as const,
        change: 22.1
      },
      { 
        name: 'Paid Search', 
        percentage: 3, 
        visitors: 1357,
        trend: 'down' as const,
        change: -8.9
      }
    ],
    referrers: [
      { name: 'google.com', visitors: 12456, percentage: 27.5 },
      { name: 'github.com', visitors: 8234, percentage: 18.2 },
      { name: 'stackoverflow.com', visitors: 5423, percentage: 12.0 },
      { name: 'twitter.com', visitors: 3612, percentage: 8.0 },
      { name: 'linkedin.com', visitors: 2891, percentage: 6.4 },
      { name: 'Others', visitors: 12618, percentage: 27.9 }
    ],
    campaigns: [
      { 
        name: 'Summer Launch 2024', 
        visitors: 8234, 
        conversionRate: 4.2,
        revenue: 12456
      },
      { 
        name: 'Product Update', 
        visitors: 5423, 
        conversionRate: 3.8,
        revenue: 8234
      },
      { 
        name: 'Newsletter Signup', 
        visitors: 3612, 
        conversionRate: 2.1,
        revenue: 2891
      },
      { 
        name: 'Social Media Push', 
        visitors: 2891, 
        conversionRate: 1.8,
        revenue: 1567
      }
    ],
    keywords: [
      { name: 'container orchestration', visitors: 3421, percentage: 12.3 },
      { name: 'paas platform', visitors: 2891, percentage: 10.4 },
      { name: 'docker deployment', visitors: 2456, percentage: 8.8 },
      { name: 'self-hosted analytics', visitors: 1987, percentage: 7.1 },
      { name: 'railway alternative', visitors: 1654, percentage: 5.9 }
    ]
  };

  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? (
      <ArrowUp className="w-3 h-3 text-green-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-red-500" />
    );
  };

  const getSourceIcon = (source: string) => {
    if (source.includes('Search')) return <Search className="w-4 h-4" />;
    if (source.includes('Direct')) return <MousePointer className="w-4 h-4" />;
    if (source.includes('Social')) return <Globe className="w-4 h-4" />;
    if (source.includes('Referral')) return <ExternalLink className="w-4 h-4" />;
    return <TrendingUp className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Traffic Sources Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Traffic Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trafficData.sources.map((source) => (
            <div key={source.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSourceIcon(source.name)}
                  <span className="text-sm font-medium">{source.name}</span>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(source.trend)}
                    <span className={`text-xs ${
                      source.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Math.abs(source.change)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{source.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {source.visitors.toLocaleString()} visitors
                  </div>
                </div>
              </div>
              <Progress value={source.percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Referrers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Top Referrers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trafficData.referrers.map((referrer) => (
            <div key={referrer.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">{referrer.name}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{referrer.percentage}%</div>
                <div className="text-xs text-muted-foreground">
                  {referrer.visitors.toLocaleString()} visitors
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trafficData.campaigns.map((campaign) => (
            <div key={campaign.name} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm">{campaign.name}</h4>
                <Badge variant="secondary">
                  {campaign.conversionRate}% conversion
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Visitors</div>
                  <div className="font-semibold">{campaign.visitors.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="font-semibold">${campaign.revenue.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Search Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Top Search Keywords
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trafficData.keywords.map((keyword) => (
            <div key={keyword.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">{keyword.name}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{keyword.percentage}%</div>
                <div className="text-xs text-muted-foreground">
                  {keyword.visitors.toLocaleString()} visitors
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
