interface ServiceNodeProps {
    data: {
        label: string;
        type: 'github' | 'database' | 'docker' | 'function' | 'bucket' | 'empty';
        repo?: string;
        status?: 'running' | 'building' | 'error' | 'stopped';
    };
    selected?: boolean;
}
export default function ServiceNode({ data, selected }: ServiceNodeProps): import("react/jsx-runtime").JSX.Element;
export {};
