import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Github, 
  GitBranch, 
  Link, 
  Settings, 
  Eye, 
  Trash2, 
  Webhook,
  GitPullRequest,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WebhookManager from '@/components/git/WebhookManager';

interface GitProvider {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
}

export default function GitIntegrationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<GitProvider | null>(null);
  const [selectedRepository, setSelectedRepository] = useState<any>(null);
  const [providerForm, setProviderForm] = useState({ 
    name: 'github', 
    display_name: '', 
    access_token: '' 
  });
  const [repoForm, setRepoForm] = useState({ 
    provider_id: '', 
    repo_full_name: '' 
  });

  const queryClient = useQueryClient();

  // Queries
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['git-providers'],
    queryFn: gitApi.getProviders,
  });

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ['git-repositories'],
    queryFn: () => gitApi.getConnectedRepositories(),
  });

  // Mutations
  const createProviderMutation = useMutation({
    mutationFn: gitApi.createProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-providers'] });
      setIsProviderModalOpen(false);
      setProviderForm({ name: 'github', display_name: '', access_token: '' });
    },
  });

  const connectRepoMutation = useMutation({
    mutationFn: gitApi.connectRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-repositories'] });
      setIsRepoModalOpen(false);
      setRepoForm({ provider_id: '', repo_full_name: '' });
    },
  });

  const providers = providersData?.providers || [];
  const repositories = reposData?.repositories || [];
  const filteredRepos = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateProvider = () => {
    createProviderMutation.mutate(providerForm);
  };

  const handleConnectRepository = () => {
    connectRepoMutation.mutate(repoForm);
  };

  const openRepoModal = (provider: GitProvider) => {
    setSelectedProvider(provider);
    setRepoForm({ provider_id: provider.id, repo_full_name: '' });
    setIsRepoModalOpen(true);
  };

  const getProviderIcon = (name: string) => {
    switch (name) {
      case 'github':
        return <Github className="w-5 h-5" />;
      case 'gitlab':
        return <GitBranch className="w-5 h-5" />;
      case 'bitbucket':
        return <GitPullRequest className="w-5 h-5" />;
      default:
        return <GitBranch className="w-5 h-5" />;
    }
  };

  const getProviderColor = (name: string) => {
    switch (name) {
      case 'github':
        return 'bg-gray-800';
      case 'gitlab':
        return 'bg-orange-500';
      case 'bitbucket':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (providersLoading || reposLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Git Integration</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Connect your Git providers and repositories for seamless deployments
          </p>
        </div>
        <Button 
          onClick={() => setIsProviderModalOpen(true)}
          className="w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Git Provider
        </Button>
      </div>

      {/* Git Providers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Connected Git Providers</h2>
        {providers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Github className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Git providers connected</h3>
              <p className="text-gray-600 text-center mb-4">
                Connect your GitHub, GitLab, or Bitbucket account to start deploying from your repositories
              </p>
              <Button onClick={() => setIsProviderModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Connect Git Provider
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Card key={provider.id} className="group hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${getProviderColor(provider.name)} flex items-center justify-center text-white`}>
                        {getProviderIcon(provider.name)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {provider.name}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRepoModal(provider)}
                    >
                      <Link className="w-3 h-3 mr-1" />
                      Connect Repo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Connected {formatDistanceToNow(new Date(provider.created_at), { addSuffix: true })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Connected Repositories Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-semibold">Connected Repositories</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>
        </div>

        {filteredRepos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <GitBranch className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm ? 'No repositories found' : 'No repositories connected'}
              </h3>
              <p className="text-gray-600 text-center mb-4">
                {searchTerm 
                  ? 'Try adjusting your search terms' 
                  : 'Connect repositories from your Git providers to enable deployments'
                }
              </p>
              {providers.length > 0 && !searchTerm && (
                <Button onClick={() => openRepoModal(providers[0])}>
                  <Plus className="w-4 h-4 mr-2" />
                  Connect Repository
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredRepos.map((repo) => (
              <Card key={repo.id} className="group hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getProviderIcon(repo.provider.name)}
                        <CardTitle className="text-lg font-semibold truncate">
                          {repo.name}
                        </CardTitle>
                        {repo.is_private && (
                          <Badge variant="secondary" className="text-xs">Private</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        {repo.full_name}
                      </p>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3 h-3" />
                      <span>Default: {repo.default_branch}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-green-600">Connected</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setSelectedRepository(repo)}
                    >
                      <Webhook className="w-3 h-3 mr-1" />
                      Webhooks
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Git Provider Modal */}
      {isProviderModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Connect Git Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  className="mt-1 w-full p-2 border rounded-md"
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="bitbucket">Bitbucket</option>
                </select>
              </div>
              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={providerForm.display_name}
                  onChange={(e) => setProviderForm({ ...providerForm, display_name: e.target.value })}
                  placeholder="My GitHub Account"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="access-token">Access Token</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={providerForm.access_token}
                  onChange={(e) => setProviderForm({ ...providerForm, access_token: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a personal access token with repository permissions
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsProviderModalOpen(false);
                    setProviderForm({ name: 'github', display_name: '', access_token: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProvider}
                  disabled={!providerForm.display_name || !providerForm.access_token || createProviderMutation.isPending}
                  className="flex-1"
                >
                  {createProviderMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Provider'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connect Repository Modal */}
      {isRepoModalOpen && selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Connect Repository</CardTitle>
              <p className="text-sm text-muted-foreground">
                from {selectedProvider.display_name}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="repo-full-name">Repository Name</Label>
                <Input
                  id="repo-full-name"
                  value={repoForm.repo_full_name}
                  onChange={(e) => setRepoForm({ ...repoForm, repo_full_name: e.target.value })}
                  placeholder="owner/repository-name"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the full repository name (e.g., "username/my-repo")
                </p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRepoModalOpen(false);
                    setRepoForm({ provider_id: '', repo_full_name: '' });
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectRepository}
                  disabled={!repoForm.repo_full_name || connectRepoMutation.isPending}
                  className="flex-1"
                >
                  {connectRepoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Repository'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Webhook Manager */}
      {selectedRepository && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Webhook Management</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedRepository.full_name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedRepository(null)}
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-6">
              <WebhookManager 
                repositoryId={selectedRepository.id}
                repositoryName={selectedRepository.full_name}
                projectId="project-1" // TODO: Get actual project ID
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
