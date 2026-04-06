'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Bell, MapPin, ChevronRight, Heart, Star,
  Activity, Flower2, Dumbbell, ArrowRight, User, Calendar, Home as HomeIcon
} from 'lucide-react';

const categories = [
  { id: 'health', name: 'Health', nameAr: 'صحة', icon: Activity, color: '#DC2626' },
  { id: 'wellness', name: 'Wellness', nameAr: 'عافية', icon: Flower2, color: '#C5A059' },
  { id: 'fitness', name: 'Fitness', nameAr: 'لياقة', icon: Dumbbell, color: '#16A34A' },
];

const featuredServices = [
  {
    id: '1',
    name: 'Deep Tissue Massage',
    category: 'Wellness',
    price: 300,
    duration: 60,
    rating: 4.9,
    reviews: 128,
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop',
  },
  {
    id: '2',
    name: 'Physiotherapy',
    category: 'Health',
    price: 250,
    duration: 60,
    rating: 4.8,
    reviews: 95,
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop',
  },
  {
    id: '3',
    name: 'Yoga at Home',
    category: 'Fitness',
    price: 200,
    duration: 60,
    rating: 4.9,
    reviews: 204,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop',
  },
];

const topProviders = [
  { id: '1', name: 'Sarah Al-Rashid', specialty: 'Massage Therapist', rating: 4.9, image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face', verified: true },
  { id: '2', name: 'Dr. Ahmed Hassan', specialty: 'Physiotherapist', rating: 4.8, image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&crop=face', verified: true },
  { id: '3', name: 'Maya Patel', specialty: 'Yoga Instructor', rating: 4.9, image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face', verified: true },
];

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');

  return (
    <main className="min-h-screen bg-neutral pb-24">
      {/* Header */}
      <header className="bg-primary px-6 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-secondary/70 text-xs tracking-widest uppercase">Welcome back</p>
            <h1 className="text-white text-xl font-semibold mt-1">Good Morning</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
              <Bell size={18} className="text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full" />
            </button>
            <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <User size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 mb-5">
          <MapPin size={14} className="text-secondary" />
          <span className="text-white/60 text-xs">Dubai, UAE</span>
          <ChevronRight size={12} className="text-white/40" />
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            className="w-full bg-white/10 text-white placeholder-white/40 pl-11 pr-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 backdrop-blur-sm"
          />
        </div>
      </header>

      {/* Categories */}
      <section className="px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Categories</h2>
          <button className="text-xs text-secondary font-medium">View All</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => router.push(`/services?category=${cat.id}`)}
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: cat.color + '15' }}
              >
                <cat.icon size={22} style={{ color: cat.color }} />
              </div>
              <span className="text-xs font-medium text-primary">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Services */}
      <section className="mt-8">
        <div className="flex items-center justify-between px-6 mb-4">
          <h2 className="text-lg font-semibold text-primary">Popular Services</h2>
          <button onClick={() => router.push('/services')} className="text-xs text-secondary font-medium flex items-center gap-1">
            See All <ArrowRight size={12} />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide">
          {featuredServices.map((service) => (
            <button
              key={service.id}
              onClick={() => router.push(`/services/${service.id}`)}
              className="min-w-[260px] bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="relative h-36">
                <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center">
                  <Heart size={14} className="text-gray-400" />
                </button>
                <span className="absolute bottom-3 left-3 bg-primary/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
                  {service.category}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm text-primary">{service.name}</h3>
                <div className="flex items-center gap-1 mt-1.5">
                  <Star size={12} className="text-secondary fill-secondary" />
                  <span className="text-xs font-medium">{service.rating}</span>
                  <span className="text-xs text-gray-400">({service.reviews})</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-secondary font-semibold">
                    AED {service.price}
                    <span className="text-xs text-gray-400 font-normal ml-1">/ {service.duration} min</span>
                  </p>
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                    <ArrowRight size={14} className="text-secondary" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Top Providers */}
      <section className="px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">Top Providers</h2>
          <button className="text-xs text-secondary font-medium">View All</button>
        </div>
        <div className="space-y-3">
          {topProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm"
            >
              <img
                src={provider.image}
                alt={provider.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-secondary/20"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm">{provider.name}</h3>
                  {provider.verified && (
                    <svg width="14" height="14" viewBox="0 0 14 14" className="text-secondary">
                      <path d="M7 0L8.5 2.5L11.5 2L10.5 5L13 7L10.5 9L11.5 12L8.5 11.5L7 14L5.5 11.5L2.5 12L3.5 9L1 7L3.5 5L2.5 2L5.5 2.5L7 0Z" fill="currentColor" />
                      <path d="M5.5 7L6.5 8L8.5 6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{provider.specialty}</p>
              </div>
              <div className="flex items-center gap-1 bg-neutral px-2.5 py-1.5 rounded-lg">
                <Star size={12} className="text-secondary fill-secondary" />
                <span className="text-xs font-semibold">{provider.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-around z-50">
        {[
          { id: 'home', icon: HomeIcon, label: 'Home' },
          { id: 'services', icon: Search, label: 'Explore' },
          { id: 'bookings', icon: Calendar, label: 'Bookings' },
          { id: 'profile', icon: User, label: 'Profile' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'home') router.push(`/${tab.id === 'services' ? 'services' : tab.id === 'bookings' ? 'bookings' : 'profile'}`);
            }}
            className={`flex flex-col items-center gap-1 ${
              activeTab === tab.id ? 'text-secondary' : 'text-gray-400'
            }`}
          >
            <tab.icon size={20} />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
