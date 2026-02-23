import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  RefreshCw,
  Download,
  Trash2,
  Plus,
  HardDrive,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';

interface Backup {
  id: string;
  database_id: string;
  name: string;
  size_bytes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

interface BackupManagerProps {
  databaseId: string;
  databaseName: string;
}

function _BackupManager({ databaseId, databaseName: _databaseName }: BackupManagerProps) {
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups', databaseId],
    queryFn: async () => {
      const response = await api.get<{ backups: Backup[] }>(`/api/v1/databases/${databaseId}/backups`);
      return response.backups;
    },
    refetchInterval: 30000,
  });

  const createBackup = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ backup: Backup }>(`/api/v1/databases/${databaseId}/backup`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
    },
  });

  const restoreBackup = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await api.post<{ message: string }>(`/api/v1/databases/${databaseId}/restore`, {
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
    mutationFn: async (backupId: string) => {
      const response = await api.delete<{ message: string }>(`/api/v1/backups/${backupId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
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

  const totalSize = backups?.reduce((sum, b) => sum + b.size_bytes, 0) || 0;
  const completedBackups = backups?.filter((b) => b.status === 'completed').length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Backups</h3>
          <p className="text-sm text-muted-foreground">
            {completedBackups} backups • {formatSize(totalSize)} total
          </p>
        </div>
        <Button onClick={() => createBackup.mutate()} disabled={createBackup.isPending}>
          {createBackup.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create Backup
        </Button>
      </div>

      {!backups || backups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <HardDrive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No backups yet</p>
            <p className="text-sm">Create your first backup to protect your data</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <Card key={backup.id} className={selectedBackup === backup.id ? 'border-primary' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(backup.status)}
                    <div>
                      <div className="font-medium">{backup.name}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(backup.created_at), { addSuffix: true })}
                        </span>
                        <span>{formatSize(backup.size_bytes)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${getStatusColor(backup.status)} text-white`}>
                      {backup.status}
                    </Badge>
                    {backup.status === 'completed' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restoreBackup.mutate(backup.id)}
                          disabled={restoreBackup.isPending}
                        >
                          {restoreBackup.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteBackup.mutate(backup.id)}
                      disabled={deleteBackup.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {backup.completed_at && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Completed: {format(new Date(backup.completed_at), 'PPpp')}
                    {backup.expires_at && (
                      <span className="ml-2">
                        • Expires: {format(new Date(backup.expires_at), 'PP')}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Backup Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Daily backups at 2:00 AM UTC</span>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Backups are retained for 30 days by default
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
