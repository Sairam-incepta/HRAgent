'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
      <div className="w-full max-w-md mr-6">
        {/* Sign In Form */}
        <SignIn
          appearance={{
            elements: {

              // Main card styling
              card: 'bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600 p-8 w-full',
              rootBox: 'w-full',

              // Hide default headers since we have custom ones
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',

              // Logo styling - Show logo inside component
              logoBox: 'flex justify-center mb-6',
              logoImage: 'h-10 w-auto',

              // Primary button styling
              formButtonPrimary: 'bg-gradient-to-r from-[#005cb3] to-[#0066cc] hover:from-[#004a96] hover:to-[#0052a3] text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 w-full',

              // Social buttons
              socialButtonsBlockButton: 'border-2 border-gray-200 dark:border-slate-600 hover:border-[#005cb3] dark:hover:border-[#005cb3] hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl transition-all duration-300 w-full mb-3 bg-white dark:bg-slate-700',
              socialButtonsBlockButtonText: 'text-sm font-medium',

              // Form fields
              formFieldInput: 'border-2 border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005cb3] focus:border-[#005cb3] transition-all duration-300 w-full text-sm',
              formFieldLabel: 'text-gray-700 dark:text-gray-300 font-semibold text-sm mb-2 block',

              // Links and actions
              footerActionLink: 'text-[#005cb3] hover:text-[#004a96] font-semibold transition-colors duration-200 text-sm',
              formFieldHintText: 'text-gray-500 dark:text-gray-400 text-xs mt-1',
              formFieldAction: 'text-[#005cb3] hover:text-[#004a96] font-medium text-sm transition-colors duration-200',
              formResendCodeLink: 'text-[#005cb3] hover:text-[#004a96] font-medium transition-colors duration-200 text-sm',

              // Dividers
              dividerLine: 'bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-600 to-transparent',
              dividerText: 'text-gray-500 dark:text-gray-400 text-sm px-4 bg-white dark:bg-slate-800',

              // OTP and verification
              identityPreviewText: 'text-gray-600 dark:text-gray-400 text-sm',
              otpCodeFieldInput: 'border-2 border-gray-200 dark:border-slate-600 rounded-xl px-3 py-3 text-center text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#005cb3] focus:border-[#005cb3] transition-all duration-300 font-mono text-lg',

              // Messages and alerts
              formFieldSuccessText: 'text-green-600 dark:text-green-400 text-sm mt-1 font-medium',
              formFieldErrorText: 'text-red-600 dark:text-red-400 text-sm mt-1 font-medium',
              alertText: 'text-gray-900 dark:text-white text-sm',

              // Form layout
              form: 'space-y-5',
              formFieldRow: 'space-y-2',

              // Footer
              footer: 'mt-8 text-center',
              footerText: 'text-gray-500 dark:text-gray-400 text-sm',

              // Alternative methods
              alternativeMethodsBlockButton: 'text-[#005cb3] hover:text-[#004a96] font-medium text-sm transition-colors duration-200 underline decoration-2 underline-offset-2',

              // Loading state
              spinner: 'text-[#005cb3]',

              // Clerk branding
              footerPageLink: 'text-[#005cb3] hover:text-[#004a96] text-xs',

              // Layout overrides
              internal: 'w-full',
              main: 'w-full'
            },
            layout: {
              socialButtonsPlacement: 'bottom',
              showOptionalFields: false,
              helpPageUrl: undefined,
              privacyPageUrl: undefined,
              termsPageUrl: undefined
            },
            variables: {
              colorPrimary: '#005cb3',
              colorText: '#1f2937',
              colorTextSecondary: '#6b7280',
              colorBackground: 'transparent',
              colorInputBackground: '#ffffff',
              colorInputText: '#111827',
              borderRadius: '0.75rem',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '14px',
              fontWeight: {
                normal: 400,
                medium: 500,
                semibold: 600,
                bold: 700
              }
            }
          }}
          redirectUrl="/dashboard"
          signUpUrl={undefined}
          routing="path"
          path="/sign-in"
        />

        {/* Security Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400 mr-10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-sm font-medium">
              Authorized employees only • Secure access required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}