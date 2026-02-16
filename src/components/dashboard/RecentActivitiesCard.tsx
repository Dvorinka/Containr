import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, 
  Database, 
  Settings, 
  UserPlus, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

export function RecentActivitiesCard() {
  const activities = [
    {
      id: 1,
      type: 'deployment',
      title: 'web-app deployed successfully',
      description: 'Version 2.1.0 deployed to production',
      time: '2 minutes ago',
      status: 'success',
      icon: GitBranch
    },
    {
      id: 2,
      type: 'database',
      title: 'Database backup completed',
      description: 'PostgreSQL backup automated',
      time: '15 minutes ago',
      status: 'success',
      icon: Database
    },
    {
      id: 3,
      type: 'settings',
      title: 'Configuration updated',
      description: 'Environment variables modified',
      time: '1 hour ago',
      status: 'warning',
      icon: Settings
    },
    {
      id: 4,
      type: 'user',
      title: 'New team member added',
      description: 'John Doe joined the project',
      time: '3 hours ago',
      status: 'success',
      icon: UserPlus
    },
    {
      id: 5,
      type: 'alert',
      title: 'High memory usage detected',
      description: 'Node-3 memory usage at 85%',
      time: '4 hours ago',
      status: 'error',
      icon: AlertTriangle
    },
    {
      id: 6,
      type: 'deployment',
      title: 'API server restarted',
      description: 'Automatic restart after crash',
      time: '6 hours ago',
      status: 'success',
      icon: GitBranch
    },
    {
      id: 7,
      type: 'deployment',
      title: 'Worker service updated',
      description: 'Background tasks service patched',
      time: '8 hours ago',
      status: 'success',
      icon: GitBranch
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>7 new activities today</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-2.5 px-2">
            Details
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Time Filter */}
          <div className="flex flex-wrap gap-2.5" role="radiogroup">
            {['Today', 'Yesterday', 'This Week', 'This Month'].map((period) => (
              <Button
                key={period}
                variant={period === 'Today' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-sm"
              >
                {period}
              </Button>
            ))}
          </div>

          {/* Activities List */}
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-shrink-0 mt-0.5">
                  <activity.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {activity.title}
                    </h4>
                    {getStatusIcon(activity.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {activity.time}
                    </span>
                    {getStatusBadge(activity.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
