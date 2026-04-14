import { BookOpen, Github, LayoutTemplate, MousePointer2, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const sections = [
  {
    icon: Server,
    title: 'Create a project',
    text: 'Projects hold services, deployments, variables, and monitoring. Start from Projects, choose New, then open the canvas.',
  },
  {
    icon: Github,
    title: 'Connect GitHub',
    text: 'Connect a GitHub token for private repositories, or paste any public GitHub Compose URL into the template importer.',
  },
  {
    icon: LayoutTemplate,
    title: 'Use templates',
    text: 'Templates are pure Docker Compose files. Optional x-containr or x-casaos fields add app-store metadata.',
  },
  {
    icon: MousePointer2,
    title: 'Manage the canvas',
    text: 'Right-click the project canvas to add services, drag services into position, connect them, and open the service panel for logs and variables.',
  },
];

export default function Docs() {
  return (
    <div className="mx-auto max-w-[1000px] space-y-8 p-5 md:p-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">Docs</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The shortest path from a fresh self-hosted install to running services.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardContent className="space-y-4 p-5">
              <section.icon className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-start gap-4 p-5">
          <BookOpen className="mt-1 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Compose template metadata</h2>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-background p-4 text-xs text-muted-foreground">
{`name: uptime-kuma

x-containr:
  name: Uptime Kuma
  description: Self-hosted uptime monitoring.
  category: Monitoring
  icon: https://cdn.simpleicons.org/uptimekuma
  screenshots:
    - https://example.com/screenshot.png

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "\${UPTIME_KUMA_PORT:-3001}:3001"`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
