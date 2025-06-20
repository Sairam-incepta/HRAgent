'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, SignIn } from '@clerk/nextjs';
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

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

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

  // If not signed in, render the sign-in form directly
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0e7ff] to-[#f8fafc]">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center">
          <h1 className="text-3xl font-bold mb-2 text-[#005cb3] tracking-tight">Sign in to HRAgent</h1>
          <p className="mb-6 text-gray-500 text-center">Welcome back! Please sign in to your account.</p>
          <div className="w-full flex flex-col items-center">
            <SignIn
              routing="path"
              appearance={{
                elements: {
                  card: 'shadow-none border-none',
                  formButtonPrimary: 'bg-[#005cb3] hover:bg-[#004a96] text-white font-semibold',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                },
                variables: {
                  colorPrimary: '#005cb3',
                  colorText: '#222',
                  colorBackground: '#fff',
                  colorInputBackground: '#f3f4f6',
                  colorInputText: '#222',
                  colorAlphaShade: '#005cb3',
                }
              }}
            />
          </div>
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