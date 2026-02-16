import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { 
  NodeAgent, 
  AgentHeartbeat, 
  ContainerInstance, 
  AgentCommand,
  ContainerMetrics,
  NodeCluster,
  RegisterAgentRequest,
  RegisterAgentResponse,
  CreateContainerRequest,
  ContainerLogsRequest,
  ContainerLogsResponse
} from '@/types/agent';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const agentsApi = {
  // Node Agent Management
  getAgents: async (): Promise<{ agents: NodeAgent[] }> => {
    const response = await apiClient.get('/api/agents');
    return response.data;
  },

  getAgent: async (id: string): Promise<{ agent: NodeAgent }> => {
    const response = await apiClient.get(`/api/agents/${id}`);
    return response.data;
  },

  registerAgent: async (data: RegisterAgentRequest): Promise<RegisterAgentResponse> => {
    const response = await apiClient.post('/api/agents/register', data);
    return response.data;
  },

  updateAgent: async (id: string, data: Partial<NodeAgent>): Promise<{ agent: NodeAgent }> => {
    const response = await apiClient.put(`/api/agents/${id}`, data);
    return response.data;
  },

  deleteAgent: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${id}`);
  },

  // Agent Heartbeat
  sendHeartbeat: async (data: AgentHeartbeat): Promise<void> => {
    await apiClient.post('/api/agents/heartbeat', data);
  },

  getAgentMetrics: async (id: string, timeRange?: string): Promise<{ metrics: ContainerMetrics[] }> => {
    const params = timeRange ? { time_range: timeRange } : {};
    const response = await apiClient.get(`/api/agents/${id}/metrics`, { params });
    return response.data;
  },

  // Container Management via Agents
  createContainer: async (agentId: string, data: CreateContainerRequest): Promise<{ container: ContainerInstance }> => {
    const response = await apiClient.post(`/api/agents/${agentId}/containers`, data);
    return response.data;
  },

  getAgentContainers: async (agentId: string): Promise<{ containers: ContainerInstance[] }> => {
    const response = await apiClient.get(`/api/agents/${agentId}/containers`);
    return response.data;
  },

  startContainer: async (agentId: string, containerId: string): Promise<void> => {
    await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/start`);
  },

  stopContainer: async (agentId: string, containerId: string): Promise<void> => {
    await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/stop`);
  },

  restartContainer: async (agentId: string, containerId: string): Promise<void> => {
    await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/restart`);
  },

  removeContainer: async (agentId: string, containerId: string): Promise<void> => {
    await apiClient.delete(`/api/agents/${agentId}/containers/${containerId}`);
  },

  getContainerLogs: async (agentId: string, containerId: string, options: ContainerLogsRequest): Promise<ContainerLogsResponse> => {
    const response = await apiClient.get(`/api/agents/${agentId}/containers/${containerId}/logs`, { 
      params: options 
    });
    return response.data;
  },

  getContainerStats: async (agentId: string, containerId: string): Promise<{ stats: ContainerMetrics }> => {
    const response = await apiClient.get(`/api/agents/${agentId}/containers/${containerId}/stats`);
    return response.data;
  },

  // Command Management
  getAgentCommands: async (agentId: string): Promise<{ commands: AgentCommand[] }> => {
    const response = await apiClient.get(`/api/agents/${agentId}/commands`);
    return response.data;
  },

  executeCommand: async (agentId: string, type: string, payload: Record<string, any>): Promise<{ command: AgentCommand }> => {
    const response = await apiClient.post(`/api/agents/${agentId}/commands`, {
      type,
      payload
    });
    return response.data;
  },

  getCommandStatus: async (agentId: string, commandId: string): Promise<{ command: AgentCommand }> => {
    const response = await apiClient.get(`/api/agents/${agentId}/commands/${commandId}`);
    return response.data;
  },

  // Cluster Management
  getClusters: async (): Promise<{ clusters: NodeCluster[] }> => {
    const response = await apiClient.get('/api/clusters');
    return response.data;
  },

  getCluster: async (id: string): Promise<{ cluster: NodeCluster }> => {
    const response = await apiClient.get(`/api/clusters/${id}`);
    return response.data;
  },

  createCluster: async (data: Omit<NodeCluster, 'id' | 'created_at' | 'updated_at' | 'node_agents' | 'total_resources' | 'used_resources'>): Promise<{ cluster: NodeCluster }> => {
    const response = await apiClient.post('/api/clusters', data);
    return response.data;
  },

  updateCluster: async (id: string, data: Partial<NodeCluster>): Promise<{ cluster: NodeCluster }> => {
    const response = await apiClient.put(`/api/clusters/${id}`, data);
    return response.data;
  },

  deleteCluster: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/clusters/${id}`);
  },

  // System Operations
  pruneImages: async (agentId: string): Promise<void> => {
    await apiClient.post(`/api/agents/${agentId}/system/prune-images`);
  },

  getSystemInfo: async (agentId: string): Promise<{ info: Record<string, any> }> => {
    const response = await apiClient.get(`/api/agents/${agentId}/system/info`);
    return response.data;
  },
};

// React Query hooks
export const useAgents = () => {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => agentsApi.getAgents().then(res => res.agents),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useAgent = (id: string) => {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => agentsApi.getAgent(id).then(res => res.agent),
    enabled: !!id,
    refetchInterval: 15000, // Refresh every 15 seconds
  });
};

export const useAgentContainers = (agentId: string) => {
  return useQuery({
    queryKey: ['agent-containers', agentId],
    queryFn: () => agentsApi.getAgentContainers(agentId).then(res => res.containers),
    enabled: !!agentId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
};

export const useAgentMetrics = (agentId: string, timeRange?: string) => {
  return useQuery({
    queryKey: ['agent-metrics', agentId, timeRange],
    queryFn: () => agentsApi.getAgentMetrics(agentId, timeRange).then(res => res.metrics),
    enabled: !!agentId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useClusters = () => {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: () => agentsApi.getClusters().then(res => res.clusters),
  });
};

export const useCluster = (id: string) => {
  return useQuery({
    queryKey: ['cluster', id],
    queryFn: () => agentsApi.getCluster(id).then(res => res.cluster),
    enabled: !!id,
  });
};

export const useRegisterAgent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: agentsApi.registerAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useCreateContainer = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: CreateContainerRequest }) =>
      agentsApi.createContainer(agentId, data),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-containers', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useContainerAction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      agentId, 
      containerId, 
      action 
    }: { 
      agentId: string; 
      containerId: string; 
      action: 'start' | 'stop' | 'restart' | 'remove' 
    }) => {
      switch (action) {
        case 'start':
          return agentsApi.startContainer(agentId, containerId);
        case 'stop':
          return agentsApi.stopContainer(agentId, containerId);
        case 'restart':
          return agentsApi.restartContainer(agentId, containerId);
        case 'remove':
          return agentsApi.removeContainer(agentId, containerId);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-containers', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
};

export const useExecuteAgentCommand = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      agentId, 
      type, 
      payload 
    }: { 
      agentId: string; 
      type: string; 
      payload: Record<string, any> 
    }) => agentsApi.executeCommand(agentId, type, payload),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-commands', agentId] });
    },
  });
};
