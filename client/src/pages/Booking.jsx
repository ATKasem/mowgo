import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase, isDemoMode } from '../lib/supabase';
import { Calendar, Clock, User, Phone, MapPin, FileText, CheckCircle, Loader2, AlertCircle, Leaf } from 'lucide-react';

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00',
];

function getNext7Days() {
  const days = [];
  const today = new Date();
  let i = 1;
  while (days.length < 7) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 0) { // skip Sundays until we have 7 usable days
      days.push({
        // Local-time date (not UTC) — prevents off-by-one across timezones
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayOfWeek: d.getDay(),
      });
    }
    i++;
  }
  return days;
}

function formatTime(t) {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const displayHr = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${displayHr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

export default function Booking() {
  const { businessId } = useParams();
  const { t } = useTranslation();
  const days = useMemo(() => getNext7Days(), []);

  const [businessName, setBusinessName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [bookedSlots, setBookedSlots] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Load business profile
  useEffect(() => {
    if (isDemoMode()) {
      setBusinessName('Green Thumb Lawn Care');
      setLoadingProfile(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('business_name')
          .eq('id', businessId)
          .single();
        if (!active) return;
        if (error || !data) {
          setProfileError(t('booking.business_not_found'));
        } else {
          setBusinessName(data.business_name || 'Lawn Care');
        }
      } catch {
        if (active) setProfileError(t('booking.could_not_load_business'));
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => { active = false; };
  }, [businessId]);

  // Load booked slots when date selected
  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    (async () => {
      setLoadingSlots(true);
      try {
        if (isDemoMode()) {
          // In demo mode, show a few random slots as taken
          if (active) setBookedSlots({ '09:00': true, '10:30': true });
          return;
        }
        const { data, error } = await supabase
          .from('jobs')
          .select('scheduled_time')
          .eq('user_id', businessId)
          .eq('scheduled_date', selectedDate)
          .in('status', ['scheduled', 'in_progress']);
        if (error) throw error;
        const taken = {};
        (data || []).forEach(j => {
          const t = j.scheduled_time?.slice(0, 5);
          if (t) taken[t] = true;
        });
        if (active) setBookedSlots(taken);
      } catch {
        if (active) setBookedSlots({});
      } finally {
        if (active) setLoadingSlots(false);
      }
    })();
    return () => { active = false; };
  }, [selectedDate, businessId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submittingRef.current) return; // synchronous double-submit guard
    setError('');
    if (!selectedDate || !selectedTime) {
      setError(t('booking.select_date_time'));
      return;
    }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError(t('booking.fill_fields'));
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim(),
          notes: notes.trim() || null,
          scheduled_date: selectedDate,
          scheduled_time: selectedTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Booking failed. Please try again.');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Leaf className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{profileError}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('booking.booking_link_invalid')}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('booking.booked')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {t('booking.thanks_for_booking', { name: businessName })}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedDate} at {formatTime(selectedTime)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto p-4 pb-24">
        {/* Header */}
        <div className="text-center pt-6 pb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-3">
            <Leaf className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{businessName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('booking.book_a_service')}</p>
        </div>

        {/* Date picker */}
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            {t('booking.pick_a_date')}
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {days.map(d => (
              <button
                key={d.date}
                type="button"
                onClick={() => { setSelectedDate(d.date); setSelectedTime(''); }}
                className={`p-2 rounded-xl text-xs font-medium transition-all ${
                  selectedDate === d.date
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="card p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              {t('booking.pick_a_time')}
            </h3>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {TIME_SLOTS.map(slot => {
                  const taken = bookedSlots[slot];
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={taken}
                      onClick={() => setSelectedTime(slot)}
                      className={`p-2 rounded-xl text-xs font-medium transition-all ${
                        taken
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed line-through'
                          : selectedTime === slot
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Customer form */}
        {selectedDate && selectedTime && (
          <form onSubmit={handleSubmit} className="card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-500" />
              {t('booking.your_info')}
            </h3>
            <div>
              <label className="label">{t('booking.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('booking.name_placeholder')}
                  className="input pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t('booking.phone')}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('booking.phone_placeholder')}
                  className="input pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t('booking.address')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={t('booking.address_placeholder')}
                  className="input pl-10"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t('booking.notes')} <span className="text-gray-400 font-normal">({t('booking.optional')})</span></label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('booking.notes_placeholder')}
                  className="input pl-10 min-h-[60px] resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400">
              {t('booking.summary', { date: selectedDate, time: formatTime(selectedTime) })}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('booking.booking')}</>
                : <><Calendar className="w-4 h-4" /> {t('booking.confirm_booking')}</>
              }
            </button>
          </form>
        )}

        {/* Powered by MowGo */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          {t('booking.powered_by')} <a href="https://mowgo.pages.dev" className="hover:text-emerald-500 transition-colors">MowGo</a>
        </p>
      </div>
    </div>
  );
}
