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
import { 
  Cloud, 
  Globe, 
  Server, 
  Power, 
  PowerOff,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setMessage({ type: 'success', text: `${serviceName} ${action}ed successfully` });
      } else {
        throw new Error(`Failed to ${action} ${serviceName}`);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Operation failed' });
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
        setMessage({ type: 'success', text: 'Cloudflare configuration saved' });
        await fetchServices();
      } else {
        throw new Error('Failed to save Cloudflare configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Save failed' });
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
        setMessage({ type: 'success', text: 'Environment configuration saved' });
      } else {
        throw new Error('Failed to save environment configuration');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'running': 'default',
      'stopped': 'secondary',
      'error': 'destructive',
    };
    
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application configuration and services
        </p>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="cloudflare">Cloudflare Tunnel</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Service Management
              </CardTitle>
              <CardDescription>
                Control the status of your application services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                        {service.url && (
                          <a 
                            href={service.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {service.url}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(service.status)}
                      <div className="flex gap-1">
                        {service.status === 'stopped' ? (
                          <Button 
                            size="sm" 
                            onClick={() => handleServiceAction(service.name, 'start')}
                          >
                            <Power className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleServiceAction(service.name, 'stop')}
                          >
                            <PowerOff className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleServiceAction(service.name, 'restart')}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cloudflare" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Cloudflare Tunnel
              </CardTitle>
              <CardDescription>
                Configure Cloudflare tunnel to expose your services without domain setup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cloudflare-enabled">Enable Cloudflare Tunnel</Label>
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
                />
                <p className="text-sm text-muted-foreground">
                  Get your token from{' '}
                  <a 
                    href="https://dash.cloudflare.com/argotunnel" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Cloudflare Dashboard → Zero Trust → Networks → Tunnels
                  </a>
                </p>
              </div>

              {cloudflareConfig.tunnelUrl && (
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Tunnel URL: {cloudflareConfig.tunnelUrl}
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={saveCloudflareConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Environment Configuration
              </CardTitle>
              <CardDescription>
                Configure domain and environment settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                />
              </div>

              <Button onClick={saveEnvironmentConfig} disabled={saving}>
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
