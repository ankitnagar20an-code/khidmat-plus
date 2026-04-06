'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Star, Clock, MapPin, Shield, Heart, Share2,
  ChevronRight, Check, Calendar
} from 'lucide-react';

const service = {
  id: '1',
  name: 'Deep Tissue Massage',
  category: 'Wellness',
  description: 'Professional deep tissue massage targeting chronic muscle tension and pain. Our certified therapists bring premium equipment to your location for a truly relaxing experience.',
  image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&h=500&fit=crop',
  rating: 4.9,
  reviews: 128,
  includes: ['Premium massage oils', 'Professional massage table', 'Hot towels', 'Post-session care tips'],
  variants: [
    { id: 'v1', name: '60 Minutes', duration: 60, price: 300 },
    { id: 'v2', name: '90 Minutes', duration: 90, price: 420 },
    { id: 'v3', name: 'Couple Session', duration: 60, price: 550 },
  ],
};

const providers = [
  { id: 'p1', name: 'Sarah Al-Rashid', rating: 4.9, reviews: 87, experience: '8 years', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', verified: true, nextAvailable: 'Today, 2:00 PM' },
  { id: 'p2', name: 'Layla Hassan', rating: 4.8, reviews: 62, experience: '5 years', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', verified: true, nextAvailable: 'Today, 4:00 PM' },
  { id: 'p3', name: 'Nadia Patel', rating: 4.7, reviews: 45, experience: '3 years', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face', verified: true, nextAvailable: 'Tomorrow, 10:00 AM' },
];

const reviews = [
  { id: 'r1', author: 'Fatima K.', rating: 5, date: '2 days ago', comment: 'Amazing experience! Sarah was very professional and the massage was exactly what I needed.' },
  { id: 'r2', author: 'Maria L.', rating: 5, date: '1 week ago', comment: 'Best deep tissue massage I\'ve had. Will definitely book again.' },
  { id: 'r3', author: 'Ahmed R.', rating: 4, date: '2 weeks ago', comment: 'Great service, very convenient having it at home. Slightly late arrival but otherwise perfect.' },
];

export default function ServiceDetailPage() {
  const router = useRouter();
  const [selectedVariant, setSelectedVariant] = useState(service.variants[0]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-neutral pb-28">
      {/* Hero Image */}
      <div className="relative h-64">
        <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft size={18} />
          </button>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
              <Heart size={18} className="text-gray-600" />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
              <Share2 size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="absolute bottom-4 left-4">
          <span className="bg-secondary text-white text-[10px] px-2.5 py-1 rounded-md font-medium uppercase tracking-wider">
            {service.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-primary">{service.name}</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <Star size={14} className="text-secondary fill-secondary" />
              <span className="text-sm font-semibold">{service.rating}</span>
              <span className="text-xs text-gray-400">({service.reviews} reviews)</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Shield size={14} className="text-green-500" />
              <span className="text-xs">Verified Professionals</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{service.description}</p>

          {/* What's included */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What&apos;s Included</h3>
            <div className="grid grid-cols-2 gap-2">
              {service.includes.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check size={12} className="text-secondary" />
                  <span className="text-xs text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Variant Selection */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-primary mb-3">Choose Duration</h3>
          <div className="space-y-2">
            {service.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                  selectedVariant.id === variant.id
                    ? 'border-secondary bg-secondary/5'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedVariant.id === variant.id ? 'border-secondary' : 'border-gray-300'
                  }`}>
                    {selectedVariant.id === variant.id && (
                      <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-primary">{variant.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{variant.duration} min</span>
                    </div>
                  </div>
                </div>
                <span className="text-secondary font-semibold">AED {variant.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider Selection */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">Choose Provider</h3>
            <button className="text-xs text-secondary font-medium">Best Available</button>
          </div>
          <div className="space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(selectedProvider === provider.id ? null : provider.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
                  selectedProvider === provider.id
                    ? 'border-secondary bg-secondary/5'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <img
                  src={provider.image}
                  alt={provider.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-primary truncate">{provider.name}</p>
                    {provider.verified && (
                      <svg width="14" height="14" viewBox="0 0 14 14" className="text-secondary shrink-0">
                        <path d="M7 0L8.5 2.5L11.5 2L10.5 5L13 7L10.5 9L11.5 12L8.5 11.5L7 14L5.5 11.5L2.5 12L3.5 9L1 7L3.5 5L2.5 2L5.5 2.5L7 0Z" fill="currentColor" />
                        <path d="M5.5 7L6.5 8L8.5 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="text-secondary fill-secondary" />
                      <span className="text-[11px] font-medium">{provider.rating}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{provider.experience}</span>
                  </div>
                  <p className="text-[11px] text-green-600 mt-1">Next: {provider.nextAvailable}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">Reviews</h3>
            <button className="text-xs text-secondary font-medium">See All</button>
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center">
                      <span className="text-xs font-semibold text-secondary">{review.author[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{review.author}</p>
                      <p className="text-[10px] text-gray-400">{review.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={10}
                        className={i < review.rating ? 'text-secondary fill-secondary' : 'text-gray-200'}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xl font-semibold text-primary">AED {selectedVariant.price}</p>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={14} />
            <span className="text-sm">{selectedVariant.duration} min</span>
          </div>
        </div>
        <button
          onClick={() => router.push('/booking')}
          className="w-full bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl font-medium tracking-wide transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          <Calendar size={18} />
          Book Now
        </button>
      </div>
    </main>
  );
}
