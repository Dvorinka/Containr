import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings, GitBranch, Database, Activity, Users, Calendar, Plus, TestTube } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import PreviewEnvironments from '@/components/preview/PreviewEnvironments';
import { ProjectCanvas } from '@/components/dashboard/ProjectCanvas';
export default function ProjectDetailPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const { data: projectData, isLoading, error } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => projectId ? projectsApi.getProject(projectId) : Promise.reject('No project ID'),
        enabled: !!projectId,
    });
    const project = projectData?.project;
    if (isLoading) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "h-8 bg-gray-200 rounded w-1/4" }), _jsx("div", { className: "h-32 bg-gray-200 rounded-lg" })] }) }));
    }
    if (error || !project) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "text-center py-12", children: [_jsx("h2", { className: "text-2xl font-semibold text-gray-900", children: "Project not found" }), _jsx("p", { className: "text-gray-600 mt-2", children: "The project you're looking for doesn't exist or you don't have access to it." }), _jsxs(Button, { onClick: () => navigate('/projects'), className: "mt-4", children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Back to Projects"] })] }) }));
    }
    const tabs = [
        { id: 'overview', label: 'Overview', icon: Activity },
        { id: 'services', label: 'Services', icon: Database },
        { id: 'preview', label: 'Preview Environments', icon: TestTube },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => navigate('/projects'), children: _jsx(ArrowLeft, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold text-foreground", children: project.name }), _jsx("p", { className: "text-sm md:text-base text-muted-foreground", children: project.description || 'No description' })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", children: [_jsx(Settings, { className: "w-4 h-4 mr-2" }), "Settings"] }), _jsxs(Button, { children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Add Service"] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Database, { className: "w-5 h-5 text-blue-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: "3" }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Services" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(GitBranch, { className: "w-5 h-5 text-green-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: "12" }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Deployments" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Users, { className: "w-5 h-5 text-purple-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: "2" }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Members" })] })] }) }) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-5 h-5 text-orange-500" }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold", children: formatDistanceToNow(new Date(project.created_at), { addSuffix: true }) }), _jsx("div", { className: "text-sm text-muted-foreground", children: "Created" })] })] }) }) })] }), _jsx("div", { className: "border-b", children: _jsx("nav", { className: "flex space-x-8", children: tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (_jsxs("button", { onClick: () => setActiveTab(tab.id), className: `flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: [_jsx(Icon, { className: "w-4 h-4" }), tab.label] }, tab.id));
                    }) }) }), _jsxs("div", { className: "space-y-6", children: [activeTab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Project Overview" }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("h4", { className: "font-medium mb-2", children: "Recent Activity" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(GitBranch, { className: "w-4 h-4" }), _jsx("span", { children: "Deployed main branch to production" }), _jsx("span", { children: "\u2022 2 hours ago" })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(TestTube, { className: "w-4 h-4" }), _jsx("span", { children: "Created preview environment for feature/new-ui" }), _jsx("span", { children: "\u2022 5 hours ago" })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Database, { className: "w-4 h-4" }), _jsx("span", { children: "Added PostgreSQL database" }), _jsx("span", { children: "\u2022 1 day ago" })] })] })] }) }) })] }), _jsx(ProjectCanvas, {})] })), activeTab === 'services' && (_jsx("div", { className: "space-y-6", children: _jsx(ProjectCanvas, {}) })), activeTab === 'preview' && (_jsx(PreviewEnvironments, { projectId: project.id })), activeTab === 'settings' && (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Project Settings" }) }), _jsx(CardContent, { children: _jsx("div", { className: "space-y-4", children: _jsx("p", { className: "text-muted-foreground", children: "Project settings and configuration options will be available here." }) }) })] }) }))] })] }));
}
