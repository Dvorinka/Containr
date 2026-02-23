import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Database, Play, Pause, CheckCircle, AlertCircle, MoreHorizontal, Activity, MemoryStick, HardDrive, Download } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
const mockDatabases = [
    {
        id: '1',
        name: 'main-postgres',
        type: 'postgresql',
        status: 'running',
        version: '15.4',
        plan: 'standard',
        region: 'us-east-1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        connectionUrl: 'postgresql://user:pass@main-postgres.containr.local:5432/dbname',
        metrics: {
            cpu: 25,
            memory: 60,
            storage: 45,
            connections: 12
        },
        backups: {
            enabled: true,
            lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            retention: 30
        }
    },
    {
        id: '2',
        name: 'cache-redis',
        type: 'redis',
        status: 'running',
        version: '7.2',
        plan: 'starter',
        region: 'us-east-1',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        connectionUrl: 'redis://cache-redis.containr.local:6379',
        metrics: {
            cpu: 15,
            memory: 40,
            storage: 20,
            connections: 8
        },
        backups: {
            enabled: true,
            lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            retention: 7
        }
    }
];
const _databasePlans = {
    hobby: { cpu: 1, memory: 1, storage: 10, price: 0 },
    starter: { cpu: 1, memory: 2, storage: 25, price: 15 },
    standard: { cpu: 2, memory: 4, storage: 100, price: 50 },
    business: { cpu: 4, memory: 8, storage: 500, price: 200 }
};
export default function DatabaseServices() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [_selectedDatabase, _setSelectedDatabase] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'postgresql',
        plan: 'starter',
        region: 'us-east-1'
    });
    const queryClient = useQueryClient();
    const { data: databases = mockDatabases, isLoading, error } = useQuery({
        queryKey: ['databases'],
        queryFn: () => Promise.resolve(mockDatabases),
    });
    const createDatabaseMutation = useMutation({
        mutationFn: (_data) => {
            // Mock API call
            return new Promise(resolve => setTimeout(resolve, 1000));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['databases'] });
            setIsCreateModalOpen(false);
            setFormData({ name: '', type: 'postgresql', plan: 'starter', region: 'us-east-1' });
        },
    });
    const toggleDatabaseMutation = useMutation({
        mutationFn: ({ id, action }) => {
            return new Promise(resolve => setTimeout(resolve, 1000));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['databases'] });
        },
    });
    const filteredDatabases = databases.filter(db => db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        db.type.toLowerCase().includes(searchTerm.toLowerCase()));
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
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map(i => (_jsx("div", { className: "h-64 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-2xl font-semibold text-gray-900", children: "Error loading databases" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Please check your connection and try again." })] }) }));
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: "Database Services" }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: "Managed PostgreSQL, Redis, and MySQL databases for your applications" })] }), _jsxs(Button, { onClick: () => setIsCreateModalOpen(true), className: "w-full sm:w-auto", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "New Database"] })] }), _jsx("div", { className: "flex flex-col sm:flex-row gap-4", children: _jsxs("div", { className: "relative flex-1", children: [_jsx(Database, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" }), _jsx(Input, { placeholder: "Search databases...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "pl-10" })] }) }), filteredDatabases.length === 0 ? (_jsxs("div", { className: "text-center py-12", children: [_jsx("div", { className: "mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4", children: _jsx(Database, { className: "w-12 h-12 text-gray-400" }) }), _jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: searchTerm ? 'No databases found' : 'No databases yet' }), _jsx("p", { className: "text-gray-600 mb-4", children: searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Create your first database to get started with managed data storage' }), !searchTerm && (_jsxs(Button, { onClick: () => setIsCreateModalOpen(true), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Create Database"] }))] })) : (_jsx("div", { className: "grid gap-6 md:grid-cols-2 lg:grid-cols-3", children: filteredDatabases.map((database) => (_jsxs(Card, { className: "group hover:shadow-lg transition-all duration-200", children: [_jsx(CardHeader, { className: "pb-3", children: _jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "text-2xl", children: getDatabaseIcon(database.type) }), _jsxs("div", { className: "flex-1", children: [_jsx(CardTitle, { className: "text-lg font-semibold truncate", children: database.name }), _jsxs("p", { className: "text-sm text-muted-foreground capitalize", children: [database.type, " \u2022 ", database.version] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${getStatusColor(database.status)} animate-pulse` }), getStatusBadge(database.status)] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "w-4 h-4 text-blue-500" }), _jsxs("div", { children: [_jsxs("div", { className: "font-medium", children: [database.metrics.cpu, "%"] }), _jsx("div", { className: "text-xs text-muted-foreground", children: "CPU" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(MemoryStick, { className: "w-4 h-4 text-green-500" }), _jsxs("div", { children: [_jsxs("div", { className: "font-medium", children: [database.metrics.memory, "%"] }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Memory" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(HardDrive, { className: "w-4 h-4 text-orange-500" }), _jsxs("div", { children: [_jsxs("div", { className: "font-medium", children: [database.metrics.storage, "%"] }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Storage" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Database, { className: "w-4 h-4 text-purple-500" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: database.metrics.connections }), _jsx("div", { className: "text-xs text-muted-foreground", children: "Connections" })] })] })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx(Badge, { variant: "outline", className: "capitalize", children: database.plan }), _jsx("span", { className: "text-muted-foreground", children: database.region })] }), _jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [database.backups.enabled ? (_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" })) : (_jsx(AlertCircle, { className: "w-4 h-4 text-orange-500" })), _jsxs("span", { className: "text-muted-foreground", children: ["Backups ", database.backups.enabled ? 'enabled' : 'disabled'] })] }), database.backups.lastBackup && (_jsx("span", { className: "text-xs text-muted-foreground", children: formatDistanceToNow(new Date(database.backups.lastBackup), { addSuffix: true }) }))] }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsxs(Button, { variant: "outline", size: "sm", className: "flex-1", onClick: () => navigator.clipboard.writeText(database.connectionUrl), children: [_jsx(Download, { className: "w-3 h-3 mr-1" }), "Copy URL"] }), _jsxs(Button, { variant: database.status === 'running' ? 'destructive' : 'default', size: "sm", className: "flex-1", onClick: () => toggleDatabaseMutation.mutate({
                                                id: database.id,
                                                action: database.status === 'running' ? 'stop' : 'start'
                                            }), disabled: toggleDatabaseMutation.isPending, children: [database.status === 'running' ? (_jsx(Pause, { className: "w-3 h-3 mr-1" })) : (_jsx(Play, { className: "w-3 h-3 mr-1" })), database.status === 'running' ? 'Stop' : 'Start'] }), _jsx(Button, { variant: "ghost", size: "sm", className: "w-8 h-8 p-0", children: _jsx(MoreHorizontal, { className: "w-4 h-4" }) })] })] })] }, database.id))) })), isCreateModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Create New Database" }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "name", children: "Database Name" }), _jsx(Input, { id: "name", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), placeholder: "my-database", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "type", children: "Database Type" }), _jsxs("select", { id: "type", value: formData.type, onChange: (e) => setFormData({ ...formData, type: e.target.value }), className: "w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "postgresql", children: "PostgreSQL" }), _jsx("option", { value: "redis", children: "Redis" }), _jsx("option", { value: "mysql", children: "MySQL" })] })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "plan", children: "Plan" }), _jsxs(Tabs, { value: formData.plan, onValueChange: (value) => setFormData({ ...formData, plan: value }), className: "mt-1", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-4", children: [_jsx(TabsTrigger, { value: "hobby", children: "Hobby" }), _jsx(TabsTrigger, { value: "starter", children: "Starter" }), _jsx(TabsTrigger, { value: "standard", children: "Standard" }), _jsx(TabsTrigger, { value: "business", children: "Business" })] }), _jsx(TabsContent, { value: "hobby", className: "mt-2", children: _jsxs("div", { className: "p-4 border rounded-lg", children: [_jsx("h4", { className: "font-semibold", children: "Hobby Plan" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Perfect for development and small projects" }), _jsxs("div", { className: "mt-2 text-sm", children: [_jsx("div", { children: "\u2022 1 CPU \u2022 1GB RAM \u2022 10GB Storage" }), _jsx("div", { children: "\u2022 Free tier" })] })] }) }), _jsx(TabsContent, { value: "starter", className: "mt-2", children: _jsxs("div", { className: "p-4 border rounded-lg", children: [_jsx("h4", { className: "font-semibold", children: "Starter Plan - $15/month" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Great for production applications" }), _jsxs("div", { className: "mt-2 text-sm", children: [_jsx("div", { children: "\u2022 1 CPU \u2022 2GB RAM \u2022 25GB Storage" }), _jsx("div", { children: "\u2022 Automated backups" })] })] }) }), _jsx(TabsContent, { value: "standard", className: "mt-2", children: _jsxs("div", { className: "p-4 border rounded-lg", children: [_jsx("h4", { className: "font-semibold", children: "Standard Plan - $50/month" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "For growing applications" }), _jsxs("div", { className: "mt-2 text-sm", children: [_jsx("div", { children: "\u2022 2 CPUs \u2022 4GB RAM \u2022 100GB Storage" }), _jsx("div", { children: "\u2022 Enhanced monitoring" })] })] }) }), _jsx(TabsContent, { value: "business", className: "mt-2", children: _jsxs("div", { className: "p-4 border rounded-lg", children: [_jsx("h4", { className: "font-semibold", children: "Business Plan - $200/month" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "High-performance databases" }), _jsxs("div", { className: "mt-2 text-sm", children: [_jsx("div", { children: "\u2022 4 CPUs \u2022 8GB RAM \u2022 500GB Storage" }), _jsx("div", { children: "\u2022 Priority support" })] })] }) })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "region", children: "Region" }), _jsxs("select", { id: "region", value: formData.region, onChange: (e) => setFormData({ ...formData, region: e.target.value }), className: "w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "us-east-1", children: "US East (N. Virginia)" }), _jsx("option", { value: "us-west-2", children: "US West (Oregon)" }), _jsx("option", { value: "eu-west-1", children: "EU West (Ireland)" }), _jsx("option", { value: "ap-southeast-1", children: "Asia Pacific (Singapore)" })] })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsCreateModalOpen(false);
                                                setFormData({ name: '', type: 'postgresql', plan: 'starter', region: 'us-east-1' });
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: () => createDatabaseMutation.mutate(formData), disabled: !formData.name || createDatabaseMutation.isPending, className: "flex-1", children: createDatabaseMutation.isPending ? 'Creating...' : 'Create Database' })] })] })] }) }))] }));
}
