import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, RefreshCw, Download, Trash2, Plus, HardDrive, Calendar, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';
function BackupManager({ databaseId, databaseName: _databaseName }) {
    const [selectedBackup, setSelectedBackup] = useState(null);
    const queryClient = useQueryClient();
    const { data: backups, isLoading } = useQuery({
        queryKey: ['backups', databaseId],
        queryFn: async () => {
            const response = await api.get(`/api/v1/databases/${databaseId}/backups`);
            return response.backups;
        },
        refetchInterval: 30000,
    });
    const createBackup = useMutation({
        mutationFn: async () => {
            const response = await api.post(`/api/v1/databases/${databaseId}/backup`, {});
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
        },
    });
    const restoreBackup = useMutation({
        mutationFn: async (backupId) => {
            const response = await api.post(`/api/v1/databases/${databaseId}/restore`, {
                backup_id: backupId,
            });
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
            setSelectedBackup(null);
        },
    });
    const deleteBackup = useMutation({
        mutationFn: async (backupId) => {
            const response = await api.delete(`/api/v1/backups/${backupId}`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
        },
    });
    const formatSize = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed':
                return _jsx(CheckCircle, { className: "w-4 h-4 text-green-500" });
            case 'failed':
                return _jsx(AlertTriangle, { className: "w-4 h-4 text-red-500" });
            case 'in_progress':
                return _jsx(Loader2, { className: "w-4 h-4 text-blue-500 animate-spin" });
            default:
                return _jsx(Clock, { className: "w-4 h-4 text-gray-500" });
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500';
            case 'failed':
                return 'bg-red-500';
            case 'in_progress':
                return 'bg-blue-500';
            default:
                return 'bg-gray-500';
        }
    };
    if (isLoading) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }) }) }));
    }
    const totalSize = backups?.reduce((sum, b) => sum + b.size_bytes, 0) || 0;
    const completedBackups = backups?.filter((b) => b.status === 'completed').length || 0;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: "Backups" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [completedBackups, " backups \u2022 ", formatSize(totalSize), " total"] })] }), _jsxs(Button, { onClick: () => createBackup.mutate(), disabled: createBackup.isPending, children: [createBackup.isPending ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : (_jsx(Plus, { className: "w-4 h-4 mr-2" })), "Create Backup"] })] }), !backups || backups.length === 0 ? (_jsx(Card, { children: _jsxs(CardContent, { className: "p-6 text-center text-muted-foreground", children: [_jsx(HardDrive, { className: "w-12 h-12 mx-auto mb-2 opacity-50" }), _jsx("p", { children: "No backups yet" }), _jsx("p", { className: "text-sm", children: "Create your first backup to protect your data" })] }) })) : (_jsx("div", { className: "space-y-2", children: backups.map((backup) => (_jsx(Card, { className: selectedBackup === backup.id ? 'border-primary' : '', children: _jsxs(CardContent, { className: "p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getStatusIcon(backup.status), _jsxs("div", { children: [_jsx("div", { className: "font-medium", children: backup.name }), _jsxs("div", { className: "flex items-center gap-3 text-sm text-muted-foreground", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx(Calendar, { className: "w-3 h-3" }), formatDistanceToNow(new Date(backup.created_at), { addSuffix: true })] }), _jsx("span", { children: formatSize(backup.size_bytes) })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Badge, { variant: "outline", className: `${getStatusColor(backup.status)} text-white`, children: backup.status }), backup.status === 'completed' && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => restoreBackup.mutate(backup.id), disabled: restoreBackup.isPending, children: restoreBackup.isPending ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(RefreshCw, { className: "w-4 h-4" })) }), _jsx(Button, { variant: "ghost", size: "sm", children: _jsx(Download, { className: "w-4 h-4" }) })] })), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => deleteBackup.mutate(backup.id), disabled: deleteBackup.isPending, className: "text-destructive hover:text-destructive", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }), backup.completed_at && (_jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Completed: ", format(new Date(backup.completed_at), 'PPpp'), backup.expires_at && (_jsxs("span", { className: "ml-2", children: ["\u2022 Expires: ", format(new Date(backup.expires_at), 'PP')] }))] }))] }) }, backup.id))) })), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { className: "text-sm", children: "Backup Schedule" }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "w-4 h-4 text-muted-foreground" }), _jsx("span", { className: "text-sm", children: "Daily backups at 2:00 AM UTC" })] }), _jsx(Button, { variant: "outline", size: "sm", children: "Configure" })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-2", children: "Backups are retained for 30 days by default" })] })] })] }));
}
