import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  Play,
  Pause,
  RefreshCw,
  Download,
  Activity,
  HardDrive,
  MemoryStick,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  BarChart3,
  Users,
  Shield,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DatabaseDetail {
  id: string;
  name: string;
  type: 'postgresql' | 'redis' | 'mysql';
  status: 'running' | 'stopped' | 'building' | 'error';
  version: string;
  plan: 'hobby' | 'starter' | 'standard' | 'business';
  region: string;
  createdAt: string;
  updatedAt: string;
  connectionUrl: string;
  metrics: {
    cpu: number;
    memory: number;
    storage: number;
    connections: number;
    readIops: number;
    writeIops: number;
    networkIn: number;
    networkOut: number;
  };
  backups: {
    enabled: boolean;
    lastBackup?: string;
    retention: number;
    nextBackup?: string;
    backups: Array<{
      id: string;
      createdAt: string;
      size: string;
      status: 'completed' | 'failed' | 'in_progress';
    }>;
  };
  settings: {
    maxConnections: number;
    timeout: number;
    ssl: boolean;
    logging: boolean;
  };
}

interface DatabaseDetailPanelProps {
  databaseId: string;
  onClose: () => void;
}

const mockDatabaseDetail: DatabaseDetail = {
  id: '1',
  name: 'main-postgres',
  type: 'postgresql',
  status: 'running',
  version: '15.4',
  plan: 'standard',
  region: 'us-east-1',
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  connectionUrl: 'postgresql://user:password@main-postgres.containr.local:5432/maindb',
  metrics: {
    cpu: 25,
    memory: 60,
    storage: 45,
    connections: 12,
    readIops: 150,
    writeIops: 80,
    networkIn: 2.5,
    networkOut: 1.8
  },
  backups: {
    enabled: true,
    lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    retention: 30,
    nextBackup: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    backups: [
      {
        id: 'backup-1',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        size: '245 MB',
        status: 'completed'
      },
      {
        id: 'backup-2',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        size: '238 MB',
        status: 'completed'
      },
      {
        id: 'backup-3',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        size: '241 MB',
        status: 'completed'
      }
    ]
  },
  settings: {
    maxConnections: 100,
    timeout: 30,
    ssl: true,
    logging: true
  }
};

export default function DatabaseDetailPanel({ databaseId, onClose: _onClose }: DatabaseDetailPanelProps) {
  const [showConnectionUrl, setShowConnectionUrl] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: database = mockDatabaseDetail, isLoading, error } = useQuery({
    queryKey: ['database', databaseId],
    queryFn: () => Promise.resolve(mockDatabaseDetail),
    enabled: !!databaseId,
  });

  const toggleDatabaseMutation = useMutation({
    mutationFn: ({ action: _action }: { action: 'start' | 'stop' | 'restart' }) => {
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: () => {
      return new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (_backupId: string) => {
      return new Promise(resolve => setTimeout(resolve, 5000));
    },
    onSuccess: () => {
      setIsRestoring(false);
      setSelectedBackup(null);
      queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-gray-400';
      case 'building': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-green-100 text-green-800">Running</Badge>;
      case 'stopped': return <Badge variant="secondary">Stopped</Badge>;
      case 'building': return <Badge className="bg-blue-100 text-blue-800">Building</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getDatabaseIcon = (type: string) => {
    switch (type) {
      case 'postgresql': return '🐘';
      case 'redis': return '🔴';
      case 'mysql': return '🐬';
      default: return '💾';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Error loading database details</h2>
          <p className="text-gray-600 mt-2">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{getDatabaseIcon(database.type)}</div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{database.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground capitalize">
                {database.type} • {database.version}
              </span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(database.status)} animate-pulse`} />
              {getStatusBadge(database.status)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleDatabaseMutation.mutate({ action: 'restart' })}
            disabled={toggleDatabaseMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restart
          </Button>
          <Button
            variant={database.status === 'running' ? 'destructive' : 'default'}
            size="sm"
            onClick={() => toggleDatabaseMutation.mutate({
              action: database.status === 'running' ? 'stop' : 'start'
            })}
            disabled={toggleDatabaseMutation.isPending}
          >
            {database.status === 'running' ? (
              <Pause className="w-4 h-4 mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {database.status === 'running' ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Connection Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Connection Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Connection URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showConnectionUrl ? 'text' : 'password'}
                      value={database.connectionUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowConnectionUrl(!showConnectionUrl)}
                    >
                      {showConnectionUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigator.clipboard.writeText(database.connectionUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Plan</Label>
                    <Badge variant="outline" className="capitalize mt-1">
                      {database.plan}
                    </Badge>
                  </div>
                  <div>
                    <Label>Region</Label>
                    <p className="text-muted-foreground mt-1">{database.region}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{database.metrics.connections}</div>
                    <div className="text-sm text-muted-foreground">Active Connections</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{database.metrics.storage}%</div>
                    <div className="text-sm text-muted-foreground">Storage Used</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Created</span>
                    <span>{formatDistanceToNow(new Date(database.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Last Updated</span>
                    <span>{formatDistanceToNow(new Date(database.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  CPU Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.cpu}%</div>
                <Progress value={database.metrics.cpu} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MemoryStick className="w-5 h-5 text-green-500" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.memory}%</div>
                <Progress value={database.metrics.memory} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-orange-500" />
                  Storage Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.storage}%</div>
                <Progress value={database.metrics.storage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  Read IOPS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.readIops}</div>
                <p className="text-sm text-muted-foreground">Operations/sec</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Write IOPS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.writeIops}</div>
                <p className="text-sm text-muted-foreground">Operations/sec</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-500" />
                  Connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{database.metrics.connections}</div>
                <p className="text-sm text-muted-foreground">Active connections</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Backup Configuration
                </CardTitle>
                <Button
                  onClick={() => createBackupMutation.mutate()}
                  disabled={createBackupMutation.isPending}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {createBackupMutation.isPending ? 'Creating...' : 'Create Backup'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  {database.backups.enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                  <span>Automated Backups</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Retention Period:</span>
                  <span className="ml-2 font-medium">{database.backups.retention} days</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Next Backup:</span>
                  <span className="ml-2 font-medium">
                    {database.backups.nextBackup ? 
                      formatDistanceToNow(new Date(database.backups.nextBackup), { addSuffix: true }) :
                      'Not scheduled'
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {database.backups.backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        backup.status === 'completed' ? 'bg-green-500' :
                        backup.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <div>
                        <div className="font-medium">{backup.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{backup.size}</span>
                      <Badge variant={
                        backup.status === 'completed' ? 'default' :
                        backup.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {backup.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBackup(backup.id);
                          setIsRestoring(true);
                        }}
                        disabled={backup.status !== 'completed' || restoreBackupMutation.isPending}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Maximum Connections</Label>
                  <Input
                    type="number"
                    value={database.settings.maxConnections}
                    readOnly
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Connection Timeout (seconds)</Label>
                  <Input
                    type="number"
                    value={database.settings.timeout}
                    readOnly
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={database.settings.ssl}
                    readOnly
                    className="rounded"
                  />
                  <Label>Enable SSL/TLS</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={database.settings.logging}
                    readOnly
                    className="rounded"
                  />
                  <Label>Enable Query Logging</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-2xl font-bold">{database.metrics.connections}</div>
                <p className="text-muted-foreground">Active connections</p>
                <div className="mt-4 text-sm text-muted-foreground">
                  Max connections: {database.settings.maxConnections}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Real-time logs will appear here</p>
                <Button variant="outline" className="mt-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Restore Confirmation Modal */}
      {isRestoring && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Restore</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Are you sure you want to restore from backup "{selectedBackup}"? 
                This will replace the current database data and cannot be undone.
              </p>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRestoring(false);
                    setSelectedBackup(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => restoreBackupMutation.mutate(selectedBackup)}
                  disabled={restoreBackupMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  {restoreBackupMutation.isPending ? 'Restoring...' : 'Restore Database'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
