import type { NodeAgent, AgentHeartbeat, ContainerInstance, AgentCommand, ContainerMetrics, NodeCluster, RegisterAgentRequest, RegisterAgentResponse, CreateContainerRequest, ContainerLogsRequest, ContainerLogsResponse } from '@/types/agent';
export declare const agentsApi: {
    getAgents: () => Promise<{
        agents: NodeAgent[];
    }>;
    getAgent: (id: string) => Promise<{
        agent: NodeAgent;
    }>;
    registerAgent: (data: RegisterAgentRequest) => Promise<RegisterAgentResponse>;
    updateAgent: (id: string, data: Partial<NodeAgent>) => Promise<{
        agent: NodeAgent;
    }>;
    deleteAgent: (id: string) => Promise<void>;
    sendHeartbeat: (data: AgentHeartbeat) => Promise<void>;
    getAgentMetrics: (id: string, timeRange?: string) => Promise<{
        metrics: ContainerMetrics[];
    }>;
    createContainer: (agentId: string, data: CreateContainerRequest) => Promise<{
        container: ContainerInstance;
    }>;
    getAgentContainers: (agentId: string) => Promise<{
        containers: ContainerInstance[];
    }>;
    startContainer: (agentId: string, containerId: string) => Promise<void>;
    stopContainer: (agentId: string, containerId: string) => Promise<void>;
    restartContainer: (agentId: string, containerId: string) => Promise<void>;
    removeContainer: (agentId: string, containerId: string) => Promise<void>;
    getContainerLogs: (agentId: string, containerId: string, options: ContainerLogsRequest) => Promise<ContainerLogsResponse>;
    getContainerStats: (agentId: string, containerId: string) => Promise<{
        stats: ContainerMetrics;
    }>;
    getAgentCommands: (agentId: string) => Promise<{
        commands: AgentCommand[];
    }>;
    executeCommand: (agentId: string, type: string, payload: Record<string, any>) => Promise<{
        command: AgentCommand;
    }>;
    getCommandStatus: (agentId: string, commandId: string) => Promise<{
        command: AgentCommand;
    }>;
    getClusters: () => Promise<{
        clusters: NodeCluster[];
    }>;
    getCluster: (id: string) => Promise<{
        cluster: NodeCluster;
    }>;
    createCluster: (data: Omit<NodeCluster, "id" | "created_at" | "updated_at" | "node_agents" | "total_resources" | "used_resources">) => Promise<{
        cluster: NodeCluster;
    }>;
    updateCluster: (id: string, data: Partial<NodeCluster>) => Promise<{
        cluster: NodeCluster;
    }>;
    deleteCluster: (id: string) => Promise<void>;
    pruneImages: (agentId: string) => Promise<void>;
    getSystemInfo: (agentId: string) => Promise<{
        info: Record<string, any>;
    }>;
};
