import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Label } from "./label";
import { Input } from "./input";
import { Switch } from "./switch";
import { Badge } from "./badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Palette, Sun, Moon, Monitor, Download, Upload, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  destructive: string;
  warning: string;
  success: string;
  info: string;
  muted: string;
  background: string;
  foreground: string;
  card: string;
  border: string;
  input: string;
  ring: string;
}

interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  colors: ThemeColors;
  borderRadius: number;
  fontSize: 'sm' | 'base' | 'lg';
  fontFamily: 'Inter' | 'JetBrains Mono' | 'Geist' | 'System';
  animations: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

const defaultColors: ThemeColors = {
  primary: '#6366f1',
  secondary: '#f1f5f9',
  accent: '#6366f1',
  destructive: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#3b82f6',
  muted: '#f1f5f9',
  background: '#ffffff',
  foreground: '#0f172a',
  card: '#ffffff',
  border: '#e2e8f0',
  input: '#e2e8f0',
  ring: '#6366f1',
};

const darkColors: ThemeColors = {
  ...defaultColors,
  background: '#040406',
  foreground: '#fafafa',
  card: '#0c0c10',
  border: '#1e1e28',
  input: '#1e1e28',
  muted: '#14141c',
  secondary: '#14141c',
};

const colorPresets = {
  default: defaultColors,
  blue: {
    ...defaultColors,
    primary: '#3b82f6',
    accent: '#3b82f6',
    ring: '#3b82f6',
  },
  green: {
    ...defaultColors,
    primary: '#22c55e',
    accent: '#22c55e',
    ring: '#22c55e',
  },
  purple: {
    ...defaultColors,
    primary: '#8b5cf6',
    accent: '#8b5cf6',
    ring: '#8b5cf6',
  },
  orange: {
    ...defaultColors,
    primary: '#f97316',
    accent: '#f97316',
    ring: '#f97316',
  },
  rose: {
    ...defaultColors,
    primary: '#f43f5e',
    accent: '#f43f5e',
    ring: '#f43f5e',
  },
};

export function ThemeCustomizer() {
  const [settings, setSettings] = useState<ThemeSettings>({
    mode: 'system',
    colors: defaultColors,
    borderRadius: 0.75,
    fontSize: 'base',
    fontFamily: 'Inter',
    animations: true,
    reducedMotion: false,
    highContrast: false,
  });

  const [activePreset, setActivePreset] = useState<keyof typeof colorPresets>('default');

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  const applyTheme = (themeSettings: ThemeSettings) => {
    const root = document.documentElement;
    
    // Apply colors
    Object.entries(themeSettings.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      const rgb = hexToRgb(value);
      if (rgb) {
        root.style.setProperty(cssVar, `${rgb.r} ${rgb.g} ${rgb.b}`);
      }
    });

    // Apply other settings
    root.style.setProperty('--radius', `${themeSettings.borderRadius}rem`);
    
    // Apply font size
    const fontSizes = { sm: '14px', base: '16px', lg: '18px' };
    root.style.setProperty('--font-size-base', fontSizes[themeSettings.fontSize]);
    
    // Apply font family
    const fontFamilies = {
      'Inter': 'Inter, system-ui, sans-serif',
      'JetBrains Mono': 'JetBrains Mono, monospace',
      'Geist': 'Geist, Inter, sans-serif',
      'System': 'system-ui, sans-serif',
    };
    root.style.setProperty('--font-family', fontFamilies[themeSettings.fontFamily]);

    // Apply theme mode
    if (themeSettings.mode === 'dark') {
      root.classList.add('dark');
    } else if (themeSettings.mode === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Apply accessibility settings
    if (themeSettings.reducedMotion) {
      root.style.setProperty('--transition-duration', '0ms');
    } else {
      root.style.removeProperty('--transition-duration');
    }

    if (themeSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (!themeSettings.animations) {
      root.style.setProperty('--animation-duration', '0ms');
    } else {
      root.style.removeProperty('--animation-duration');
    }
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const updateColor = (colorKey: keyof ThemeColors, value: string) => {
    setSettings(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value,
      },
    }));
    setActivePreset('default'); // Reset preset when customizing
  };

  const applyPreset = (presetName: keyof typeof colorPresets) => {
    const colors = settings.mode === 'dark' 
      ? { ...colorPresets[presetName], ...darkColors }
      : colorPresets[presetName];
    
    setSettings(prev => ({
      ...prev,
      colors,
    }));
    setActivePreset(presetName);
  };

  const exportTheme = () => {
    const themeData = JSON.stringify(settings, null, 2);
    const blob = new Blob([themeData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setSettings(imported);
        } catch (error) {
          console.error('Failed to import theme:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const resetTheme = () => {
    setSettings({
      mode: 'system',
      colors: defaultColors,
      borderRadius: 0.75,
      fontSize: 'base',
      fontFamily: 'Inter',
      animations: true,
      reducedMotion: false,
      highContrast: false,
    });
    setActivePreset('default');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Theme Customizer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="colors" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
            </TabsList>

            <TabsContent value="colors" className="space-y-6">
              <div>
                <Label className="text-base font-medium">Theme Mode</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={settings.mode === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSettings(prev => ({ ...prev, mode: 'light' }))}
                  >
                    <Sun className="w-4 h-4 mr-1" />
                    Light
                  </Button>
                  <Button
                    variant={settings.mode === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSettings(prev => ({ ...prev, mode: 'dark' }))}
                  >
                    <Moon className="w-4 h-4 mr-1" />
                    Dark
                  </Button>
                  <Button
                    variant={settings.mode === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSettings(prev => ({ ...prev, mode: 'system' }))}
                  >
                    <Monitor className="w-4 h-4 mr-1" />
                    System
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Color Presets</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                  {Object.keys(colorPresets).map((preset) => (
                    <Button
                      key={preset}
                      variant={activePreset === preset ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyPreset(preset as keyof typeof colorPresets)}
                      className="capitalize"
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <Label className="text-base font-medium">Custom Colors</Label>
                {Object.entries(settings.colors).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <Label className="w-24 capitalize text-sm">{key}</Label>
                    <Input
                      type="color"
                      value={value}
                      onChange={(e) => updateColor(key as keyof ThemeColors, e.target.value)}
                      className="w-16 h-8 p-1 border rounded"
                    />
                    <Input
                      value={value}
                      onChange={(e) => updateColor(key as keyof ThemeColors, e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="typography" className="space-y-6">
              <div>
                <Label className="text-base font-medium">Font Family</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(['Inter', 'JetBrains Mono', 'Geist', 'System'] as const).map((font) => (
                    <Button
                      key={font}
                      variant={settings.fontFamily === font ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings(prev => ({ ...prev, fontFamily: font }))}
                    >
                      {font}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Font Size</Label>
                <div className="flex gap-2 mt-2">
                  {(['sm', 'base', 'lg'] as const).map((size) => (
                    <Button
                      key={size}
                      variant={settings.fontSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSettings(prev => ({ ...prev, fontSize: size }))}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Border Radius</Label>
                <div className="space-y-2 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.125"
                    value={settings.borderRadius}
                    onChange={(e) => setSettings(prev => ({ ...prev, borderRadius: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>None</span>
                    <span>{settings.borderRadius}rem</span>
                    <span>Extra</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Animations</Label>
                  <p className="text-sm text-muted-foreground">Enable smooth transitions and animations</p>
                </div>
                <Switch
                  checked={settings.animations}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, animations: checked }))}
                />
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Preview</Label>
                <Card className="p-4">
                  <div className="space-y-3">
                    <Button className="w-full">Primary Button</Button>
                    <div className="flex gap-2">
                      <Badge variant="outline">Badge</Badge>
                      <Badge variant="secondary">Secondary</Badge>
                    </div>
                    <Input placeholder="Sample input field" />
                    <div className="p-3 bg-muted rounded-md">
                      Sample content area with current theme
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="accessibility" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Reduced Motion</Label>
                  <p className="text-sm text-muted-foreground">Minimize animations for users with motion sensitivity</p>
                </div>
                <Switch
                  checked={settings.reducedMotion}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, reducedMotion: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">High Contrast</Label>
                  <p className="text-sm text-muted-foreground">Increase contrast for better readability</p>
                </div>
                <Switch
                  checked={settings.highContrast}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, highContrast: checked }))}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-6 border-t">
            <Button onClick={exportTheme} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button onClick={() => document.getElementById('theme-import')?.click()} variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <input
              id="theme-import"
              type="file"
              accept=".json"
              onChange={importTheme}
              className="hidden"
            />
            <Button onClick={resetTheme} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
