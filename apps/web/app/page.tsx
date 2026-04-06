'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashPage() {
  const router = useRouter();
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimating(false);
    }, 2000);

    const redirect = setTimeout(() => {
      router.push('/onboarding');
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(redirect);
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-primary flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient accent */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-secondary blur-[120px]" />
      </div>

      {/* Logo */}
      <div className={`relative z-10 flex flex-col items-center transition-all duration-1000 ${animating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
        {/* Diamond icon */}
        <div className="mb-8">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 4L52 20L32 60L12 20L32 4Z" stroke="#C5A059" strokeWidth="2" fill="none" />
            <path d="M12 20H52" stroke="#C5A059" strokeWidth="2" />
            <path d="M32 4L22 20L32 60L42 20L32 4Z" stroke="#C5A059" strokeWidth="1.5" fill="none" opacity="0.5" />
          </svg>
        </div>

        <h1 className="text-white text-4xl tracking-[0.3em] font-light" style={{ fontFamily: 'var(--font-serif)' }}>
          Khidmat<span className="text-secondary">+</span>
        </h1>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px w-8 bg-secondary/40" />
          <p className="text-secondary/70 text-[10px] tracking-[0.4em] uppercase font-light">
            Elevated Service Standards
          </p>
          <div className="h-px w-8 bg-secondary/40" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="absolute bottom-20 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-secondary/50 animate-pulse"
            style={{ animationDelay: `${i * 300}ms` }}
          />
        ))}
      </div>
    </main>
  );
}
