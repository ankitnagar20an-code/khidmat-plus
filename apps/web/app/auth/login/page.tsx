'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-neutral flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft size={20} className="text-primary" />
        </button>
      </div>

      <div className="px-6 mt-8 flex-1">
        {/* Logo */}
        <h1 className="text-2xl font-light text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
          Welcome to
        </h1>
        <h1 className="text-3xl font-semibold text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
          Khidmat<span className="text-secondary">+</span>
        </h1>
        <p className="text-sm text-gray-400 mt-2">Sign in to book premium services</p>

        {/* Mode Toggle */}
        <div className="flex gap-2 mt-8 mb-6">
          {[
            { id: 'phone' as const, label: 'Phone', icon: Phone },
            { id: 'email' as const, label: 'Email', icon: Mail },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-colors ${
                mode === m.id ? 'bg-primary text-white' : 'bg-white text-gray-500'
              }`}
            >
              <m.icon size={14} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Phone Input */}
        {mode === 'phone' && (
          <div>
            <label className="text-xs text-gray-500 font-medium">Phone Number</label>
            <div className="flex gap-2 mt-2">
              <div className="bg-white px-4 py-3.5 rounded-xl text-sm font-medium text-primary flex items-center gap-1 min-w-[80px]">
                🇦🇪 +971
              </div>
              <input
                type="tel"
                placeholder="50 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-white px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">We&apos;ll send you a verification code via SMS</p>
          </div>
        )}

        {/* Email Input */}
        {mode === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 font-medium">Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-2 bg-white px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="w-full bg-white px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 pr-12"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-400" />}
                </button>
              </div>
            </div>
            <button className="text-xs text-secondary font-medium">Forgot Password?</button>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push('/home')}
          className="w-full mt-8 bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          {mode === 'phone' ? 'Send Code' : 'Sign In'}
          <ArrowRight size={16} />
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-8">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] text-gray-400">or continue with</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Social */}
        <div className="flex gap-3 mt-4">
          <button className="flex-1 bg-white py-3.5 rounded-xl text-sm font-medium text-primary flex items-center justify-center gap-2 border border-gray-100">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.92a8.78 8.78 0 002.68-6.62z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 009 18z" fill="#34A853"/><path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>
            Google
          </button>
          <button className="flex-1 bg-white py-3.5 rounded-xl text-sm font-medium text-primary flex items-center justify-center gap-2 border border-gray-100">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M14.94 4.88a4.08 4.08 0 00-.96-1.34 4.08 4.08 0 00-1.34-.96A4.06 4.06 0 0011 2.17c-.7 0-1.37.14-2 .41a4.08 4.08 0 00-1.34.96c-.38.38-.72.83-.96 1.34A4.06 4.06 0 006.29 6.5c0 .45.08.89.24 1.3.22.57.55 1.06.97 1.48L9 10.82l1.5-1.54c.42-.42.75-.91.97-1.48.16-.41.24-.85.24-1.3a4.06 4.06 0 00-.41-1.62z" fill="#000"/></svg>
            Apple
          </button>
        </div>

        {/* Terms */}
        <p className="text-[10px] text-gray-400 text-center mt-8 leading-relaxed">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </main>
  );
}
