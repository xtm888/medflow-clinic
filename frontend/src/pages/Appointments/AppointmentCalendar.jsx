import { memo } from 'react';
import PropTypes from 'prop-types';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PermissionGate from '../../components/PermissionGate';

const WeekView = memo(function WeekView({ weekDays, appointments, getPatientName, getStatusText }) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day, idx) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayAppointments = appointments.filter(apt => {
          const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
          return aptDate === dayStr;
        });
        const isToday = dayStr === format(new Date(), 'yyyy-MM-dd');

        return (
          <div
            key={idx}
            className={`border rounded-lg p-3 min-h-[200px] ${
              isToday ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
            }`}
          >
            <div className="text-center mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase">
                {format(day, 'EEE', { locale: fr })}
              </p>
              <p className={`text-2xl font-bold ${
                isToday ? 'text-primary-600' : 'text-gray-900'
              }`}>
                {format(day, 'dd')}
              </p>
            </div>

            <div className="space-y-1">
              {dayAppointments.slice(0, 4).map((apt) => {
                const patientName = getPatientName(apt.patient);
                const statusLower = apt.status?.toLowerCase();
                return (
                  <div
                    key={apt._id || apt.id}
                    className={`text-xs p-2 rounded cursor-pointer hover:shadow-md transition ${
                      statusLower === 'confirmed' || statusLower === 'scheduled' ? 'bg-green-100 border border-green-300' :
                      statusLower === 'pending' ? 'bg-yellow-100 border border-yellow-300' :
                      statusLower === 'completed' ? 'bg-blue-100 border border-blue-300' :
                      statusLower === 'in-progress' ? 'bg-purple-100 border border-purple-300' :
                      'bg-gray-100 border border-gray-300'
                    }`}
                    onClick={() => {
                      const patientId = typeof apt.patient === 'object' ? (apt.patient._id || apt.patient.id) : apt.patient;
                      if (patientId) navigate(`/patients/${patientId}`);
                    }}
                  >
                    <p className="font-semibold truncate">
                      {apt.startTime || apt.time}
                    </p>
                    <p className="truncate text-gray-700">
                      {patientName}
                    </p>
                  </div>
                );
              })}
              {dayAppointments.length > 4 && (
                <p className="text-xs text-primary-600 font-medium text-center">
                  +{dayAppointments.length - 4} autres
                </p>
              )}
              {dayAppointments.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-4">
                  Aucun RDV
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

WeekView.propTypes = {
  weekDays: PropTypes.array.isRequired,
  appointments: PropTypes.array.isRequired,
  getPatientName: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired
};

const MonthView = memo(function MonthView({ selectedDate, appointments, getPatientName, onDateClick }) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = addDays(startOfWeek(addDays(monthEnd, 7), { weekStartsOn: 1 }), -1);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayAppointments = appointments.filter(apt => {
            const aptDate = format(new Date(apt.date), 'yyyy-MM-dd');
            return aptDate === dayStr;
          });
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={`border rounded-lg p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition ${
                !isCurrentMonth ? 'bg-gray-50 opacity-50' :
                isToday ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
              }`}
              onClick={() => onDateClick(day)}
            >
              <div className={`text-sm font-medium mb-1 ${
                isToday ? 'text-primary-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayAppointments.slice(0, 2).map((apt) => {
                  const statusLower = apt.status?.toLowerCase();
                  return (
                    <div
                      key={apt._id || apt.id}
                      className={`text-xs px-1 py-0.5 rounded truncate ${
                        statusLower === 'confirmed' || statusLower === 'scheduled' ? 'bg-green-200 text-green-800' :
                        statusLower === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                        statusLower === 'completed' ? 'bg-blue-200 text-blue-800' :
                        'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {apt.startTime || apt.time}
                    </div>
                  );
                })}
                {dayAppointments.length > 2 && (
                  <div className="text-xs text-primary-600 font-medium">
                    +{dayAppointments.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

MonthView.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  appointments: PropTypes.array.isRequired,
  getPatientName: PropTypes.func.isRequired,
  onDateClick: PropTypes.func.isRequired
};

const AgendaView = memo(function AgendaView({
  selectedDate,
  appointments,
  getPatientName,
  getProviderName,
  getStatusText,
  onCheckIn,
  actionLoading,
  getPatientObject
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const daysWithAppointments = daysInMonth.filter(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return appointments.some(apt => format(new Date(apt.date), 'yyyy-MM-dd') === dayStr);
  });

  if (daysWithAppointments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <CalendarDays className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p>Aucun rendez-vous ce mois</p>
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      {daysWithAppointments.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayAppointments = appointments
          .filter(apt => format(new Date(apt.date), 'yyyy-MM-dd') === dayStr)
          .sort((a, b) => (a.startTime || a.time || '').localeCompare(b.startTime || b.time || ''));
        const isToday = isSameDay(day, new Date());

        return (
          <div key={dayStr} className={`border rounded-lg overflow-hidden ${isToday ? 'border-primary-500' : 'border-gray-200'}`}>
            <div className={`px-4 py-2 font-semibold ${isToday ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
              {format(day, 'EEEE d MMMM', { locale: fr })}
              {isToday && <span className="ml-2 text-sm font-normal">(Aujourd'hui)</span>}
            </div>
            <div className="divide-y">
              {dayAppointments.map(apt => {
                const patientName = getPatientName(apt.patient);
                const providerName = getProviderName(apt.provider);
                const statusLower = apt.status?.toLowerCase();
                const aptId = apt._id || apt.id;

                return (
                  <div key={aptId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-semibold text-gray-900 w-16">
                        {apt.startTime || apt.time}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{patientName}</p>
                        <p className="text-sm text-gray-500">
                          {apt.type || 'Consultation'} {providerName && `• ${providerName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        statusLower === 'confirmed' || statusLower === 'scheduled' ? 'bg-green-100 text-green-800' :
                        statusLower === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        statusLower === 'completed' ? 'bg-blue-100 text-blue-800' :
                        statusLower === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                        statusLower === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getStatusText(apt.status)}
                      </span>
                      {(statusLower === 'confirmed' || statusLower === 'scheduled') && isToday && (
                        <PermissionGate permission="check_in_patients">
                          <button
                            onClick={() => {
                              const patient = getPatientObject(apt.patient);
                              onCheckIn(aptId, patient);
                            }}
                            disabled={actionLoading[aptId]}
                            className="btn btn-success text-xs px-2 py-1"
                          >
                            <UserCheck className="h-3 w-3" />
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});

AgendaView.propTypes = {
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  appointments: PropTypes.array.isRequired,
  getPatientName: PropTypes.func.isRequired,
  getProviderName: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired,
  onCheckIn: PropTypes.func.isRequired,
  actionLoading: PropTypes.object.isRequired,
  getPatientObject: PropTypes.func.isRequired
};

const AppointmentCalendar = memo(function AppointmentCalendar({
  viewMode,
  selectedDate,
  onDateChange,
  appointments,
  getPatientName,
  getProviderName,
  getStatusText,
  onCheckIn,
  actionLoading,
  getPatientObject
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePrevious = () => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      onDateChange(subMonths(selectedDate, 1));
    } else {
      onDateChange(subWeeks(selectedDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month' || viewMode === 'agenda') {
      onDateChange(addMonths(selectedDate, 1));
    } else {
      onDateChange(addWeeks(selectedDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleDateClick = (day) => {
    onDateChange(day);
  };

  const getTitle = () => {
    if (viewMode === 'week') {
      return `Semaine du ${format(weekStart, 'dd MMMM yyyy', { locale: fr })}`;
    } else if (viewMode === 'month') {
      return format(selectedDate, 'MMMM yyyy', { locale: fr });
    } else if (viewMode === 'agenda') {
      return `Agenda - ${format(selectedDate, 'MMMM yyyy', { locale: fr })}`;
    }
    return '';
  };

  const getPreviousLabel = () => {
    if (viewMode === 'week') return 'Précédente';
    if (viewMode === 'month') return 'Mois précédent';
    return '';
  };

  const getNextLabel = () => {
    if (viewMode === 'week') return 'Suivante';
    if (viewMode === 'month') return 'Mois suivant';
    return '';
  };

  return (
    <div className="card">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {getTitle()}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={handlePrevious}
            className="btn btn-secondary flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{getPreviousLabel()}</span>
          </button>
          <button
            onClick={handleToday}
            className="btn btn-primary"
          >
            Aujourd'hui
          </button>
          <button
            onClick={handleNext}
            className="btn btn-secondary flex items-center gap-1"
          >
            <span className="hidden sm:inline">{getNextLabel()}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'week' && (
        <WeekView
          weekDays={weekDays}
          appointments={appointments}
          getPatientName={getPatientName}
          getStatusText={getStatusText}
        />
      )}

      {viewMode === 'month' && (
        <MonthView
          selectedDate={selectedDate}
          appointments={appointments}
          getPatientName={getPatientName}
          onDateClick={handleDateClick}
        />
      )}

      {viewMode === 'agenda' && (
        <AgendaView
          selectedDate={selectedDate}
          appointments={appointments}
          getPatientName={getPatientName}
          getProviderName={getProviderName}
          getStatusText={getStatusText}
          onCheckIn={onCheckIn}
          actionLoading={actionLoading}
          getPatientObject={getPatientObject}
        />
      )}
    </div>
  );
});

AppointmentCalendar.propTypes = {
  viewMode: PropTypes.oneOf(['week', 'month', 'agenda']).isRequired,
  selectedDate: PropTypes.instanceOf(Date).isRequired,
  onDateChange: PropTypes.func.isRequired,
  appointments: PropTypes.array.isRequired,
  getPatientName: PropTypes.func.isRequired,
  getProviderName: PropTypes.func.isRequired,
  getStatusText: PropTypes.func.isRequired,
  onCheckIn: PropTypes.func.isRequired,
  actionLoading: PropTypes.object.isRequired,
  getPatientObject: PropTypes.func.isRequired
};

export default AppointmentCalendar;
