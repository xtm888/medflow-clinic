import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, User, ChevronLeft, ChevronRight,
  Check, X, Users, RefreshCw, Stethoscope
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import appointmentService from '../services/appointmentService';
import { normalizeToArray } from '../utils/apiHelpers';
import { toast } from 'react-toastify';

// Working hours configuration (can be made configurable later)
const DEFAULT_WORKING_HOURS = {
  start: 8, // 8 AM
  end: 18, // 6 PM
  slotDuration: 30 // minutes
};

// Generate time slots for a day
const generateTimeSlots = (startHour, endHour, slotDuration) => {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += slotDuration) {
      slots.push({
        time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        hour,
        minute: min
      });
    }
  }
  return slots;
};

export default function ProviderAvailabilityPanel({
  providers = [],
  selectedDate = new Date(),
  onDateChange,
  onSlotSelect,
  selectedProvider,
  onProviderSelect,
  existingAppointments = [],
  isLoading = false,
  mode = 'full' // 'full' or 'compact'
}) {
  const [weekStart, setWeekStart] = useState(startOfWeek(selectedDate, { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'

  // Generate week days
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Generate time slots
  const timeSlots = useMemo(() =>
    generateTimeSlots(
      DEFAULT_WORKING_HOURS.start,
      DEFAULT_WORKING_HOURS.end,
      DEFAULT_WORKING_HOURS.slotDuration
    ),
    []
  );

  // Fetch appointments for the selected week/providers
  useEffect(() => {
    if (existingAppointments.length > 0) {
      setAppointments(existingAppointments);
    } else {
      fetchAppointments();
    }
  }, [weekStart, selectedProvider, existingAppointments]);

  const fetchAppointments = async () => {
    if (providers.length === 0) return;

    try {
      setLoadingAppointments(true);
      const response = await appointmentService.getAppointments({
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(addDays(weekStart, 7), 'yyyy-MM-dd'),
        provider: selectedProvider || undefined
      });
      setAppointments(normalizeToArray(response));
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Check if a slot is booked for a specific provider and date
  const isSlotBooked = (date, time, providerId) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    return appointments.some(apt => {
      const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
      const aptProvider = apt.provider?._id || apt.provider?.id || apt.provider;
      const aptTime = apt.startTime || apt.time;

      return (
        aptDate === dateStr &&
        aptTime === time &&
        (providerId ? aptProvider === providerId : true) &&
        !['cancelled', 'no_show'].includes(apt.status?.toLowerCase())
      );
    });
  };

  // Get appointment for a slot
  const getSlotAppointment = (date, time, providerId) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    return appointments.find(apt => {
      const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
      const aptProvider = apt.provider?._id || apt.provider?.id || apt.provider;
      const aptTime = apt.startTime || apt.time;

      return (
        aptDate === dateStr &&
        aptTime === time &&
        (providerId ? aptProvider === providerId : true) &&
        !['cancelled', 'no_show'].includes(apt.status?.toLowerCase())
      );
    });
  };

  // Count available slots for a provider on a date
  const countAvailableSlots = (date, providerId) => {
    return timeSlots.filter(slot => !isSlotBooked(date, slot.time, providerId)).length;
  };

  // Navigation handlers
  const navigatePrev = () => {
    setWeekStart(prev => addDays(prev, -7));
  };

  const navigateNext = () => {
    setWeekStart(prev => addDays(prev, 7));
  };

  const goToToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    onDateChange?.(new Date());
  };

  // Handle slot click
  const handleSlotClick = (date, slot, providerId) => {
    if (isSlotBooked(date, slot.time, providerId)) return;

    onSlotSelect?.({
      date: format(date, 'yyyy-MM-dd'),
      time: slot.time,
      providerId
    });
  };

  // Get provider initials
  const getProviderInitials = (provider) => {
    if (!provider) return '?';
    const first = provider.firstName?.[0] || '';
    const last = provider.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  // Get provider display name
  const getProviderName = (provider) => {
    if (!provider) return 'Non assigné';
    return `Dr. ${provider.firstName || ''} ${provider.lastName || ''}`.trim();
  };

  // Compact mode - show only selected date/provider availability
  if (mode === 'compact') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Disponibilités</h3>
            </div>
            <span className="text-sm text-gray-500">
              {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
            </span>
          </div>
        </div>

        <div className="p-4">
          {/* Time slots grid */}
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {timeSlots.map((slot) => {
              const booked = isSlotBooked(selectedDate, slot.time, selectedProvider);
              return (
                <button
                  key={slot.time}
                  onClick={() => handleSlotClick(selectedDate, slot, selectedProvider)}
                  disabled={booked}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    booked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
                <span className="text-gray-600">Disponible</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
                <span className="text-gray-600">Occupé</span>
              </div>
            </div>
            <span className="text-gray-500">
              {countAvailableSlots(selectedDate, selectedProvider)} créneaux libres
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full mode - week view with all providers
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6" />
            <div>
              <h3 className="font-bold text-lg">Disponibilités des praticiens</h3>
              <p className="text-blue-100 text-sm">
                Semaine du {format(weekStart, 'd MMMM', { locale: fr })}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchAppointments}
              disabled={loadingAppointments}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Actualiser"
            >
              <RefreshCw className={`h-5 w-5 ${loadingAppointments ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={navigatePrev}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Aujourd'hui
            </button>
            <button
              onClick={navigateNext}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Provider filter */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <span className="text-sm font-medium text-gray-500 flex-shrink-0">Praticien:</span>
          <button
            onClick={() => onProviderSelect?.(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
              !selectedProvider
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Tous
          </button>
          {providers.map((provider) => (
            <button
              key={provider._id || provider.id}
              onClick={() => onProviderSelect?.(provider._id || provider.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 flex items-center space-x-2 ${
                selectedProvider === (provider._id || provider.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                selectedProvider === (provider._id || provider.id)
                  ? 'bg-white/20'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {getProviderInitials(provider)}
              </div>
              <span>{getProviderName(provider)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Week calendar */}
      <div className="p-4">
        {/* Days header */}
        <div className="grid grid-cols-8 gap-2 mb-3">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Heure
          </div>
          {weekDays.map((day, idx) => {
            const isCurrentDay = isToday(day);
            const availableCount = countAvailableSlots(day, selectedProvider);

            return (
              <div
                key={idx}
                className={`text-center rounded-lg py-2 ${
                  isCurrentDay ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <p className="text-xs font-medium text-gray-500 uppercase">
                  {format(day, 'EEE', { locale: fr })}
                </p>
                <p className={`text-lg font-bold ${isCurrentDay ? 'text-blue-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </p>
                <p className={`text-xs ${availableCount > 5 ? 'text-green-600' : availableCount > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  {availableCount} libres
                </p>
              </div>
            );
          })}
        </div>

        {/* Time slots grid */}
        <div className="max-h-96 overflow-y-auto border rounded-lg">
          {timeSlots.map((slot, slotIdx) => (
            <div key={slot.time} className={`grid grid-cols-8 gap-2 ${slotIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              {/* Time column */}
              <div className="px-2 py-1.5 text-xs font-medium text-gray-500 flex items-center justify-center border-r">
                {slot.time}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIdx) => {
                const booked = isSlotBooked(day, slot.time, selectedProvider);
                const apt = booked ? getSlotAppointment(day, slot.time, selectedProvider) : null;
                const isPast = day < new Date() && !isToday(day);

                return (
                  <button
                    key={dayIdx}
                    onClick={() => handleSlotClick(day, slot, selectedProvider)}
                    disabled={booked || isPast}
                    className={`py-1.5 text-xs rounded transition-all ${
                      isPast
                        ? 'bg-gray-100 cursor-not-allowed'
                        : booked
                          ? 'bg-red-100 text-red-700 cursor-not-allowed hover:bg-red-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-sm border border-transparent hover:border-green-300'
                    }`}
                    title={
                      booked
                        ? `Occupé: ${apt?.patient?.firstName || 'Patient'} ${apt?.patient?.lastName || ''}`
                        : isPast
                          ? 'Date passée'
                          : 'Cliquez pour réserver'
                    }
                  >
                    {booked ? (
                      <X className="h-3 w-3 mx-auto" />
                    ) : isPast ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <Check className="h-3 w-3 mx-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded bg-green-50 border border-green-200 flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-green-600" />
              </div>
              <span className="text-gray-600">Disponible</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-200 flex items-center justify-center">
                <X className="h-2.5 w-2.5 text-red-600" />
              </div>
              <span className="text-gray-600">Occupé</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
              <span className="text-gray-600">Passé</span>
            </div>
          </div>

          {selectedProvider && (
            <div className="flex items-center space-x-2 text-gray-500">
              <Stethoscope className="h-4 w-4" />
              <span>
                {providers.find(p => (p._id || p.id) === selectedProvider)
                  ? getProviderName(providers.find(p => (p._id || p.id) === selectedProvider))
                  : 'Tous les praticiens'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
