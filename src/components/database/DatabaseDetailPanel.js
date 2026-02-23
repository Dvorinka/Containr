import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Database, Play, Pause, RefreshCw, Download, Activity, HardDrive, MemoryStick, Clock, CheckCircle, AlertCircle, Copy, Eye, EyeOff, RotateCcw, BarChart3, Users, Shield, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
const mockDatabaseDetail = {
    id: '1',
    name: 'main-postgres',
    type: 'postgresql',
    status: 'running',
    version: '15.4',
    plan: 'standard',
    region: 'us-east-1',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    connectionUrl: 'postgresql://user:password@main-postgres.containr.local:5432/maindb',
    metrics: {
        cpu: 25,
        memory: 60,
        storage: 45,
        connections: 12,
        readIops: 150,
        writeIops: 80,
        networkIn: 2.5,
        networkOut: 1.8
    },
    backups: {
        enabled: true,
        lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        retention: 30,
        nextBackup: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        backups: [
            {
                id: 'backup-1',
                createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                size: '245 MB',
                status: 'completed'
            },
            {
                id: 'backup-2',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                size: '238 MB',
                status: 'completed'
            },
            {
                id: 'backup-3',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                size: '241 MB',
                status: 'completed'
            }
        ]
    },
    settings: {
        maxConnections: 100,
        timeout: 30,
        ssl: true,
        logging: true
    }
};
export default function DatabaseDetailPanel({ databaseId, onClose: _onClose }) {
    const [showConnectionUrl, setShowConnectionUrl] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const queryClient = useQueryClient();
    const { data: database = mockDatabaseDetail, isLoading, error } = useQuery({
        queryKey: ['database', databaseId],
        queryFn: () => Promise.resolve(mockDatabaseDetail),
        enabled: !!databaseId,
    });
    const toggleDatabaseMutation = useMutation({
        mutationFn: ({ action: _action }) => {
            return new Promise(resolve => setTimeout(resolve, 1000));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
        },
    });
    const createBackupMutation = useMutation({
        mutationFn: () => {
            return new Promise(resolve => setTimeout(resolve, 2000));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
        },
    });
    const restoreBackupMutation = useMutation({
        mutationFn: (_backupId) => {
            return new Promise(resolve => setTimeout(resolve, 5000));
        },
        onSuccess: () => {
            setIsRestoring(false);
            setSelectedBackup(null);
            queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
        },
    });
    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'bg-green-500';
            case 'stopped': return 'bg-gray-400';
            case 'building': return 'bg-blue-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'running': return _jsx(Badge, { className: "bg-green-100 text-green-800", children: "Running" });
            case 'stopped': return _jsx(Badge, { variant: "secondary", children: "Stopped" });
            case 'building': return _jsx(Badge, { className: "bg-blue-100 text-blue-800", children: "Building" });
            case 'error': return _jsx(Badge, { variant: "destructive", children: "Error" });
            default: return _jsx(Badge, { variant: "secondary", children: "Unknown" });
        }
    };
    const getDatabaseIcon = (type) => {
        switch (type) {
            case 'postgresql': return '🐘';
            case 'redis': return '🔴';
            case 'mysql': return '🐬';
            default: return '💾';
        }
    };
    if (isLoading) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "h-64 bg-gray-200 rounded-lg" })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-2xl font-semibold text-gray-900", children: "Error loading database details" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Please check your connection and try again." })] }) }));
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "text-3xl", children: getDatabaseIcon(database.type) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-foreground", children: database.name }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsxs("span", { className: "text-sm text-muted-foreground capitalize", children: [database.type, " \u2022 ", database.version] }), _jsx("div", { className: `w-2 h-2 rounded-full ${getStatusColor(database.status)} animate-pulse` }), getStatusBadge(database.status)] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => toggleDatabaseMutation.mutate({ action: 'restart' }), disabled: toggleDatabaseMutation.isPending, children: [_jsx(RotateCcw, { className: "w-4 h-4 mr-2" }), "Restart"] }), _jsxs(Button, { variant: database.status === 'running' ? 'destructive' : 'default', size: "sm", onClick: () => toggleDatabaseMutation.mutate({
                                    action: database.status === 'running' ? 'stop' : 'start'
                                }), disabled: toggleDatabaseMutation.isPending, children: [database.status === 'running' ? (_jsx(Pause, { className: "w-4 h-4 mr-2" })) : (_jsx(Play, { className: "w-4 h-4 mr-2" })), database.status === 'running' ? 'Stop' : 'Start'] })] })] }), _jsxs(Tabs, { defaultValue: "overview", className: "space-y-4", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-6", children: [_jsx(TabsTrigger, { value: "overview", children: "Overview" }), _jsx(TabsTrigger, { value: "metrics", children: "Metrics" }), _jsx(TabsTrigger, { value: "backups", children: "Backups" }), _jsx(TabsTrigger, { value: "settings", children: "Settings" }), _jsx(TabsTrigger, { value: "connections", children: "Connections" }), _jsx(TabsTrigger, { value: "logs", children: "Logs" })] }), _jsx(TabsContent, { value: "overview", className: "space-y-6", children: _jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Database, { className: "w-5 h-5" }), "Connection Information"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Connection URL" }), _jsxs("div", { className: "flex gap-2 mt-1", children: [_jsx(Input, { type: showConnectionUrl ? 'text' : 'password', value: database.connectionUrl, readOnly: true, className: "font-mono text-sm" }), _jsx(Button, { variant: "outline", size: "icon", onClick: () => setShowConnectionUrl(!showConnectionUrl), children: showConnectionUrl ? _jsx(EyeOff, { className: "w-4 h-4" }) : _jsx(Eye, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "outline", size: "icon", onClick: () => navigator.clipboard.writeText(database.connectionUrl), children: _jsx(Copy, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx(Label, { children: "Plan" }), _jsx(Badge, { variant: "outline", className: "capitalize mt-1", children: database.plan })] }), _jsxs("div", { children: [_jsx(Label, { children: "Region" }), _jsx("p", { className: "text-muted-foreground mt-1", children: database.region })] })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(BarChart3, { className: "w-5 h-5" }), "Quick Stats"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "text-center p-4 bg-gray-50 rounded-lg", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: database.metrics.connections }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Active Connections" })] }), _jsxs("div", { className: "text-center p-4 bg-gray-50 rounded-lg", children: [_jsxs("div", { className: "text-2xl font-bold text-green-600", children: [database.metrics.storage, "%"] }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Storage Used" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { children: "Created" }), _jsx("span", { children: formatDistanceToNow(new Date(database.createdAt), { addSuffix: true }) })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { children: "Last Updated" }), _jsx("span", { children: formatDistanceToNow(new Date(database.updatedAt), { addSuffix: true }) })] })] })] })] })] }) }), _jsx(TabsContent, { value: "metrics", className: "space-y-6", children: _jsxs("div", { className: "grid gap-6 md:grid-cols-2 lg:grid-cols-3", children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5 text-blue-500" }), "CPU Usage"] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [database.metrics.cpu, "%"] }), _jsx(Progress, { value: database.metrics.cpu, className: "mt-2" })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(MemoryStick, { className: "w-5 h-5 text-green-500" }), "Memory Usage"] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [database.metrics.memory, "%"] }), _jsx(Progress, { value: database.metrics.memory, className: "mt-2" })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(HardDrive, { className: "w-5 h-5 text-orange-500" }), "Storage Usage"] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "text-2xl font-bold", children: [database.metrics.storage, "%"] }), _jsx(Progress, { value: database.metrics.storage, className: "mt-2" })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(Database, { className: "w-5 h-5 text-purple-500" }), "Read IOPS"] }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: database.metrics.readIops }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Operations/sec" })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(Zap, { className: "w-5 h-5 text-yellow-500" }), "Write IOPS"] }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: database.metrics.writeIops }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Operations/sec" })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(Users, { className: "w-5 h-5 text-cyan-500" }), "Connections"] }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "text-2xl font-bold", children: database.metrics.connections }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Active connections" })] })] })] }) }), _jsxs(TabsContent, { value: "backups", className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Shield, { className: "w-5 h-5" }), "Backup Configuration"] }), _jsxs(Button, { onClick: () => createBackupMutation.mutate(), disabled: createBackupMutation.isPending, children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), createBackupMutation.isPending ? 'Creating...' : 'Create Backup'] })] }) }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [database.backups.enabled ? (_jsx(CheckCircle, { className: "w-5 h-5 text-green-500" })) : (_jsx(AlertCircle, { className: "w-5 h-5 text-orange-500" })), _jsx("span", { children: "Automated Backups" })] }), _jsxs("div", { children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Retention Period:" }), _jsxs("span", { className: "ml-2 font-medium", children: [database.backups.retention, " days"] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Next Backup:" }), _jsx("span", { className: "ml-2 font-medium", children: database.backups.nextBackup ?
                                                                formatDistanceToNow(new Date(database.backups.nextBackup), { addSuffix: true }) :
                                                                'Not scheduled' })] })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Backup History" }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-3", children: database.backups.backups.map((backup) => (_jsxs("div", { className: "flex items-center justify-between p-3 border rounded-lg", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${backup.status === 'completed' ? 'bg-green-500' :
                                                                    backup.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}` }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: backup.id }), _jsx("div", { className: "text-sm text-muted-foreground", children: formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true }) })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: backup.size }), _jsx(Badge, { variant: backup.status === 'completed' ? 'default' :
                                                                    backup.status === 'failed' ? 'destructive' : 'secondary', children: backup.status }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => {
                                                                    setSelectedBackup(backup.id);
                                                                    setIsRestoring(true);
                                                                }, disabled: backup.status !== 'completed' || restoreBackupMutation.isPending, children: [_jsx(RotateCcw, { className: "w-4 h-4 mr-1" }), "Restore"] })] })] }, backup.id))) }) })] })] }), _jsx(TabsContent, { value: "settings", className: "space-y-6", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Database Settings" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Maximum Connections" }), _jsx(Input, { type: "number", value: database.settings.maxConnections, readOnly: true, className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { children: "Connection Timeout (seconds)" }), _jsx(Input, { type: "number", value: database.settings.timeout, readOnly: true, className: "mt-1" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: database.settings.ssl, readOnly: true, className: "rounded" }), _jsx(Label, { children: "Enable SSL/TLS" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: database.settings.logging, readOnly: true, className: "rounded" }), _jsx(Label, { children: "Enable Query Logging" })] })] })] })] }) }), _jsx(TabsContent, { value: "connections", className: "space-y-6", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Active Connections" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "text-center py-8", children: [_jsx(Users, { className: "w-12 h-12 text-muted-foreground mx-auto mb-4" }), _jsx("div", { className: "text-2xl font-bold", children: database.metrics.connections }), _jsx("p", { className: "text-muted-foreground", children: "Active connections" }), _jsxs("div", { className: "mt-4 text-sm text-muted-foreground", children: ["Max connections: ", database.settings.maxConnections] })] }) })] }) }), _jsx(TabsContent, { value: "logs", className: "space-y-6", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Database Logs" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "text-center py-8", children: [_jsx(Clock, { className: "w-12 h-12 text-muted-foreground mx-auto mb-4" }), _jsx("p", { className: "text-muted-foreground", children: "Real-time logs will appear here" }), _jsxs(Button, { variant: "outline", className: "mt-4", children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), "Refresh Logs"] })] }) })] }) })] }), isRestoring && selectedBackup && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Confirm Restore" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("p", { children: ["Are you sure you want to restore from backup \"", selectedBackup, "\"? This will replace the current database data and cannot be undone."] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsRestoring(false);
                                                setSelectedBackup(null);
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: () => restoreBackupMutation.mutate(selectedBackup), disabled: restoreBackupMutation.isPending, variant: "destructive", className: "flex-1", children: restoreBackupMutation.isPending ? 'Restoring...' : 'Restore Database' })] })] })] }) }))] }));
}
