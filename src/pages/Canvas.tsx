import { ProjectCanvas } from '@/components/dashboard/ProjectCanvas';
import { PageHeader } from '@/components/ui/page-header';

export default function CanvasPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Canvas"
        description="Visualize your services and deployment graph."
      />
      <ProjectCanvas />
    </div>
  );
}

