import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Eye, EyeOff, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { variablesApi } from '@/lib/api';

interface EnvironmentVariable {
  id: string;
  service_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

interface EnvVariablesEditorProps {
  serviceId: string;
}

function _EnvVariablesEditor({ serviceId }: EnvVariablesEditorProps) {
  const [variables, setVariables] = useState<{ key: string; value: string; is_secret: boolean }[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const { data: existingVars, isLoading } = useQuery({
    queryKey: ['variables', serviceId],
    queryFn: async () => {
      const response = await variablesApi.getVariables(serviceId);
      return response.variables as EnvironmentVariable[];
    },
  });

  useState(() => {
    if (existingVars) {
      setVariables(
        existingVars.map((v) => ({
          key: v.key,
          value: v.is_secret ? '' : v.value,
          is_secret: v.is_secret,
        }))
      );
    }
  });

  const updateVariables = useMutation({
    mutationFn: async (vars: { key: string; value: string; is_secret: boolean }[]) => {
      const response = await variablesApi.updateVariables(serviceId, vars);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variables', serviceId] });
      setHasChanges(false);
    },
  });

  const addVariable = () => {
    setVariables([...variables, { key: '', value: '', is_secret: false }]);
    setHasChanges(true);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateVariable = (
    index: number,
    field: 'key' | 'value' | 'is_secret',
    newValue: string | boolean
  ) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: newValue };
    setVariables(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    const validVars = variables.filter((v) => v.key.trim() !== '');
    updateVariables.mutate(validVars);
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
          <CardTitle className="text-lg">Environment Variables</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addVariable}>
              <Plus className="w-4 h-4 mr-1" />
              Add Variable
            </Button>
            {hasChanges && (
              <Button size="sm" onClick={handleSave} disabled={updateVariables.isPending}>
                {updateVariables.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {variables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No environment variables configured. Click "Add Variable" to add one.
            </div>
          ) : (
            variables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2 group">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="KEY"
                    value={variable.key}
                    onChange={(e) => updateVariable(index, 'key', e.target.value)}
                    className="font-mono"
                  />
                  <div className="relative">
                    <Input
                      type={
                        variable.is_secret && !showSecrets[index] ? 'password' : 'text'
                      }
                      placeholder="value"
                      value={variable.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      className="font-mono pr-16"
                    />
                    {variable.is_secret && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() =>
                          setShowSecrets({
                            ...showSecrets,
                            [index]: !showSecrets[index],
                          })
                        }
                      >
                        {showSecrets[index] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateVariable(index, 'is_secret', !variable.is_secret)}
                  className={variable.is_secret ? 'text-amber-500' : 'text-muted-foreground'}
                  title={variable.is_secret ? 'Secret (hidden)' : 'Regular variable'}
                >
                  <Key className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariable(index)}
                  className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {variables.length > 0 && (
          <div className="mt-4 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Secret variables are encrypted and hidden in the UI</li>
              <li>Changes are applied after the next deployment</li>
              <li>Use uppercase keys with underscores (e.g., DATABASE_URL)</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
