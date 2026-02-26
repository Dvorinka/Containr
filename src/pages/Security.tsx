import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';

interface SecurityMetrics {
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    open: number;
    resolved: number;
  };
  latest_scan: {
    id: string;
    score: number;
    scanned_at: string;
    status: string;
  };
  compliance: {
    overall_status: string;
    score: number;
    last_assessed?: string;
  };
  security_score: number;
}

interface Vulnerability {
  id: string;
  severity: string;
  title: string;
  status: string;
  found_at: string;
}

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'security-selector'],
    queryFn: () => projectsApi.getProjects({ page: 1, limit: 100 }),
  });

  const projects = projectsData?.projects ?? [];

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projectId, projects]);

  const metricsQuery = useQuery({
    queryKey: ['security-metrics', projectId],
    queryFn: () => api.get<SecurityMetrics>(`/api/v1/projects/${projectId}/security/metrics`),
    enabled: !!projectId,
  });

  const vulnerabilitiesQuery = useQuery({
    queryKey: ['security-vulnerabilities', projectId],
    queryFn: () =>
      api.get<{ vulnerabilities: Vulnerability[] }>(
        `/api/v1/projects/${projectId}/vulnerabilities`,
      ),
    enabled: !!projectId,
  });

  const startScanMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/api/v1/security/scans', {
        project_id: projectId,
        scan_type: 'comprehensive',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-metrics', projectId] });
      queryClient.invalidateQueries({ queryKey: ['security-vulnerabilities', projectId] });
    },
  });

  const recentVulnerabilities = useMemo(
    () => (vulnerabilitiesQuery.data?.vulnerabilities ?? []).slice(0, 8),
    [vulnerabilitiesQuery.data?.vulnerabilities],
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Security"
        description="Project-level vulnerability and security health overview."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Scope</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="security-project">Project</Label>
            <select
              id="security-project"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => startScanMutation.mutate()}
            disabled={!projectId || startScanMutation.isPending}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {startScanMutation.isPending ? 'Starting Scan...' : 'Start Comprehensive Scan'}
          </Button>
        </CardContent>
      </Card>

      {metricsQuery.isError && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load security metrics for the selected project.
          </CardContent>
        </Card>
      )}

      {metricsQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Security Score</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {metricsQuery.data.security_score}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Open Vulnerabilities</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {metricsQuery.data.vulnerabilities.open}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Critical / High</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {metricsQuery.data.vulnerabilities.critical} / {metricsQuery.data.vulnerabilities.high}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">
              {metricsQuery.data.compliance.score}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Vulnerabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {vulnerabilitiesQuery.isLoading && <div className="text-sm text-muted-foreground">Loading...</div>}
          {!vulnerabilitiesQuery.isLoading && recentVulnerabilities.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              No vulnerabilities found.
            </div>
          )}
          {recentVulnerabilities.map((vuln) => (
            <div key={vuln.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{vuln.title}</p>
                <p className="text-xs text-muted-foreground">
                  Found {new Date(vuln.found_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Badge variant={vuln.status === 'resolved' ? 'default' : 'secondary'}>
                  {vuln.status}
                </Badge>
                <Badge
                  variant={vuln.severity === 'critical' || vuln.severity === 'high' ? 'destructive' : 'outline'}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {vuln.severity}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

