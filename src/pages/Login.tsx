import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

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
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleGitHubAuth = () => {
    // TODO: Implement GitHub OAuth
    console.log('GitHub OAuth not implemented yet');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col gap-5 rounded-3xl bg-bg-white-0 p-6 shadow-regular-xs">
          <div className="flex flex-col items-center gap-5">
            <div className="w-14 h-14 flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-title-h6 text-text-strong-950">
                {isRegister ? 'Create an account' : 'Welcome back'}
              </div>
              <div className="text-paragraph-sm text-text-sub-600">
                {isRegister 
                  ? 'Please enter your details to create an account.'
                  : 'Please enter your details to sign in.'
                }
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGitHubAuth}
            className="relative inline-flex h-10 items-center justify-center gap-3.5 whitespace-nowrap rounded-10 px-4 text-label-sm outline-none transition duration-200 ease-out focus:outline-none bg-bg-white-0 text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 hover:shadow-none hover:ring-transparent focus-visible:shadow-button-important-focus focus-visible:ring-stroke-strong-950 w-full"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10 -mx-1.5 size-5 shrink-0">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M16 4C9.375 4 4 9.375 4 16C4 21.3125 7.4375 25.75 12.1875 27.25C12.75 27.3438 12.9375 27.0938 12.9375 26.8125C12.9375 26.5625 12.9375 25.75 12.9375 24.875C9.625 25.5625 8.75 23.3125 8.75 23.3125C8.1875 21.875 7.25 21.5 7.25 21.5C6.0625 20.6875 7.34375 20.6875 7.34375 20.6875C8.4375 20.75 9.0625 21.8125 9.0625 21.8125C10.0625 23.5 11.6875 23 12.3125 22.6875C12.4375 21.9375 12.75 21.4375 13.0625 21.1875C10.5625 20.9375 7.8125 19.9375 7.8125 15.625C7.8125 14.375 8.25 13.3125 9.0625 12.5C8.9375 12.1875 8.5 10.9375 9.1875 9.1875C9.1875 9.1875 10.1875 8.875 12.9375 10.6875C13.875 10.4375 14.9375 10.3125 16 10.3125C17.0625 10.3125 18.125 10.4375 19.0625 10.6875C21.8125 8.875 22.8125 9.1875 22.8125 9.1875C23.5 10.9375 23.0625 12.1875 22.9375 12.5C23.75 13.3125 24.1875 14.375 24.1875 15.625C24.1875 19.9375 21.4375 20.9375 18.9375 21.1875C19.25 21.4375 19.5625 21.9375 19.5625 22.6875C19.5625 23.75 19.5625 24.5625 19.5625 24.8125C19.5625 25.0938 19.75 25.3438 20.3125 25.25C25.0625 23.75 28.5 19.3125 28.5 14C28.5 9.375 23.125 4 16 4Z" fill="#24292e"></path>
            </svg>
            Continue with GitHub
          </button>
          
          <div role="separator" className="relative flex w-full items-center gap-2.5 text-subheading-2xs text-text-soft-400 before:h-px before:w-full before:flex-1 before:bg-stroke-soft-200 after:h-px after:w-full after:flex-1 after:bg-stroke-soft-200">
            OR
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {isRegister && (
              <div className="flex gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="first-name" className="group cursor-pointer text-label-sm text-text-strong-950 flex items-center gap-px aria-disabled:text-text-disabled-300">
                    First Name
                  </Label>
                  <Input
                    id="first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="James"
                    required={isRegister}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="last-name" className="group cursor-pointer text-label-sm text-text-strong-950 flex items-center gap-px aria-disabled:text-text-disabled-300">
                    Last Name
                  </Label>
                  <Input
                    id="last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Brown"
                    required={isRegister}
                    className="h-10"
                  />
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <Label htmlFor="email" className="group cursor-pointer text-label-sm text-text-strong-950 flex items-center gap-px aria-disabled:text-text-disabled-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@alignui.com"
                required
                className="h-10"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="group cursor-pointer text-label-sm text-text-strong-950 flex items-center gap-px aria-disabled:text-text-disabled-300">
                  Password
                </Label>
                <button type="button" className="text-label-xs text-text-sub-600">
                  Clear
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="• • • • • • • • • • "
                required
                className="h-10"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-10 gap-3 rounded-10 px-3.5 bg-primary-base text-static-white"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRegister ? 'Continue' : 'Sign In'}
            </Button>
          </form>
          
          <div className="flex items-baseline justify-center gap-1 text-paragraph-sm text-text-sub-600">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="group inline-flex items-center justify-center whitespace-nowrap outline-none transition duration-200 ease-out underline decoration-transparent underline-offset-[3px] hover:decoration-current focus:outline-none focus-visible:underline disabled:pointer-events-none disabled:text-text-disabled-300 disabled:no-underline text-text-strong-950 h-5 gap-1 text-label-sm"
            >
              {isRegister ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setError('');
                localStorage.setItem('demoMode', 'true');
                window.location.href = '/';
              }}
              className="text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              Try Demo Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
