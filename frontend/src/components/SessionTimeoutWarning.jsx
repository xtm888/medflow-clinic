import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

// Default timeout settings (in milliseconds)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes total session
const WARNING_BEFORE = 5 * 60 * 1000; // Show warning 5 minutes before expiry
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

export default function SessionTimeoutWarning() {
  const { user, logout, refreshToken } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [extending, setExtending] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // If warning was shown but user is active, hide it
    if (showWarning && !extending) {
      setShowWarning(false);
      warningShownRef.current = false;
    }
  }, [showWarning, extending]);

  // Listen for user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Check session status periodically
  useEffect(() => {
    if (!user) return;

    const checkSession = () => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      const timeUntilExpiry = SESSION_TIMEOUT - timeSinceActivity;

      // Session expired
      if (timeUntilExpiry <= 0) {
        toast.warning('Session expirée - Veuillez vous reconnecter');
        logout();
        return;
      }

      // Show warning if within warning period
      if (timeUntilExpiry <= WARNING_BEFORE && !warningShownRef.current) {
        setTimeRemaining(Math.ceil(timeUntilExpiry / 1000));
        setShowWarning(true);
        warningShownRef.current = true;
      }

      // Update countdown if warning is shown
      if (showWarning) {
        setTimeRemaining(Math.ceil(timeUntilExpiry / 1000));
      }
    };

    // Initial check
    checkSession();

    // Set up interval
    const interval = setInterval(checkSession, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [user, logout, showWarning]);

  // Update countdown every second when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    const countdown = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          logout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [showWarning, logout]);

  // Extend session
  const handleExtendSession = async () => {
    setExtending(true);
    try {
      // Call refresh token if available
      if (refreshToken) {
        await refreshToken();
      }

      // Update last activity
      lastActivityRef.current = Date.now();
      warningShownRef.current = false;
      setShowWarning(false);
      toast.success('Session prolongée');
    } catch (error) {
      console.error('Error extending session:', error);
      toast.error('Erreur lors de la prolongation de session');
    } finally {
      setExtending(false);
    }
  };

  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showWarning || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-pulse-slow">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Session sur le point d'expirer</h2>
              <p className="text-orange-100 text-sm">Pour votre sécurité</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Countdown */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-red-100 mb-4">
              <div className="flex items-center space-x-1">
                <Clock className="h-6 w-6 text-orange-600" />
                <span className="text-3xl font-bold text-orange-600">
                  {formatTime(timeRemaining || 0)}
                </span>
              </div>
            </div>
            <p className="text-gray-600">
              Votre session sera automatiquement fermée dans
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatTime(timeRemaining || 0)}
            </p>
          </div>

          {/* Warning message */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-800">
              Pour des raisons de sécurité, les sessions inactives sont automatiquement fermées.
              Cliquez sur "Rester connecté" pour prolonger votre session.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={logout}
              className="flex-1 btn btn-secondary flex items-center justify-center space-x-2 py-3"
            >
              <LogOut className="h-5 w-5" />
              <span>Se déconnecter</span>
            </button>
            <button
              onClick={handleExtendSession}
              disabled={extending}
              className="flex-1 btn btn-primary flex items-center justify-center space-x-2 py-3"
            >
              {extending ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Prolongation...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  <span>Rester connecté</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000"
            style={{
              width: `${Math.max(0, (timeRemaining || 0) / (WARNING_BEFORE / 1000) * 100)}%`
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
