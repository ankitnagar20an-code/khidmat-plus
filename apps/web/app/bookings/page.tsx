'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, MapPin, ChevronRight, Home, Search, User } from 'lucide-react';

const bookings = [
  {
    id: '1',
    number: 'KH-20260406-A1B2',
    service: 'Deep Tissue Massage',
    provider: 'Sarah Al-Rashid',
    providerImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face',
    date: 'Today, Apr 6',
    time: '2:00 PM',
    status: 'confirmed',
    statusLabel: 'Provider Assigned',
    statusColor: 'bg-blue-100 text-blue-700',
    price: 270,
  },
  {
    id: '2',
    number: 'KH-20260404-C3D4',
    service: 'Yoga at Home',
    provider: 'Maya Patel',
    providerImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    date: 'Apr 4, 2026',
    time: '10:00 AM',
    status: 'completed',
    statusLabel: 'Completed',
    statusColor: 'bg-green-100 text-green-700',
    price: 200,
  },
  {
    id: '3',
    number: 'KH-20260401-E5F6',
    service: 'Physiotherapy',
    provider: 'Dr. Ahmed Hassan',
    providerImage: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face',
    date: 'Apr 1, 2026',
    time: '3:00 PM',
    status: 'completed',
    statusLabel: 'Completed',
    statusColor: 'bg-green-100 text-green-700',
    price: 250,
  },
];

export default function BookingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const filtered = bookings.filter((b) =>
    tab === 'upcoming' ? b.status !== 'completed' : b.status === 'completed'
  );

  return (
    <main className="min-h-screen bg-neutral pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-6 pb-4 shadow-sm">
        <h1 className="text-lg font-semibold text-primary mb-4">My Bookings</h1>
        <div className="flex gap-2">
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                tab === t ? 'bg-primary text-white' : 'bg-neutral text-gray-500'
              }`}
            >
              {t === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-6 mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Calendar size={48} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No {tab} bookings</p>
            <button
              onClick={() => router.push('/services')}
              className="mt-4 text-sm text-secondary font-medium"
            >
              Browse Services
            </button>
          </div>
        ) : (
          filtered.map((booking) => (
            <button
              key={booking.id}
              className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-gray-400">{booking.number}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${booking.statusColor}`}>
                  {booking.statusLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <img
                  src={booking.providerImage}
                  alt={booking.provider}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-primary">{booking.service}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{booking.provider}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Calendar size={12} />
                  <span className="text-xs">{booking.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Clock size={12} />
                  <span className="text-xs">{booking.time}</span>
                </div>
                <div className="ml-auto">
                  <span className="text-sm font-semibold text-secondary">AED {booking.price}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-around z-50">
        {[
          { id: 'home', icon: Home, label: 'Home', path: '/home' },
          { id: 'services', icon: Search, label: 'Explore', path: '/services' },
          { id: 'bookings', icon: Calendar, label: 'Bookings', path: '/bookings' },
          { id: 'profile', icon: User, label: 'Profile', path: '/profile' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className={`flex flex-col items-center gap-1 ${
              tab.id === 'bookings' ? 'text-secondary' : 'text-gray-400'
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
