import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, Download, Trash2, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logsApi } from '@/lib/api';

interface LogEntry {
  timestamp: string;
  message: string;
  stream: 'stdout' | 'stderr' | 'system';
}

interface ServiceLogsProps {
  serviceId: string;
  serviceName: string;
}

function _ServiceLogs({ serviceId, serviceName }: ServiceLogsProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data: initialLogs, isLoading } = useQuery({
    queryKey: ['logs', serviceId],
    queryFn: async () => {
      const response = await logsApi.getServiceLogs(serviceId, { lines: 100 });
      return response.logs.map((log) => ({
        timestamp: log.timestamp,
        message: log.message,
        stream: log.stream as 'stdout' | 'stderr' | 'system',
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
        const log: LogEntry = JSON.parse(event.data);
        setLogs((prev) => [...prev.slice(-500), log]);
      } catch (e) {
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
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Service Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <Button variant="outline" size="sm" onClick={stopStreaming}>
                <Pause className="w-4 h-4 mr-1" />
                Stop
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startStreaming}>
                <Play className="w-4 h-4 mr-1" />
                Stream
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={downloadLogs}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="bg-gray-950 text-gray-100 rounded-md p-4 h-96 overflow-auto font-mono text-sm"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No logs available. Start the service or enable streaming to see logs.
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`py-0.5 ${
                  log.stream === 'stderr'
                    ? 'text-red-400'
                    : log.stream === 'system'
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                <span className="text-gray-600 mr-2">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                {log.message}
              </div>
            ))
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {logs.length} log entries
            {autoScroll && ' • Auto-scroll enabled'}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Streaming...
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
