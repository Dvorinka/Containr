import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Circle, AlertCircle, Play, Square, Trash2, ExternalLink } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  port: number;
  icon: string;
  deployed: boolean;
  status: 'idle' | 'deploying' | 'running' | 'error' | 'stopped';
  progress?: number;
  logs?: string[];
  urls?: string[];
  lastDeployed?: string;
}

const DockerTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: 'glance',
      name: 'Glance Dashboard',
      description: 'Personal dashboard with widgets',
      category: 'Productivity',
      difficulty: 'Easy',
      port: 8080,
      icon: '📊',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'umami',
      name: 'Umami Analytics',
      description: 'Privacy-focused web analytics',
      category: 'Analytics',
      difficulty: 'Easy',
      port: 3000,
      icon: '📈',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'memos',
      name: 'Memos',
      description: 'Note-taking and knowledge management',
      category: 'Productivity',
      difficulty: 'Easy',
      port: 5230,
      icon: '📝',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'meilisearch',
      name: 'MeiliSearch',
      description: 'Fast search engine',
      category: 'Search',
      difficulty: 'Easy',
      port: 7700,
      icon: '🔍',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'uptime-kuma',
      name: 'Uptime Kuma',
      description: 'Monitoring dashboard',
      category: 'Monitoring',
      difficulty: 'Easy',
      port: 3001,
      icon: '📊',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'plex',
      name: 'Plex',
      description: 'Media server',
      category: 'Media',
      difficulty: 'Medium',
      port: 32400,
      icon: '🎬',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'jellyfin',
      name: 'Jellyfin',
      description: 'Media server (Plex alternative)',
      category: 'Media',
      difficulty: 'Medium',
      port: 8096,
      icon: '🎥',
      deployed: false,
      status: 'idle',
      urls: []
    },
    {
      id: 'nextcloud',
      name: 'Nextcloud',
      description: 'Cloud storage and collaboration',
      category: 'Storage',
      difficulty: 'Hard',
      port: 8080,
      icon: '☁️',
      deployed: false,
      status: 'idle',
      urls: []
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [deploymentLogs, setDeploymentLogs] = useState<{ [key: string]: string[] }>({});

  // Simulate deployment process
  const deployTemplate = async (template: Template) => {
    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { ...t, status: 'deploying', progress: 0, logs: [] }
        : t
    ));

    const logs: string[] = [];
    const steps = [
      'Checking dependencies...',
      'Creating deployment directory...',
      'Extracting docker-compose.yml...',
      'Creating environment variables...',
      'Generating secrets...',
      'Pulling Docker images...',
      'Starting services...',
      'Waiting for services to be ready...',
      'Deployment complete!'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const log = steps[i];
      logs.push(log);
      setDeploymentLogs(prev => ({ ...prev, [template.id]: logs }));
      setTemplates(prev => prev.map(t => 
        t.id === template.id 
          ? { ...t, progress: ((i + 1) / steps.length) * 100 }
          : t
      ));
    }

    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { 
            ...t, 
            status: 'running', 
            deployed: true, 
            progress: 100,
            urls: [`http://localhost:${t.port}`],
            lastDeployed: new Date().toLocaleString()
          }
        : t
    ));
  };

  const stopTemplate = async (template: Template) => {
    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { ...t, status: 'stopped', progress: 0 }
        : t
    ));

    await new Promise(resolve => setTimeout(resolve, 2000));

    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { ...t, status: 'idle', deployed: false, urls: [] }
        : t
    ));
  };

  const removeTemplate = async (template: Template) => {
    if (template.status === 'running') {
      await stopTemplate(template);
    }
    
    setTemplates(prev => prev.map(t => 
      t.id === template.id 
        ? { ...t, status: 'idle', deployed: false, progress: 0, urls: [], logs: [] }
        : t
    ));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deploying': return <Circle className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'stopped': return <Square className="h-4 w-4 text-gray-500" />;
      default: return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (activeTab === 'all') return true;
    if (activeTab === 'deployed') return template.deployed;
    if (activeTab === 'easy') return template.difficulty === 'Easy';
    if (activeTab === 'medium') return template.difficulty === 'Medium';
    if (activeTab === 'hard') return template.difficulty === 'Hard';
    return true;
  });

  const deployedCount = templates.filter(t => t.deployed).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Docker Template Manager</h1>
          <p className="text-muted-foreground">
            Deploy and manage Docker applications with one click
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">📦</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deployed</p>
                <p className="text-2xl font-bold">{deployedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="deployed">Deployed</TabsTrigger>
              <TabsTrigger value="easy">Easy</TabsTrigger>
              <TabsTrigger value="medium">Medium</TabsTrigger>
              <TabsTrigger value="hard">Hard</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate?.id === template.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{template.icon}</span>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                        {getStatusIcon(template.status)}
                      </div>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={getDifficultyColor(template.difficulty)}>
                          {template.difficulty}
                        </Badge>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      
                      {template.progress !== undefined && template.progress > 0 && (
                        <div className="mb-3">
                          <Progress value={template.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {template.progress}% complete
                          </p>
                        </div>
                      )}

                      {template.urls && template.urls.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Access URLs:</p>
                          {template.urls.map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-sm text-blue-600 hover:text-blue-800 mb-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {url}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        {template.status === 'idle' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deployTemplate(template);
                            }}
                            className="flex-1"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Deploy
                          </Button>
                        )}
                        {template.status === 'running' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              stopTemplate(template);
                            }}
                            className="flex-1"
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTemplate(template);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          {selectedTemplate ? (
            <Card className="sticky top-6">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div>
                    <CardTitle>{selectedTemplate.name}</CardTitle>
                    <CardDescription>{selectedTemplate.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Port</p>
                    <p className="font-medium">{selectedTemplate.port}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Difficulty</p>
                    <Badge className={getDifficultyColor(selectedTemplate.difficulty)}>
                      {selectedTemplate.difficulty}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(selectedTemplate.status)}
                      <span className="font-medium capitalize">{selectedTemplate.status}</span>
                    </div>
                  </div>
                </div>

                {selectedTemplate.lastDeployed && (
                  <div>
                    <p className="text-sm text-muted-foreground">Last Deployed</p>
                    <p className="font-medium">{selectedTemplate.lastDeployed}</p>
                  </div>
                )}

                {deploymentLogs[selectedTemplate.id] && (
                  <div>
                    <p className="text-sm font-medium mb-2">Deployment Logs</p>
                    <ScrollArea className="h-40 w-full border rounded p-2">
                      <div className="space-y-1">
                        {deploymentLogs[selectedTemplate.id].map((log, index) => (
                          <div key={index} className="text-sm font-mono">
                            {log}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {selectedTemplate.deployed && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      This template is deployed and running. Access it via the URLs provided.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="sticky top-6">
              <CardContent className="p-6 text-center">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-lg font-medium mb-2">Select a Template</h3>
                <p className="text-muted-foreground">
                  Choose a template from the list to view details and deploy it.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DockerTemplateManager;
