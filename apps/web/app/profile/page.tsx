'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, User, MapPin, CreditCard, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, Star, Home, Search, Calendar, Settings
} from 'lucide-react';

const menuItems = [
  { icon: MapPin, label: 'My Addresses', description: 'Manage your saved addresses' },
  { icon: CreditCard, label: 'Payment Methods', description: 'Manage cards and wallets' },
  { icon: Bell, label: 'Notifications', description: 'Notification preferences' },
  { icon: Star, label: 'My Reviews', description: 'Reviews you have written' },
  { icon: Shield, label: 'Privacy & Security', description: 'Password, data, and more' },
  { icon: Settings, label: 'Settings', description: 'Language, theme, and more' },
  { icon: HelpCircle, label: 'Help & Support', description: 'FAQs and contact us' },
];

export default function ProfilePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-neutral pb-24">
      {/* Profile Header */}
      <div className="bg-primary px-6 pt-8 pb-10 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">Profile</h1>
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <Settings size={16} className="text-white" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center ring-2 ring-secondary/30 ring-offset-2 ring-offset-primary">
            <User size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-white text-lg font-semibold">Guest User</h2>
            <p className="text-white/50 text-xs mt-0.5">Sign in to access all features</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/auth/login')}
          className="w-full mt-5 bg-secondary hover:bg-secondary-dark text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Sign In / Create Account
        </button>
      </div>

      {/* Stats */}
      <div className="px-6 -mt-5">
        <div className="bg-white rounded-2xl p-4 shadow-sm grid grid-cols-3 gap-4">
          {[
            { label: 'Bookings', value: '3' },
            { label: 'Reviews', value: '2' },
            { label: 'Saved', value: '5' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-semibold text-primary">{stat.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-6 mt-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-neutral/50 transition-colors ${
                i < menuItems.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                <item.icon size={16} className="text-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">{item.label}</p>
                <p className="text-[11px] text-gray-400">{item.description}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button className="w-full flex items-center justify-center gap-2 mt-6 py-3 text-error text-sm font-medium">
          <LogOut size={16} />
          Sign Out
        </button>

        {/* Version */}
        <p className="text-center text-[10px] text-gray-300 mt-4">Khidmat+ v0.1.0</p>
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
              tab.id === 'profile' ? 'text-secondary' : 'text-gray-400'
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
