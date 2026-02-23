import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, Settings } from 'lucide-react';

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
  type: string;
  severity: string;
  title: string;
  description: string;
  service_id?: string;
  status: string;
  found_at: string;
  resolved_at?: string;
}

interface SecurityScan {
  id: string;
  project_id: string;
  service_id?: string;
  scan_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    score: number;
  };
}

interface ComplianceReport {
  id: string;
  project_id: string;
  framework_id: string;
  assessment_date: string;
  assessor: string;
  overall_status: string;
  score: number;
  controls: any[];
  risks: any[];
}

const _SecurityDashboard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [scanHistory, setScanHistory] = useState<SecurityScan[]>([]);
  const [_complianceReports, _setComplianceReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchSecurityData();
  }, [projectId]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [metricsRes, vulnsRes, historyRes, complianceRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/security/metrics`),
        fetch(`/api/v1/projects/${projectId}/vulnerabilities`),
        fetch(`/api/v1/projects/${projectId}/security/history?limit=10`),
        fetch(`/api/v1/security/compliance/frameworks`)
      ]);

      const [metricsData, vulnsData, historyData, _complianceData] = await Promise.all([
        metricsRes.json(),
        vulnsRes.json(),
        historyRes.json(),
        complianceRes.json()
      ]);

      setMetrics(metricsData);
      setVulnerabilities(vulnsData.vulnerabilities || []);
      setScanHistory(historyData.scans || []);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSecurityScan = async (scanType: 'dependency' | 'configuration' | 'comprehensive') => {
    setScanning(true);
    try {
      const response = await fetch('/api/v1/security/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          scan_type: scanType
        })
      });

      if (response.ok) {
        const scan = await response.json();
        // Poll for scan completion
        pollScanStatus(scan.id);
      }
    } catch (error) {
      console.error('Failed to start security scan:', error);
    } finally {
      setScanning(false);
    }
  };

  const pollScanStatus = async (scanId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/security/scans/${scanId}`);
        const scan = await response.json();
        
        if (scan.status === 'completed') {
          fetchSecurityData(); // Refresh data
        } else if (scan.status === 'running') {
          setTimeout(poll, 5000); // Poll again in 5 seconds
        }
      } catch (error) {
        console.error('Failed to poll scan status:', error);
      }
    };
    poll();
  };

  const startComplianceAssessment = async () => {
    try {
      const response = await fetch('/api/v1/security/compliance/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          framework_id: 'gdpr' // Assuming GDPR framework ID
        })
      });

      if (response.ok) {
        fetchSecurityData();
      }
    } catch (error) {
      console.error('Failed to start compliance assessment:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600';
      case 'partially_compliant': return 'text-yellow-600';
      case 'non_compliant': return 'text-red-600';
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.security_score || 0}</div>
            <Progress value={metrics?.security_score || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Vulnerabilities</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.vulnerabilities.open || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.vulnerabilities.critical || 0} critical, {metrics?.vulnerabilities.high || 0} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.compliance.score || 0}</div>
            <p className={`text-xs ${getStatusColor(metrics?.compliance.overall_status || '')}`}>
              {metrics?.compliance.overall_status?.replace('_', ' ') || 'Not assessed'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.latest_scan.score || 0}</div>
            <p className={`text-xs ${getStatusColor(metrics?.latest_scan.status || '')}`}>
              {metrics?.latest_scan.status?.replace('_', ' ') || 'Never scanned'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>
            Run security scans and compliance assessments to identify and address security issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => startSecurityScan('dependency')}
              disabled={scanning}
              variant="outline"
            >
              <Shield className="h-4 w-4 mr-2" />
              Dependency Scan
            </Button>
            <Button 
              onClick={() => startSecurityScan('configuration')}
              disabled={scanning}
              variant="outline"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configuration Scan
            </Button>
            <Button 
              onClick={() => startSecurityScan('comprehensive')}
              disabled={scanning}
              variant="outline"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Comprehensive Scan
            </Button>
            <Button 
              onClick={startComplianceAssessment}
              variant="outline"
            >
              <FileText className="h-4 w-4 mr-2" />
              GDPR Assessment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Details */}
      <Tabs defaultValue="vulnerabilities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="scans">Scan History</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="vulnerabilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Vulnerabilities</CardTitle>
              <CardDescription>
                Security vulnerabilities found in your project and services.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vulnerabilities.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No vulnerabilities found</h3>
                  <p className="text-muted-foreground">Your project looks secure!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vulnerabilities.slice(0, 10).map((vuln) => (
                    <div key={vuln.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={getSeverityColor(vuln.severity)}>
                            {vuln.severity}
                          </Badge>
                          <h4 className="font-medium">{vuln.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{vuln.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Found {new Date(vuln.found_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={vuln.status === 'resolved' ? 'default' : 'secondary'}>
                          {vuln.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
              <CardDescription>
                History of security scans performed on your project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No scans yet</h3>
                  <p className="text-muted-foreground">Start your first security scan to see results here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scanHistory.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium capitalize">{scan.scan_type} Scan</h4>
                          <Badge variant={scan.status === 'completed' ? 'default' : 'secondary'}>
                            {scan.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Score: {scan.summary?.score || 0}/100 • 
                          {scan.summary?.total || 0} issues found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.started_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{scan.summary?.score || 0}</div>
                        <Progress value={scan.summary?.score || 0} className="w-16 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>
                GDPR and other regulatory compliance status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.compliance.overall_status === 'not_assessed' ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No compliance assessment</h3>
                  <p className="text-muted-foreground">Run a GDPR assessment to check compliance status.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">GDPR Compliance</h4>
                      <p className="text-sm text-muted-foreground">
                        Last assessed {metrics?.compliance.last_assessed ? 
                          new Date(metrics.compliance.last_assessed).toLocaleDateString() : 
                          'Never'
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getStatusColor(metrics?.compliance.overall_status || '')}`}>
                        {metrics?.compliance.score || 0}%
                      </div>
                      <Badge variant={metrics?.compliance.overall_status === 'compliant' ? 'default' : 'secondary'}>
                        {metrics?.compliance.overall_status?.replace('_', ' ') || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  
                  <Progress value={metrics?.compliance.score || 0} className="w-full" />
                  
                  {metrics?.compliance.overall_status === 'non_compliant' && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Compliance Issues Found</AlertTitle>
                      <AlertDescription>
                        Your project has compliance gaps that need to be addressed. Review the detailed assessment report for specific actions required.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
