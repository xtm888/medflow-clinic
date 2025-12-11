import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, XCircle, HelpCircle, X } from 'lucide-react';

/**
 * Reusable Confirmation Modal - Replaces window.confirm()
 *
 * Usage:
 * const [showConfirm, setShowConfirm] = useState(false);
 * const [confirmAction, setConfirmAction] = useState(null);
 *
 * const handleDelete = () => {
 *   setConfirmAction(() => async () => { await deleteItem(); });
 *   setShowConfirm(true);
 * };
 *
 * <ConfirmationModal
 *   isOpen={showConfirm}
 *   onClose={() => setShowConfirm(false)}
 *   onConfirm={confirmAction}
 *   title="Supprimer l'élément?"
 *   message="Cette action est irréversible."
 *   type="danger"
 * />
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmer l\'action?',
  message = 'Êtes-vous sûr de vouloir continuer?',
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  type = 'warning', // 'warning' | 'danger' | 'success' | 'info'
  loading = false,
  children // Optional custom content
}) {
  const confirmButtonRef = useRef(null);
  const modalRef = useRef(null);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when modal opens
    setTimeout(() => confirmButtonRef.current?.focus(), 100);

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  // Handle confirm action
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    onClose();
  };

  if (!isOpen) return null;

  // Icon and color variants
  const variants = {
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      buttonBg: 'bg-amber-600 hover:bg-amber-700',
      buttonText: 'text-white'
    },
    danger: {
      icon: XCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
      buttonText: 'text-white'
    },
    success: {
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      buttonBg: 'bg-green-600 hover:bg-green-700',
      buttonText: 'text-white'
    },
    info: {
      icon: HelpCircle,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
      buttonText: 'text-white'
    }
  };

  const variant = variants[type] || variants.warning;
  const Icon = variant.icon;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6">
            {/* Icon and Title */}
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${variant.iconBg} flex items-center justify-center`}>
                <Icon className={`h-6 w-6 ${variant.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {message}
                </p>
              </div>
            </div>

            {/* Custom content */}
            {children && (
              <div className="mt-4">
                {children}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium ${variant.buttonText} ${variant.buttonBg} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2`}
              >
                {loading && (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                )}
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for easier confirmation modal usage
import { useState, useCallback } from 'react';

export function useConfirmation() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null,
    loading: false
  });

  const confirm = useCallback(({ title, message, type = 'warning', onConfirm }) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        type,
        loading: false,
        onConfirm: async () => {
          setState(prev => ({ ...prev, loading: true }));
          try {
            if (onConfirm) await onConfirm();
            resolve(true);
          } catch (error) {
            resolve(false);
            throw error;
          }
        }
      });
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmationDialog = useCallback(() => (
    <ConfirmationModal
      isOpen={state.isOpen}
      onClose={close}
      onConfirm={state.onConfirm}
      title={state.title}
      message={state.message}
      type={state.type}
      loading={state.loading}
    />
  ), [state, close]);

  return { confirm, close, ConfirmationDialog };
}
