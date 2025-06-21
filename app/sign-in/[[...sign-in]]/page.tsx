import { SignIn } from '@clerk/nextjs';
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 py-12">
      <div className="w-full max-w-md space-y-6 flex-shrink-0">
        {/* Logo Section */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/image.png"
              alt="LetsInsure Logo"
              width={200}
              height={60}
              className="h-12 w-auto"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Sign in to access your LetsInsure HR dashboard
          </p>
        </div>
        
        {/* Sign In Form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 p-6">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 'bg-[#005cb3] hover:bg-[#004a96] text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md',
                card: 'shadow-none border-0 bg-transparent p-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-3 px-4 rounded-lg transition-all duration-200',
                formFieldInput: 'border border-gray-300 dark:border-slate-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005cb3] focus:border-transparent transition-all duration-200',
                footerActionLink: 'text-[#005cb3] hover:text-[#004a96] font-medium transition-colors duration-200',
                dividerLine: 'bg-gray-200 dark:bg-slate-600',
                dividerText: 'text-gray-500 dark:text-gray-400 text-sm',
                formFieldLabel: 'text-gray-700 dark:text-gray-300 font-medium text-sm mb-2',
                identityPreviewText: 'text-gray-600 dark:text-gray-400',
                formResendCodeLink: 'text-[#005cb3] hover:text-[#004a96] font-medium transition-colors duration-200',
                otpCodeFieldInput: 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-3 text-center text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005cb3] focus:border-transparent transition-all duration-200',
                formFieldSuccessText: 'text-green-600 dark:text-green-400 text-sm',
                formFieldErrorText: 'text-red-600 dark:text-red-400 text-sm',
                alertText: 'text-gray-900 dark:text-white',
                formFieldHintText: 'text-gray-500 dark:text-gray-400 text-sm',
                formFieldAction: 'text-[#005cb3] hover:text-[#004a96] font-medium text-sm transition-colors duration-200'
              },
              layout: {
                socialButtonsPlacement: 'bottom',
                showOptionalFields: false
              }
            }}
            redirectUrl="/dashboard"
            signUpUrl={undefined}
          />
        </div>
        
        {/* Forgot Password Link */}
        <div className="text-center">
          <Link 
            href="/forgot-password" 
            className="text-[#005cb3] hover:text-[#004a96] font-medium text-sm transition-colors duration-200"
          >
            Forgot your password?
          </Link>
        </div>
        
        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Authorized employees only • Secure access required
          </p>
        </div>
      </div>
      
      {/* Extra spacing to prevent bottom cutoff */}
      <div className="h-16 flex-shrink-0"></div>
    </div>
  );
}