import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useToast } from '@/components/ui/toaster';
import {
  Plus,
  Database,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Activity,
  MemoryStick,
  HardDrive,
  Download,
  RefreshCw,
  Settings
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DatabaseService {
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
  };
  backups: {
    enabled: boolean;
    lastBackup?: string;
    retention: number;
  };
}

const mockDatabases: DatabaseService[] = [
  {
    id: '1',
    name: 'main-postgres',
    type: 'postgresql',
    status: 'running',
    version: '15.4',
    plan: 'standard',
    region: 'us-east-1',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    connectionUrl: 'postgresql://user:pass@main-postgres.containr.local:5432/dbname',
    metrics: {
      cpu: 25,
      memory: 60,
      storage: 45,
      connections: 12
    },
    backups: {
      enabled: true,
      lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      retention: 30
    }
  },
  {
    id: '2',
    name: 'cache-redis',
    type: 'redis',
    status: 'running',
    version: '7.2',
    plan: 'starter',
    region: 'us-east-1',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    connectionUrl: 'redis://cache-redis.containr.local:6379',
    metrics: {
      cpu: 15,
      memory: 40,
      storage: 20,
      connections: 8
    },
    backups: {
      enabled: true,
      lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      retention: 7
    }
  }
];

const _databasePlans = {
  hobby: { cpu: 1, memory: 1, storage: 10, price: 0 },
  starter: { cpu: 1, memory: 2, storage: 25, price: 15 },
  standard: { cpu: 2, memory: 4, storage: 100, price: 50 },
  business: { cpu: 4, memory: 8, storage: 500, price: 200 }
};

export default function DatabaseServices() {
  const { isFeatureEnabled, isDemoMode, config } = useAppConfig();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseService | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql' as 'postgresql' | 'redis' | 'mysql',
    plan: 'starter' as 'hobby' | 'starter' | 'standard' | 'business',
    region: 'us-east-1'
  });

  const queryClient = useQueryClient();

  // Enhanced query with error handling and caching
  const { data: databases = [], isLoading, error, refetch } = useQuery<DatabaseService[]>({
    queryKey: ['databases'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/databases');
        if (!response.ok) throw new Error('Failed to fetch databases');
        return response.json();
      } catch (err) {
        console.error('Failed to fetch databases:', err);
        throw err;
      }
    },
    enabled: isFeatureEnabled('databases'),
    staleTime: 30000,
    retry: 3,
  });

  // Enhanced mutations with better error handling
  const createDatabaseMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      try {
        const response = await fetch('/api/databases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create database: ${response.statusText}`);
        }
        return response.json();
      } catch (err) {
        console.error('Failed to create database:', err);
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      setIsCreateModalOpen(false);
      setFormData({ name: '', type: 'postgresql', plan: 'starter', region: 'us-east-1' });
      
      toast({
        title: 'Success',
        description: `Database "${data.name}" created successfully`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create database',
        variant: 'destructive',
      });
    },
  });

  const toggleDatabaseMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' }) => {
      try {
        const response = await fetch(`/api/databases/${id}/${action}`, { method: 'POST' });
        if (!response.ok) throw new Error(`Failed to ${action} database`);
        return response.json();
      } catch (err) {
        console.error(`Failed to ${action} database:`, err);
        throw err;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      
      toast({
        title: 'Success',
        description: `Database ${variables.action}ed successfully`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update database',
        variant: 'destructive',
      });
    },
  });

  // Check if user can create more databases
  const canCreateMoreDatabases = !isDemoMode || databases.length < config.limits.maxServices;

  const filteredDatabases = databases.filter(db =>
    db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    db.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isFeatureEnabled('databases')) {
    return (
      <div className="p-6 text-center">
        <Database className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Database Services Not Available</h2>
        <p className="text-muted-foreground">Upgrade to production mode to access database features</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Error loading databases</h2>
          <p className="text-gray-600 mt-2">{error instanceof Error ? error.message : 'Please check your connection and try again.'}</p>
          <Button onClick={() => refetch()} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Error loading databases</h2>
          <p className="text-gray-600 mt-2">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Database Services</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Managed PostgreSQL, Redis, and MySQL databases for your applications
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => {
              if (!canCreateMoreDatabases) {
                toast({
                  title: 'Limit Reached',
                  description: `You've reached the maximum of ${config.limits.maxServices} databases in ${config.mode} mode`,
                  variant: 'destructive',
                });
                return;
              }
              setIsCreateModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Database
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search databases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Database Grid */}
      {filteredDatabases.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Database className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm ? 'No databases found' : 'No databases yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Create your first database to get started with managed data storage'
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Database
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDatabases.map((database) => (
            <Card key={database.id} className="group hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{getDatabaseIcon(database.type)}</div>
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold truncate">
                        {database.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">
                        {database.type} • {database.version}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(database.status)} animate-pulse`} />
                    {getStatusBadge(database.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="font-medium">{database.metrics.cpu}%</div>
                      <div className="text-xs text-muted-foreground">CPU</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-green-500" />
                    <div>
                      <div className="font-medium">{database.metrics.memory}%</div>
                      <div className="text-xs text-muted-foreground">Memory</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="font-medium">{database.metrics.storage}%</div>
                      <div className="text-xs text-muted-foreground">Storage</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="font-medium">{database.metrics.connections}</div>
                      <div className="text-xs text-muted-foreground">Connections</div>
                    </div>
                  </div>
                </div>

                {/* Plan and Region */}
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline" className="capitalize">
                    {database.plan}
                  </Badge>
                  <span className="text-muted-foreground">{database.region}</span>
                </div>

                {/* Backup Status */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {database.backups.enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-muted-foreground">
                      Backups {database.backups.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  {database.backups.lastBackup && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(database.backups.lastBackup), { addSuffix: true })}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigator.clipboard.writeText(database.connectionUrl)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Copy URL
                  </Button>
                  <Button 
                    variant={database.status === 'running' ? 'destructive' : 'default'}
                    size="sm" 
                    className="flex-1"
                    onClick={() => toggleDatabaseMutation.mutate({
                      id: database.id,
                      action: database.status === 'running' ? 'stop' : 'start'
                    })}
                    disabled={toggleDatabaseMutation.isPending}
                  >
                    {database.status === 'running' ? (
                      <Pause className="w-3 h-3 mr-1" />
                    ) : (
                      <Play className="w-3 h-3 mr-1" />
                    )}
                    {database.status === 'running' ? 'Stop' : 'Start'}
                  </Button>
                  <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Database Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Database</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Database Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="my-database"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Database Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="redis">Redis</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="plan">Plan</Label>
                <Tabs value={formData.plan} onValueChange={(value) => setFormData({ ...formData, plan: value as any })} className="mt-1">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="hobby">Hobby</TabsTrigger>
                    <TabsTrigger value="starter">Starter</TabsTrigger>
                    <TabsTrigger value="standard">Standard</TabsTrigger>
                    <TabsTrigger value="business">Business</TabsTrigger>
                  </TabsList>
                  <TabsContent value="hobby" className="mt-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold">Hobby Plan</h4>
                      <p className="text-sm text-muted-foreground">Perfect for development and small projects</p>
                      <div className="mt-2 text-sm">
                        <div>• 1 CPU • 1GB RAM • 10GB Storage</div>
                        <div>• Free tier</div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="starter" className="mt-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold">Starter Plan - $15/month</h4>
                      <p className="text-sm text-muted-foreground">Great for production applications</p>
                      <div className="mt-2 text-sm">
                        <div>• 1 CPU • 2GB RAM • 25GB Storage</div>
                        <div>• Automated backups</div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="standard" className="mt-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold">Standard Plan - $50/month</h4>
                      <p className="text-sm text-muted-foreground">For growing applications</p>
                      <div className="mt-2 text-sm">
                        <div>• 2 CPUs • 4GB RAM • 100GB Storage</div>
                        <div>• Enhanced monitoring</div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="business" className="mt-2">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-semibold">Business Plan - $200/month</h4>
                      <p className="text-sm text-muted-foreground">High-performance databases</p>
                      <div className="mt-2 text-sm">
                        <div>• 4 CPUs • 8GB RAM • 500GB Storage</div>
                        <div>• Priority support</div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                <Label htmlFor="region">Region</Label>
                <select
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU West (Ireland)</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setFormData({ name: '', type: 'postgresql', plan: 'starter', region: 'us-east-1' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createDatabaseMutation.mutate(formData)}
                  disabled={!formData.name || createDatabaseMutation.isPending}
                  className="flex-1"
                >
                  {createDatabaseMutation.isPending ? 'Creating...' : 'Create Database'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
