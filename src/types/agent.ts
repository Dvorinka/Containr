// Node Agent types for the Containr platform

export interface NodeAgent {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  port: number;
  status: 'online' | 'offline' | 'connecting' | 'error';
  version: string;
  capabilities: AgentCapabilities;
  resources: NodeResources;
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

interface AgentCapabilities {
  container_runtimes: string[]; // docker, podman, etc.
  supported_architectures: string[]; // amd64, arm64
  max_containers: number;
  storage_driver: string;
  network_plugins: string[];
  features: string[]; // gpu, volumes, custom_networks
}

interface NodeResources {
  cpu: {
    cores: number;
    allocation: number; // percentage allocated
    usage: number; // current usage percentage
  };
  memory: {
    total: number; // bytes
    allocated: number; // bytes allocated to containers
    used: number; // current usage
    available: number; // free memory
  };
  storage: {
    total: number; // bytes
    allocated: number; // bytes allocated to containers
    used: number; // current usage
    available: number; // free storage
  };
  network: {
    interfaces: NetworkInterface[];
    bandwidth: {
      inbound: number; // bytes per second
      outbound: number; // bytes per second
    };
  };
}

interface NetworkInterface {
  name: string;
  ip_address: string;
  mac_address: string;
  speed: number; // mbps
  status: 'up' | 'down';
}

export interface ContainerInstance {
  id: string;
  name: string;
  image: string;
  project_id: string;
  service_id: string;
  node_agent_id: string;
  status: ContainerStatus;
  resources: ContainerResources;
  ports: PortMapping[];
  environment: Record<string, string>;
  volumes: VolumeMount[];
  networks: string[];
  restart_policy: RestartPolicy;
  health_check: HealthCheck;
  created_at: string;
  started_at?: string;
  updated_at: string;
}

interface ContainerStatus {
  state: 'running' | 'stopped' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
  health: 'healthy' | 'unhealthy' | 'none';
  exit_code?: number;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

interface ContainerResources {
  cpu_limit: number; // cores
  cpu_reservation: number; // cores
  memory_limit: number; // bytes
  memory_reservation: number; // bytes
  disk_limit?: number; // bytes
}

interface PortMapping {
  container_port: number;
  host_port?: number;
  protocol: 'tcp' | 'udp';
  published: boolean;
}

interface VolumeMount {
  name: string;
  source: string; // host path or volume name
  target: string; // container path
  type: 'bind' | 'volume';
  read_only: boolean;
}

interface RestartPolicy {
  name: 'no' | 'on-failure' | 'always' | 'unless-stopped';
  maximum_retry_count?: number;
}

interface HealthCheck {
  test: string[]; // command to run
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  start_period: number; // seconds
}

export interface AgentCommand {
  id: string;
  type: CommandType;
  node_agent_id: string;
  container_id?: string;
  payload: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

type CommandType = 
  | 'create_container'
  | 'start_container'
  | 'stop_container'
  | 'restart_container'
  | 'remove_container'
  | 'update_container'
  | 'get_container_logs'
  | 'get_container_stats'
  | 'list_containers'
  | 'pull_image'
  | 'prune_images'
  | 'system_info'
  | 'health_check';

export interface AgentHeartbeat {
  node_agent_id: string;
  timestamp: string;
  status: 'online' | 'offline';
  resources: NodeResources;
  container_count: number;
  system_load: {
    load_1m: number;
    load_5m: number;
    load_15m: number;
  };
  uptime: number; // seconds
  version: string;
}

export interface ContainerMetrics {
  container_id: string;
  timestamp: string;
  cpu: {
    usage: number; // percentage
    usage_percent: number;
  };
  memory: {
    usage: number; // bytes
    usage_percent: number;
    limit: number; // bytes
  };
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_packets: number;
    tx_packets: number;
  };
  block_io: {
    read_bytes: number;
    write_bytes: number;
  };
  pids: {
    current: number;
    limit: number;
  };
}

export interface NodeCluster {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'maintenance';
  node_agents: NodeAgent[];
  total_resources: NodeResources;
  used_resources: NodeResources;
  scheduling_rules: SchedulingRule[];
  created_at: string;
  updated_at: string;
}

interface SchedulingRule {
  id: string;
  name: string;
  type: 'affinity' | 'anti_affinity' | 'resource_constraint';
  selector: Record<string, any>;
  weight: number;
  enabled: boolean;
}

// API Request/Response types
export interface RegisterAgentRequest {
  name: string;
  hostname: string;
  ip_address: string;
  port: number;
  capabilities: AgentCapabilities;
  auth_token: string;
}

export interface RegisterAgentResponse {
  agent_id: string;
  auth_token: string;
  status: 'registered' | 'updated';
}

export interface CreateContainerRequest {
  name: string;
  image: string;
  project_id: string;
  service_id: string;
  resources: ContainerResources;
  ports: PortMapping[];
  environment: Record<string, string>;
  volumes: VolumeMount[];
  networks: string[];
  restart_policy: RestartPolicy;
  health_check?: HealthCheck;
}

export interface ContainerLogsRequest {
  container_id: string;
  follow: boolean;
  tail: number;
  since?: string;
  until?: string;
}

export interface ContainerLogsResponse {
  logs: string[];
  container_id: string;
  timestamp: string;
}
