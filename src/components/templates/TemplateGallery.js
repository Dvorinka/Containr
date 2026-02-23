import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Grid, List, Box, Database, Terminal, Globe, Clock, Dock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
const categoryIcons = {
    web: Globe,
    frontend: Globe,
    database: Database,
    worker: Terminal,
    cron: Clock,
    custom: Dock,
};
function TemplateGallery({ projectId, onSelect: _onSelect }) {
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variableValues, setVariableValues] = useState({});
    const queryClient = useQueryClient();
    const { data: templates, isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const response = await api.get('/api/v1/templates');
            return response.templates;
        },
    });
    const createFromTemplate = useMutation({
        mutationFn: async (templateId) => {
            const response = await api.post(`/api/v1/templates/${templateId}/deploy`, {
                project_id: projectId,
                name: selectedTemplate?.name || 'New Service',
                variables: variableValues,
            });
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services', projectId] });
            setSelectedTemplate(null);
            setVariableValues({});
        },
    });
    const filteredTemplates = templates?.filter((template) => {
        const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase()) ||
            template.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !selectedCategory || template.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    const categories = templates ? [...new Set(templates.map((t) => t.category))] : [];
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center p-8", children: _jsx(Loader2, { className: "w-8 h-8 animate-spin text-muted-foreground" }) }));
    }
    if (selectedTemplate) {
        return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx("img", { src: selectedTemplate.logo, alt: "", className: "w-8 h-8 rounded", onError: (e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                                        } }), "Deploy ", selectedTemplate.name] }), _jsx(Button, { variant: "ghost", onClick: () => setSelectedTemplate(null), children: "Back" })] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsx("p", { className: "text-muted-foreground", children: selectedTemplate.description }), selectedTemplate.variables.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsx("h4", { className: "font-medium", children: "Configuration" }), selectedTemplate.variables.map((variable) => (_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium", children: [variable.label, variable.required && _jsx("span", { className: "text-destructive ml-1", children: "*" })] }), _jsx(Input, { type: variable.secret ? 'password' : 'text', value: variableValues[variable.key] || variable.default || '', onChange: (e) => setVariableValues({
                                                ...variableValues,
                                                [variable.key]: e.target.value,
                                            }), placeholder: variable.default || `Enter ${variable.label}`, className: "mt-1" })] }, variable.key)))] })), _jsxs("div", { className: "flex gap-2 pt-4", children: [_jsx(Button, { variant: "outline", onClick: () => setSelectedTemplate(null), className: "flex-1", children: "Cancel" }), _jsxs(Button, { onClick: () => createFromTemplate.mutate(selectedTemplate.id), disabled: createFromTemplate.isPending, className: "flex-1", children: [createFromTemplate.isPending ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : (_jsx(Plus, { className: "w-4 h-4 mr-2" })), "Deploy"] })] })] })] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row gap-4", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search templates...", value: search, onChange: (e) => setSearch(e.target.value), className: "pl-10" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: viewMode === 'grid' ? 'default' : 'outline', size: "icon", onClick: () => setViewMode('grid'), children: _jsx(Grid, { className: "w-4 h-4" }) }), _jsx(Button, { variant: viewMode === 'list' ? 'default' : 'outline', size: "icon", onClick: () => setViewMode('list'), children: _jsx(List, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "flex gap-2 overflow-x-auto pb-2", children: [_jsx(Button, { variant: selectedCategory === null ? 'default' : 'outline', size: "sm", onClick: () => setSelectedCategory(null), children: "All" }), categories.map((category) => {
                        const Icon = categoryIcons[category] || Box;
                        return (_jsxs(Button, { variant: selectedCategory === category ? 'default' : 'outline', size: "sm", onClick: () => setSelectedCategory(category), className: "whitespace-nowrap", children: [_jsx(Icon, { className: "w-4 h-4 mr-1" }), category.charAt(0).toUpperCase() + category.slice(1)] }, category));
                    })] }), viewMode === 'grid' ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: filteredTemplates?.map((template) => {
                    const Icon = categoryIcons[template.category] || Box;
                    return (_jsxs(Card, { className: "cursor-pointer hover:border-primary transition-colors", onClick: () => {
                            setSelectedTemplate(template);
                            setVariableValues(template.variables.reduce((acc, v) => {
                                if (v.default)
                                    acc[v.key] = v.default;
                                return acc;
                            }, {}));
                        }, children: [_jsx(CardHeader, { className: "pb-2", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("img", { src: template.logo, alt: "", className: "w-12 h-12 rounded-lg", onError: (e) => {
                                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                                            } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs(CardTitle, { className: "text-base flex items-center gap-2", children: [template.name, template.is_official && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Official" }))] }), _jsxs(Badge, { variant: "outline", className: "mt-1", children: [_jsx(Icon, { className: "w-3 h-3 mr-1" }), template.category] })] })] }) }), _jsxs(CardContent, { children: [_jsx("p", { className: "text-sm text-muted-foreground line-clamp-2", children: template.description }), template.config.port && (_jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: ["Port: ", template.config.port] }))] })] }, template.id));
                }) })) : (_jsx("div", { className: "space-y-2", children: filteredTemplates?.map((template) => {
                    const Icon = categoryIcons[template.category] || Box;
                    return (_jsx(Card, { className: "cursor-pointer hover:border-primary transition-colors", onClick: () => {
                            setSelectedTemplate(template);
                            setVariableValues(template.variables.reduce((acc, v) => {
                                if (v.default)
                                    acc[v.key] = v.default;
                                return acc;
                            }, {}));
                        }, children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("img", { src: template.logo, alt: "", className: "w-10 h-10 rounded-lg", onError: (e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                                        } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: template.name }), template.is_official && (_jsx(Badge, { variant: "secondary", className: "text-xs", children: "Official" }))] }), _jsx("p", { className: "text-sm text-muted-foreground truncate", children: template.description })] }), _jsxs(Badge, { variant: "outline", children: [_jsx(Icon, { className: "w-3 h-3 mr-1" }), template.category] })] }) }) }, template.id));
                }) })), filteredTemplates?.length === 0 && (_jsx("div", { className: "text-center py-8 text-muted-foreground", children: "No templates found matching your search." }))] }));
}
