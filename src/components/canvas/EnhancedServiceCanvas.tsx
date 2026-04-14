import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EnhancedServiceNode } from './EnhancedServiceNode';
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
  uptime: number;
  requests: number;
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

interface CanvasTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export function EnhancedServiceCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
      requests: 1250,
      buildStatus: 'success',
      lastDeploy: '2 hours ago',
      region: 'us-east',
      domain: 'app.containr.dev',
      connections: ['2', '3'],
      environment: { NODE_ENV: 'production', API_URL: 'https://api.containr.dev' },
      port: 3000,
      route: '/',
      x: 200,
      y: 150
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
      requests: 3400,
      buildStatus: 'success',
      lastDeploy: '5 hours ago',
      region: 'us-east',
      domain: 'api.containr.dev',
      connections: ['3'],
      environment: { PORT: '8080', DB_URL: 'postgresql://...' },
      port: 8080,
      route: '/api/*',
      x: 450,
      y: 150
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
      requests: 850,
      buildStatus: 'success',
      lastDeploy: '1 day ago',
      region: 'us-east',
      connections: [],
      environment: { POSTGRES_DB: 'containr', POSTGRES_USER: 'admin' },
      port: 5432,
      x: 700,
      y: 150
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
      requests: 2100,
      buildStatus: 'success',
      lastDeploy: '3 days ago',
      region: 'eu-west',
      connections: ['2'],
      environment: { REDIS_MEMORY: '256mb' },
      port: 6379,
      x: 450,
      y: 350
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showDeployment, setShowDeployment] = useState(false);
  const [showAutoscaling, setShowAutoscaling] = useState(false);

  // Canvas transform state
  const [transform, setTransform] = useState<CanvasTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0
  });

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedService, setDraggedService] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasDragStart, setCanvasDragStart] = useState({ x: 0, y: 0 });

  // Hover state for element zoom
  const [hoveredService, setHoveredService] = useState<string | null>(null);
  const [elementZoom, setElementZoom] = useState(1);

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

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      setIsDragging(true);
      setDraggedService(null);
      setCanvasDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  };

  const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && !draggedService) {
      // Pan the canvas
      const newTranslateX = e.clientX - canvasDragStart.x;
      const newTranslateY = e.clientY - canvasDragStart.y;
      setTransform(prev => ({
        ...prev,
        translateX: newTranslateX,
        translateY: newTranslateY
      }));
    }

    if (draggedService) {
      // Update service position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - transform.translateX) / transform.scale;
        const y = (e.clientY - rect.top - transform.translateY) / transform.scale;
        
        setServices(prev => prev.map(service => 
          service.id === draggedService 
            ? { ...service, x, y }
            : service
        ));
      }
    }
  }, [isDragging, draggedService, canvasDragStart, transform]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedService(null);
  }, []);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.25, transform.scale * scaleFactor), 3);

    // Zoom towards mouse position
    const scaleRatio = newScale / transform.scale;
    const newTranslateX = mouseX - (mouseX - transform.translateX) * scaleRatio;
    const newTranslateY = mouseY - (mouseY - transform.translateY) * scaleRatio;

    setTransform({
      scale: newScale,
      translateX: newTranslateX,
      translateY: newTranslateY
    });
  }, [transform]);

  // Add global event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('mouseup', handleCanvasMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('mouseup', handleCanvasMouseUp);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [handleCanvasMouseMove, handleCanvasMouseUp, handleWheel]);

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
      requests: 0,
      buildStatus: 'idle',
      connections: [],
      environment: {},
      x: 400,
      y: 300
    };
    setServices(prev => [...prev, newService]);
  };

  const handleServiceMouseDown = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedService(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setDragStart({ x: service.x || 0, y: service.y || 0 });
    }
  };

  const handleServiceMouseEnter = (serviceId: string) => {
    setHoveredService(serviceId);
    setElementZoom(1.1);
  };

  const handleServiceMouseLeave = () => {
    setHoveredService(null);
    setElementZoom(1);
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
                  onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.25, prev.scale - 0.1) }))}
                >
                  <IconZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium px-2 min-w-[3rem] text-center">{Math.round(transform.scale * 100)}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))}
                >
                  <IconZoomIn className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setTransform({ scale: 1, translateX: 0, translateY: 0 })}
              >
                <IconRefresh className="w-4 h-4" />
              </Button>
              
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
            "relative bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden cursor-move",
            isFullscreen ? "h-screen" : "h-[calc(100vh-80px)]"
          )}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Grid Background */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          
          {/* SVG for connections */}
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
              transformOrigin: '0 0'
            }}
          >
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
            {isConnecting && connectingFrom && (
              <ConnectionLine
                from={{ x: services.find(s => s.id === connectingFrom)?.x || 200, 
                       y: services.find(s => s.id === connectingFrom)?.y || 200 }}
                to={{ x: 0, y: 0 }} // Will be updated on mouse move
                type="network"
                status="inactive"
                isTemporary
              />
            )}
          </svg>
          
          {/* Service Nodes */}
          <div
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
              transformOrigin: '0 0'
            }}
          >
            {services.map(service => (
              <EnhancedServiceNode
                key={service.id}
                service={service}
                position={{ x: service.x || 200, y: service.y || 200 }}
                isSelected={selectedService === service.id}
                onSelect={handleServiceSelect}
                onStatusChange={handleStatusChange}
                onConnect={handleConnect}
                isConnecting={isConnecting}
                connectingFrom={connectingFrom || undefined}
                onMouseDown={(e: React.MouseEvent) => handleServiceMouseDown(service.id, e)}
                onMouseEnter={() => handleServiceMouseEnter(service.id)}
                onMouseLeave={() => handleServiceMouseLeave()}
                zoomLevel={hoveredService === service.id ? elementZoom : 1}
              />
            ))}
          </div>
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
                service={selectedServiceData}
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
