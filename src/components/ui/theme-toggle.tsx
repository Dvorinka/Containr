import { Moon } from 'lucide-react';
import { Button } from './button';

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      title="Dark mode only"
      disabled
    >
      <Moon className="h-4 w-4" />
      <span className="sr-only">Dark mode</span>
    </Button>
  );
}
