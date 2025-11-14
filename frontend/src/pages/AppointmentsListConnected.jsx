import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, Search, Filter, Plus, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppointments, useAuth, useAppDispatch } from '../hooks/useRedux';
import { fetchAppointments, updateAppointmentStatus, cancelAppointment } from '../store/slices/appointmentSlice';
import { addToast } from '../store/slices/notificationSlice';
import { useAppointmentUpdates } from '../hooks/useWebSocket';

const AppointmentCard = ({ appointment, onStatusChange, onCancel, onView }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'no-show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateTime) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const { date, time } = formatDateTime(appointment.dateTime);

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {appointment.patientName || `${appointment.patient?.firstName} ${appointment.patient?.lastName}`}
              </h3>
              <p className="text-sm text-gray-500">ID: {appointment.patientId}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              <span>{date}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Clock className="h-4 w-4 mr-2" />
              <span>{time}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <span className="font-medium mr-2">Type:</span>
              <span>{appointment.appointmentType}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <span className="font-medium mr-2">Department:</span>
              <span>{appointment.department}</span>
            </div>
            {appointment.doctorName && (
              <div className="flex items-center text-gray-600">
                <span className="font-medium mr-2">Doctor:</span>
                <span>Dr. {appointment.doctorName}</span>
              </div>
            )}
            {appointment.reason && (
              <div className="text-gray-600">
                <span className="font-medium">Reason:</span> {appointment.reason}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
            {appointment.status}
          </span>

          <div className="flex space-x-2">
            <button
              onClick={() => onView(appointment)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View
            </button>
            {appointment.status === 'pending' && (
              <>
                <button
                  onClick={() => onStatusChange(appointment._id, 'confirmed')}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onCancel(appointment._id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Cancel
                </button>
              </>
            )}
            {appointment.status === 'confirmed' && (
              <button
                onClick={() => onStatusChange(appointment._id, 'completed')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AppointmentsListConnected() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { appointments, loading, error, pagination } = useAppointments();
  const { hasPermission } = useAuth();

  const [view, setView] = useState('day'); // day, week, month
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    status: 'all',
    department: 'all',
    appointmentType: 'all',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Real-time appointment updates
  useAppointmentUpdates();

  // Fetch appointments
  useEffect(() => {
    const params = {
      page: currentPage,
      limit: itemsPerPage,
      date: selectedDate,
      view,
      ...filters,
    };

    if (searchTerm) {
      params.search = searchTerm;
    }

    dispatch(fetchAppointments(params));
  }, [dispatch, currentPage, itemsPerPage, selectedDate, view, filters, searchTerm]);

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await dispatch(updateAppointmentStatus({ id: appointmentId, status: newStatus })).unwrap();
      dispatch(addToast({
        type: 'success',
        message: 'Appointment status updated successfully'
      }));
    } catch (error) {
      dispatch(addToast({
        type: 'error',
        message: error.message || 'Failed to update appointment status'
      }));
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await dispatch(cancelAppointment(appointmentId)).unwrap();
        dispatch(addToast({
          type: 'success',
          message: 'Appointment cancelled successfully'
        }));
      } catch (error) {
        dispatch(addToast({
          type: 'error',
          message: error.message || 'Failed to cancel appointment'
        }));
      }
    }
  };

  const handleViewAppointment = (appointment) => {
    navigate(`/appointments/${appointment._id}`);
  };

  const handleNewAppointment = () => {
    navigate('/appointments/new');
  };

  const handleDateChange = (days) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Group appointments by time for better display
  const groupAppointmentsByTime = () => {
    const grouped = {};
    appointments.forEach(appointment => {
      const dateTime = new Date(appointment.dateTime);
      const hour = dateTime.getHours();
      const timeSlot = `${hour}:00 - ${hour + 1}:00`;

      if (!grouped[timeSlot]) {
        grouped[timeSlot] = [];
      }
      grouped[timeSlot].push(appointment);
    });
    return grouped;
  };

  const totalPages = Math.ceil((pagination.total || 0) / itemsPerPage);

  if (!hasPermission(['doctor', 'nurse', 'receptionist'])) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">You don't have permission to view appointments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and schedule patient appointments
          </p>
        </div>
        <button
          onClick={handleNewAppointment}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Appointment
        </button>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleDateChange(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <button
                onClick={() => handleDateChange(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="btn-secondary text-sm"
              >
                Today
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex space-x-2">
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  view === 'day'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  view === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  view === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by patient name or ID..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No Show</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="all">All Departments</option>
                  <option value="General">General</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Pediatrics">Pediatrics</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filters.appointmentType}
                  onChange={(e) => handleFilterChange('appointmentType', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="all">All Types</option>
                  <option value="Consultation">Consultation</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Routine Check">Routine Check</option>
                  <option value="Vaccination">Vaccination</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Appointments List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-500">Loading appointments...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error loading appointments: {error}</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No appointments found</p>
              <p className="text-sm text-gray-400 mt-2">
                {searchTerm ? 'Try adjusting your search terms' : 'Schedule a new appointment to get started'}
              </p>
            </div>
          ) : view === 'day' ? (
            // Day View - Group by time slots
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <span className="text-sm text-gray-500">
                  {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {Object.entries(groupAppointmentsByTime())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([timeSlot, slotAppointments]) => (
                  <div key={timeSlot}>
                    <div className="flex items-center mb-3">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-700">{timeSlot}</span>
                      <div className="flex-1 h-px bg-gray-200 ml-4" />
                    </div>
                    <div className="space-y-3 pl-6">
                      {slotAppointments.map(appointment => (
                        <AppointmentCard
                          key={appointment._id}
                          appointment={appointment}
                          onStatusChange={handleStatusChange}
                          onCancel={handleCancelAppointment}
                          onView={handleViewAppointment}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // List View for Week/Month
            <div className="space-y-3">
              {appointments.map(appointment => (
                <AppointmentCard
                  key={appointment._id}
                  appointment={appointment}
                  onStatusChange={handleStatusChange}
                  onCancel={handleCancelAppointment}
                  onView={handleViewAppointment}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, pagination.total)} of{' '}
                {pagination.total} appointments
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {[...Array(totalPages)].map((_, idx) => {
                  const page = idx + 1;
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-md ${
                          page === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    page === currentPage - 2 ||
                    page === currentPage + 2
                  ) {
                    return <span key={page}>...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Appointment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Today</p>
              <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Confirmed</p>
              <p className="text-2xl font-bold text-green-600">
                {appointments.filter(a => a.status === 'confirmed').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {appointments.filter(a => a.status === 'pending').length}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">
                {appointments.filter(a => a.status === 'cancelled').length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}