import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, Download, Trash2, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logsApi } from '@/lib/api';
function ServiceLogs({ serviceId, serviceName }) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [logs, setLogs] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const logContainerRef = useRef(null);
    const eventSourceRef = useRef(null);
    const { data: initialLogs, isLoading } = useQuery({
        queryKey: ['logs', serviceId],
        queryFn: async () => {
            const response = await logsApi.getServiceLogs(serviceId, { lines: 100 });
            return response.logs.map((log) => ({
                timestamp: log.timestamp,
                message: log.message,
                stream: log.stream,
            }));
        },
    });
    useEffect(() => {
        if (initialLogs) {
            setLogs(initialLogs);
        }
    }, [initialLogs]);
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);
    const startStreaming = () => {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const _token = localStorage.getItem('auth_token');
        const url = new URL(`${API_BASE_URL}/api/v1/services/${serviceId}/logs`);
        url.searchParams.append('follow', 'true');
        const eventSource = new EventSource(url.toString(), {
            withCredentials: true,
        });
        eventSource.onmessage = (event) => {
            try {
                const log = JSON.parse(event.data);
                setLogs((prev) => [...prev.slice(-500), log]);
            }
            catch (e) {
                console.error('Failed to parse log:', e);
            }
        };
        eventSource.onerror = () => {
            console.error('EventSource error');
            eventSource.close();
            setIsStreaming(false);
        };
        eventSourceRef.current = eventSource;
        setIsStreaming(true);
    };
    const stopStreaming = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsStreaming(false);
    };
    const clearLogs = () => {
        setLogs([]);
    };
    const downloadLogs = () => {
        const content = logs
            .map((log) => `[${log.timestamp}] ${log.message}`)
            .join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${serviceName}-${new Date().toISOString()}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const handleScroll = () => {
        if (logContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
            setAutoScroll(isAtBottom);
        }
    };
    if (isLoading) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }) }) }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "text-lg flex items-center gap-2", children: [_jsx(Terminal, { className: "w-5 h-5" }), "Service Logs"] }), _jsxs("div", { className: "flex items-center gap-2", children: [isStreaming ? (_jsxs(Button, { variant: "outline", size: "sm", onClick: stopStreaming, children: [_jsx(Pause, { className: "w-4 h-4 mr-1" }), "Stop"] })) : (_jsxs(Button, { variant: "outline", size: "sm", onClick: startStreaming, children: [_jsx(Play, { className: "w-4 h-4 mr-1" }), "Stream"] })), _jsxs(Button, { variant: "outline", size: "sm", onClick: downloadLogs, children: [_jsx(Download, { className: "w-4 h-4 mr-1" }), "Download"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: clearLogs, children: [_jsx(Trash2, { className: "w-4 h-4 mr-1" }), "Clear"] })] })] }) }), _jsxs(CardContent, { children: [_jsx("div", { ref: logContainerRef, onScroll: handleScroll, className: "bg-gray-950 text-gray-100 rounded-md p-4 h-96 overflow-auto font-mono text-sm", children: logs.length === 0 ? (_jsx("div", { className: "text-gray-500 text-center py-8", children: "No logs available. Start the service or enable streaming to see logs." })) : (logs.map((log, index) => (_jsxs("div", { className: `py-0.5 ${log.stream === 'stderr'
                                ? 'text-red-400'
                                : log.stream === 'system'
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'}`, children: [_jsxs("span", { className: "text-gray-600 mr-2", children: ["[", new Date(log.timestamp).toLocaleTimeString(), "]"] }), log.message] }, index)))) }), _jsxs("div", { className: "mt-2 flex items-center justify-between text-xs text-muted-foreground", children: [_jsxs("span", { children: [logs.length, " log entries", autoScroll && ' • Auto-scroll enabled'] }), isStreaming && (_jsxs("span", { className: "flex items-center gap-1 text-green-500", children: [_jsx("span", { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse" }), "Streaming..."] }))] })] })] }));
}
