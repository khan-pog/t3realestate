'use client';

import { useRouter } from "next/navigation";

interface DialogProps {
  children: React.ReactNode;
}

export function Dialog({ children }: DialogProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => router.back()}
      />
      <div className="relative z-50 max-h-[90vh] w-[90vw] max-w-7xl overflow-auto rounded-lg bg-white">
        {children}
      </div>
    </div>
  );
} 