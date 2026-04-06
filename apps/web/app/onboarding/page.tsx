'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Home, ShieldCheck, Star } from 'lucide-react';

const slides = [
  {
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=1000&fit=crop',
    title: 'Convenience',
    titleAccent: 'at Home',
    description: 'Access premium wellness and health services delivered right to your doorstep, tailored to your schedule.',
    icon: Home,
  },
  {
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=1000&fit=crop',
    title: 'Verified',
    titleAccent: 'Professionals',
    description: 'Every professional undergoes a rigorous background check and verification process to ensure your peace of mind.',
    icon: ShieldCheck,
  },
  {
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=1000&fit=crop',
    title: 'Premium',
    titleAccent: 'Experience',
    description: 'From booking to completion, enjoy a seamless experience with real-time updates and quality guarantees.',
    icon: Star,
  },
];

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0);
  const router = useRouter();
  const slide = slides[current];

  return (
    <main className="min-h-screen bg-neutral flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        {current > 0 ? (
          <button onClick={() => setCurrent(current - 1)} className="p-2 -ml-2">
            <ArrowLeft size={20} className="text-primary" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <span className="text-xs text-gray-400 tracking-wider uppercase">
          Step {String(current + 1).padStart(2, '0')}/{String(slides.length).padStart(2, '0')}
        </span>
        <button
          onClick={() => router.push('/home')}
          className="text-xs text-gray-400 tracking-wider uppercase hover:text-secondary transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Image */}
      <div className="px-6 flex-1 flex flex-col">
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="mt-8 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <slide.icon size={18} className="text-secondary" />
            <div className="h-px flex-1 bg-secondary/20" />
          </div>

          <h2 className="text-3xl font-light text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            {slide.title}
          </h2>
          <h2 className="text-3xl italic text-secondary" style={{ fontFamily: 'var(--font-serif)' }}>
            {slide.titleAccent}
          </h2>

          <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-sm">
            {slide.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-secondary' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => {
            if (current < slides.length - 1) {
              setCurrent(current + 1);
            } else {
              router.push('/home');
            }
          }}
          className="w-full bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl flex items-center justify-center gap-2 font-medium tracking-wide transition-colors mb-8 shadow-md"
        >
          {current < slides.length - 1 ? 'Continue' : 'Get Started'}
          <ArrowRight size={18} />
        </button>
      </div>
    </main>
  );
}
