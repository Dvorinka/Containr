import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ServiceNode } from './ServiceNode';
import { ServiceControls } from './ServiceControls';
import { DeploymentPanel } from './DeploymentPanel';
import { AutoscalingPanel } from './AutoscalingPanel';
import { ConnectionLine } from './ConnectionLine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  IconPlus, 
  IconLink, 
  IconGrid3x3, 
  IconWorld, 
  IconRefresh,
  IconZoomIn,
  IconZoomOut,
  IconMaximize,
  IconSettings,
  IconCloud,
  IconDatabase,
  IconServer
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  type: 'service' | 'database' | 'api' | 'frontend';
  status: 'running' | 'building' | 'stopped' | 'error';
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  requests?: number;
  uptime: number;
  buildStatus?: 'success' | 'building' | 'failed' | 'idle';
  lastDeploy?: string;
  region?: string;
  domain?: string;
  connections: string[];
  environment?: Record<string, string>;
  port?: number;
  route?: string;
  x?: number;
  y?: number;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  type: 'database' | 'api' | 'network';
  status: 'active' | 'inactive';
}

export function ServiceCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([
    {
      id: '1',
      name: 'Web Frontend',
      type: 'frontend',
      status: 'running',
      cpu: 25,
      memory: 45,
      disk: 30,
      network: 12,
      uptime: 99.9,
      buildStatus: 'success',
      lastDeploy: '2 hours ago',
      region: 'us-east',
      domain: 'app.containr.dev',
      connections: ['2', '3'],
      environment: { NODE_ENV: 'production', API_URL: 'https://api.containr.dev' },
      port: 3000,
      route: '/'
    },
    {
      id: '2',
      name: 'API Gateway',
      type: 'api',
      status: 'running',
      cpu: 65,
      memory: 70,
      disk: 25,
      network: 45,
      uptime: 99.7,
      buildStatus: 'success',
      lastDeploy: '5 hours ago',
      region: 'us-east',
      domain: 'api.containr.dev',
      connections: ['3'],
      environment: { PORT: '8080', DB_URL: 'postgresql://...' },
      port: 8080,
      route: '/api/*'
    },
    {
      id: '3',
      name: 'PostgreSQL DB',
      type: 'database',
      status: 'running',
      cpu: 35,
      memory: 60,
      disk: 55,
      network: 8,
      uptime: 99.9,
      buildStatus: 'success',
      lastDeploy: '1 day ago',
      region: 'us-east',
      connections: [],
      environment: { POSTGRES_DB: 'containr', POSTGRES_USER: 'admin' },
      port: 5432
    },
    {
      id: '4',
      name: 'Redis Cache',
      type: 'database',
      status: 'running',
      cpu: 15,
      memory: 40,
      disk: 10,
      network: 25,
      uptime: 99.8,
      buildStatus: 'success',
      lastDeploy: '3 days ago',
      region: 'eu-west',
      connections: ['2'],
      environment: { REDIS_MEMORY: '256mb' },
      port: 6379
    }
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', from: '1', to: '2', type: 'api', status: 'active' },
    { id: 'c2', from: '2', to: '3', type: 'database', status: 'active' },
    { id: 'c3', from: '2', to: '4', type: 'database', status: 'active' }
  ]);

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showDeployment, setShowDeployment] = useState(false);
  const [showAutoscaling, setShowAutoscaling] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedService, setDraggedService] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Auto-layout services in a grid
  const autoLayout = useCallback(() => {
    const cols = 3;
    const spacing = 250;
    const offsetX = 150;
    const offsetY = 150;
    
    services.forEach((service, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      service.x = offsetX + col * spacing;
      service.y = offsetY + row * spacing;
    });
    
    setServices([...services]);
  }, [services]);

  // Initialize positions
  useEffect(() => {
    autoLayout();
  }, []);

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId === selectedService ? null : serviceId);
  };

  const handleStatusChange = (serviceId: string, status: string) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, status: status as any, buildStatus: status === 'building' ? 'building' : service.buildStatus }
        : service
    ));
  };

  const handleConnect = (fromId: string, toId: string) => {
    const existingConnection = connections.find(
      c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
    );
    
    if (!existingConnection) {
      const newConnection: Connection = {
        id: `c${Date.now()}`,
        from: fromId,
        to: toId,
        type: 'network',
        status: 'active'
      };
      setConnections(prev => [...prev, newConnection]);
      
      // Update service connections
      setServices(prev => prev.map(service => {
        if (service.id === fromId) {
          return { ...service, connections: [...service.connections, toId] };
        }
        if (service.id === toId) {
          return { ...service, connections: [...service.connections, fromId] };
        }
        return service;
      }));
    }
    
    setIsConnecting(false);
    setConnectingFrom(null);
  };

  const handleAddService = () => {
    const newService: Service = {
      id: `s${Date.now()}`,
      name: `Service ${services.length + 1}`,
      type: 'service',
      status: 'stopped',
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      uptime: 0,
      buildStatus: 'idle',
      connections: [],
      environment: {},
      x: 400,
      y: 300
    };
    setServices(prev => [...prev, newService]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x, y });
      
      if (isDragging && draggedService) {
        setServices(prev => prev.map(service => 
          service.id === draggedService 
            ? { ...service, x, y }
            : service
        ));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedService(null);
  };

  const handleServiceMouseDown = (serviceId: string) => {
    setIsDragging(true);
    setDraggedService(serviceId);
  };

  const selectedServiceData = services.find(s => s.id === selectedService);

  return (
    <div className="relative h-full flex">
      {/* Main Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Canvas Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5">
                <IconCloud className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Service Canvas</h2>
                <p className="text-sm text-muted-foreground">Interactive service management</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {services.filter(s => s.status === 'running').length} Running
              </Badge>
              
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
                >
                  <IconZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium px-2 min-w-[3rem] text-center">{zoomLevel}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                >
                  <IconZoomIn className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                <IconMaximize className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={autoLayout}
              >
                <IconGrid3x3 className="w-4 h-4" />
              </Button>
              
              <Button
                variant={isConnecting ? "default" : "outline"}
                size="sm"
                className="h-7 px-3"
                onClick={() => {
                  setIsConnecting(!isConnecting);
                  setConnectingFrom(null);
                }}
              >
                <IconLink className="w-4 h-4 mr-1" />
                Connect
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3"
                onClick={handleAddService}
              >
                <IconPlus className="w-4 h-4 mr-1" />
                Add Service
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef}
          className={cn(
            "relative bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden",
            isFullscreen ? "h-screen" : "h-[calc(100vh-80px)]"
          )}
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center center'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid Background */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          
          {/* Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none">
            {connections.map(connection => {
              const fromService = services.find(s => s.id === connection.from);
              const toService = services.find(s => s.id === connection.to);
              
              if (!fromService || !toService) return null;
              
              return (
                <ConnectionLine
                  key={connection.id}
                  from={{ x: fromService.x || 200, y: fromService.y || 200 }}
                  to={{ x: toService.x || 400, y: toService.y || 300 }}
                  type={connection.type}
                  status={connection.status}
                />
              );
            })}
            
            {/* Temporary connection line while connecting */}
            {isConnecting && connectingFrom && mousePos && (
              <ConnectionLine
                from={{ x: services.find(s => s.id === connectingFrom)?.x || 200, 
                       y: services.find(s => s.id === connectingFrom)?.y || 200 }}
                to={mousePos}
                type="network"
                status="inactive"
                isTemporary
              />
            )}
          </svg>
          
          {/* Service Nodes */}
          {services.map(service => (
            <ServiceNode
              key={service.id}
              service={service}
              position={{ x: service.x || 200, y: service.y || 200 }}
              isSelected={selectedService === service.id}
              onSelect={handleServiceSelect}
              onStatusChange={handleStatusChange}
              onConnect={handleConnect}
              isConnecting={isConnecting}
              connectingFrom={connectingFrom || undefined}
              onMouseDown={() => handleServiceMouseDown(service.id)}
            />
          ))}
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-80 border-l border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="p-4 space-y-4">
          {selectedServiceData && (
            <>
              <ServiceControls
                service={selectedServiceData}
                onStatusChange={handleStatusChange}
                onEnvironmentChange={(env: Record<string, string>) => {
                  if (selectedService) {
                    setServices(prev => prev.map(s => 
                      s.id === selectedService 
                        ? { ...s, environment: env }
                        : s
                    ));
                  }
                }}
                onPortChange={(port: number) => {
                  if (selectedService) {
                    setServices(prev => prev.map(s => 
                      s.id === selectedService 
                        ? { ...s, port }
                        : s
                    ));
                  }
                }}
                onRouteChange={(route: string) => {
                  if (selectedService) {
                    setServices(prev => prev.map(s => 
                      s.id === selectedService 
                        ? { ...s, route }
                        : s
                    ));
                  }
                }}
              />
              
              <DeploymentPanel
                service={selectedServiceData}
                onDeploy={(region: string, domain: string) => {
                  if (selectedService) {
                    setServices(prev => prev.map(s => 
                      s.id === selectedService 
                        ? { ...s, region, domain, buildStatus: 'building' }
                        : s
                    ));
                  }
                }}
              />
              
              <AutoscalingPanel
                service={{
                  id: selectedServiceData.id,
                  name: selectedServiceData.name,
                  cpu: selectedServiceData.cpu,
                  memory: selectedServiceData.memory,
                  network: selectedServiceData.network,
                  requests: selectedServiceData.requests ?? 0,
                }}
                onScalingChange={(config: any) => {
                  // Handle autoscaling configuration
                }}
              />
            </>
          )}
          
          {!selectedServiceData && (
            <Card>
              <CardContent className="py-8 text-center">
                <IconServer className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Select a Service</h3>
                <p className="text-sm text-muted-foreground">
                  Click on a service node to view and manage its configuration
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
