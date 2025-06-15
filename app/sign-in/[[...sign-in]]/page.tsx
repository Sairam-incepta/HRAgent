import { SignIn } from '@clerk/nextjs';
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <Image
            src="/image.png"
            alt="LetsInsure Logo"
            width={240}
            height={100}
            className="h-12 w-auto"
          />
        </div>
        
        {/* Sign in card with welcome text inside */}
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center mb-3">
            <h1 className="text-2xl font-bold">Welcome to LetsInsure HR</h1>
            <p className="text-muted-foreground mt-2">
              Sign in to access your dashboard
            </p>
          </div>
          
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 'bg-[#005cb3] hover:bg-[#005cb3]/90',
                card: 'shadow-none border-0 bg-transparent',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'border-input hover:bg-accent',
                formFieldInput: 'border-input',
                footerActionLink: 'text-[#005cb3] hover:text-[#005cb3]/90'
              }
            }}
            redirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  );
}