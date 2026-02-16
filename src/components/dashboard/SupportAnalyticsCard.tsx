import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Package,
  Activity,
  Phone,
  Mail,
  MessageSquare,
  Share2
} from 'lucide-react';
import { useState } from 'react';

interface Ticket {
  id: string;
  subject: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  assignee?: string;
  createdAt: string;
  category: 'bug' | 'feature' | 'support' | 'incident';
}

const mockTickets: Ticket[] = [
  {
    id: 'TK-001',
    subject: 'Database connection timeout in production',
    priority: 'high',
    status: 'in_progress',
    assignee: 'Sarah Chen',
    createdAt: '2 hours ago',
    category: 'incident'
  },
  {
    id: 'TK-002', 
    subject: 'Add custom domain support',
    priority: 'medium',
    status: 'open',
    assignee: 'Mike Johnson',
    createdAt: '5 hours ago',
    category: 'feature'
  },
  {
    id: 'TK-003',
    subject: 'Deployment logs not showing for Node.js apps',
    priority: 'medium', 
    status: 'resolved',
    assignee: 'Alex Kumar',
    createdAt: '1 day ago',
    category: 'bug'
  }
];

const supportData = [
  { channel: 'Email', tickets: 245, trend: '+12%', status: 'up', icon: Mail },
  { channel: 'Chat', tickets: 189, trend: '+8%', status: 'up', icon: MessageSquare },
  { channel: 'Phone', tickets: 67, trend: '-3%', status: 'down', icon: Phone },
  { channel: 'Social', tickets: 34, trend: '0%', status: 'neutral', icon: Share2 },
];

const getTrendIcon = (status: string) => {
  switch (status) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    default:
      return <Minus className="w-4 h-4 text-gray-600" />;
  }
};

const getTrendColor = (status: string) => {
  switch (status) {
    case 'up':
      return 'text-green-600 bg-green-50';
    case 'down':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open':
      return <Clock className="w-3 h-3" />;
    case 'in_progress':
      return <Activity className="w-3 h-3" />;
    case 'resolved':
      return <CheckCircle className="w-3 h-3" />;
    default:
      return <Clock className="w-3 h-3" />;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'incident':
      return <AlertTriangle className="w-3 h-3 text-red-600" />;
    case 'bug':
      return <AlertTriangle className="w-3 h-3 text-orange-600" />;
    case 'feature':
      return <Package className="w-3 h-3 text-blue-600" />;
    case 'support':
      return <Users className="w-3 h-3 text-green-600" />;
    default:
      return <AlertTriangle className="w-3 h-3" />;
  }
};

export function SupportAnalyticsCard() {
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  
  const openTickets = mockTickets.filter(t => t.status !== 'resolved').length;
  const highPriorityTickets = mockTickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length;
  const avgResolutionTime = '4.2 hours';
  const satisfactionRate = '94%';

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Support Analytics</CardTitle>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Open Tickets</span>
            </div>
            <div className="text-lg font-bold">{openTickets}</div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingDown className="w-3 h-3 text-green-600" />
              <span className="text-green-600">-12% from last week</span>
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">High Priority</span>
            </div>
            <div className="text-lg font-bold text-red-600">{highPriorityTickets}</div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3 h-3 text-red-600" />
              <span className="text-red-600">+2 new today</span>
            </div>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Support Channels</div>
          {supportData.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.channel} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{channel.channel}</div>
                    <div className="text-xs text-muted-foreground">{channel.tickets} tickets</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={getTrendColor(channel.status)}>
                    {getTrendIcon(channel.status)}
                    {channel.trend}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Avg Resolution Time</span>
            <span className="font-medium">{avgResolutionTime}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Customer Satisfaction</span>
            <span className="font-medium text-green-600">{satisfactionRate}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Response Rate</span>
            <span className="font-medium">87%</span>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Recent Activity</div>
          <div className="space-y-2">
            {mockTickets.slice(0, 3).map((ticket) => (
              <div
                key={ticket.id}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedTicket === ticket.id 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/30 border-border hover:bg-muted/50'
                }`}
                onClick={() => setSelectedTicket(ticket.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getCategoryIcon(ticket.category)}
                      <span className="text-xs font-medium truncate">{ticket.id}</span>
                      <Badge className={`text-xs px-1.5 py-0.5 ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate leading-tight">
                      {ticket.subject}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {getStatusIcon(ticket.status)}
                      <span>{ticket.assignee || 'Unassigned'}</span>
                      <span>•</span>
                      <span>{ticket.createdAt}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 text-xs">
            View All Tickets
          </Button>
          <Button size="sm" className="flex-1 text-xs">
            New Ticket
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
