import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  IconWorld, 
  IconCloud, 
  IconServer, 
  IconRocket, 
  IconCheck,
  IconLoader,
  IconGlobe,
  IconFlag
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface DeploymentPanelProps {
  service: {
    id: string;
    name: string;
    region?: string;
    domain?: string;
    status: 'running' | 'building' | 'stopped' | 'error';
  };
  onDeploy: (region: string, domain: string) => void;
}

const regions = [
  { code: 'us-east', name: 'US East', flag: '🇺🇸', latency: '12ms' },
  { code: 'us-west', name: 'US West', flag: '🇺🇸', latency: '45ms' },
  { code: 'eu-west', name: 'Europe West', flag: '🇪🇺', latency: '28ms' },
  { code: 'eu-central', name: 'Europe Central', flag: '🇩🇪', latency: '22ms' },
  { code: 'asia-east', name: 'Asia East', flag: '🇯🇵', latency: '85ms' },
  { code: 'asia-south', name: 'Asia South', flag: '🇮🇳', latency: '95ms' },
];

const domains = [
  'containr.dev',
  'app.containr.cloud',
  'my-service.io',
  'custom-domain.com'
];

export function DeploymentPanel({ service, onDeploy }: DeploymentPanelProps) {
  const [selectedRegion, setSelectedRegion] = useState(service.region || 'us-east');
  const [selectedDomain, setSelectedDomain] = useState(service.domain || 'containr.dev');
  const [customDomain, setCustomDomain] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async () => {
    setIsDeploying(true);
    const domain = selectedDomain === 'custom-domain.com' ? customDomain : selectedDomain;
    onDeploy(selectedRegion, domain);
    
    // Simulate deployment
    setTimeout(() => {
      setIsDeploying(false);
    }, 3000);
  };

  const getRegionInfo = (code: string) => {
    return regions.find(r => r.code === code) || regions[0];
  };

  const currentRegion = getRegionInfo(selectedRegion);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IconRocket className="w-4 h-4" />
          Deployment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Deployment Status */}
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Current Status</span>
            <Badge 
              variant={service.status === 'running' ? 'default' : 'outline'}
              className={cn(
                service.status === 'running' && 'bg-emerald-500',
                service.status === 'building' && 'bg-amber-500',
                service.status === 'error' && 'bg-red-500'
              )}
            >
              {service.status}
            </Badge>
          </div>
          
          {service.region && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconGlobe className="w-3 h-3" />
              <span>{getRegionInfo(service.region).name}</span>
              <span>•</span>
              <span>{service.domain}</span>
            </div>
          )}
        </div>

        {/* Region Selection */}
        <div className="space-y-2">
          <Label className="text-sm">Deploy Region</Label>
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regions.map(region => (
                <SelectItem key={region.code} value={region.code}>
                  <div className="flex items-center gap-2">
                    <span>{region.flag}</span>
                    <div>
                      <div className="font-medium">{region.name}</div>
                      <div className="text-xs text-muted-foreground">{region.latency}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="p-2 rounded-lg bg-muted/20">
            <div className="flex items-center gap-2 text-xs">
              <IconServer className="w-3 h-3" />
              <span>{currentRegion.name}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-emerald-500">{currentRegion.latency}</span>
              <span className="text-muted-foreground">latency</span>
            </div>
          </div>
        </div>

        {/* Domain Selection */}
        <div className="space-y-2">
          <Label className="text-sm">Domain</Label>
          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {domains.map(domain => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedDomain === 'custom-domain.com' && (
            <Input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="your-domain.com"
              className="text-sm font-mono"
            />
          )}
        </div>

        {/* Deployment Recommendations */}
        <div className="space-y-2">
          <Label className="text-sm">Recommendations</Label>
          <div className="space-y-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs">
                <IconCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-700 dark:text-emerald-400">
                  Optimal region for your users
                </span>
              </div>
            </div>
            
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-xs">
                <IconFlag className="w-3 h-3 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-400">
                  Consider CDN for global performance
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Deploy Button */}
        <Button 
          onClick={handleDeploy}
          disabled={isDeploying || (selectedDomain === 'custom-domain.com' && !customDomain)}
          className="w-full gap-2"
        >
          {isDeploying ? (
            <>
              <IconLoader className="w-4 h-4 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <IconRocket className="w-4 h-4" />
              Deploy to {currentRegion.name}
            </>
          )}
        </Button>

        {/* Recent Deployments */}
        <div className="space-y-2">
          <Label className="text-sm">Recent Deployments</Label>
          <div className="space-y-1">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <IconCheck className="w-3 h-3 text-emerald-500" />
                <div>
                  <div className="text-xs font-medium">Success</div>
                  <div className="text-xs text-muted-foreground">2 hours ago</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {currentRegion.flag} {currentRegion.name}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <IconCheck className="w-3 h-3 text-emerald-500" />
                <div>
                  <div className="text-xs font-medium">Success</div>
                  <div className="text-xs text-muted-foreground">1 day ago</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                🇪🇺 Europe West
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
