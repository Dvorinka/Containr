import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
// import { Slider } from '@/components/ui/slider'; // Commented out as it might not exist
import { 
  IconTrendingUp, 
  IconTrendingDown, 
  IconActivity, 
  IconCpu, 
  IconDatabase as IconHdd, 
  IconNetwork,
  IconAlertTriangle,
  IconCheck,
  IconSettings
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface AutoscalingPanelProps {
  service: {
    id: string;
    name: string;
    cpu: number;
    memory: number;
    network: number;
    requests: number;
  };
  onScalingChange: (config: AutoscalingConfig) => void;
}

interface AutoscalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

export function AutoscalingPanel({ service, onScalingChange }: AutoscalingPanelProps) {
  const [config, setConfig] = useState<AutoscalingConfig>({
    enabled: false,
    minInstances: 1,
    maxInstances: 5,
    targetCPU: 70,
    targetMemory: 80,
    scaleUpCooldown: 300,
    scaleDownCooldown: 600,
  });

  const [recommendations, setRecommendations] = useState([
    {
      type: 'scale-up',
      message: 'High CPU usage detected. Consider scaling up.',
      priority: 'high',
      icon: IconTrendingUp,
      color: 'text-red-500'
    },
    {
      type: 'optimize',
      message: 'Memory usage is optimal. Current configuration is efficient.',
      priority: 'low',
      icon: IconCheck,
      color: 'text-emerald-500'
    },
    {
      type: 'region',
      message: 'Consider deploying to multiple regions for better performance.',
      priority: 'medium',
      icon: IconActivity,
      color: 'text-amber-500'
    }
  ]);

  // Simple range slider implementation since Slider component might not exist
  const RangeSlider = ({ value, onChange, min, max, step }: any) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange([parseInt(e.target.value)])}
      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
    />
  );

  const getUsageColor = (usage: number, target: number) => {
    if (usage < target * 0.8) return 'text-emerald-500';
    if (usage < target) return 'text-amber-500';
    return 'text-red-500';
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'scale-up': return IconTrendingUp;
      case 'scale-down': return IconTrendingDown;
      case 'optimize': return IconCheck;
      case 'region': return IconActivity;
      default: return IconSettings;
    }
  };

  const getRecommendationColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-emerald-500';
      default: return 'text-gray-500';
    }
  };

  const handleConfigChange = (key: keyof AutoscalingConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onScalingChange(newConfig);
  };

  const currentInstances = 2; // Simulated current instance count
  const projectedInstances = config.enabled 
    ? Math.min(config.maxInstances, Math.max(config.minInstances, 
        Math.ceil(service.cpu / config.targetCPU * currentInstances)
      ))
    : currentInstances;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IconActivity className="w-4 h-4" />
          Autoscaling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Autoscaling */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Enable Autoscaling</Label>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
          />
        </div>

        {config.enabled && (
          <>
            {/* Current vs Projected Instances */}
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Instance Count</span>
                <Badge variant="outline" className="text-xs">
                  {currentInstances} → {projectedInstances}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Min: {config.minInstances}</span>
                <span>•</span>
                <span>Max: {config.maxInstances}</span>
              </div>
            </div>

            {/* Usage Metrics */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1">
                    <IconCpu className="w-3 h-3" />
                    CPU Usage
                  </Label>
                  <span className={cn("text-xs font-medium", getUsageColor(service.cpu, config.targetCPU))}>
                    {service.cpu}% / {config.targetCPU}%
                  </span>
                </div>
                <Progress value={service.cpu} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1">
                    <IconHdd className="w-3 h-3" />
                    Memory Usage
                  </Label>
                  <span className={cn("text-xs font-medium", getUsageColor(service.memory, config.targetMemory))}>
                    {service.memory}% / {config.targetMemory}%
                  </span>
                </div>
                <Progress value={service.memory} className="h-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1">
                    <IconNetwork className="w-3 h-3" />
                    Network I/O
                  </Label>
                  <span className="text-xs font-medium text-muted-foreground">
                    {service.network} MB/s
                  </span>
                </div>
                <Progress value={service.network * 2} className="h-2" />
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Min Instances</Label>
                <RangeSlider
                  value={[config.minInstances]}
                  onChange={([value]: number[]) => handleConfigChange('minInstances', value)}
                  min={1}
                  max={10}
                  step={1}
                  className="mt-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>{config.minInstances}</span>
                  <span>10</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Max Instances</Label>
                <RangeSlider
                  value={[config.maxInstances]}
                  onChange={([value]: number[]) => handleConfigChange('maxInstances', value)}
                  min={1}
                  max={20}
                  step={1}
                  className="mt-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>{config.maxInstances}</span>
                  <span>20</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Target CPU (%)</Label>
                <RangeSlider
                  value={[config.targetCPU]}
                  onChange={([value]: number[]) => handleConfigChange('targetCPU', value)}
                  min={50}
                  max={90}
                  step={5}
                  className="mt-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{config.targetCPU}%</span>
                  <span>90%</span>
                </div>
              </div>

              <div>
                <Label className="text-xs">Target Memory (%)</Label>
                <RangeSlider
                  value={[config.targetMemory]}
                  onChange={([value]: number[]) => handleConfigChange('targetMemory', value)}
                  min={50}
                  max={90}
                  step={5}
                  className="mt-1"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>{config.targetMemory}%</span>
                  <span>90%</span>
                </div>
              </div>
            </div>

            {/* Cooldown Periods */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Scale Up Cooldown</Label>
                <Badge variant="outline" className="text-xs">
                  {config.scaleUpCooldown}s
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Scale Down Cooldown</Label>
                <Badge variant="outline" className="text-xs">
                  {config.scaleDownCooldown}s
                </Badge>
              </div>
            </div>
          </>
        )}

        {/* Recommendations */}
        <div className="space-y-2">
          <Label className="text-sm">Recommendations</Label>
          <div className="space-y-2">
            {recommendations.map((rec, index) => {
              const IconComponent = rec.icon;
              return (
                <div key={index} className="p-2 rounded-lg bg-muted/30">
                  <div className="flex items-start gap-2">
                    <IconComponent className={cn("w-3 h-3 mt-0.5", rec.color)} />
                    <div className="flex-1">
                      <p className="text-xs">{rec.message}</p>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs mt-1", rec.color.replace('text', 'border').replace('-500', '-500/50'))}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost Estimation */}
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm flex items-center gap-1">
              <IconAlertTriangle className="w-3 h-3" />
              Cost Estimation
            </Label>
            <Badge variant="outline" className="text-xs">
              ${currentInstances * 20}/mo
            </Badge>
          </div>
          {config.enabled && (
            <div className="text-xs text-muted-foreground">
              Projected: ${projectedInstances * 20}/mo
              {projectedInstances > currentInstances && (
                <span className="text-amber-500 ml-1">(+${(projectedInstances - currentInstances) * 20})</span>
              )}
            </div>
          )}
        </div>

        {/* Apply Button */}
        <Button className="w-full gap-2">
          <IconSettings className="w-4 h-4" />
          Apply Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
