import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Eye, EyeOff } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  plan: string;
  enabled: boolean;
  rpm_limit: number;
  monthly_quota: number;
  created_at: string;
  updated_at: string;
}

export default function KeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('pro');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/v1/keys');
      if (response.ok) {
        const data = await response.json();
        setKeys(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!name.trim()) return;
    
    try {
      const response = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          plan: plan
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setCreatedKey(result.data.key);
        setName('');
        await fetchKeys();
      }
    } catch (error) {
      console.error('Failed to create key:', error);
    }
  };

  const toggleKey = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        await fetchKeys();
      }
    } catch (error) {
      console.error('Failed to toggle key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'default';
      case 'pro': return 'secondary';
      case 'business': return 'outline';
      case 'enterprise': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="space-y-3">
        <CardHeader>
          <CardTitle className="text-lg">Create API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input 
            placeholder="production-client" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
          />
          <Select value={plan} onValueChange={setPlan}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={createKey} className="w-full">Create Key</Button>
          
          {createdKey && (
            <div className="rounded-md border border-primary/50 bg-primary/15 p-3 text-xs">
              <p className="font-semibold uppercase tracking-wide text-primary">Generated once</p>
              <div className="mt-2 flex items-center gap-2 rounded bg-card px-2 py-1 font-mono text-foreground">
                <span className="flex-1 break-all">
                  {showKey ? createdKey : '••••••••••••••••••••••••••••••••'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg mb-3">API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading keys...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys created yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <Badge variant={getPlanColor(key.plan) as any}>
                        {key.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.key_prefix}••••••••
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.enabled ? "default" : "secondary"}>
                        {key.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleKey(key.id, !key.enabled)}
                      >
                        {key.enabled ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
