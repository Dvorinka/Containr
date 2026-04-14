import { EnhancedServiceCanvas } from '@/components/canvas/EnhancedServiceCanvas';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  IconCloud, 
  IconNetwork, 
  IconSparkles, 
  IconRefresh, 
  IconZoomIn, 
  IconZoomOut, 
  IconMaximize,
  IconDownload
} from '@tabler/icons-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function CanvasPage() {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Canvas"
        description="Visualize your services and deployment graph"
        action={{
          label: 'Refresh',
          icon: IconRefresh,
          onClick: () => window.location.reload()
        }}
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="card-elevated overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5">
                    <IconNetwork className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Service Graph</CardTitle>
                    <p className="text-sm text-muted-foreground">Interactive deployment visualization</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className={cn(
                "relative bg-gradient-to-br from-background via-background to-muted/30 transition-all duration-300",
                isFullscreen ? "h-[80vh]" : "h-[600px]"
              )}>
                <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                <EnhancedServiceCanvas />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Services</span>
                <Badge variant="secondary">4</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Deployments</span>
                <Badge variant="default" className="bg-emerald-500">3</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connections</span>
                <Badge variant="outline">3</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm">Running</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm">Building</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Error</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm">Stopped</span>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <IconRefresh className="w-4 h-4" />
                Refresh Graph
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-2">
                <IconDownload className="w-4 h-4" />
                Export Image
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

