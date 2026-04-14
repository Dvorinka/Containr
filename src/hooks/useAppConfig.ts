import { useState, useEffect } from 'react';

export interface AppConfig {
  mode: 'demo' | 'production';
  features: {
    deployments: boolean;
    analytics: boolean;
    databases: boolean;
    security: boolean;
    apwhy: boolean;
  };
  limits: {
    maxProjects: number;
    maxServices: number;
    maxUsers: number;
  };
}

const defaultConfig: AppConfig = {
  mode: 'demo',
  features: {
    deployments: true,
    analytics: true,
    databases: false,
    security: false,
    apwhy: false,
  },
  limits: {
    maxProjects: 3,
    maxServices: 5,
    maxUsers: 2,
  },
};

const productionConfig: AppConfig = {
  mode: 'production',
  features: {
    deployments: true,
    analytics: true,
    databases: true,
    security: true,
    apwhy: true,
  },
  limits: {
    maxProjects: 100,
    maxServices: 500,
    maxUsers: 50,
  },
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const envMode = import.meta.env.VITE_APP_MODE || 'demo';
        const isDemo = envMode === 'demo';
        
        const appConfig = isDemo ? defaultConfig : productionConfig;
        
        setConfig(appConfig);
      } catch (error) {
        console.error('Failed to load app config:', error);
        setConfig(defaultConfig);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const isFeatureEnabled = (feature: keyof AppConfig['features']) => {
    return config.features[feature];
  };

  const isDemoMode = config.mode === 'demo';

  return {
    config,
    loading,
    isFeatureEnabled,
    isDemoMode,
  };
}
