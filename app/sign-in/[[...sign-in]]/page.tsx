import { SignIn } from '@clerk/nextjs';
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center mb-8">
          <Image
            src="/image.png"
            alt="LetsInsure Logo"
            width={200}
            height={60}
            className="h-12 w-auto"
          />
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center mb-6">
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
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Demo Accounts</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>Admin:</strong> admin@letsinsure.hr</p>
              <p><strong>Employee:</strong> employee@letsinsure.hr</p>
              <p className="text-xs mt-2 opacity-75">Use any password for demo accounts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}