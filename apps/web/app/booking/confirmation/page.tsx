'use client';

import { useRouter } from 'next/navigation';
import { Check, Calendar, Clock, MapPin, User, ArrowRight, Home } from 'lucide-react';

export default function BookingConfirmationPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral flex flex-col items-center px-6 py-12">
      {/* Success Animation */}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-bounce">
        <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
          <Check size={28} className="text-white" strokeWidth={3} />
        </div>
      </div>

      <h1 className="text-2xl font-semibold text-primary text-center">Booking Confirmed!</h1>
      <p className="text-sm text-gray-500 mt-2 text-center max-w-xs">
        Your service has been booked successfully. We&apos;re assigning the best provider for you.
      </p>

      {/* Booking Details Card */}
      <div className="w-full bg-white rounded-2xl p-6 shadow-sm mt-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-400">Booking Number</span>
          <span className="text-sm font-mono font-semibold text-secondary">KH-20260406-A1B2</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Calendar size={16} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Date</p>
              <p className="text-sm font-medium">Today, April 6, 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Clock size={16} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Time</p>
              <p className="text-sm font-medium">2:00 PM — 3:00 PM</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
              <MapPin size={16} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Location</p>
              <p className="text-sm font-medium">Apartment 1204, Marina Towers</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
              <User size={16} className="text-secondary" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Provider</p>
              <p className="text-sm font-medium">Assigning best available...</p>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm text-gray-500">Total Paid</span>
          <span className="text-lg font-semibold text-secondary">AED 270</span>
        </div>
      </div>

      {/* Status */}
      <div className="w-full bg-tertiary/30 rounded-xl p-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-xs text-secondary font-medium">Finding your provider...</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-1 ml-4">
          You&apos;ll receive a notification once a provider is confirmed.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full mt-8 space-y-3">
        <button
          onClick={() => router.push('/bookings')}
          className="w-full bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          View My Bookings
          <ArrowRight size={16} />
        </button>
        <button
          onClick={() => router.push('/home')}
          className="w-full bg-white text-primary py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200"
        >
          <Home size={16} />
          Back to Home
        </button>
      </div>
    </main>
  );
}
