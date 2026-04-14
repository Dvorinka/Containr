import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  IconSettings, 
  IconKey, 
  IconNetwork, 
  IconRefresh, 
  IconPlayerPlay as IconPlay, 
  IconPlayerPause as IconPause, 
  IconTrash,
  IconWorld,
  IconServer,
  IconDatabase,
  IconCloud
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface ServiceControlsProps {
  service: {
    id: string;
    name: string;
    type: 'service' | 'database' | 'api' | 'frontend';
    status: 'running' | 'building' | 'stopped' | 'error';
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    uptime: number;
    buildStatus?: 'success' | 'building' | 'failed' | 'idle';
    environment?: Record<string, string>;
    port?: number;
    route?: string;
    domain?: string;
    region?: string;
  };
  onStatusChange: (serviceId: string, status: string) => void;
  onEnvironmentChange: (environment: Record<string, string>) => void;
  onPortChange: (port: number) => void;
  onRouteChange: (route: string) => void;
}

export function ServiceControls({ 
  service, 
  onStatusChange, 
  onEnvironmentChange, 
  onPortChange, 
  onRouteChange 
}: ServiceControlsProps) {
  const [envVars, setEnvVars] = useState<Record<string, string>>(service.environment || {});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-emerald-500';
      case 'building': return 'bg-amber-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'service': return <IconServer className="w-4 h-4" />;
      case 'database': return <IconDatabase className="w-4 h-4" />;
      case 'api': return <IconCloud className="w-4 h-4" />;
      case 'frontend': return <IconWorld className="w-4 h-4" />;
      default: return <IconServer className="w-4 h-4" />;
    }
  };

  const handleAddEnvVar = () => {
    if (newEnvKey && newEnvValue) {
      const updated = { ...envVars, [newEnvKey]: newEnvValue };
      setEnvVars(updated);
      onEnvironmentChange(updated);
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    const updated = { ...envVars };
    delete updated[key];
    setEnvVars(updated);
    onEnvironmentChange(updated);
  };

  const handleUpdateEnvVar = (key: string, value: string) => {
    const updated = { ...envVars, [key]: value };
    setEnvVars(updated);
    onEnvironmentChange(updated);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted/50">
              {getTypeIcon(service.type)}
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {service.type}
                </Badge>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  getStatusColor(service.status),
                  service.status === 'running' && "animate-pulse"
                )} />
                <span className="text-xs text-muted-foreground">{service.status}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="environment" className="text-xs">Environment</TabsTrigger>
            <TabsTrigger value="networking" className="text-xs">Networking</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold">{service.cpu}%</div>
                <div className="text-xs text-muted-foreground">CPU Usage</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold">{service.memory}%</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold">{service.disk}%</div>
                <div className="text-xs text-muted-foreground">Disk</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-lg font-bold">{service.uptime}%</div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
            </div>
            
            {service.buildStatus && (
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="text-sm font-medium mb-1">Build Status</div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    service.buildStatus === 'success' && "border-emerald-500 text-emerald-500",
                    service.buildStatus === 'building' && "border-amber-500 text-amber-500",
                    service.buildStatus === 'failed' && "border-red-500 text-red-500",
                    service.buildStatus === 'idle' && "border-gray-500 text-gray-500"
                  )}
                >
                  {service.buildStatus}
                </Badge>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="environment" className="space-y-4 mt-4">
            <div className="space-y-2">
              {Object.entries(envVars).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <Input
                    value={key}
                    className="flex-1 font-mono text-xs"
                    readOnly
                  />
                  <Input
                    value={value}
                    onChange={(e) => handleUpdateEnvVar(key, e.target.value)}
                    className="flex-1 font-mono text-xs"
                    placeholder="Value"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleRemoveEnvVar(key)}
                  >
                    <IconTrash className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="Key"
                className="font-mono text-xs"
              />
              <Input
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="Value"
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={handleAddEnvVar}
                disabled={!newEnvKey || !newEnvValue}
              >
                Add
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="networking" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Port</Label>
                <Input
                  type="number"
                  value={service.port || ''}
                  onChange={(e) => onPortChange(parseInt(e.target.value) || 0)}
                  placeholder="3000"
                  className="font-mono text-xs"
                />
              </div>
              
              <div>
                <Label className="text-xs">Route</Label>
                <Input
                  value={service.route || ''}
                  onChange={(e) => onRouteChange(e.target.value)}
                  placeholder="/api/*"
                  className="font-mono text-xs"
                />
              </div>
              
              {service.domain && (
                <div>
                  <Label className="text-xs">Domain</Label>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <IconWorld className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-mono">{service.domain}</span>
                  </div>
                </div>
              )}
              
              {service.region && (
                <div>
                  <Label className="text-xs">Region</Label>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <IconServer className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs">{service.region}</span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="actions" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-2">
              {service.status === 'stopped' ? (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => onStatusChange(service.id, 'running')}
                >
                  <IconPlay className="w-3 h-3" />
                  Start
                </Button>
              ) : service.status === 'running' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => onStatusChange(service.id, 'stopped')}
                >
                  <IconPause className="w-3 h-3" />
                  Stop
                </Button>
              ) : null}
              
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => onStatusChange(service.id, 'building')}
              >
                <IconRefresh className="w-3 h-3" />
                Rebuild
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
            >
              <IconSettings className="w-3 h-3" />
              Advanced Settings
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
