import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import {
  Cloud,
  Globe,
  Server,
  Power,
  PowerOff,
  RefreshCw,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertCircle,
  Circle,
  Key,
  Bell,
  Save,
  RotateCcw
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  url?: string;
  description: string;
}

interface CloudflareConfig {
  enabled: boolean;
  token: string;
  tunnelUrl?: string;
}

interface EnvironmentConfig {
  domain: string;
  acmeEmail: string;
  corsOrigins: string;
}

const statusConfig = {
  running: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Running' },
  stopped: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Stopped' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
};

export default function Settings() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>({
    enabled: false,
    token: ''
  });
  const [envConfig, setEnvConfig] = useState<EnvironmentConfig>({
    domain: '',
    acmeEmail: '',
    corsOrigins: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services/status');
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const [envResponse, cloudflareResponse] = await Promise.all([
        fetch('/api/config/environment'),
        fetch('/api/config/cloudflare')
      ]);

      if (envResponse.ok) {
        const envData = await envResponse.json();
        setEnvConfig(envData);
      }

      if (cloudflareResponse.ok) {
        const cloudflareData = await cloudflareResponse.json();
        setCloudflareConfig(cloudflareData);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchConfig();
  }, []);

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/services/${serviceName}/${action}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchServices();
        toast({ 
          title: 'Success', 
          description: `${serviceName} ${action}ed successfully`,
          variant: 'success'
        });
      } else {
        throw new Error(`Failed to ${action} ${serviceName}`);
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Operation failed',
        variant: 'destructive'
      });
    }
  };

  const saveCloudflareConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/cloudflare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudflareConfig),
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Cloudflare configuration saved', variant: 'success' });
        await fetchServices();
      } else {
        throw new Error('Failed to save Cloudflare configuration');
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Save failed',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const saveEnvironmentConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envConfig),
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Environment configuration saved', variant: 'success' });
      } else {
        throw new Error('Failed to save environment configuration');
      }
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Save failed',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-8">
        <PageHeader title="Settings" description="Manage your application configuration and services" />
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in">
      <PageHeader 
        title="Settings" 
        description="Manage your application configuration and services" 
      />

      <Tabs defaultValue="services" className="space-y-6">
        <div className="relative">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid bg-muted/30 p-1">
            <TabsTrigger value="services" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Server className="w-4 h-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="cloudflare" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Cloud className="w-4 h-4" />
              <span className="hidden sm:inline">Cloudflare</span>
            </TabsTrigger>
            <TabsTrigger value="environment" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">Environment</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="services" className="space-y-4 animate-fade-in-up">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/10">
                  <Server className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <CardTitle>Service Management</CardTitle>
                  <CardDescription>
                    Control the status of your application services
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {services.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <Server className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">No services configured</p>
                  </div>
                ) : (
                  services.map((service, index) => {
                    const config = statusConfig[service.status];
                    return (
                      <div 
                        key={service.name} 
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all duration-200",
                          "animate-fade-in-up"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-lg", config.bg)}>
                            <config.icon className={cn("w-4 h-4", config.color)} />
                          </div>
                          <div>
                            <h3 className="font-medium">{service.name}</h3>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                            {service.url && (
                              <a 
                                href={service.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {service.url}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline" 
                            className={cn("border-0 font-medium", config.bg, config.color)}
                          >
                            {config.label}
                          </Badge>
                          <div className="flex gap-1">
                            {service.status === 'stopped' ? (
                              <Button 
                                size="sm" 
                                onClick={() => handleServiceAction(service.name, 'start')}
                                className="gap-1.5"
                              >
                                <Power className="h-3.5 w-3.5" />
                                Start
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleServiceAction(service.name, 'stop')}
                                className="gap-1.5"
                              >
                                <PowerOff className="h-3.5 w-3.5" />
                                Stop
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => handleServiceAction(service.name, 'restart')}
                              className="px-2"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloudflare" className="space-y-4 animate-fade-in-up">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Cloud className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle>Cloudflare Tunnel</CardTitle>
                  <CardDescription>
                    Configure Cloudflare tunnel to expose your services without domain setup
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="cloudflare-enabled" className="text-base font-medium">Enable Cloudflare Tunnel</Label>
                  <p className="text-sm text-muted-foreground">
                    Use Cloudflare tunnel instead of custom domain
                  </p>
                </div>
                <Switch
                  id="cloudflare-enabled"
                  checked={cloudflareConfig.enabled}
                  onCheckedChange={(enabled: boolean) => 
                    setCloudflareConfig(prev => ({ ...prev, enabled }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cloudflare-token">Tunnel Token</Label>
                <Textarea
                  id="cloudflare-token"
                  placeholder="Enter your Cloudflare tunnel token..."
                  value={cloudflareConfig.token}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                    setCloudflareConfig(prev => ({ ...prev, token: e.target.value }))
                  }
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Get your token from{' '}
                  <a 
                    href="https://dash.cloudflare.com/argotunnel" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Cloudflare Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              {cloudflareConfig.tunnelUrl && (
                <Alert className="border-emerald-500/30 bg-emerald-500/5">
                  <Globe className="h-4 w-4 text-emerald-500" />
                  <AlertDescription className="font-mono text-sm">
                    Tunnel URL: <span className="font-semibold">{cloudflareConfig.tunnelUrl}</span>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCloudflareConfig({ enabled: false, token: '' })}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={saveCloudflareConfig} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environment" className="space-y-4 animate-fade-in-up">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Environment Configuration</CardTitle>
                  <CardDescription>
                    Configure domain and environment settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    placeholder="yourdomain.com"
                    value={envConfig.domain}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setEnvConfig(prev => ({ ...prev, domain: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acme-email">ACME Email</Label>
                  <Input
                    id="acme-email"
                    type="email"
                    placeholder="admin@yourdomain.com"
                    value={envConfig.acmeEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                      setEnvConfig(prev => ({ ...prev, acmeEmail: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cors-origins">CORS Allowed Origins</Label>
                <Textarea
                  id="cors-origins"
                  placeholder="https://yourdomain.com,https://www.yourdomain.com"
                  value={envConfig.corsOrigins}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                    setEnvConfig(prev => ({ ...prev, corsOrigins: e.target.value }))
                  }
                  rows={2}
                  className="font-mono text-sm"
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEnvConfig({ domain: '', acmeEmail: '', corsOrigins: '' })}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={saveEnvironmentConfig} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 animate-fade-in-up">
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage security and authentication settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { 
                  title: 'Two-Factor Authentication', 
                  description: 'Add an extra layer of security to your account',
                  icon: Shield,
                  defaultChecked: false
                },
                { 
                  title: 'Session Timeout', 
                  description: 'Automatically log out after inactivity',
                  icon: Bell,
                  defaultChecked: true
                },
                { 
                  title: 'API Key Access', 
                  description: 'Allow API key authentication for integrations',
                  icon: Key,
                  defaultChecked: true
                },
              ].map((setting, index) => (
                <div 
                  key={setting.title}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20",
                    "animate-fade-in-up"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <setting.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="font-medium">{setting.title}</Label>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  <Switch defaultChecked={setting.defaultChecked} />
                </div>
              ))}

              <Separator />

              <div className="space-y-3 pt-2">
                <Label htmlFor="jwt-secret" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  JWT Secret
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="jwt-secret"
                    type="password"
                    value="••••••••••••••••"
                    readOnly
                    className="font-mono"
                  />
                  <Button variant="outline">Regenerate</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Regenerating will invalidate all existing sessions
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
