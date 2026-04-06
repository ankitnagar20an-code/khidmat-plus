'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Star, Clock, ArrowRight, Filter, Activity, Flower2, Dumbbell } from 'lucide-react';

const allServices = [
  { id: '1', name: 'Deep Tissue Massage', category: 'wellness', price: 300, duration: 60, rating: 4.9, reviews: 128, image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop', description: 'Therapeutic massage targeting chronic tension' },
  { id: '2', name: 'Physiotherapy', category: 'health', price: 250, duration: 60, rating: 4.8, reviews: 95, image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop', description: 'Licensed physiotherapy at home' },
  { id: '3', name: 'Yoga at Home', category: 'fitness', price: 200, duration: 60, rating: 4.9, reviews: 204, image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop', description: 'Private yoga sessions with certified instructors' },
  { id: '4', name: 'Swedish Massage', category: 'wellness', price: 250, duration: 60, rating: 4.7, reviews: 87, image: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&h=300&fit=crop', description: 'Classic relaxation massage' },
  { id: '5', name: 'Personal Training', category: 'fitness', price: 350, duration: 60, rating: 4.8, reviews: 156, image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=300&fit=crop', description: 'Custom fitness training at home' },
  { id: '6', name: 'Online Consultation', category: 'health', price: 150, duration: 30, rating: 4.6, reviews: 63, image: 'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=300&fit=crop', description: 'Video consultation with health professionals' },
  { id: '7', name: 'Aromatherapy', category: 'wellness', price: 280, duration: 60, rating: 4.8, reviews: 74, image: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop', description: 'Therapeutic massage with essential oils' },
  { id: '8', name: 'Pilates', category: 'fitness', price: 220, duration: 60, rating: 4.7, reviews: 91, image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=300&fit=crop', description: 'Mat Pilates for core strength and flexibility' },
];

const categoryFilters = [
  { id: 'all', label: 'All', icon: null },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'wellness', label: 'Wellness', icon: Flower2 },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell },
];

export default function ServicesPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = allServices.filter((s) => {
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-neutral pb-8">
      {/* Header */}
      <div className="bg-white px-6 pt-6 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={20} className="text-primary" />
          </button>
          <h1 className="text-lg font-semibold text-primary flex-1">Services</h1>
          <button className="w-10 h-10 rounded-xl bg-neutral flex items-center justify-center">
            <Filter size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryFilters.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-neutral text-gray-500 hover:bg-gray-200'
              }`}
            >
              {cat.icon && <cat.icon size={14} />}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="px-6 mt-4">
        <p className="text-xs text-gray-400 mb-3">{filtered.length} services available</p>
        <div className="space-y-4">
          {filtered.map((service) => (
            <button
              key={service.id}
              onClick={() => router.push(`/services/${service.id}`)}
              className="w-full bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex text-left"
            >
              <img
                src={service.image}
                alt={service.name}
                className="w-28 h-full object-cover"
              />
              <div className="p-4 flex-1">
                <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">
                  {service.category}
                </span>
                <h3 className="font-semibold text-sm text-primary mt-1">{service.name}</h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{service.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-secondary fill-secondary" />
                    <span className="text-xs font-medium">{service.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    <Clock size={11} />
                    <span className="text-xs">{service.duration} min</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-secondary font-semibold text-sm">AED {service.price}</span>
                  <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center">
                    <ArrowRight size={12} className="text-secondary" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
