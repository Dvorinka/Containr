import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Settings, TrendingUp, TrendingDown, Activity, Cpu, HardDrive, AlertTriangle, CheckCircle, XCircle, Edit, Trash2, Play, Pause, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
// Mock API functions
const scalingApi = {
    getPolicies: async () => {
        // Mock data
        return {
            policies: [
                {
                    service_id: 'web-service',
                    min_replicas: 2,
                    max_replicas: 10,
                    target_cpu: 70,
                    target_memory: 80,
                    scale_up_cooldown: '3m',
                    scale_down_cooldown: '5m',
                    scale_up_step: 1,
                    scale_down_step: 1,
                    metrics: ['cpu', 'memory', 'requests_per_second'],
                    enabled: true,
                    cost_optimization: {
                        max_cost_per_hour: 1.0,
                        prefer_efficiency: true,
                        idle_timeout: '10m'
                    }
                },
                {
                    service_id: 'api-service',
                    min_replicas: 1,
                    max_replicas: 20,
                    target_cpu: 60,
                    target_memory: 75,
                    scale_up_cooldown: '1m',
                    scale_down_cooldown: '3m',
                    scale_up_step: 2,
                    scale_down_step: 1,
                    metrics: ['cpu', 'memory', 'requests_per_second', 'error_rate'],
                    enabled: true
                }
            ]
        };
    },
    getServiceStates: async () => {
        return {
            services: [
                {
                    service_id: 'web-service',
                    current_replicas: 3,
                    desired_replicas: 3,
                    last_scale_action: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                    last_scale_direction: 'up'
                },
                {
                    service_id: 'api-service',
                    current_replicas: 5,
                    desired_replicas: 5,
                    last_scale_action: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    last_scale_direction: 'down'
                }
            ]
        };
    },
    getScalingEvents: async () => {
        return {
            events: [
                {
                    id: 'evt_1',
                    service_id: 'web-service',
                    action: 'scale_up',
                    from: 2,
                    to: 3,
                    reason: 'CPU usage (85%) above target (70%)',
                    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                    cost_impact: 0.01
                },
                {
                    id: 'evt_2',
                    service_id: 'api-service',
                    action: 'scale_down',
                    from: 7,
                    to: 5,
                    reason: 'Low request rate (10/s)',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    cost_impact: -0.02
                }
            ]
        };
    },
    getStatus: async () => {
        return {
            status: {
                status: 'active',
                summary: {
                    total_services: 2,
                    enabled_services: 2,
                    total_replicas: 8,
                    services_scaling_up: 0,
                    services_scaling_down: 0,
                    enabled: true,
                    check_interval: '30s'
                }
            }
        };
    },
    setPolicy: async (policy) => {
        // Mock implementation
        console.log('Setting policy:', policy);
        return { message: 'Policy updated successfully', policy };
    },
    enableAutoScaler: async () => {
        return { message: 'Auto-scaler enabled', enabled: true };
    },
    disableAutoScaler: async () => {
        return { message: 'Auto-scaler disabled', enabled: false };
    }
};
export default function ScalingPage() {
    const [selectedService, setSelectedService] = useState(null);
    const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        min_replicas: 1,
        max_replicas: 10,
        target_cpu: 70,
        target_memory: 80,
        scale_up_cooldown: '3m',
        scale_down_cooldown: '5m',
        scale_up_step: 1,
        scale_down_step: 1,
        enabled: true
    });
    const queryClient = useQueryClient();
    const { data: policiesData, isLoading: policiesLoading } = useQuery({
        queryKey: ['scaling-policies'],
        queryFn: scalingApi.getPolicies,
    });
    const { data: servicesData, isLoading: servicesLoading } = useQuery({
        queryKey: ['scaling-services'],
        queryFn: scalingApi.getServiceStates,
    });
    const { data: eventsData, isLoading: eventsLoading } = useQuery({
        queryKey: ['scaling-events'],
        queryFn: scalingApi.getScalingEvents,
    });
    const { data: statusData, isLoading: statusLoading } = useQuery({
        queryKey: ['scaling-status'],
        queryFn: scalingApi.getStatus,
    });
    const setPolicyMutation = useMutation({
        mutationFn: scalingApi.setPolicy,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scaling-policies'] });
            setIsPolicyModalOpen(false);
        },
    });
    const enableAutoScalerMutation = useMutation({
        mutationFn: scalingApi.enableAutoScaler,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scaling-status'] });
        },
    });
    const disableAutoScalerMutation = useMutation({
        mutationFn: scalingApi.disableAutoScaler,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scaling-status'] });
        },
    });
    const policies = policiesData?.policies || [];
    const services = servicesData?.services || [];
    const events = eventsData?.events || [];
    const status = statusData?.status;
    const handleSetPolicy = () => {
        if (selectedService) {
            setPolicyMutation.mutate({
                service_id: selectedService,
                ...formData,
                metrics: ['cpu', 'memory', 'requests_per_second'] // Default metrics
            });
        }
    };
    const openPolicyModal = (serviceId) => {
        if (serviceId) {
            const policy = policies.find(p => p.service_id === serviceId);
            if (policy) {
                setFormData({
                    min_replicas: policy.min_replicas,
                    max_replicas: policy.max_replicas,
                    target_cpu: policy.target_cpu,
                    target_memory: policy.target_memory,
                    scale_up_cooldown: policy.scale_up_cooldown,
                    scale_down_cooldown: policy.scale_down_cooldown,
                    scale_up_step: policy.scale_up_step,
                    scale_down_step: policy.scale_down_step,
                    enabled: policy.enabled
                });
            }
        }
        setSelectedService(serviceId || null);
        setIsPolicyModalOpen(true);
    };
    const getStatusColor = (enabled) => {
        return enabled ? 'text-green-600' : 'text-red-600';
    };
    const getStatusIcon = (enabled) => {
        return enabled ? _jsx(CheckCircle, { className: "w-4 h-4" }) : _jsx(XCircle, { className: "w-4 h-4" });
    };
    const getActionIcon = (action) => {
        return action === 'scale_up' ? _jsx(TrendingUp, { className: "w-4 h-4 text-green-500" }) : _jsx(TrendingDown, { className: "w-4 h-4 text-red-500" });
    };
    if (policiesLoading || servicesLoading || eventsLoading || statusLoading) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: [1, 2, 3, 4, 5, 6].map(i => (_jsx("div", { className: "h-32 bg-gray-200 rounded-lg" }, i))) })] }) }));
    }
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: "Auto-Scaling" }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: "Manage automatic scaling policies for your services" })] }), _jsxs("div", { className: "flex gap-2", children: [status?.summary?.enabled ? (_jsxs(Button, { variant: "outline", onClick: () => disableAutoScalerMutation.mutate(), disabled: disableAutoScalerMutation.isPending, children: [_jsx(Pause, { className: "w-4 h-4 mr-2" }), "Disable"] })) : (_jsxs(Button, { onClick: () => enableAutoScalerMutation.mutate(), disabled: enableAutoScalerMutation.isPending, children: [_jsx(Play, { className: "w-4 h-4 mr-2" }), "Enable"] })), _jsxs(Button, { onClick: () => openPolicyModal(), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "New Policy"] })] })] }), status && (_jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5 text-blue-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: status.summary.total_services }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Total Services" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(CheckCircle, { className: "w-5 h-5 text-green-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: status.summary.enabled_services }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Enabled Services" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Server, { className: "w-5 h-5 text-purple-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: status.summary.total_replicas }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Total Replicas" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [getStatusIcon(status.summary.enabled), _jsxs("div", { children: [_jsx("div", { className: `text-2xl font-bold ${getStatusColor(status.summary.enabled)}`, children: status.summary.enabled ? 'Active' : 'Inactive' }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Auto-Scaler Status" })] })] }) }) })] })), _jsxs(Tabs, { defaultValue: "policies", className: "space-y-4", children: [_jsxs(TabsList, { children: [_jsx(TabsTrigger, { value: "policies", children: "Policies" }), _jsx(TabsTrigger, { value: "services", children: "Services" }), _jsx(TabsTrigger, { value: "events", children: "Events" })] }), _jsx(TabsContent, { value: "policies", className: "space-y-4", children: _jsx("div", { className: "grid gap-4", children: policies.map((policy) => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg", children: policy.service_id }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(Badge, { variant: policy.enabled ? 'default' : 'secondary', children: policy.enabled ? 'Enabled' : 'Disabled' }), _jsxs("span", { className: "text-sm text-muted-foreground", children: [policy.min_replicas, "-", policy.max_replicas, " replicas"] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => openPolicyModal(policy.service_id), children: _jsx(Edit, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Cpu, { className: "w-4 h-4 text-blue-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", children: "Target CPU" }), _jsxs("div", { className: "text-lg font-bold", children: [policy.target_cpu, "%"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(HardDrive, { className: "w-4 h-4 text-green-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", children: "Target Memory" }), _jsxs("div", { className: "text-lg font-bold", children: [policy.target_memory, "%"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-4 h-4 text-purple-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", children: "Scale Up" }), _jsxs("div", { className: "text-lg font-bold", children: ["+", policy.scale_up_step, " (", policy.scale_up_cooldown, ")"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(TrendingDown, { className: "w-4 h-4 text-orange-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", children: "Scale Down" }), _jsxs("div", { className: "text-lg font-bold", children: ["-", policy.scale_down_step, " (", policy.scale_down_cooldown, ")"] })] })] })] }), policy.metrics && (_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium mb-2", children: "Metrics" }), _jsx("div", { className: "flex flex-wrap gap-1", children: policy.metrics.map((metric) => (_jsx(Badge, { variant: "outline", className: "text-xs", children: metric }, metric))) })] }))] })] }, policy.service_id))) }) }), _jsx(TabsContent, { value: "services", className: "space-y-4", children: _jsx("div", { className: "grid gap-4", children: services.map((service) => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx(CardTitle, { className: "text-lg", children: service.service_id }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsxs("span", { className: "text-sm text-muted-foreground", children: [service.current_replicas, " replicas"] }), service.last_scale_direction && (_jsxs("div", { className: "flex items-center gap-1", children: [getActionIcon(service.last_scale_direction), _jsx("span", { className: "text-sm text-muted-foreground", children: formatDistanceToNow(new Date(service.last_scale_action), { addSuffix: true }) })] }))] })] }), _jsxs(Button, { variant: "outline", onClick: () => openPolicyModal(service.service_id), children: [_jsx(Settings, { className: "w-4 h-4 mr-2" }), "Configure"] })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium", children: "Current:" }), _jsx("span", { className: "text-lg font-bold", children: service.current_replicas })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium", children: "Desired:" }), _jsx("span", { className: "text-lg font-bold", children: service.desired_replicas })] }), service.current_replicas !== service.desired_replicas && (_jsxs(Badge, { variant: "outline", className: "text-orange-600", children: [_jsx(AlertTriangle, { className: "w-3 h-3 mr-1" }), "Scaling in progress"] }))] }) })] }, service.service_id))) }) }), _jsx(TabsContent, { value: "events", className: "space-y-4", children: _jsx("div", { className: "space-y-2", children: events.map((event) => (_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getActionIcon(event.action), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: event.service_id }), _jsx("div", { className: "text-sm text-muted-foreground", children: event.reason })] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("div", { className: "font-medium", children: [event.from, " \u2192 ", event.to, " replicas"] }), _jsx("div", { className: "text-sm text-muted-foreground", children: formatDistanceToNow(new Date(event.timestamp), { addSuffix: true }) })] })] }) }) }, event.id))) }) })] }), isPolicyModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs(Card, { className: "w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: selectedService ? 'Edit Scaling Policy' : 'Create Scaling Policy' }) }), _jsxs(CardContent, { className: "space-y-4", children: [selectedService && (_jsxs("div", { children: [_jsx(Label, { children: "Service" }), _jsx(Input, { value: selectedService, disabled: true, className: "mt-1" })] })), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "min-replicas", children: "Min Replicas" }), _jsx(Input, { id: "min-replicas", type: "number", min: "1", value: formData.min_replicas, onChange: (e) => setFormData({ ...formData, min_replicas: parseInt(e.target.value) }), className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "max-replicas", children: "Max Replicas" }), _jsx(Input, { id: "max-replicas", type: "number", min: "1", value: formData.max_replicas, onChange: (e) => setFormData({ ...formData, max_replicas: parseInt(e.target.value) }), className: "mt-1" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "target-cpu", children: "Target CPU (%)" }), _jsx(Input, { id: "target-cpu", type: "number", min: "1", max: "100", value: formData.target_cpu, onChange: (e) => setFormData({ ...formData, target_cpu: parseInt(e.target.value) }), className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "target-memory", children: "Target Memory (%)" }), _jsx(Input, { id: "target-memory", type: "number", min: "1", max: "100", value: formData.target_memory, onChange: (e) => setFormData({ ...formData, target_memory: parseInt(e.target.value) }), className: "mt-1" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "scale-up-step", children: "Scale Up Step" }), _jsx(Input, { id: "scale-up-step", type: "number", min: "1", value: formData.scale_up_step, onChange: (e) => setFormData({ ...formData, scale_up_step: parseInt(e.target.value) }), className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "scale-down-step", children: "Scale Down Step" }), _jsx(Input, { id: "scale-down-step", type: "number", min: "1", value: formData.scale_down_step, onChange: (e) => setFormData({ ...formData, scale_down_step: parseInt(e.target.value) }), className: "mt-1" })] })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "scale-up-cooldown", children: "Scale Up Cooldown" }), _jsx(Input, { id: "scale-up-cooldown", value: formData.scale_up_cooldown, onChange: (e) => setFormData({ ...formData, scale_up_cooldown: e.target.value }), placeholder: "3m", className: "mt-1" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "scale-down-cooldown", children: "Scale Down Cooldown" }), _jsx(Input, { id: "scale-down-cooldown", value: formData.scale_down_cooldown, onChange: (e) => setFormData({ ...formData, scale_down_cooldown: e.target.value }), placeholder: "5m", className: "mt-1" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", id: "enabled", checked: formData.enabled, onChange: (e) => setFormData({ ...formData, enabled: e.target.checked }) }), _jsx(Label, { htmlFor: "enabled", children: "Enable this policy" })] }), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => {
                                                setIsPolicyModalOpen(false);
                                                setSelectedService(null);
                                            }, className: "flex-1", children: "Cancel" }), _jsx(Button, { onClick: handleSetPolicy, disabled: setPolicyMutation.isPending, className: "flex-1", children: setPolicyMutation.isPending ? 'Saving...' : 'Save Policy' })] })] })] }) }))] }));
}
