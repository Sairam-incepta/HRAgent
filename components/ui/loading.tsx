import { Loader2 } from 'lucide-react';

interface LoadingProps {
  text?: string;
}

export function Loading({ text = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
        {text && <p className="text-muted-foreground">{text}</p>}
      </div>
    </div>
  );
}