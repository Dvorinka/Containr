import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Webhook, 
  Plus, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  GitBranch,
  GitPullRequest,
  GitCommit
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DeploymentTriggers from './DeploymentTriggers';

interface WebhookData {
  id: string;
  repo_id: string;
  events: string[];
  active: boolean;
  branch_filter?: string;
  created_at: string;
  remote_webhook_id: string;
}

interface WebhookManagerProps {
  repositoryId: string;
  repositoryName: string;
  projectId?: string;
}

export default function WebhookManager({ repositoryId, repositoryName, projectId }: WebhookManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'webhooks' | 'triggers'>('webhooks');
  const [webhookForm, setWebhookForm] = useState({
    repo_id: repositoryId,
    events: ['push'],
    branch: ''
  });

  const queryClient = useQueryClient();

  // Mock webhook data for now - in real implementation, this would come from an API
  const { data: webhooksData, isLoading } = useQuery({
    queryKey: ['webhooks', repositoryId],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return {
        webhooks: [
          {
            id: 'webhook-1',
            repo_id: repositoryId,
            events: ['push', 'pull_request'],
            active: true,
            branch_filter: 'main',
            created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            remote_webhook_id: 'remote-123'
          }
        ] as WebhookData[]
      };
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: gitApi.createWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', repositoryId] });
      setIsCreateModalOpen(false);
      setWebhookForm({ repo_id: repositoryId, events: ['push'], branch: '' });
    },
  });

  const webhooks = webhooksData?.webhooks || [];

  const handleCreateWebhook = () => {
    createWebhookMutation.mutate({
      repo_id: webhookForm.repo_id,
      events: webhookForm.events,
      branch: webhookForm.branch || undefined
    });
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'push':
        return <GitCommit className="w-4 h-4" />;
      case 'pull_request':
        return <GitPullRequest className="w-4 h-4" />;
      default:
        return <GitBranch className="w-4 h-4" />;
    }
  };

  const getEventLabel = (event: string) => {
    switch (event) {
      case 'push':
        return 'Push';
      case 'pull_request':
        return 'Pull Request';
      case 'release':
        return 'Release';
      default:
        return event;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Git Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure webhooks and deployment triggers for {repositoryName}
          </p>
        </div>
        {activeTab === 'webhooks' && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Webhook
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={activeTab === 'webhooks' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('webhooks')}
        >
          <Webhook className="w-4 h-4 mr-2" />
          Webhooks
        </Button>
        <Button
          variant={activeTab === 'triggers' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('triggers')}
        >
          <GitBranch className="w-4 h-4 mr-2" />
          Deployment Triggers
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'webhooks' && (
        <div>
          {/* Webhooks List */}
          {webhooks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Webhook className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
                <p className="text-gray-600 text-center mb-4">
                  Create a webhook to automatically trigger deployments when you push to your repository
                </p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          webhook.active ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {webhook.active ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">Webhook</CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>ID: {webhook.id.substring(0, 8)}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(webhook.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={webhook.active ? 'default' : 'secondary'}>
                          {webhook.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Events */}
                    <div>
                      <Label className="text-sm font-medium">Events</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="flex items-center gap-1">
                            {getEventIcon(event)}
                            {getEventLabel(event)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Branch Filter */}
                    {webhook.branch_filter && (
                      <div>
                        <Label className="text-sm font-medium">Branch Filter</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <GitBranch className="w-4 h-4 text-muted-foreground" />
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {webhook.branch_filter}
                          </code>
                        </div>
                      </div>
                    )}

                    {/* Webhook URL */}
                    <div>
                      <Label className="text-sm font-medium">Webhook URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                          {`https://your-domain.com/api/v1/webhooks/git/${repositoryId}`}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(`https://your-domain.com/api/v1/webhooks/git/${repositoryId}`)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Secret */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Webhook Secret</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSecret(showSecret === webhook.id ? null : webhook.id)}
                        >
                          {showSecret === webhook.id ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                          {showSecret === webhook.id 
                            ? 'webhook-secret-' + webhook.id.substring(0, 8)
                            : '••••••••••••••••'
                          }
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard('webhook-secret-' + webhook.id.substring(0, 8))}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'triggers' && projectId && (
        <DeploymentTriggers 
          repositoryId={repositoryId}
          repositoryName={repositoryName}
          projectId={projectId}
        />
      )}

      {/* Create Webhook Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Webhook</CardTitle>
              <p className="text-sm text-muted-foreground">
                for {repositoryName}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Events</Label>
                <div className="space-y-2 mt-2">
                  {['push', 'pull_request', 'release'].map((event) => (
                    <label key={event} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookForm({ ...webhookForm, events: [...webhookForm.events, event] });
                          } else {
                            setWebhookForm({ 
                              ...webhookForm, 
                              events: webhookForm.events.filter(e => e !== event) 
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex items-center gap-2">
                        {getEventIcon(event)}
                        {getEventLabel(event)}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="branch">Branch Filter (Optional)</Label>
                <Input
                  id="branch"
                  value={webhookForm.branch}
                  onChange={(e) => setWebhookForm({ ...webhookForm, branch: e.target.value })}
                  placeholder="main"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Only trigger deployments for this branch
                </p>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">Webhook will be created with:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• URL: https://your-domain.com/api/v1/webhooks/git/{repositoryId}</li>
                  <li>• Auto-generated secret for security</li>
                  <li>• SSL verification enabled</li>
                  <li>• Content type: application/json</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setWebhookForm({ repo_id: repositoryId, events: ['push'], branch: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWebhook}
                  disabled={webhookForm.events.length === 0 || createWebhookMutation.isPending}
                  className="flex-1"
                >
                  {createWebhookMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Webhook'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
