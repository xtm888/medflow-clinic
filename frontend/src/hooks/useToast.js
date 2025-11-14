import { useState, useCallback } from 'react';

/**
 * Custom hook for managing toast notifications
 * @returns {Object} Toast methods and state
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random(); // Unique ID
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    success: useCallback((msg, duration) => showToast(msg, 'success', duration), [showToast]),
    error: useCallback((msg, duration) => showToast(msg, 'error', duration), [showToast]),
    warning: useCallback((msg, duration) => showToast(msg, 'warning', duration), [showToast]),
    info: useCallback((msg, duration) => showToast(msg, 'info', duration), [showToast])
  };
};

export default useToast;
