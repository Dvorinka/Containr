import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  TrendingUp,
  MapPin
} from 'lucide-react';

interface VisitorAnalyticsProps {
  timeRange: string;
}

export function VisitorAnalytics({ timeRange }: VisitorAnalyticsProps) {
  // Mock data - in real implementation, this would come from Umami API
  const visitorData = {
    newVsReturning: {
      new: 68,
      returning: 32
    },
    devices: {
      desktop: 45,
      mobile: 42,
      tablet: 13
    },
    browsers: [
      { name: 'Chrome', percentage: 45, users: 20356 },
      { name: 'Safari', percentage: 28, users: 12666 },
      { name: 'Firefox', percentage: 12, users: 5428 },
      { name: 'Edge', percentage: 8, users: 3619 },
      { name: 'Others', percentage: 7, users: 3166 }
    ],
    operatingSystems: [
      { name: 'Windows', percentage: 38, users: 17189 },
      { name: 'macOS', percentage: 32, users: 14475 },
      { name: 'Android', percentage: 18, users: 8142 },
      { name: 'iOS', percentage: 10, users: 4523 },
      { name: 'Linux', percentage: 2, users: 905 }
    ],
    countries: [
      { name: 'United States', percentage: 35, users: 15832 },
      { name: 'United Kingdom', percentage: 18, users: 8142 },
      { name: 'Germany', percentage: 12, users: 5428 },
      { name: 'Canada', percentage: 8, users: 3619 },
      { name: 'France', percentage: 7, users: 3166 },
      { name: 'Others', percentage: 20, users: 9047 }
    ],
    languages: [
      { name: 'English', percentage: 45, users: 20356 },
      { name: 'German', percentage: 15, users: 6785 },
      { name: 'French', percentage: 12, users: 5428 },
      { name: 'Spanish', percentage: 10, users: 4523 },
      { name: 'Others', percentage: 18, users: 8142 }
    ]
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'desktop':
        return <Monitor className="w-4 h-4" />;
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* New vs Returning Visitors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            New vs Returning Visitors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">New</Badge>
                <span className="text-sm">First-time visitors</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{visitorData.newVsReturning.new}%</div>
                <div className="text-xs text-muted-foreground">
                  {(45234 * visitorData.newVsReturning.new / 100).toLocaleString()} visitors
                </div>
              </div>
            </div>
            <Progress value={visitorData.newVsReturning.new} className="h-2" />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Returning</Badge>
                <span className="text-sm">Repeat visitors</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{visitorData.newVsReturning.returning}%</div>
                <div className="text-xs text-muted-foreground">
                  {(45234 * visitorData.newVsReturning.returning / 100).toLocaleString()} visitors
                </div>
              </div>
            </div>
            <Progress value={visitorData.newVsReturning.returning} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Device Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Device Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(visitorData.devices).map(([device, percentage]) => (
            <div key={device} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getDeviceIcon(device)}
                  <span className="text-sm capitalize">{device}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.floor(45234 * percentage / 100).toLocaleString()} visitors
                  </div>
                </div>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Browser Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Top Browsers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitorData.browsers.map((browser) => (
            <div key={browser.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">{browser.name}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{browser.percentage}%</div>
                <div className="text-xs text-muted-foreground">
                  {browser.users.toLocaleString()} users
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Top Countries
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitorData.countries.map((country) => (
            <div key={country.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">{country.name}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{country.percentage}%</div>
                <div className="text-xs text-muted-foreground">
                  {country.users.toLocaleString()} visitors
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
