import { SignUp } from '@clerk/nextjs';
import Image from "next/image";

export default function SignUpPage() {
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
            <h1 className="text-2xl font-bold">Join LetsInsure HR</h1>
            <p className="text-muted-foreground mt-2">
              Create your account to get started
            </p>
          </div>
          
          <SignUp 
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