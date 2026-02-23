import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, GitBranch, Database, Settings, Globe, Cpu, Play, Square, RotateCcw, Eye, MoreHorizontal, Activity, Clock, AlertTriangle, CheckCircle, Pause, Zap, Server, GitPullRequest, GitCommit, PackageOpen } from 'lucide-react';
import { useState } from 'react';
const mockServices = [
    {
        id: '1',
        name: 'web-app',
        type: 'app',
        status: 'running',
        source: 'GitHub: containr/web-app',
        url: 'https://app.containr.dev',
        lastDeploy: '2 hours ago',
        cpu: '245m',
        memory: '512Mi',
        connections: ['2', '3'],
        environment: 'production',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        variables: { 'NODE_ENV': 'production', 'PORT': '3000' },
        deployments: [
            {
                id: 'd1',
                version: 'v1.2.3',
                status: 'success',
                timestamp: '2024-07-15T14:30:00Z',
                commitHash: 'abc123',
                commitMessage: 'Fix authentication bug',
                buildTime: '2m 15s',
                triggeredBy: 'push'
            }
        ],
        logsEnabled: true,
        metricsEnabled: true,
        healthCheckPath: '/health',
        instances: 2,
        region: 'us-east-1',
        repository: 'containr/web-app',
        branch: 'main',
        commitHash: 'abc123',
        buildTime: '2m 15s',
        uptime: '99.9%',
        errorRate: '0.1%',
        responseTime: '120ms'
    },
    {
        id: '2',
        name: 'api-server',
        type: 'api',
        status: 'running',
        source: 'GitHub: containr/api',
        url: 'https://api.containr.dev',
        lastDeploy: '1 day ago',
        cpu: '180m',
        memory: '256Mi',
        connections: ['3'],
        environment: 'production',
        buildCommand: 'go build -o api',
        startCommand: './api',
        variables: { 'GIN_MODE': 'release', 'DB_HOST': 'postgres-db' },
        deployments: [
            {
                id: 'd2',
                version: 'v2.1.0',
                status: 'success',
                timestamp: '2024-07-14T10:15:00Z',
                commitHash: 'def456',
                commitMessage: 'Add rate limiting',
                buildTime: '1m 30s',
                triggeredBy: 'push'
            }
        ],
        logsEnabled: true,
        metricsEnabled: true,
        healthCheckPath: '/ping',
        instances: 3,
        region: 'us-east-1',
        repository: 'containr/api',
        branch: 'main',
        commitHash: 'def456',
        buildTime: '1m 30s',
        uptime: '99.7%',
        errorRate: '0.3%',
        responseTime: '85ms'
    },
    {
        id: '3',
        name: 'postgres-db',
        type: 'database',
        status: 'running',
        source: 'PostgreSQL 14',
        lastDeploy: '3 days ago',
        cpu: '95m',
        memory: '1Gi',
        environment: 'production',
        variables: { 'POSTGRES_DB': 'containr', 'POSTGRES_USER': 'admin' },
        logsEnabled: true,
        metricsEnabled: true,
        instances: 1,
        region: 'us-east-1',
        uptime: '100%',
        errorRate: '0%'
    },
    {
        id: '4',
        name: 'redis-cache',
        type: 'database',
        status: 'running',
        source: 'Redis 7',
        lastDeploy: '3 days ago',
        cpu: '50m',
        memory: '128Mi',
        environment: 'production',
        variables: { 'REDIS_PASSWORD': 'secret123' },
        logsEnabled: true,
        metricsEnabled: true,
        instances: 1,
        region: 'us-east-1',
        uptime: '100%',
        errorRate: '0%'
    },
    {
        id: '5',
        name: 'background-worker',
        type: 'worker',
        status: 'deploying',
        source: 'GitHub: containr/worker',
        lastDeploy: 'Deploying...',
        cpu: '120m',
        memory: '256Mi',
        environment: 'production',
        buildCommand: 'npm run build',
        startCommand: 'npm run worker',
        variables: { 'QUEUE_URL': 'redis://redis-cache:6379' },
        deployments: [
            {
                id: 'd3',
                version: 'v1.0.1',
                status: 'building',
                timestamp: '2024-07-15T16:45:00Z',
                commitHash: 'ghi789',
                commitMessage: 'Update job processing',
                buildTime: 'Building...',
                triggeredBy: 'manual'
            }
        ],
        logsEnabled: true,
        metricsEnabled: false,
        instances: 1,
        region: 'us-east-1',
        repository: 'containr/worker',
        branch: 'main',
        commitHash: 'ghi789',
        buildTime: 'Building...'
    },
    {
        id: '6',
        name: 'monitoring',
        type: 'app',
        status: 'stopped',
        source: 'GitHub: containr/monitoring',
        lastDeploy: '1 week ago',
        cpu: '0m',
        memory: '0Mi',
        environment: 'development',
        buildCommand: 'docker build -t monitor .',
        startCommand: 'docker run -p 3001:3000 monitor',
        variables: { 'ENV': 'dev' },
        deployments: [
            {
                id: 'd4',
                version: 'v0.9.0',
                status: 'success',
                timestamp: '2024-07-08T09:00:00Z',
                commitHash: 'jkl012',
                commitMessage: 'Add dashboard metrics',
                buildTime: '3m 45s',
                triggeredBy: 'manual'
            }
        ],
        logsEnabled: false,
        metricsEnabled: false,
        instances: 0,
        region: 'us-east-1',
        repository: 'containr/monitoring',
        branch: 'develop',
        commitHash: 'jkl012',
        buildTime: '3m 45s',
        uptime: '0%',
        errorRate: '0%'
    }
];
const getServiceIcon = (type) => {
    switch (type) {
        case 'app':
            return _jsx(Globe, { className: "w-4 h-4" });
        case 'api':
            return _jsx(Settings, { className: "w-4 h-4" });
        case 'database':
            return _jsx(Database, { className: "w-4 h-4" });
        case 'worker':
            return _jsx(Cpu, { className: "w-4 h-4" });
        case 'cron':
            return _jsx(Clock, { className: "w-4 h-4" });
        case 'static':
            return _jsx(PackageOpen, { className: "w-4 h-4" });
        default:
            return _jsx(Server, { className: "w-4 h-4" });
    }
};
const getStatusColor = (status) => {
    switch (status) {
        case 'running':
            return 'bg-green-500';
        case 'building':
        case 'deploying':
            return 'bg-yellow-500';
        case 'failed':
            return 'bg-red-500';
        case 'stopped':
            return 'bg-gray-500';
        default:
            return 'bg-gray-500';
    }
};
const getStatusBadge = (status) => {
    switch (status) {
        case 'running':
            return _jsx(Badge, { variant: "default", className: "bg-green-100 text-green-800", children: "Running" });
        case 'building':
            return _jsx(Badge, { variant: "secondary", children: "Building" });
        case 'deploying':
            return _jsx(Badge, { variant: "secondary", children: "Deploying" });
        case 'failed':
            return _jsx(Badge, { variant: "destructive", children: "Failed" });
        case 'stopped':
            return _jsx(Badge, { variant: "outline", children: "Stopped" });
        default:
            return _jsx(Badge, { variant: "outline", children: "Unknown" });
    }
};
const getStatusIcon = (status) => {
    switch (status) {
        case 'running':
            return _jsx(CheckCircle, { className: "w-3 h-3 text-green-600" });
        case 'building':
        case 'deploying':
            return _jsx(Activity, { className: "w-3 h-3 text-yellow-600" });
        case 'failed':
            return _jsx(AlertTriangle, { className: "w-3 h-3 text-red-600" });
        case 'stopped':
            return _jsx(Pause, { className: "w-3 h-3 text-gray-600" });
        default:
            return _jsx(Clock, { className: "w-3 h-3 text-gray-600" });
    }
};
const getEnvironmentBadge = (environment) => {
    if (!environment)
        return null;
    switch (environment) {
        case 'production':
            return _jsx(Badge, { className: "bg-red-100 text-red-800 text-xs", children: "PROD" });
        case 'preview':
            return _jsx(Badge, { className: "bg-blue-100 text-blue-800 text-xs", children: "PREVIEW" });
        case 'development':
            return _jsx(Badge, { className: "bg-gray-100 text-gray-800 text-xs", children: "DEV" });
        default:
            return _jsx(Badge, { variant: "outline", className: "text-xs", children: environment.toUpperCase() });
    }
};
const getActionButton = (status, onAction) => {
    switch (status) {
        case 'running':
            return (_jsxs("div", { className: "flex gap-1", children: [_jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", onClick: () => onAction('restart'), children: [_jsx(RotateCcw, { className: "w-3 h-3 mr-1" }), "Restart"] }), _jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", onClick: () => onAction('stop'), children: [_jsx(Square, { className: "w-3 h-3 mr-1" }), "Stop"] })] }));
        case 'stopped':
            return (_jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", onClick: () => onAction('start'), children: [_jsx(Play, { className: "w-3 h-3 mr-1" }), "Start"] }));
        case 'building':
            return (_jsx(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", disabled: true, children: "Building..." }));
        case 'failed':
            return (_jsxs("div", { className: "flex gap-1", children: [_jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", onClick: () => onAction('rebuild'), children: [_jsx(RotateCcw, { className: "w-3 h-3 mr-1" }), "Rebuild"] }), _jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 px-2 text-xs", onClick: () => onAction('logs'), children: [_jsx(Eye, { className: "w-3 h-3 mr-1" }), "Logs"] })] }));
        default:
            return null;
    }
};
export function ProjectCanvas() {
    const [selectedService, setSelectedService] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const handleAction = (action) => {
        console.log(`Action: ${action} on service: ${selectedService}`);
        // Here you would handle the actual action
    };
    const selectedServiceData = mockServices.find(s => s.id === selectedService);
    return (_jsxs(Card, { className: "w-full", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CardTitle, { className: "text-sm font-medium", children: "Project Canvas" }), _jsxs(Badge, { variant: "outline", className: "text-xs", children: [mockServices.length, " services"] }), _jsx("div", { className: "w-2 h-2 rounded-full bg-green-500 animate-pulse" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(GitBranch, { className: "w-4 h-4 mr-2" }), "Deploy All"] }), _jsxs(Button, { size: "sm", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Service"] })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: mockServices.map((service) => (_jsxs("div", { className: `relative p-4 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer ${selectedService === service.id ? 'ring-2 ring-primary' : ''}`, onClick: () => setSelectedService(service.id), children: [_jsxs("div", { className: "absolute top-2 right-2 flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getStatusColor(service.status)} animate-pulse` }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", children: _jsx(MoreHorizontal, { className: "w-3 h-3" }) })] }), _jsxs("div", { className: "flex items-center gap-2 mb-3", children: [getServiceIcon(service.type), _jsx("h3", { className: "font-semibold text-sm", children: service.name }), _jsx(Badge, { variant: "outline", className: "text-xs", children: service.type }), getEnvironmentBadge(service.environment)] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-xs text-muted-foreground truncate", children: service.source }), service.url && (_jsx("div", { className: "text-xs text-blue-600 hover:underline truncate", children: service.url })), service.cpu && service.memory && (_jsxs("div", { className: "flex gap-2 text-xs text-muted-foreground", children: [_jsxs("span", { children: ["CPU: ", service.cpu] }), _jsx("span", { children: "\u2022" }), _jsxs("span", { children: ["Memory: ", service.memory] }), service.instances && service.instances > 1 && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsxs("span", { children: [service.instances, "x"] })] }))] })), service.uptime && (_jsxs("div", { className: "flex gap-3 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Activity, { className: "w-3 h-3" }), _jsx("span", { children: service.uptime })] }), service.responseTime && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Zap, { className: "w-3 h-3" }), _jsx("span", { children: service.responseTime })] })), service.errorRate && service.errorRate !== '0%' && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(AlertTriangle, { className: "w-3 h-3 text-red-500" }), _jsx("span", { className: "text-red-500", children: service.errorRate })] }))] })), _jsxs("div", { className: "text-xs text-muted-foreground", children: [service.commitHash && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(GitCommit, { className: "w-3 h-3" }), _jsx("span", { children: service.commitHash.substring(0, 7) }), service.branch && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsx(GitBranch, { className: "w-3 h-3" }), _jsx("span", { children: service.branch })] }))] })), "Last deploy: ", service.lastDeploy] }), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [getStatusBadge(service.status), getActionButton(service.status, handleAction)] })] }), service.connections && service.connections.length > 0 && (_jsx("div", { className: "absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-2 bg-border" }))] }, service.id))) }), selectedService && selectedServiceData && (_jsxs("div", { className: "mt-6 p-4 rounded-lg border bg-muted/50", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h4", { className: "font-medium", children: ["Service Details: ", selectedServiceData.name] }), _jsx("div", { className: "flex gap-1 bg-muted rounded-lg p-1", children: ['overview', 'deployments', 'variables', 'metrics'].map((tab) => (_jsx(Button, { variant: activeTab === tab ? 'default' : 'ghost', size: "sm", className: "text-xs capitalize", onClick: () => setActiveTab(tab), children: tab }, tab))) })] }), activeTab === 'overview' && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Status" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [getStatusIcon(selectedServiceData.status), getStatusBadge(selectedServiceData.status)] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Type" }), _jsx("div", { className: "capitalize mt-1", children: selectedServiceData.type })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Environment" }), _jsx("div", { className: "mt-1", children: getEnvironmentBadge(selectedServiceData.environment) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Region" }), _jsx("div", { className: "mt-1", children: selectedServiceData.region || 'N/A' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Repository" }), _jsx("div", { className: "truncate mt-1", children: selectedServiceData.repository || 'N/A' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Branch" }), _jsx("div", { className: "mt-1", children: selectedServiceData.branch || 'N/A' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Instances" }), _jsx("div", { className: "mt-1", children: selectedServiceData.instances || 1 })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Build Time" }), _jsx("div", { className: "mt-1", children: selectedServiceData.buildTime || 'N/A' })] })] })), activeTab === 'deployments' && selectedServiceData.deployments && (_jsxs("div", { className: "space-y-3", children: [_jsx("h5", { className: "text-sm font-medium", children: "Recent Deployments" }), _jsx("div", { className: "space-y-2", children: selectedServiceData.deployments.map((deployment) => (_jsxs("div", { className: "p-3 rounded-lg border bg-card", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: deployment.status === 'success' ? 'default' : 'secondary', children: deployment.status }), _jsx("span", { className: "text-sm font-medium", children: deployment.version })] }), _jsx("span", { className: "text-xs text-muted-foreground", children: deployment.timestamp })] }), _jsx("div", { className: "text-xs text-muted-foreground mb-1", children: deployment.commitMessage }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(GitCommit, { className: "w-3 h-3" }), _jsx("span", { children: deployment.commitHash.substring(0, 7) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "w-3 h-3" }), _jsx("span", { children: deployment.buildTime })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(GitPullRequest, { className: "w-3 h-3" }), _jsx("span", { children: deployment.triggeredBy })] })] })] }, deployment.id))) })] })), activeTab === 'variables' && selectedServiceData.variables && (_jsxs("div", { className: "space-y-3", children: [_jsx("h5", { className: "text-sm font-medium", children: "Environment Variables" }), _jsx("div", { className: "space-y-2", children: Object.entries(selectedServiceData.variables).map(([key]) => (_jsxs("div", { className: "flex items-center justify-between p-2 rounded border bg-card", children: [_jsx("span", { className: "text-sm font-mono", children: key }), _jsx("span", { className: "text-sm text-muted-foreground", children: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }, key))) })] })), activeTab === 'metrics' && (_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Uptime" }), _jsx("div", { className: "text-lg font-bold text-green-600 mt-1", children: selectedServiceData.uptime || 'N/A' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Error Rate" }), _jsx("div", { className: "text-lg font-bold text-red-600 mt-1", children: selectedServiceData.errorRate || '0%' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Response Time" }), _jsx("div", { className: "text-lg font-bold text-blue-600 mt-1", children: selectedServiceData.responseTime || 'N/A' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Logs" }), _jsx("div", { className: "mt-1", children: _jsx(Badge, { variant: selectedServiceData.logsEnabled ? 'default' : 'outline', children: selectedServiceData.logsEnabled ? 'Enabled' : 'Disabled' }) })] })] }))] })), _jsxs("div", { className: "mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-green-500" }), _jsx("span", { children: "Running" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-yellow-500" }), _jsx("span", { children: "Building/Deploying" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-red-500" }), _jsx("span", { children: "Failed" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-gray-500" }), _jsx("span", { children: "Stopped" })] })] })] })] }));
}
