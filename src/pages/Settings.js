import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Cloud, Globe, Server, Power, PowerOff, RefreshCw, ExternalLink, Shield, CheckCircle2, AlertCircle, Circle, Key, Bell, Save, RotateCcw } from 'lucide-react';
const statusConfig = {
    running: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Running' },
    stopped: { icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Stopped' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Error' },
};
export default function Settings() {
    const [services, setServices] = useState([]);
    const [cloudflareConfig, setCloudflareConfig] = useState({
        enabled: false,
        token: ''
    });
    const [envConfig, setEnvConfig] = useState({
        domain: '',
        acmeEmail: '',
        corsOrigins: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const fetchServices = async () => {
        try {
            const response = await fetch('/api/services/status');
            if (response.ok) {
                const data = await response.json();
                setServices(data.services || []);
            }
        }
        catch (error) {
            console.error('Failed to fetch services:', error);
        }
    };
    const fetchConfig = async () => {
        try {
            const [envResponse, cloudflareResponse] = await Promise.all([
                fetch('/api/config/environment'),
                fetch('/api/config/cloudflare')
            ]);
            if (envResponse.ok) {
                const envData = await envResponse.json();
                setEnvConfig(envData);
            }
            if (cloudflareResponse.ok) {
                const cloudflareData = await cloudflareResponse.json();
                setCloudflareConfig(cloudflareData);
            }
        }
        catch (error) {
            console.error('Failed to fetch config:', error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchServices();
        fetchConfig();
    }, []);
    const handleServiceAction = async (serviceName, action) => {
        try {
            const response = await fetch(`/api/services/${serviceName}/${action}`, {
                method: 'POST',
            });
            if (response.ok) {
                await fetchServices();
                toast({
                    title: 'Success',
                    description: `${serviceName} ${action}ed successfully`,
                    variant: 'success'
                });
            }
            else {
                throw new Error(`Failed to ${action} ${serviceName}`);
            }
        }
        catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Operation failed',
                variant: 'destructive'
            });
        }
    };
    const saveCloudflareConfig = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/config/cloudflare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cloudflareConfig),
            });
            if (response.ok) {
                toast({ title: 'Success', description: 'Cloudflare configuration saved', variant: 'success' });
                await fetchServices();
            }
            else {
                throw new Error('Failed to save Cloudflare configuration');
            }
        }
        catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Save failed',
                variant: 'destructive'
            });
        }
        finally {
            setSaving(false);
        }
    };
    const saveEnvironmentConfig = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/config/environment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(envConfig),
            });
            if (response.ok) {
                toast({ title: 'Success', description: 'Environment configuration saved', variant: 'success' });
            }
            else {
                throw new Error('Failed to save environment configuration');
            }
        }
        catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Save failed',
                variant: 'destructive'
            });
        }
        finally {
            setSaving(false);
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8", children: [_jsx(PageHeader, { title: "Settings", description: "Manage your application configuration and services" }), _jsx("div", { className: "flex items-center justify-center h-64", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-sm text-muted-foreground", children: "Loading settings..." })] }) })] }));
    }
    return (_jsxs("div", { className: "p-4 md:p-6 lg:p-8 space-y-8 animate-fade-in", children: [_jsx(PageHeader, { title: "Settings", description: "Manage your application configuration and services" }), _jsxs(Tabs, { defaultValue: "services", className: "space-y-6", children: [_jsx("div", { className: "relative", children: _jsxs(TabsList, { className: "grid w-full grid-cols-4 lg:w-auto lg:inline-grid bg-muted/30 p-1", children: [_jsxs(TabsTrigger, { value: "services", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Server, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Services" })] }), _jsxs(TabsTrigger, { value: "cloudflare", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Cloud, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Cloudflare" })] }), _jsxs(TabsTrigger, { value: "environment", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Globe, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Environment" })] }), _jsxs(TabsTrigger, { value: "security", className: "gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm", children: [_jsx(Shield, { className: "w-4 h-4" }), _jsx("span", { className: "hidden sm:inline", children: "Security" })] })] }) }), _jsx(TabsContent, { value: "services", className: "space-y-4 animate-fade-in-up", children: _jsxs(Card, { className: "card-hover", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 rounded-xl bg-violet-500/10", children: _jsx(Server, { className: "h-5 w-5 text-violet-500" }) }), _jsxs("div", { children: [_jsx(CardTitle, { children: "Service Management" }), _jsx(CardDescription, { children: "Control the status of your application services" })] })] }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-3", children: services.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 text-center", children: [_jsx("div", { className: "p-4 rounded-full bg-muted/50 mb-4", children: _jsx(Server, { className: "h-8 w-8 text-muted-foreground" }) }), _jsx("p", { className: "text-muted-foreground", children: "No services configured" })] })) : (services.map((service, index) => {
                                            const config = statusConfig[service.status];
                                            return (_jsxs("div", { className: cn("flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all duration-200", "animate-fade-in-up"), style: { animationDelay: `${index * 50}ms` }, children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: cn("p-2 rounded-lg", config.bg), children: _jsx(config.icon, { className: cn("w-4 h-4", config.color) }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium", children: service.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: service.description }), service.url && (_jsxs("a", { href: service.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-primary hover:underline flex items-center gap-1 mt-1", children: [_jsx(ExternalLink, { className: "h-3 w-3" }), service.url] }))] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Badge, { variant: "outline", className: cn("border-0 font-medium", config.bg, config.color), children: config.label }), _jsxs("div", { className: "flex gap-1", children: [service.status === 'stopped' ? (_jsxs(Button, { size: "sm", onClick: () => handleServiceAction(service.name, 'start'), className: "gap-1.5", children: [_jsx(Power, { className: "h-3.5 w-3.5" }), "Start"] })) : (_jsxs(Button, { size: "sm", variant: "outline", onClick: () => handleServiceAction(service.name, 'stop'), className: "gap-1.5", children: [_jsx(PowerOff, { className: "h-3.5 w-3.5" }), "Stop"] })), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => handleServiceAction(service.name, 'restart'), className: "px-2", children: _jsx(RefreshCw, { className: "h-3.5 w-3.5" }) })] })] })] }, service.name));
                                        })) }) })] }) }), _jsx(TabsContent, { value: "cloudflare", className: "space-y-4 animate-fade-in-up", children: _jsxs(Card, { className: "card-hover", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 rounded-xl bg-orange-500/10", children: _jsx(Cloud, { className: "h-5 w-5 text-orange-500" }) }), _jsxs("div", { children: [_jsx(CardTitle, { children: "Cloudflare Tunnel" }), _jsx(CardDescription, { children: "Configure Cloudflare tunnel to expose your services without domain setup" })] })] }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20", children: [_jsxs("div", { className: "space-y-0.5", children: [_jsx(Label, { htmlFor: "cloudflare-enabled", className: "text-base font-medium", children: "Enable Cloudflare Tunnel" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Use Cloudflare tunnel instead of custom domain" })] }), _jsx(Switch, { id: "cloudflare-enabled", checked: cloudflareConfig.enabled, onCheckedChange: (enabled) => setCloudflareConfig(prev => ({ ...prev, enabled })) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cloudflare-token", children: "Tunnel Token" }), _jsx(Textarea, { id: "cloudflare-token", placeholder: "Enter your Cloudflare tunnel token...", value: cloudflareConfig.token, onChange: (e) => setCloudflareConfig(prev => ({ ...prev, token: e.target.value })), rows: 3, className: "font-mono text-sm" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Get your token from", ' ', _jsxs("a", { href: "https://dash.cloudflare.com/argotunnel", target: "_blank", rel: "noopener noreferrer", className: "text-primary hover:underline inline-flex items-center gap-1", children: ["Cloudflare Dashboard", _jsx(ExternalLink, { className: "h-3 w-3" })] })] })] }), cloudflareConfig.tunnelUrl && (_jsxs(Alert, { className: "border-emerald-500/30 bg-emerald-500/5", children: [_jsx(Globe, { className: "h-4 w-4 text-emerald-500" }), _jsxs(AlertDescription, { className: "font-mono text-sm", children: ["Tunnel URL: ", _jsx("span", { className: "font-semibold", children: cloudflareConfig.tunnelUrl })] })] })), _jsx(Separator, {}), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => setCloudflareConfig({ enabled: false, token: '' }), children: [_jsx(RotateCcw, { className: "w-4 h-4 mr-2" }), "Reset"] }), _jsxs(Button, { onClick: saveCloudflareConfig, disabled: saving, className: "gap-2", children: [_jsx(Save, { className: "w-4 h-4" }), saving ? 'Saving...' : 'Save Configuration'] })] })] })] }) }), _jsx(TabsContent, { value: "environment", className: "space-y-4 animate-fade-in-up", children: _jsxs(Card, { className: "card-hover", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 rounded-xl bg-blue-500/10", children: _jsx(Globe, { className: "h-5 w-5 text-blue-500" }) }), _jsxs("div", { children: [_jsx(CardTitle, { children: "Environment Configuration" }), _jsx(CardDescription, { children: "Configure domain and environment settings" })] })] }) }), _jsxs(CardContent, { className: "space-y-6", children: [_jsxs("div", { className: "grid gap-6 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "domain", children: "Domain" }), _jsx(Input, { id: "domain", placeholder: "yourdomain.com", value: envConfig.domain, onChange: (e) => setEnvConfig(prev => ({ ...prev, domain: e.target.value })) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "acme-email", children: "ACME Email" }), _jsx(Input, { id: "acme-email", type: "email", placeholder: "admin@yourdomain.com", value: envConfig.acmeEmail, onChange: (e) => setEnvConfig(prev => ({ ...prev, acmeEmail: e.target.value })) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "cors-origins", children: "CORS Allowed Origins" }), _jsx(Textarea, { id: "cors-origins", placeholder: "https://yourdomain.com,https://www.yourdomain.com", value: envConfig.corsOrigins, onChange: (e) => setEnvConfig(prev => ({ ...prev, corsOrigins: e.target.value })), rows: 2, className: "font-mono text-sm" })] }), _jsx(Separator, {}), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsxs(Button, { variant: "outline", onClick: () => setEnvConfig({ domain: '', acmeEmail: '', corsOrigins: '' }), children: [_jsx(RotateCcw, { className: "w-4 h-4 mr-2" }), "Reset"] }), _jsxs(Button, { onClick: saveEnvironmentConfig, disabled: saving, className: "gap-2", children: [_jsx(Save, { className: "w-4 h-4" }), saving ? 'Saving...' : 'Save Configuration'] })] })] })] }) }), _jsx(TabsContent, { value: "security", className: "space-y-4 animate-fade-in-up", children: _jsxs(Card, { className: "card-hover", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 rounded-xl bg-emerald-500/10", children: _jsx(Shield, { className: "h-5 w-5 text-emerald-500" }) }), _jsxs("div", { children: [_jsx(CardTitle, { children: "Security Settings" }), _jsx(CardDescription, { children: "Manage security and authentication settings" })] })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [[
                                            {
                                                title: 'Two-Factor Authentication',
                                                description: 'Add an extra layer of security to your account',
                                                icon: Shield,
                                                defaultChecked: false
                                            },
                                            {
                                                title: 'Session Timeout',
                                                description: 'Automatically log out after inactivity',
                                                icon: Bell,
                                                defaultChecked: true
                                            },
                                            {
                                                title: 'API Key Access',
                                                description: 'Allow API key authentication for integrations',
                                                icon: Key,
                                                defaultChecked: true
                                            },
                                        ].map((setting, index) => (_jsxs("div", { className: cn("flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20", "animate-fade-in-up"), style: { animationDelay: `${index * 50}ms` }, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-2 rounded-lg bg-muted", children: _jsx(setting.icon, { className: "w-4 h-4 text-muted-foreground" }) }), _jsxs("div", { children: [_jsx(Label, { className: "font-medium", children: setting.title }), _jsx("p", { className: "text-sm text-muted-foreground", children: setting.description })] })] }), _jsx(Switch, { defaultChecked: setting.defaultChecked })] }, setting.title))), _jsx(Separator, {}), _jsxs("div", { className: "space-y-3 pt-2", children: [_jsxs(Label, { htmlFor: "jwt-secret", className: "flex items-center gap-2", children: [_jsx(Key, { className: "w-4 h-4" }), "JWT Secret"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "jwt-secret", type: "password", value: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", readOnly: true, className: "font-mono" }), _jsx(Button, { variant: "outline", children: "Regenerate" })] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Regenerating will invalidate all existing sessions" })] })] })] }) })] })] }));
}
