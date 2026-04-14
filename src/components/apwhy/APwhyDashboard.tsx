import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Server, 
  Key, 
  Users, 
  Shield, 
  Settings,
  Database,
  Activity
} from 'lucide-react';

import ServicesPanel from './ServicesPanel';
import KeysPanel from './KeysPanel';
import AnalyticsPanel from './AnalyticsPanel';

export default function APwhyDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3, component: AnalyticsPanel },
    { id: 'services', label: 'Services', icon: Server, component: ServicesPanel },
    { id: 'keys', label: 'API Keys', icon: Key, component: KeysPanel },
    { id: 'users', label: 'Users', icon: Users, component: () => (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Users management coming soon
          </div>
        </CardContent>
      </Card>
    )},
    { id: 'roles', label: 'Roles', icon: Shield, component: () => (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Role management coming soon
          </div>
        </CardContent>
      </Card>
    )},
    { id: 'databases', label: 'Databases', icon: Database, component: () => (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Database management coming soon
          </div>
        </CardContent>
      </Card>
    )},
    { id: 'settings', label: 'Settings', icon: Settings, component: () => (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Settings panel coming soon
          </div>
        </CardContent>
      </Card>
    )}
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || AnalyticsPanel;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">APwhy Gateway</h1>
          <p className="text-muted-foreground">
            API routing and management control plane
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Active
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {tabs.map((tab) => {
          const Component = tab.component;
          return (
            <TabsContent key={tab.id} value={tab.id} className="space-y-4">
              <Component />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
