import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, AlertCircle, Calendar, Clock, Users, Package } from 'lucide-react';
import alertService from '../services/alertService';

const ICON_MAP = {
  calendar: Calendar,
  clock: Clock,
  users: Users,
  'alert-triangle': AlertCircle,
  package: Package
};

const CATEGORY_COLORS = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  important: 'bg-orange-100 text-orange-800 border-orange-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  reminder: 'bg-purple-100 text-purple-800 border-purple-200'
};

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch unread count on mount and set up polling
  useEffect(() => {
    fetchUnreadCount();

    // Poll for new alerts every 30 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchUnreadAlerts();
      }
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen]);

  // Fetch unread alerts when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchUnreadAlerts();
    }
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const response = await alertService.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchUnreadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await alertService.getUnreadAlerts(20);
      if (response.success) {
        // Safely extract array from response
        const alertsData = Array.isArray(response.data) ? response.data : [];
        setAlerts(alertsData);
        setUnreadCount(response.unreadCount || alertsData.length);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Impossible de charger les alertes');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertId) => {
    try {
      const response = await alertService.markAsRead(alertId);
      if (response.success) {
        // Update local state
        setAlerts(prev => prev.filter(a => a._id !== alertId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error marking alert as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const alertIds = alerts.map(a => a._id);
      if (alertIds.length === 0) return;

      const response = await alertService.markMultipleAsRead(alertIds);
      if (response.success) {
        setAlerts([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const dismissAlert = async (alertId) => {
    try {
      const response = await alertService.dismissAlert(alertId);
      if (response.success) {
        setAlerts(prev => prev.filter(a => a._id !== alertId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handleAlertClick = (alert) => {
    // Mark as read
    markAsRead(alert._id);

    // Navigate to action URL if provided
    if (alert.actionUrl) {
      window.location.href = alert.actionUrl;
    }
  };

  const getAlertIcon = (alert) => {
    const IconComponent = ICON_MAP[alert.icon] || Bell;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-lg">
            <h3 className="font-semibold text-gray-900">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex items-center gap-2">
              {alerts.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Tout lire</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {loading && (
              <div className="p-8 text-center text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm">Chargement...</p>
              </div>
            )}

            {error && (
              <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && alerts.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Aucune notification</p>
                <p className="text-xs mt-1">Vous êtes à jour!</p>
              </div>
            )}

            {!loading && !error && alerts.length > 0 && (
              <div className="divide-y divide-gray-100">
                {alerts.map(alert => (
                  <div
                    key={alert._id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !alert.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`flex-shrink-0 p-2 rounded-full ${
                        alert.category === 'urgent' ? 'bg-red-100 text-red-600' :
                        alert.category === 'important' ? 'bg-orange-100 text-orange-600' :
                        alert.category === 'info' ? 'bg-blue-100 text-blue-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {getAlertIcon(alert)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0" onClick={() => handleAlertClick(alert)}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 text-sm leading-tight">
                            {alert.title}
                          </h4>
                          <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border ${
                            CATEGORY_COLORS[alert.category] || CATEGORY_COLORS.info
                          }`}>
                            {alert.category === 'urgent' ? 'Urgent' :
                             alert.category === 'important' ? 'Important' :
                             alert.category === 'info' ? 'Info' : 'Rappel'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {alert.message}
                        </p>

                        {alert.relatedPatient && (
                          <p className="text-xs text-gray-500 mb-2">
                            Patient: {alert.relatedPatient.firstName} {alert.relatedPatient.lastName}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {formatTime(alert.createdAt)}
                          </span>

                          <div className="flex items-center gap-1">
                            {alert.actionRequired && alert.actionLabel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAlertClick(alert);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {alert.actionLabel}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(alert._id);
                              }}
                              className="p-1 text-gray-400 hover:text-green-600 rounded transition-colors"
                              title="Marquer comme lu"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                dismissAlert(alert._id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Ignorer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <a
                href="/alerts"
                className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                onClick={() => setIsOpen(false)}
              >
                Voir toutes les notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
