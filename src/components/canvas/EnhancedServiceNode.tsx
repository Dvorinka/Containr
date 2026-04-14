import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  IconServer, 
  IconDatabase, 
  IconCloud, 
  IconLoader, 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconSettings,
  IconWorld,
  IconCpu,
  IconDatabase as IconHdd,
  IconNetwork,
  IconGitBranch,
  IconRefresh,
  IconPlayerPlay as IconPlay,
  IconPlayerPause as IconPause,
  IconTrash
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface EnhancedServiceNodeProps {
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
    lastDeploy?: string;
    region?: string;
    domain?: string;
    connections: string[];
  };
  position: { x: number; y: number };
  isSelected: boolean;
  onSelect: (serviceId: string) => void;
  onStatusChange: (serviceId: string, status: string) => void;
  onConnect: (serviceId: string, targetId: string) => void;
  isConnecting: boolean;
  connectingFrom?: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  zoomLevel: number;
}

export function EnhancedServiceNode({ 
  service, 
  position, 
  isSelected, 
  onSelect, 
  onStatusChange,
  onConnect,
  isConnecting,
  connectingFrom,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  zoomLevel
}: EnhancedServiceNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-emerald-500';
      case 'building': return 'bg-amber-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <IconCheck className="w-3 h-3" />;
      case 'building': return <IconLoader className="w-3 h-3 animate-spin" />;
      case 'stopped': return <IconPause className="w-3 h-3" />;
      case 'error': return <IconX className="w-3 h-3" />;
      default: return <IconAlertTriangle className="w-3 h-3" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'service': return <IconServer className="w-5 h-5" />;
      case 'database': return <IconDatabase className="w-5 h-5" />;
      case 'api': return <IconCloud className="w-5 h-5" />;
      case 'frontend': return <IconWorld className="w-5 h-5" />;
      default: return <IconServer className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'service': return 'text-blue-500';
      case 'database': return 'text-emerald-500';
      case 'api': return 'text-purple-500';
      case 'frontend': return 'text-orange-500';
      default: return 'text-gray-500';
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage < 50) return 'text-emerald-500';
    if (usage < 80) return 'text-amber-500';
    return 'text-red-500';
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting && connectingFrom !== service.id) {
      onConnect(connectingFrom!, service.id);
    } else {
      onSelect(service.id);
    }
  };

  const handleStatusToggle = (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    onStatusChange(service.id, newStatus);
  };

  const isConnectionTarget = isConnecting && connectingFrom !== service.id;

  return (
    <div
      ref={nodeRef}
      className={cn(
        "absolute cursor-pointer transition-all duration-300",
        isSelected && "z-50",
        "hover:z-40"
      )}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        transform: `translate(-50%, -50%) scale(${zoomLevel})`,
        transformOrigin: 'center center'
      }}
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={() => {
        setIsHovered(true);
        onMouseEnter();
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave();
      }}
    >
      <Card className={cn(
        "shadow-lg transition-all duration-300",
        isSelected && "ring-2 ring-primary ring-offset-2",
        isHovered && "shadow-xl",
        isConnectionTarget && "ring-2 ring-blue-500 ring-offset-2 animate-pulse",
        "bg-card/95 backdrop-blur-sm border-border/50",
        "hover:scale-105"
      )}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg bg-muted/50", getTypeColor(service.type))}>
                {getTypeIcon(service.type)}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{service.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {service.type}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                getStatusColor(service.status),
                service.status === 'running' && "animate-pulse"
              )} />
              {getStatusIcon(service.status)}
            </div>
          </div>

          {/* Usage Metrics */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="flex items-center gap-2 text-xs">
              <IconCpu className={cn("w-3 h-3", getUsageColor(service.cpu))} />
              <span className={cn("font-medium", getUsageColor(service.cpu))}>{service.cpu}%</span>
              <span className="text-muted-foreground">CPU</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <IconHdd className={cn("w-3 h-3", getUsageColor(service.memory))} />
              <span className={cn("font-medium", getUsageColor(service.memory))}>{service.memory}%</span>
              <span className="text-muted-foreground">MEM</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <IconNetwork className={cn("w-3 h-3", getUsageColor(service.network))} />
              <span className={cn("font-medium", getUsageColor(service.network))}>{service.network}MB/s</span>
              <span className="text-muted-foreground">NET</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <IconHdd className={cn("w-3 h-3", getUsageColor(service.disk))} />
              <span className={cn("font-medium", getUsageColor(service.disk))}>{service.disk}%</span>
              <span className="text-muted-foreground">DISK</span>
            </div>
          </div>

          {/* Build Status */}
          {service.buildStatus && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted/30">
              <IconGitBranch className="w-3 h-3 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-xs font-medium">Build Status</div>
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
            </div>
          )}

          {/* Region & Domain */}
          {(service.region || service.domain) && (
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
              {service.region && (
                <div className="flex items-center gap-1">
                  <IconWorld className="w-3 h-3" />
                  <span>{service.region}</span>
                </div>
              )}
              {service.domain && (
                <div className="flex items-center gap-1">
                  <IconNetwork className="w-3 h-3" />
                  <span className="truncate">{service.domain}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {(isHovered || isSelected) && (
            <div className="flex gap-1 pt-2 border-t border-border/50">
              {service.status === 'stopped' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={(e) => handleStatusToggle(e, 'running')}
                >
                  <IconPlay className="w-3 h-3 mr-1" />
                  Start
                </Button>
              ) : service.status === 'running' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 text-xs"
                  onClick={(e) => handleStatusToggle(e, 'stopped')}
                >
                  <IconPause className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : null}
              
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(service.id, 'building');
                }}
              >
                <IconRefresh className="w-3 h-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Points */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 right-0 w-3 h-3 bg-blue-500 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-blue-500 rounded-full -translate-x-1/2 translate-y-1/2" />
        </div>
      )}
    </div>
  );
}
