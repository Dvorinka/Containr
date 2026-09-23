import { Box, Globe, Database, Terminal, Clock } from 'lucide-react';

export function serviceTypeIcon(type: string, size = 18) {
  switch (type) {
    case 'web':
      return <Globe size={size} />;
    case 'database':
      return <Database size={size} />;
    case 'worker':
      return <Terminal size={size} />;
    case 'cron':
      return <Clock size={size} />;
    default:
      return <Box size={size} />;
  }
}

export function serviceTypeColor(type: string): string {
  switch (type) {
    case 'web':
      return '#7ab8ff';
    case 'database':
      return '#b4e34a';
    case 'worker':
      return '#f2c94c';
    case 'cron':
      return '#f2994a';
    default:
      return '#9295a4';
  }
}
