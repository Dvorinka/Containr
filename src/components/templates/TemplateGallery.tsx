import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Grid,
  List,
  Box,
  Database,
  Terminal,
  Globe,
  Clock,
  Dock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  config: {
    type: string;
    runtime: string;
    port?: number;
  };
  variables: Array<{
    key: string;
    label: string;
    default?: string;
    required?: boolean;
    secret?: boolean;
  }>;
  is_official: boolean;
}

interface TemplateGalleryProps {
  projectId: string;
  onSelect?: (template: ServiceTemplate) => void;
}

const categoryIcons: Record<string, typeof Box> = {
  web: Globe,
  frontend: Globe,
  database: Database,
  worker: Terminal,
  cron: Clock,
  custom: Dock,
};

function _TemplateGallery({ projectId, onSelect: _onSelect }: TemplateGalleryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<ServiceTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get<{ templates: ServiceTemplate[] }>('/api/v1/templates');
      return response.templates;
    },
  });

  const createFromTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await api.post<{ service_id: string; message: string }>(
        `/api/v1/templates/${templateId}/deploy`,
        {
          project_id: projectId,
          name: selectedTemplate?.name || 'New Service',
          variables: variableValues,
        }
      );
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
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <img 
                src={selectedTemplate.logo} 
                alt="" 
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                }}
              />
              Deploy {selectedTemplate.name}
            </CardTitle>
            <Button variant="ghost" onClick={() => setSelectedTemplate(null)}>
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{selectedTemplate.description}</p>

          {selectedTemplate.variables.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Configuration</h4>
              {selectedTemplate.variables.map((variable) => (
                <div key={variable.key}>
                  <label className="text-sm font-medium">
                    {variable.label}
                    {variable.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <Input
                    type={variable.secret ? 'password' : 'text'}
                    value={variableValues[variable.key] || variable.default || ''}
                    onChange={(e) => setVariableValues({
                      ...variableValues,
                      [variable.key]: e.target.value,
                    })}
                    placeholder={variable.default || `Enter ${variable.label}`}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedTemplate(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createFromTemplate.mutate(selectedTemplate.id)}
              disabled={createFromTemplate.isPending}
              className="flex-1"
            >
              {createFromTemplate.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Deploy
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Button>
        {categories.map((category) => {
          const Icon = categoryIcons[category] || Box;
          return (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap"
            >
              <Icon className="w-4 h-4 mr-1" />
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          );
        })}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates?.map((template) => {
            const Icon = categoryIcons[template.category] || Box;
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedTemplate(template);
                  setVariableValues(
                    template.variables.reduce((acc, v) => {
                      if (v.default) acc[v.key] = v.default;
                      return acc;
                    }, {} as Record<string, string>)
                  );
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <img
                      src={template.logo}
                      alt=""
                      className="w-12 h-12 rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.name}
                        {template.is_official && (
                          <Badge variant="secondary" className="text-xs">
                            Official
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge variant="outline" className="mt-1">
                        <Icon className="w-3 h-3 mr-1" />
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  {template.config.port && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Port: {template.config.port}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTemplates?.map((template) => {
            const Icon = categoryIcons[template.category] || Box;
            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => {
                  setSelectedTemplate(template);
                  setVariableValues(
                    template.variables.reduce((acc, v) => {
                      if (v.default) acc[v.key] = v.default;
                      return acc;
                    }, {} as Record<string, string>)
                  );
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={template.logo}
                      alt=""
                      className="w-10 h-10 rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23666"><rect width="24" height="24" rx="4"/></svg>';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.is_official && (
                          <Badge variant="secondary" className="text-xs">
                            Official
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant="outline">
                      <Icon className="w-3 h-3 mr-1" />
                      {template.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredTemplates?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No templates found matching your search.
        </div>
      )}
    </div>
  );
}
