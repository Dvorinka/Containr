import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText,
  Eye,
  MousePointer,
  Clock,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Link
} from 'lucide-react';

interface ContentAnalyticsProps {
  timeRange: string;
}

export function ContentAnalytics({ timeRange }: ContentAnalyticsProps) {
  // Mock data - in real implementation, this would come from Umami API
  const contentData = {
    topPages: [
      { 
        url: '/dashboard', 
        title: 'Dashboard', 
        pageviews: 12456, 
        uniquePageviews: 8234,
        avgTimeOnPage: 245,
        bounceRate: 32.1,
        exitRate: 28.4,
        trend: 'up' as const,
        change: 12.5
      },
      { 
        url: '/projects', 
        title: 'Projects', 
        pageviews: 9876, 
        uniquePageviews: 6789,
        avgTimeOnPage: 189,
        bounceRate: 28.7,
        exitRate: 31.2,
        trend: 'up' as const,
        change: 8.3
      },
      { 
        url: '/analytics', 
        title: 'Analytics', 
        pageviews: 7654, 
        uniquePageviews: 5432,
        avgTimeOnPage: 312,
        bounceRate: 24.1,
        exitRate: 26.8,
        trend: 'down' as const,
        change: -3.2
      },
      { 
        url: '/docs', 
        title: 'Documentation', 
        pageviews: 5432, 
        uniquePageviews: 4321,
        avgTimeOnPage: 428,
        bounceRate: 18.9,
        exitRate: 22.3,
        trend: 'up' as const,
        change: 15.7
      },
      { 
        url: '/settings', 
        title: 'Settings', 
        pageviews: 3210, 
        uniquePageviews: 2876,
        avgTimeOnPage: 156,
        bounceRate: 41.2,
        exitRate: 38.7,
        trend: 'up' as const,
        change: 6.8
      }
    ],
    landingPages: [
      { 
        url: '/', 
        title: 'Home', 
        entrances: 8765, 
        bounceRate: 34.2,
        conversions: 234,
        conversionRate: 2.7
      },
      { 
        url: '/blog/getting-started', 
        title: 'Getting Started', 
        entrances: 5432, 
        bounceRate: 28.9,
        conversions: 189,
        conversionRate: 3.5
      },
      { 
        url: '/features', 
        title: 'Features', 
        entrances: 3210, 
        bounceRate: 31.5,
        conversions: 98,
        conversionRate: 3.1
      }
    ],
    exitPages: [
      { 
        url: '/thank-you', 
        title: 'Thank You', 
        exits: 2345, 
        exitRate: 78.9,
        totalPageviews: 2976
      },
      { 
        url: '/pricing', 
        title: 'Pricing', 
        exits: 1876, 
        exitRate: 45.2,
        totalPageviews: 4156
      },
      { 
        url: '/contact', 
        title: 'Contact', 
        exits: 1543, 
        exitRate: 38.7,
        totalPageviews: 3987
      }
    ],
    events: [
      { 
        name: 'button_click', 
        count: 12456, 
        uniqueUsers: 8234,
        category: 'engagement'
      },
      { 
        name: 'form_submit', 
        count: 3456, 
        uniqueUsers: 2876,
        category: 'conversion'
      },
      { 
        name: 'video_play', 
        count: 2345, 
        uniqueUsers: 1987,
        category: 'engagement'
      },
      { 
        name: 'download', 
        count: 1234, 
        uniqueUsers: 1098,
        category: 'conversion'
      }
    ]
  };

  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? (
      <ArrowUp className="w-3 h-3 text-green-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-red-500" />
    );
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Top Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentData.topPages.map((page) => (
            <div key={page.url} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium text-sm">{page.title}</h4>
                    <p className="text-xs text-muted-foreground">{page.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {getTrendIcon(page.trend)}
                  <span className={`text-xs ${
                    page.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(page.change)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Pageviews</div>
                  <div className="font-semibold">{page.pageviews.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Unique</div>
                  <div className="font-semibold">{page.uniquePageviews.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg. Time</div>
                  <div className="font-semibold">{formatDuration(page.avgTimeOnPage)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bounce Rate</div>
                  <div className="font-semibold">{page.bounceRate}%</div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Landing Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Landing Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contentData.landingPages.map((page) => (
            <div key={page.url} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">{page.title}</h4>
                  <p className="text-xs text-muted-foreground">{page.url}</p>
                </div>
                <div className="text-right">
                  <Badge variant={page.conversionRate > 3 ? "default" : "secondary"}>
                    {page.conversionRate}% conversion
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Entrances</div>
                  <div className="font-semibold">{page.entrances.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bounce Rate</div>
                  <div className="font-semibold">{page.bounceRate}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Conversions</div>
                  <div className="font-semibold">{page.conversions}</div>
                </div>
              </div>
              <Progress value={page.bounceRate} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Exit Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Exit Pages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contentData.exitPages.map((page) => (
            <div key={page.url} className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">{page.title}</h4>
                <p className="text-xs text-muted-foreground">{page.url}</p>
              </div>
              <div className="text-right">
                <div className="font-semibold">{page.exitRate}%</div>
                <div className="text-xs text-muted-foreground">
                  {page.exits.toLocaleString()} exits
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointer className="w-5 h-5" />
            Custom Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contentData.events.map((event) => (
            <div key={event.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <div>
                  <span className="text-sm font-medium">{event.name}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {event.category}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{event.count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {event.uniqueUsers.toLocaleString()} users
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
