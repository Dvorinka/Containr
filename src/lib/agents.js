import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    getAgents: async () => {
        const response = await apiClient.get('/api/agents');
        return response.data;
    },
    getAgent: async (id) => {
        const response = await apiClient.get(`/api/agents/${id}`);
        return response.data;
    },
    registerAgent: async (data) => {
        const response = await apiClient.post('/api/agents/register', data);
        return response.data;
    },
    updateAgent: async (id, data) => {
        const response = await apiClient.put(`/api/agents/${id}`, data);
        return response.data;
    },
    deleteAgent: async (id) => {
        await apiClient.delete(`/api/agents/${id}`);
    },
    // Agent Heartbeat
    sendHeartbeat: async (data) => {
        await apiClient.post('/api/agents/heartbeat', data);
    },
    getAgentMetrics: async (id, timeRange) => {
        const params = timeRange ? { time_range: timeRange } : {};
        const response = await apiClient.get(`/api/agents/${id}/metrics`, { params });
        return response.data;
    },
    // Container Management via Agents
    createContainer: async (agentId, data) => {
        const response = await apiClient.post(`/api/agents/${agentId}/containers`, data);
        return response.data;
    },
    getAgentContainers: async (agentId) => {
        const response = await apiClient.get(`/api/agents/${agentId}/containers`);
        return response.data;
    },
    startContainer: async (agentId, containerId) => {
        await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/start`);
    },
    stopContainer: async (agentId, containerId) => {
        await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/stop`);
    },
    restartContainer: async (agentId, containerId) => {
        await apiClient.post(`/api/agents/${agentId}/containers/${containerId}/restart`);
    },
    removeContainer: async (agentId, containerId) => {
        await apiClient.delete(`/api/agents/${agentId}/containers/${containerId}`);
    },
    getContainerLogs: async (agentId, containerId, options) => {
        const response = await apiClient.get(`/api/agents/${agentId}/containers/${containerId}/logs`, {
            params: options
        });
        return response.data;
    },
    getContainerStats: async (agentId, containerId) => {
        const response = await apiClient.get(`/api/agents/${agentId}/containers/${containerId}/stats`);
        return response.data;
    },
    // Command Management
    getAgentCommands: async (agentId) => {
        const response = await apiClient.get(`/api/agents/${agentId}/commands`);
        return response.data;
    },
    executeCommand: async (agentId, type, payload) => {
        const response = await apiClient.post(`/api/agents/${agentId}/commands`, {
            type,
            payload
        });
        return response.data;
    },
    getCommandStatus: async (agentId, commandId) => {
        const response = await apiClient.get(`/api/agents/${agentId}/commands/${commandId}`);
        return response.data;
    },
    // Cluster Management
    getClusters: async () => {
        const response = await apiClient.get('/api/clusters');
        return response.data;
    },
    getCluster: async (id) => {
        const response = await apiClient.get(`/api/clusters/${id}`);
        return response.data;
    },
    createCluster: async (data) => {
        const response = await apiClient.post('/api/clusters', data);
        return response.data;
    },
    updateCluster: async (id, data) => {
        const response = await apiClient.put(`/api/clusters/${id}`, data);
        return response.data;
    },
    deleteCluster: async (id) => {
        await apiClient.delete(`/api/clusters/${id}`);
    },
    // System Operations
    pruneImages: async (agentId) => {
        await apiClient.post(`/api/agents/${agentId}/system/prune-images`);
    },
    getSystemInfo: async (agentId) => {
        const response = await apiClient.get(`/api/agents/${agentId}/system/info`);
        return response.data;
    },
};
// React Query hooks
const useAgents = () => {
    return useQuery({
        queryKey: ['agents'],
        queryFn: () => agentsApi.getAgents().then(res => res.agents),
        refetchInterval: 30000, // Refresh every 30 seconds
    });
};
const useAgent = (id) => {
    return useQuery({
        queryKey: ['agent', id],
        queryFn: () => agentsApi.getAgent(id).then(res => res.agent),
        enabled: !!id,
        refetchInterval: 15000, // Refresh every 15 seconds
    });
};
const useAgentContainers = (agentId) => {
    return useQuery({
        queryKey: ['agent-containers', agentId],
        queryFn: () => agentsApi.getAgentContainers(agentId).then(res => res.containers),
        enabled: !!agentId,
        refetchInterval: 10000, // Refresh every 10 seconds
    });
};
const useAgentMetrics = (agentId, timeRange) => {
    return useQuery({
        queryKey: ['agent-metrics', agentId, timeRange],
        queryFn: () => agentsApi.getAgentMetrics(agentId, timeRange).then(res => res.metrics),
        enabled: !!agentId,
        refetchInterval: 30000, // Refresh every 30 seconds
    });
};
const useClusters = () => {
    return useQuery({
        queryKey: ['clusters'],
        queryFn: () => agentsApi.getClusters().then(res => res.clusters),
    });
};
const useCluster = (id) => {
    return useQuery({
        queryKey: ['cluster', id],
        queryFn: () => agentsApi.getCluster(id).then(res => res.cluster),
        enabled: !!id,
    });
};
const useRegisterAgent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: agentsApi.registerAgent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
};
const useCreateContainer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ agentId, data }) => agentsApi.createContainer(agentId, data),
        onSuccess: (_, { agentId }) => {
            queryClient.invalidateQueries({ queryKey: ['agent-containers', agentId] });
            queryClient.invalidateQueries({ queryKey: ['agents'] });
        },
    });
};
const useContainerAction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ agentId, containerId, action }) => {
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
const useExecuteAgentCommand = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ agentId, type, payload }) => agentsApi.executeCommand(agentId, type, payload),
        onSuccess: (_, { agentId }) => {
            queryClient.invalidateQueries({ queryKey: ['agent-commands', agentId] });
        },
    });
};
