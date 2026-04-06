'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Calendar, Clock, MapPin, CreditCard, ChevronRight,
  Check, Shield, Tag
} from 'lucide-react';

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
];

const dates = Array.from({ length: 7 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return {
    date: d,
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    full: d.toISOString().slice(0, 10),
  };
});

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(dates[0].full);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);

  const basePrice = 300;
  const discount = couponApplied ? 45 : 0;
  const tax = Math.round((basePrice - discount) * 0.05);
  const total = basePrice - discount + tax;

  return (
    <main className="min-h-screen bg-neutral pb-28">
      {/* Header */}
      <div className="bg-white px-6 pt-6 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="p-1">
            <ArrowLeft size={20} className="text-primary" />
          </button>
          <h1 className="text-lg font-semibold text-primary flex-1">Book Service</h1>
          <span className="text-xs text-gray-400">Step {step}/3</span>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-secondary' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      {/* Step 1: Date & Time */}
      {step === 1 && (
        <div className="px-6 mt-6">
          <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-secondary" />
            Select Date
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dates.map((d) => (
              <button
                key={d.full}
                onClick={() => setSelectedDate(d.full)}
                className={`flex flex-col items-center min-w-[56px] py-3 px-2 rounded-xl transition-colors ${
                  selectedDate === d.full
                    ? 'bg-primary text-white'
                    : 'bg-white text-primary hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] uppercase ${selectedDate === d.full ? 'text-secondary' : 'text-gray-400'}`}>{d.day}</span>
                <span className="text-lg font-semibold mt-0.5">{d.num}</span>
                <span className={`text-[10px] ${selectedDate === d.full ? 'text-white/60' : 'text-gray-400'}`}>{d.month}</span>
              </button>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-primary mt-6 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-secondary" />
            Select Time
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                className={`py-3 rounded-xl text-xs font-medium transition-colors ${
                  selectedTime === slot
                    ? 'bg-secondary text-white'
                    : 'bg-white text-primary hover:bg-gray-50'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <button
            onClick={() => selectedTime && setStep(2)}
            disabled={!selectedTime}
            className={`w-full mt-8 py-4 rounded-xl font-medium transition-colors ${
              selectedTime
                ? 'bg-secondary text-white hover:bg-secondary-dark'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Address */}
      {step === 2 && (
        <div className="px-6 mt-6">
          <h2 className="text-sm font-semibold text-primary mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-secondary" />
            Service Address
          </h2>

          <div className="space-y-3">
            {[
              { label: 'Home', address: 'Apartment 1204, Marina Towers, Dubai Marina', isDefault: true },
              { label: 'Office', address: 'Level 15, Tower B, Business Bay', isDefault: false },
            ].map((addr) => (
              <button
                key={addr.label}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                  addr.isDefault ? 'border-secondary bg-secondary/5' : 'border-gray-100 bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <MapPin size={18} className="text-secondary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{addr.label}</p>
                    {addr.isDefault && (
                      <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{addr.address}</p>
                </div>
                {addr.isDefault && <Check size={18} className="text-secondary" />}
              </button>
            ))}

            <button className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:text-secondary hover:border-secondary transition-colors">
              <MapPin size={16} />
              <span className="text-sm">Add New Address</span>
            </button>
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full mt-8 bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 3: Review & Pay */}
      {step === 3 && (
        <div className="px-6 mt-6">
          {/* Booking Summary */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-primary mb-4">Booking Summary</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Calendar size={16} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Date & Time</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedTime}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <MapPin size={16} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Location</p>
                  <p className="text-sm font-medium">Apartment 1204, Marina Towers</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Clock size={16} className="text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Service</p>
                  <p className="text-sm font-medium">Deep Tissue Massage — 60 min</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coupon */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mt-4">
            <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Tag size={14} className="text-secondary" />
              Promo Code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                className="flex-1 bg-neutral px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
              <button
                onClick={() => coupon && setCouponApplied(true)}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-medium"
              >
                Apply
              </button>
            </div>
            {couponApplied && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check size={12} /> 15% discount applied!
              </p>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mt-4">
            <h3 className="text-sm font-semibold text-primary mb-3">Price Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service Fee</span>
                <span>AED {basePrice}</span>
              </div>
              {couponApplied && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount (15%)</span>
                  <span className="text-green-600">-AED {discount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT (5%)</span>
                <span>AED {tax}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-secondary text-lg">AED {total}</span>
              </div>
            </div>
          </div>

          {/* Safety */}
          <div className="flex items-center gap-2 mt-4 px-1">
            <Shield size={14} className="text-green-500" />
            <p className="text-[11px] text-gray-400">Verified professionals. Full refund if cancelled 24h before.</p>
          </div>
        </div>
      )}

      {/* Fixed Bottom for Step 3 */}
      {step === 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 z-50">
          <button
            onClick={() => {
              router.push('/booking/confirmation');
            }}
            className="w-full bg-secondary hover:bg-secondary-dark text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <CreditCard size={18} />
            Pay AED {total}
          </button>
        </div>
      )}
    </main>
  );
}
