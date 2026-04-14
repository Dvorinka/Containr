import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Github,
  Mail,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  Zap,
  Database,
  GitBranch,
  Shield,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  
  const { login, register, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await register(email, password, `${firstName} ${lastName}`);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleGitHubAuth = () => {
    console.log('GitHub OAuth not implemented yet');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Side - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-surface">
          <div 
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 30%, rgb(var(--primary) / 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgb(var(--gradient-end) / 0.1) 0%, transparent 50%)'
            }}
          />
        </div>
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgb(var(--foreground)) 1px, transparent 1px), linear-gradient(to right, rgb(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Containr</h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8 max-w-md">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight mb-4 leading-tight">
                Deploy your apps
                <br />
                <span className="text-gradient">in seconds</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A self-hosted platform for managing containers, databases, and infrastructure with zero-config deployments.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Zero-config deployments', description: 'Push to deploy with automatic builds', icon: Zap },
                { title: 'Managed databases', description: 'PostgreSQL, Redis, and more', icon: Database },
                { title: 'Git integration', description: 'Connect your repositories', icon: GitBranch },
                { title: 'Built-in monitoring', description: 'Real-time metrics and logs', icon: Shield },
              ].map((feature, index) => (
                <div 
                  key={feature.title}
                  className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:bg-card transition-colors"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-surface border-2 border-background text-[10px] font-medium"
                >
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span className="text-xs">Trusted by developers worldwide</span>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <div className="absolute inset-0 bg-background" />
        
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-4">
              <Box className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Containr</h1>
            <p className="text-sm text-muted-foreground">Self-hosted container platform</p>
          </div>

          <Card className="border-border bg-card shadow-lg">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardTitle className="text-lg font-semibold">
                {isRegister ? 'Create account' : 'Welcome back'}
              </CardTitle>
              <CardDescription className="text-sm">
                {isRegister 
                  ? 'Enter your details to get started'
                  : 'Sign in to your account'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full gap-2 h-10 font-medium"
                onClick={handleGitHubAuth}
              >
                <Github className="w-4 h-4" />
                Continue with GitHub
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="text-sm py-2">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-name" className="text-xs">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="first-name"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          required={isRegister}
                          className="pl-9 h-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last-name" className="text-xs">Last name</Label>
                      <Input
                        id="last-name"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required={isRegister}
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full gap-2 h-9"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRegister ? 'Create account' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  {isRegister ? 'Already have an account?' : "Don't have an account?"}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError('');
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  {isRegister ? 'Sign in' : 'Sign up'}
                </button>
              </div>
              
              <Separator />

              <button
                type="button"
                onClick={() => {
                  setError('');
                  localStorage.setItem('demoMode', 'true');
                  window.location.href = '/';
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-surface group"
              >
                <Sparkles className="w-4 h-4 group-hover:text-primary transition-colors" />
                <span>Try demo mode</span>
              </button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-foreground">Terms</a> and{' '}
            <a href="#" className="underline hover:text-foreground">Privacy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
