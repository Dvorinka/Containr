import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Github, Mail, Lock, User, Layers, ArrowRight, Sparkles, Zap, Database, GitBranch, Shield } from 'lucide-react';
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
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="absolute inset-0 dot-grid opacity-50 dark:opacity-30" />
        <div className="absolute top-0 right-0 w-2/3 h-2/3 radial-glow" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 radial-glow-bottom" />
        <div className="absolute inset-0 mesh-gradient" />
        
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-20 left-20 w-56 h-56 bg-violet-500/10 rounded-full blur-[80px] animate-float" style={{ animationDelay: '-2s' }} />
        
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-primary via-primary to-primary/90 rounded-xl flex items-center justify-center shadow-glow logo-glow p-1.5">
              <img src="/containr.svg" alt="Containr" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Containr</h1>
              <p className="text-xs text-muted-foreground">Self-hosted PaaS</p>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <h2 className="text-4xl font-bold leading-[1.1] mb-4">
                Deploy your apps
                <br />
                <span className="gradient-text-vivid">in seconds</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                A powerful platform for managing containers, databases, and infrastructure with zero-config deployments.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Zero-config deployments', description: 'Push to deploy with automatic builds', icon: Zap },
                { title: 'Managed databases', description: 'PostgreSQL, Redis, and more', icon: Database },
                { title: 'Automatic scaling', description: 'Scale up or down based on demand', icon: GitBranch },
                { title: 'Built-in monitoring', description: 'Real-time metrics and logs', icon: Shield },
              ].map((feature, index) => (
                <div 
                  key={feature.title}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl bg-card/60 backdrop-blur-sm border border-border/40",
                    "animate-fade-in-up hover:bg-card/80 transition-colors duration-300"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{feature.title}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-background flex items-center justify-center text-[10px] font-medium">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span>Trusted by developers worldwide</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5" />
        
        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-gradient-to-br from-primary via-primary to-primary/90 rounded-xl flex items-center justify-center shadow-glow mb-4 p-2">
              <img src="/containr.svg" alt="Containr" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold">Containr</h1>
            <p className="text-sm text-muted-foreground">Self-hosted container platform</p>
          </div>

          <Card className="border-0 shadow-elevated glass-heavy">
            <CardHeader className="space-y-1 pb-4 text-center">
              <CardTitle className="text-xl font-semibold">
                {isRegister ? 'Create an account' : 'Welcome back'}
              </CardTitle>
              <CardDescription>
                {isRegister 
                  ? 'Enter your details to create your account'
                  : 'Sign in to your account to continue'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full gap-2 h-11 font-medium hover:bg-muted/50 transition-colors"
                onClick={handleGitHubAuth}
              >
                <Github className="w-5 h-5" />
                Continue with GitHub
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {isRegister && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="first-name" className="text-xs font-medium">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="first-name"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          required={isRegister}
                          className="pl-10 h-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name" className="text-xs font-medium">Last Name</Label>
                      <Input
                        id="last-name"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required={isRegister}
                        className="h-10"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full gap-2 h-11 btn-shine bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 font-medium"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRegister ? 'Create Account' : 'Sign In'}
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
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-2.5 rounded-xl hover:bg-muted/50 group"
              >
                <Sparkles className="w-4 h-4 group-hover:text-primary transition-colors" />
                <span>Try Demo Mode</span>
              </button>
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-foreground">Terms</a> and{' '}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
