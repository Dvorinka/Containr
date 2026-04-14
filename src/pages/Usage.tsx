import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, HardDrive, Network, Server } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Project } from '@/types';

interface ProjectWithStats extends Project {
  stats?: {
    service_count: number;
    running_services: number;
    deployment_count: number;
  };
}

export default function Usage() {
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects({ limit: 100 }),
  });

  const totals = useMemo(() => {
    const projects = (data?.projects ?? []) as ProjectWithStats[];
    const serviceCount = projects.reduce((sum, project) => sum + (project.stats?.service_count ?? 0), 0);
    const runningCount = projects.reduce((sum, project) => sum + (project.stats?.running_services ?? 0), 0);
    const deploymentCount = projects.reduce((sum, project) => sum + (project.stats?.deployment_count ?? 0), 0);
    return { projectCount: projects.length, serviceCount, runningCount, deploymentCount };
  }, [data?.projects]);

  const cpu = Math.min(100, totals.runningCount * 9 + totals.projectCount * 4);
  const memory = Math.min(100, totals.runningCount * 12 + totals.serviceCount * 3);
  const disk = Math.min(100, totals.serviceCount * 7 + totals.deploymentCount);
  const network = Math.min(100, totals.runningCount * 6 + totals.deploymentCount * 2);

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 p-5 md:p-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">Usage</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Local monitoring for this self-hosted instance. No billing, plans, or metering are enabled.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Server className="mb-4 h-5 w-5 text-muted-foreground" />
            <div className="text-3xl font-semibold">{totals.projectCount}</div>
            <div className="text-sm text-muted-foreground">Projects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Activity className="mb-4 h-5 w-5 text-emerald-400" />
            <div className="text-3xl font-semibold">{totals.runningCount}</div>
            <div className="text-sm text-muted-foreground">Services online</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Network className="mb-4 h-5 w-5 text-primary" />
            <div className="text-3xl font-semibold">{totals.deploymentCount}</div>
            <div className="text-sm text-muted-foreground">Deployments tracked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <HardDrive className="mb-4 h-5 w-5 text-amber-400" />
            <div className="text-3xl font-semibold">{totals.serviceCount}</div>
            <div className="text-sm text-muted-foreground">Services total</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Host Resources</h2>
              <p className="text-sm text-muted-foreground">Estimated from active Containr resources until live host metrics are attached.</p>
            </div>
            <Badge variant="outline">Monitoring</Badge>
          </div>

          {[
            { label: 'CPU', value: cpu, icon: Cpu },
            { label: 'Memory', value: memory, icon: Activity },
            { label: 'Disk', value: disk, icon: HardDrive },
            { label: 'Network', value: network, icon: Network },
          ].map((metric) => (
            <div key={metric.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <metric.icon className="h-4 w-4 text-muted-foreground" />
                  {metric.label}
                </span>
                <span className="font-mono text-muted-foreground">{metric.value}%</span>
              </div>
              <Progress value={metric.value} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
