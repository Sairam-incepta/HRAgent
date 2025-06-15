'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        router.push('/dashboard');
      } else {
        router.push('/sign-in');
      }
    }
  }, [isLoaded, isSignedIn, router]);

  // Clear any cached authentication state on page load
  useEffect(() => {
    // Force a clean state by clearing any cached data
    if (typeof window !== 'undefined') {
      // Clear any localStorage auth tokens that might persist
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('clerk') || key.includes('auth') || key.includes('session')
      );
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }, []);

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading LetsInsure HR...</p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}