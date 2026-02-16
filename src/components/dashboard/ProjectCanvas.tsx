import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  GitBranch, 
  Database, 
  Settings, 
  Globe, 
  Cpu, 
  Play, 
  Square, 
  RotateCcw, 
  Eye, 
  MoreHorizontal,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  Pause,
  Zap,
  Server,
  GitPullRequest,
  GitCommit,
  PackageOpen
} from 'lucide-react';
import { useState } from 'react';

interface ServiceNode {
  id: string;
  name: string;
  type: 'app' | 'database' | 'worker' | 'api' | 'cron' | 'static';
  status: 'running' | 'building' | 'failed' | 'stopped' | 'deploying';
  source?: string;
  url?: string;
  lastDeploy?: string;
  cpu?: string;
  memory?: string;
  connections?: string[];
  // Railway-inspired features
  environment?: 'production' | 'preview' | 'development';
  buildCommand?: string;
  startCommand?: string;
  variables?: Record<string, string>;
  deployments?: Deployment[];
  logsEnabled?: boolean;
  metricsEnabled?: boolean;
  healthCheckPath?: string;
  instances?: number;
  region?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  buildTime?: string;
  uptime?: string;
  errorRate?: string;
  responseTime?: string;
}

interface Deployment {
  id: string;
  version: string;
  status: 'success' | 'failed' | 'building';
  timestamp: string;
  commitHash: string;
  commitMessage: string;
  buildTime: string;
  triggeredBy: 'push' | 'manual' | 'api';
}

const mockServices: ServiceNode[] = [
  {
    id: '1',
    name: 'web-app',
    type: 'app',
    status: 'running',
    source: 'GitHub: containr/web-app',
    url: 'https://app.containr.dev',
    lastDeploy: '2 hours ago',
    cpu: '245m',
    memory: '512Mi',
    connections: ['2', '3'],
    environment: 'production',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    variables: { 'NODE_ENV': 'production', 'PORT': '3000' },
    deployments: [
      {
        id: 'd1',
        version: 'v1.2.3',
        status: 'success',
        timestamp: '2024-07-15T14:30:00Z',
        commitHash: 'abc123',
        commitMessage: 'Fix authentication bug',
        buildTime: '2m 15s',
        triggeredBy: 'push'
      }
    ],
    logsEnabled: true,
    metricsEnabled: true,
    healthCheckPath: '/health',
    instances: 2,
    region: 'us-east-1',
    repository: 'containr/web-app',
    branch: 'main',
    commitHash: 'abc123',
    buildTime: '2m 15s',
    uptime: '99.9%',
    errorRate: '0.1%',
    responseTime: '120ms'
  },
  {
    id: '2',
    name: 'api-server',
    type: 'api',
    status: 'running',
    source: 'GitHub: containr/api',
    url: 'https://api.containr.dev',
    lastDeploy: '1 day ago',
    cpu: '180m',
    memory: '256Mi',
    connections: ['3'],
    environment: 'production',
    buildCommand: 'go build -o api',
    startCommand: './api',
    variables: { 'GIN_MODE': 'release', 'DB_HOST': 'postgres-db' },
    deployments: [
      {
        id: 'd2',
        version: 'v2.1.0',
        status: 'success',
        timestamp: '2024-07-14T10:15:00Z',
        commitHash: 'def456',
        commitMessage: 'Add rate limiting',
        buildTime: '1m 30s',
        triggeredBy: 'push'
      }
    ],
    logsEnabled: true,
    metricsEnabled: true,
    healthCheckPath: '/ping',
    instances: 3,
    region: 'us-east-1',
    repository: 'containr/api',
    branch: 'main',
    commitHash: 'def456',
    buildTime: '1m 30s',
    uptime: '99.7%',
    errorRate: '0.3%',
    responseTime: '85ms'
  },
  {
    id: '3',
    name: 'postgres-db',
    type: 'database',
    status: 'running',
    source: 'PostgreSQL 14',
    lastDeploy: '3 days ago',
    cpu: '95m',
    memory: '1Gi',
    environment: 'production',
    variables: { 'POSTGRES_DB': 'containr', 'POSTGRES_USER': 'admin' },
    logsEnabled: true,
    metricsEnabled: true,
    instances: 1,
    region: 'us-east-1',
    uptime: '100%',
    errorRate: '0%'
  },
  {
    id: '4',
    name: 'redis-cache',
    type: 'database',
    status: 'running',
    source: 'Redis 7',
    lastDeploy: '3 days ago',
    cpu: '50m',
    memory: '128Mi',
    environment: 'production',
    variables: { 'REDIS_PASSWORD': 'secret123' },
    logsEnabled: true,
    metricsEnabled: true,
    instances: 1,
    region: 'us-east-1',
    uptime: '100%',
    errorRate: '0%'
  },
  {
    id: '5',
    name: 'background-worker',
    type: 'worker',
    status: 'deploying',
    source: 'GitHub: containr/worker',
    lastDeploy: 'Deploying...',
    cpu: '120m',
    memory: '256Mi',
    environment: 'production',
    buildCommand: 'npm run build',
    startCommand: 'npm run worker',
    variables: { 'QUEUE_URL': 'redis://redis-cache:6379' },
    deployments: [
      {
        id: 'd3',
        version: 'v1.0.1',
        status: 'building',
        timestamp: '2024-07-15T16:45:00Z',
        commitHash: 'ghi789',
        commitMessage: 'Update job processing',
        buildTime: 'Building...',
        triggeredBy: 'manual'
      }
    ],
    logsEnabled: true,
    metricsEnabled: false,
    instances: 1,
    region: 'us-east-1',
    repository: 'containr/worker',
    branch: 'main',
    commitHash: 'ghi789',
    buildTime: 'Building...'
  },
  {
    id: '6',
    name: 'monitoring',
    type: 'app',
    status: 'stopped',
    source: 'GitHub: containr/monitoring',
    lastDeploy: '1 week ago',
    cpu: '0m',
    memory: '0Mi',
    environment: 'development',
    buildCommand: 'docker build -t monitor .',
    startCommand: 'docker run -p 3001:3000 monitor',
    variables: { 'ENV': 'dev' },
    deployments: [
      {
        id: 'd4',
        version: 'v0.9.0',
        status: 'success',
        timestamp: '2024-07-08T09:00:00Z',
        commitHash: 'jkl012',
        commitMessage: 'Add dashboard metrics',
        buildTime: '3m 45s',
        triggeredBy: 'manual'
      }
    ],
    logsEnabled: false,
    metricsEnabled: false,
    instances: 0,
    region: 'us-east-1',
    repository: 'containr/monitoring',
    branch: 'develop',
    commitHash: 'jkl012',
    buildTime: '3m 45s',
    uptime: '0%',
    errorRate: '0%'
  }
];

const getServiceIcon = (type: string) => {
  switch (type) {
    case 'app':
      return <Globe className="w-4 h-4" />;
    case 'api':
      return <Settings className="w-4 h-4" />;
    case 'database':
      return <Database className="w-4 h-4" />;
    case 'worker':
      return <Cpu className="w-4 h-4" />;
    case 'cron':
      return <Clock className="w-4 h-4" />;
    case 'static':
      return <PackageOpen className="w-4 h-4" />;
    default:
      return <Server className="w-4 h-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'bg-green-500';
    case 'building':
    case 'deploying':
      return 'bg-yellow-500';
    case 'failed':
      return 'bg-red-500';
    case 'stopped':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'running':
      return <Badge variant="default" className="bg-green-100 text-green-800">Running</Badge>;
    case 'building':
      return <Badge variant="secondary">Building</Badge>;
    case 'deploying':
      return <Badge variant="secondary">Deploying</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'stopped':
      return <Badge variant="outline">Stopped</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running':
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    case 'building':
    case 'deploying':
      return <Activity className="w-3 h-3 text-yellow-600" />;
    case 'failed':
      return <AlertTriangle className="w-3 h-3 text-red-600" />;
    case 'stopped':
      return <Pause className="w-3 h-3 text-gray-600" />;
    default:
      return <Clock className="w-3 h-3 text-gray-600" />;
  }
};

const getEnvironmentBadge = (environment?: string) => {
  if (!environment) return null;
  switch (environment) {
    case 'production':
      return <Badge className="bg-red-100 text-red-800 text-xs">PROD</Badge>;
    case 'preview':
      return <Badge className="bg-blue-100 text-blue-800 text-xs">PREVIEW</Badge>;
    case 'development':
      return <Badge className="bg-gray-100 text-gray-800 text-xs">DEV</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{environment.toUpperCase()}</Badge>;
  }
};

const getActionButton = (status: string, onAction: (action: string) => void) => {
  switch (status) {
    case 'running':
      return (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction('restart')}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Restart
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction('stop')}>
            <Square className="w-3 h-3 mr-1" />
            Stop
          </Button>
        </div>
      );
    case 'stopped':
      return (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction('start')}>
          <Play className="w-3 h-3 mr-1" />
          Start
        </Button>
      );
    case 'building':
      return (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled>
          Building...
        </Button>
      );
    case 'failed':
      return (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction('rebuild')}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Rebuild
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction('logs')}>
            <Eye className="w-3 h-3 mr-1" />
            Logs
          </Button>
        </div>
      );
    default:
      return null;
  }
};

export function ProjectCanvas() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'variables' | 'metrics'>('overview');

  const handleAction = (action: string) => {
    console.log(`Action: ${action} on service: ${selectedService}`);
    // Here you would handle the actual action
  };

  const selectedServiceData = mockServices.find(s => s.id === selectedService);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Project Canvas</CardTitle>
            <Badge variant="outline" className="text-xs">
              {mockServices.length} services
            </Badge>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <GitBranch className="w-4 h-4 mr-2" />
              Deploy All
            </Button>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockServices.map((service) => (
            <div
              key={service.id}
              className={`relative p-4 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer ${
                selectedService === service.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedService(service.id)}
            >
              {/* Status Indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)} animate-pulse`} />
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </div>

              {/* Service Header */}
              <div className="flex items-center gap-2 mb-3">
                {getServiceIcon(service.type)}
                <h3 className="font-semibold text-sm">{service.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {service.type}
                </Badge>
                {getEnvironmentBadge(service.environment)}
              </div>

              {/* Service Info */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground truncate">
                  {service.source}
                </div>
                
                {service.url && (
                  <div className="text-xs text-blue-600 hover:underline truncate">
                    {service.url}
                  </div>
                )}

                {/* Resource Usage */}
                {service.cpu && service.memory && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>CPU: {service.cpu}</span>
                    <span>•</span>
                    <span>Memory: {service.memory}</span>
                    {service.instances && service.instances > 1 && (
                      <>
                        <span>•</span>
                        <span>{service.instances}x</span>
                      </>
                    )}
                  </div>
                )}

                {/* Performance Metrics */}
                {service.uptime && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      <span>{service.uptime}</span>
                    </div>
                    {service.responseTime && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{service.responseTime}</span>
                      </div>
                    )}
                    {service.errorRate && service.errorRate !== '0%' && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-red-500">{service.errorRate}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {service.commitHash && (
                    <div className="flex items-center gap-1">
                      <GitCommit className="w-3 h-3" />
                      <span>{service.commitHash.substring(0, 7)}</span>
                      {service.branch && (
                        <>
                          <span>•</span>
                          <GitBranch className="w-3 h-3" />
                          <span>{service.branch}</span>
                        </>
                      )}
                    </div>
                  )}
                  Last deploy: {service.lastDeploy}
                </div>

                <div className="flex items-center justify-between pt-2">
                  {getStatusBadge(service.status)}
                  {getActionButton(service.status, handleAction)}
                </div>
              </div>

              {/* Connection Lines (Visual representation) */}
              {service.connections && service.connections.length > 0 && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Selected Service Details */}
        {selectedService && selectedServiceData && (
          <div className="mt-6 p-4 rounded-lg border bg-muted/50">
            {/* Service Detail Tabs */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Service Details: {selectedServiceData.name}</h4>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {(['overview', 'deployments', 'variables', 'metrics'] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs capitalize"
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedServiceData.status)}
                    {getStatusBadge(selectedServiceData.status)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="capitalize mt-1">{selectedServiceData.type}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Environment</div>
                  <div className="mt-1">{getEnvironmentBadge(selectedServiceData.environment)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Region</div>
                  <div className="mt-1">{selectedServiceData.region || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Repository</div>
                  <div className="truncate mt-1">{selectedServiceData.repository || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Branch</div>
                  <div className="mt-1">{selectedServiceData.branch || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Instances</div>
                  <div className="mt-1">{selectedServiceData.instances || 1}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Build Time</div>
                  <div className="mt-1">{selectedServiceData.buildTime || 'N/A'}</div>
                </div>
              </div>
            )}

            {activeTab === 'deployments' && selectedServiceData.deployments && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium">Recent Deployments</h5>
                <div className="space-y-2">
                  {selectedServiceData.deployments.map((deployment) => (
                    <div key={deployment.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={deployment.status === 'success' ? 'default' : 'secondary'}>
                            {deployment.status}
                          </Badge>
                          <span className="text-sm font-medium">{deployment.version}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{deployment.timestamp}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">{deployment.commitMessage}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <GitCommit className="w-3 h-3" />
                          <span>{deployment.commitHash.substring(0, 7)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{deployment.buildTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <GitPullRequest className="w-3 h-3" />
                          <span>{deployment.triggeredBy}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'variables' && selectedServiceData.variables && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium">Environment Variables</h5>
                <div className="space-y-2">
                  {Object.entries(selectedServiceData.variables).map(([key]) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded border bg-card">
                      <span className="text-sm font-mono">{key}</span>
                      <span className="text-sm text-muted-foreground">••••••••</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'metrics' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Uptime</div>
                  <div className="text-lg font-bold text-green-600 mt-1">{selectedServiceData.uptime || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Error Rate</div>
                  <div className="text-lg font-bold text-red-600 mt-1">{selectedServiceData.errorRate || '0%'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Response Time</div>
                  <div className="text-lg font-bold text-blue-600 mt-1">{selectedServiceData.responseTime || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Logs</div>
                  <div className="mt-1">
                    <Badge variant={selectedServiceData.logsEnabled ? 'default' : 'outline'}>
                      {selectedServiceData.logsEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Canvas Legend */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Running</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Building/Deploying</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span>Stopped</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
