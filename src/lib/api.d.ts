import type { Project, Service, CreateServiceRequest, UpdateServiceRequest } from '@/types';
export declare const api: {
    get: <T>(endpoint: string) => Promise<T>;
    post: <T>(endpoint: string, data?: unknown) => Promise<T>;
    put: <T>(endpoint: string, data?: unknown) => Promise<T>;
    delete: <T>(endpoint: string) => Promise<T>;
};
export declare const authApi: {
    login: (email: string, password: string) => Promise<{
        token: string;
        user: any;
    }>;
    register: (email: string, password: string, name: string) => Promise<{
        token: string;
        user: any;
    }>;
    getProfile: () => Promise<any>;
    updateProfile: (data: any) => Promise<any>;
};
export declare const projectsApi: {
    getProjects: (params?: {
        page?: number;
        limit?: number;
        search?: string;
    }) => Promise<{
        projects: Project[];
        pagination: any;
    }>;
    getProject: (id: string) => Promise<{
        project: Project;
    }>;
    createProject: (data: {
        name: string;
        description?: string;
    }) => Promise<{
        project: Project;
    }>;
    updateProject: (id: string, data: {
        name?: string;
        description?: string;
    }) => Promise<{
        project: Project;
    }>;
    deleteProject: (id: string) => Promise<{
        message: string;
    }>;
    getPreviewEnvironments: (projectId: string) => Promise<{
        preview_environments: any[];
    }>;
    getServices: (projectId: string) => Promise<{
        services: Service[];
    }>;
    createPreviewEnvironment: (projectId: string, data: any) => Promise<{
        preview_environment: any;
    }>;
    updatePreviewEnvironment: (id: string, data: any) => Promise<{
        preview_environment: any;
    }>;
    deletePreviewEnvironment: (id: string) => Promise<{
        message: string;
    }>;
    promotePreviewEnvironment: (id: string, data: any) => Promise<{
        promotion: any;
    }>;
    cleanupExpiredPreviewEnvironments: () => Promise<{
        message: string;
        cleaned_count: number;
    }>;
};
export declare const servicesApi: {
    getServices: (projectId: string) => Promise<{
        services: Service[];
    }>;
    getService: (id: string) => Promise<{
        service: Service;
    }>;
    createService: (projectId: string, data: CreateServiceRequest) => Promise<{
        service: Service;
    }>;
    updateService: (id: string, data: UpdateServiceRequest) => Promise<{
        service: Service;
    }>;
    deleteService: (id: string) => Promise<{
        message: string;
    }>;
};
export declare const deploymentsApi: {
    getDeployments: (serviceId: string) => Promise<{
        deployments: any[];
    }>;
    createDeployment: (serviceId: string, data: any) => Promise<{
        deployment: any;
    }>;
    getDeployment: (id: string) => Promise<{
        deployment: any;
    }>;
    rollbackDeployment: (id: string) => Promise<{
        deployment: any;
    }>;
};
export declare const variablesApi: {
    getVariables: (serviceId: string) => Promise<{
        variables: any[];
    }>;
    updateVariables: (serviceId: string, variables: {
        key: string;
        value: string;
        is_secret?: boolean;
    }[]) => Promise<{
        variables: any[];
    }>;
};
export declare const logsApi: {
    getServiceLogs: (serviceId: string, options?: {
        lines?: number;
        follow?: boolean;
    }) => Promise<{
        logs: Array<{
            timestamp: string;
            message: string;
            stream: string;
        }>;
    }>;
    getDeploymentLogs: (deploymentId: string, options?: {
        lines?: number;
    }) => Promise<{
        logs: Array<{
            timestamp: string;
            message: string;
            stream: string;
        }>;
    }>;
};
export declare const gitApi: {
    getProviders: () => Promise<{
        providers: any[];
    }>;
    createProvider: (data: {
        name: string;
        display_name: string;
        access_token: string;
    }) => Promise<{
        provider: any;
    }>;
    getProviderRepositories: (providerId: string) => Promise<{
        repositories: any[];
    }>;
    connectRepository: (data: {
        provider_id: string;
        repo_full_name: string;
    }) => Promise<{
        repository: any;
    }>;
    getConnectedRepositories: (params?: {
        page?: number;
        limit?: number;
    }) => Promise<{
        repositories: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    createWebhook: (data: {
        repo_id: string;
        events: string[];
        branch?: string;
    }) => Promise<{
        webhook: any;
        remote_webhook_id: string;
    }>;
    getRepositoryBranches: (repoId: string) => Promise<{
        branches: any[];
    }>;
};
export declare const analyticsApi: {
    getOverview: (timeRange: string, projectId?: string) => Promise<{
        visitors: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
        pageviews: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
        sessions: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
        bounceRate: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
        sessionDuration: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
        conversionRate: {
            current: number;
            previous: number;
            change: number;
            trend: "up" | "down";
        };
    }>;
    getVisitorAnalytics: (timeRange: string, projectId?: string) => Promise<{
        newVsReturning: {
            new: number;
            returning: number;
        };
        devices: {
            desktop: number;
            mobile: number;
            tablet: number;
        };
        browsers: Array<{
            name: string;
            percentage: number;
            users: number;
        }>;
        operatingSystems: Array<{
            name: string;
            percentage: number;
            users: number;
        }>;
        countries: Array<{
            name: string;
            percentage: number;
            users: number;
        }>;
        languages: Array<{
            name: string;
            percentage: number;
            users: number;
        }>;
    }>;
    getTrafficAnalytics: (timeRange: string, projectId?: string) => Promise<{
        sources: Array<{
            name: string;
            percentage: number;
            visitors: number;
            trend: "up" | "down";
            change: number;
        }>;
        referrers: Array<{
            name: string;
            visitors: number;
            percentage: number;
        }>;
        campaigns: Array<{
            name: string;
            visitors: number;
            conversionRate: number;
            revenue: number;
        }>;
        keywords: Array<{
            name: string;
            visitors: number;
            percentage: number;
        }>;
    }>;
    getContentAnalytics: (timeRange: string, projectId?: string) => Promise<{
        topPages: Array<{
            url: string;
            title: string;
            pageviews: number;
            uniquePageviews: number;
            avgTimeOnPage: number;
            bounceRate: number;
            exitRate: number;
            trend: "up" | "down";
            change: number;
        }>;
        landingPages: Array<{
            url: string;
            title: string;
            entrances: number;
            bounceRate: number;
            conversions: number;
            conversionRate: number;
        }>;
        exitPages: Array<{
            url: string;
            title: string;
            exits: number;
            exitRate: number;
            totalPageviews: number;
        }>;
        events: Array<{
            name: string;
            count: number;
            uniqueUsers: number;
            category: string;
        }>;
    }>;
    getRealTimeAnalytics: (projectId?: string) => Promise<{
        onlineUsers: number;
        currentVisitors: number;
        pageviews: Array<{
            url: string;
            title: string;
            count: number;
            percentage: number;
        }>;
        locations: Array<{
            country: string;
            count: number;
            percentage: number;
        }>;
        devices: Array<{
            type: string;
            count: number;
            percentage: number;
        }>;
        recentActivity: Array<{
            type: string;
            user: string;
            page: string;
            location: string;
            device: string;
            event?: string;
            timestamp: string;
        }>;
    }>;
    trackEvent: (data: {
        event: string;
        url: string;
        referrer?: string;
        userAgent?: string;
        projectId?: string;
        metadata?: Record<string, any>;
    }) => Promise<{
        success: boolean;
    }>;
    generateReport: (data: {
        timeRange: string;
        metrics: string[];
        format: "json" | "csv" | "pdf";
        projectId?: string;
    }) => Promise<{
        reportUrl: string;
    }>;
    getSettings: (projectId?: string) => Promise<{
        trackingEnabled: boolean;
        dataRetention: number;
        anonymizeIp: boolean;
        respectDoNotTrack: boolean;
        customEvents: string[];
    }>;
    updateSettings: (data: {
        trackingEnabled?: boolean;
        dataRetention?: number;
        anonymizeIp?: boolean;
        respectDoNotTrack?: boolean;
        customEvents?: string[];
        projectId?: string;
    }) => Promise<{
        settings: any;
    }>;
};
