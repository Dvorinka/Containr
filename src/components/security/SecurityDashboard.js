import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, Settings } from 'lucide-react';
const SecurityDashboard = ({ projectId }) => {
    const [metrics, setMetrics] = useState(null);
    const [vulnerabilities, setVulnerabilities] = useState([]);
    const [scanHistory, setScanHistory] = useState([]);
    const [_complianceReports, _setComplianceReports] = useState([]);
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
        }
        catch (error) {
            console.error('Failed to fetch security data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const startSecurityScan = async (scanType) => {
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
        }
        catch (error) {
            console.error('Failed to start security scan:', error);
        }
        finally {
            setScanning(false);
        }
    };
    const pollScanStatus = async (scanId) => {
        const poll = async () => {
            try {
                const response = await fetch(`/api/v1/security/scans/${scanId}`);
                const scan = await response.json();
                if (scan.status === 'completed') {
                    fetchSecurityData(); // Refresh data
                }
                else if (scan.status === 'running') {
                    setTimeout(poll, 5000); // Poll again in 5 seconds
                }
            }
            catch (error) {
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
        }
        catch (error) {
            console.error('Failed to start compliance assessment:', error);
        }
    };
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-orange-500';
            case 'medium': return 'bg-yellow-500';
            case 'low': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };
    const getStatusColor = (status) => {
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
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Security Score" }), _jsx(Shield, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metrics?.security_score || 0 }), _jsx(Progress, { value: metrics?.security_score || 0, className: "mt-2" })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Open Vulnerabilities" }), _jsx(AlertTriangle, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metrics?.vulnerabilities.open || 0 }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [metrics?.vulnerabilities.critical || 0, " critical, ", metrics?.vulnerabilities.high || 0, " high"] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Compliance Score" }), _jsx(FileText, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metrics?.compliance.score || 0 }), _jsx("p", { className: `text-xs ${getStatusColor(metrics?.compliance.overall_status || '')}`, children: metrics?.compliance.overall_status?.replace('_', ' ') || 'Not assessed' })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { className: "flex flex-row items-center justify-between space-y-0 pb-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Last Scan" }), _jsx(Clock, { className: "h-4 w-4 text-muted-foreground" })] }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: metrics?.latest_scan.score || 0 }), _jsx("p", { className: `text-xs ${getStatusColor(metrics?.latest_scan.status || '')}`, children: metrics?.latest_scan.status?.replace('_', ' ') || 'Never scanned' })] })] })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Security Actions" }), _jsx(CardDescription, { children: "Run security scans and compliance assessments to identify and address security issues." })] }), _jsx(CardContent, { children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { onClick: () => startSecurityScan('dependency'), disabled: scanning, variant: "outline", children: [_jsx(Shield, { className: "h-4 w-4 mr-2" }), "Dependency Scan"] }), _jsxs(Button, { onClick: () => startSecurityScan('configuration'), disabled: scanning, variant: "outline", children: [_jsx(Settings, { className: "h-4 w-4 mr-2" }), "Configuration Scan"] }), _jsxs(Button, { onClick: () => startSecurityScan('comprehensive'), disabled: scanning, variant: "outline", children: [_jsx(TrendingUp, { className: "h-4 w-4 mr-2" }), "Comprehensive Scan"] }), _jsxs(Button, { onClick: startComplianceAssessment, variant: "outline", children: [_jsx(FileText, { className: "h-4 w-4 mr-2" }), "GDPR Assessment"] })] }) })] }), _jsxs(Tabs, { defaultValue: "vulnerabilities", className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "vulnerabilities", children: "Vulnerabilities" }), _jsx(TabsTrigger, { value: "scans", children: "Scan History" }), _jsx(TabsTrigger, { value: "compliance", children: "Compliance" })] }), _jsx(TabsContent, { value: "vulnerabilities", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Recent Vulnerabilities" }), _jsx(CardDescription, { children: "Security vulnerabilities found in your project and services." })] }), _jsx(CardContent, { children: vulnerabilities.length === 0 ? (_jsxs("div", { className: "text-center py-8", children: [_jsx(CheckCircle, { className: "h-12 w-12 text-green-500 mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-semibold", children: "No vulnerabilities found" }), _jsx("p", { className: "text-muted-foreground", children: "Your project looks secure!" })] })) : (_jsx("div", { className: "space-y-3", children: vulnerabilities.slice(0, 10).map((vuln) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { className: getSeverityColor(vuln.severity), children: vuln.severity }), _jsx("h4", { className: "font-medium", children: vuln.title })] }), _jsx("p", { className: "text-sm text-muted-foreground mt-1", children: vuln.description }), _jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Found ", new Date(vuln.found_at).toLocaleDateString()] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Badge, { variant: vuln.status === 'resolved' ? 'default' : 'secondary', children: vuln.status }) })] }, vuln.id))) })) })] }) }), _jsx(TabsContent, { value: "scans", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Scan History" }), _jsx(CardDescription, { children: "History of security scans performed on your project." })] }), _jsx(CardContent, { children: scanHistory.length === 0 ? (_jsxs("div", { className: "text-center py-8", children: [_jsx(Shield, { className: "h-12 w-12 text-muted-foreground mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-semibold", children: "No scans yet" }), _jsx("p", { className: "text-muted-foreground", children: "Start your first security scan to see results here." })] })) : (_jsx("div", { className: "space-y-3", children: scanHistory.map((scan) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("h4", { className: "font-medium capitalize", children: [scan.scan_type, " Scan"] }), _jsx(Badge, { variant: scan.status === 'completed' ? 'default' : 'secondary', children: scan.status })] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Score: ", scan.summary?.score || 0, "/100 \u2022", scan.summary?.total || 0, " issues found"] }), _jsx("p", { className: "text-xs text-muted-foreground", children: new Date(scan.started_at).toLocaleDateString() })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-sm font-medium", children: scan.summary?.score || 0 }), _jsx(Progress, { value: scan.summary?.score || 0, className: "w-16 mt-1" })] })] }, scan.id))) })) })] }) }), _jsx(TabsContent, { value: "compliance", className: "space-y-4", children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Compliance Status" }), _jsx(CardDescription, { children: "GDPR and other regulatory compliance status." })] }), _jsx(CardContent, { children: metrics?.compliance.overall_status === 'not_assessed' ? (_jsxs("div", { className: "text-center py-8", children: [_jsx(FileText, { className: "h-12 w-12 text-muted-foreground mx-auto mb-4" }), _jsx("h3", { className: "text-lg font-semibold", children: "No compliance assessment" }), _jsx("p", { className: "text-muted-foreground", children: "Run a GDPR assessment to check compliance status." })] })) : (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-medium", children: "GDPR Compliance" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Last assessed ", metrics?.compliance.last_assessed ?
                                                                        new Date(metrics.compliance.last_assessed).toLocaleDateString() :
                                                                        'Never'] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: `text-lg font-bold ${getStatusColor(metrics?.compliance.overall_status || '')}`, children: [metrics?.compliance.score || 0, "%"] }), _jsx(Badge, { variant: metrics?.compliance.overall_status === 'compliant' ? 'default' : 'secondary', children: metrics?.compliance.overall_status?.replace('_', ' ') || 'Unknown' })] })] }), _jsx(Progress, { value: metrics?.compliance.score || 0, className: "w-full" }), metrics?.compliance.overall_status === 'non_compliant' && (_jsxs(Alert, { children: [_jsx(AlertTriangle, { className: "h-4 w-4" }), _jsx(AlertTitle, { children: "Compliance Issues Found" }), _jsx(AlertDescription, { children: "Your project has compliance gaps that need to be addressed. Review the detailed assessment report for specific actions required." })] }))] })) })] }) })] })] }));
};
