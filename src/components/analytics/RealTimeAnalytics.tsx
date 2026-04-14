import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Users,
  Eye,
  MousePointer,
  Monitor,
  Smartphone,
  Clock,
  TrendingUp,
  MapPin
} from 'lucide-react';

export function RealTimeAnalytics() {
  const [_currentTime, setCurrentTime] = useState(new Date());
  const [activeUsers, setActiveUsers] = useState(127);
  const [currentVisitors, setCurrentVisitors] = useState(34);

  // Mock real-time data - in real implementation, this would update from WebSocket/API
  const [realTimeData, _setRealTimeData] = useState({
    onlineUsers: 127,
    currentVisitors: 34,
    pageviews: [
      { url: '/dashboard', title: 'Dashboard', count: 12, percentage: 35 },
      { url: '/projects', title: 'Projects', count: 8, percentage: 24 },
      { url: '/analytics', title: 'Analytics', count: 6, percentage: 18 },
      { url: '/docs', title: 'Documentation', count: 4, percentage: 12 },
      { url: '/settings', title: 'Settings', count: 4, percentage: 11 }
    ],
    locations: [
      { country: 'United States', count: 8, percentage: 24 },
      { country: 'United Kingdom', count: 6, percentage: 18 },
      { country: 'Germany', count: 4, percentage: 12 },
      { country: 'Canada', count: 3, percentage: 9 },
      { country: 'France', count: 3, percentage: 9 },
      { country: 'Others', count: 6, percentage: 28 }
    ],
    devices: [
      { type: 'desktop', count: 18, percentage: 53 },
      { type: 'mobile', count: 12, percentage: 35 },
      { type: 'tablet', count: 4, percentage: 12 }
    ],
    recentActivity: [
      { 
        type: 'page_view', 
        user: 'User 1234', 
        page: '/dashboard', 
        location: 'United States',
        device: 'desktop',
        timestamp: new Date(Date.now() - 2 * 60 * 1000)
      },
      { 
        type: 'page_view', 
        user: 'User 5678', 
        page: '/projects', 
        location: 'United Kingdom',
        device: 'mobile',
        timestamp: new Date(Date.now() - 5 * 60 * 1000)
      },
      { 
        type: 'event', 
        user: 'User 9012', 
        page: '/analytics', 
        location: 'Germany',
        device: 'desktop',
        event: 'button_click',
        timestamp: new Date(Date.now() - 8 * 60 * 1000)
      },
      { 
        type: 'page_view', 
        user: 'User 3456', 
        page: '/docs', 
        location: 'Canada',
        device: 'tablet',
        timestamp: new Date(Date.now() - 12 * 60 * 1000)
      },
      { 
        type: 'conversion', 
        user: 'User 7890', 
        page: '/pricing', 
        location: 'France',
        device: 'mobile',
        event: 'form_submit',
        timestamp: new Date(Date.now() - 15 * 60 * 1000)
      }
    ]
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      // Simulate real-time updates
      setActiveUsers(prev => prev + Math.floor(Math.random() * 5) - 2);
      setCurrentVisitors(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const formatTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'page_view':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'event':
        return <MousePointer className="w-4 h-4 text-purple-500" />;
      case 'conversion':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'desktop':
        return <Monitor className="w-3 h-3" />;
      case 'mobile':
        return <Smartphone className="w-3 h-3" />;
      case 'tablet':
        return <Activity className="w-3 h-3" />;
      default:
        return <Monitor className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Overview */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Active now
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Visitors</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentVisitors}</div>
            <p className="text-xs text-muted-foreground">
              On site now
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pageviews/min</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">47</div>
            <p className="text-xs text-muted-foreground">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3:24</div>
            <p className="text-xs text-muted-foreground">
              Current session
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Activity */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Top Pages Now */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Top Pages Now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {realTimeData.pageviews.map((page) => (
              <div key={page.url} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div>
                    <span className="text-sm font-medium">{page.title}</span>
                    <p className="text-xs text-muted-foreground">{page.url}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{page.count}</div>
                  <div className="text-xs text-muted-foreground">{page.percentage}%</div>
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
              Live Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {realTimeData.locations.map((location) => (
              <div key={location.country} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">{location.country}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{location.count}</div>
                  <div className="text-xs text-muted-foreground">{location.percentage}%</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Live Devices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {realTimeData.devices.map((device) => (
              <div key={device.type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(device.type)}
                    <span className="text-sm capitalize">{device.type}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{device.count}</div>
                    <div className="text-xs text-muted-foreground">{device.percentage}%</div>
                  </div>
                </div>
                <Progress value={device.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Live Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {realTimeData.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 border-b pb-2 last:border-0">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{activity.user}</span>
                    <Badge variant="outline" className="text-xs">
                      {activity.location}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {getDeviceIcon(activity.device)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activity.type === 'page_view' && `Viewed ${activity.page}`}
                    {activity.type === 'event' && `Triggered ${activity.event} on ${activity.page}`}
                    {activity.type === 'conversion' && `Converted on ${activity.page}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
