import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 blur-3xl opacity-20 animate-pulse"></div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "relative",
              card: "glass-effect shadow-2xl",
              headerTitle: "text-2xl font-bold text-white",
              headerSubtitle: "text-slate-400",
              formFieldLabel: "text-slate-300 text-sm font-medium",
              formFieldInput: "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
              formButtonPrimary: "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold",
              footerActionLink: "text-indigo-400 hover:text-indigo-300",
              identityPreviewText: "text-slate-300",
              identityPreviewEditButton: "text-indigo-400 hover:text-indigo-300",
              formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-300",
              otpCodeFieldInput: "bg-slate-800/50 border-slate-700 text-white",
              formResendCodeLink: "text-indigo-400 hover:text-indigo-300"
            },
            layout: {
              socialButtonsPlacement: "bottom",
              showOptionalFields: false,
            }
          }}
        />
      </div>
    </div>
  );
}