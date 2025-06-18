'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [hasRedirected, setHasRedirected] = useState(false);
  
  useEffect(() => {
    if (isLoaded && isSignedIn && user && !hasRedirected) {
      console.log('User authenticated, redirecting to dashboard');
      setHasRedirected(true);
      
      // Add a small delay to prevent rapid redirects
      setTimeout(() => {
        router.replace('/dashboard');
      }, 100);
    }
  }, [isLoaded, isSignedIn, user, router, hasRedirected]);

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // If signed in but no user data yet, show loading
  if (isSignedIn && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading user profile...</p>
        </div>
      </div>
    );
  }

  // If not signed in, Clerk will handle the redirect automatically
  // We just show a loading state
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
        <p className="text-muted-foreground">Redirecting to sign-in...</p>
      </div>
    </div>
  );
}