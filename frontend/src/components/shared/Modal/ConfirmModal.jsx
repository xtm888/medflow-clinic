/**
 * ConfirmModal - Pre-built confirmation dialog
 *
 * A specialized modal for yes/no confirmations with:
 * - Danger/warning/info/success variants with appropriate icons
 * - Loading state for async confirmations
 * - Customizable button labels
 * - Keyboard support (Enter to confirm, Escape to cancel)
 *
 * Usage:
 * <ConfirmModal
 *   isOpen={showDelete}
 *   onClose={() => setShowDelete(false)}
 *   onConfirm={handleDelete}
 *   title="Supprimer le patient?"
 *   message="Cette action est irréversible."
 *   variant="danger"
 * />
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, XCircle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import BaseModal from './BaseModal';

// Variant configurations
const VARIANTS = {
  danger: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
  },
  info: {
    icon: HelpCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    buttonClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
  }
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'warning',
  loading: externalLoading,
  children, // Optional additional content
  testId
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading ?? internalLoading;

  const config = VARIANTS[variant] || VARIANTS.warning;
  const Icon = config.icon;

  const handleConfirm = async () => {
    if (!onConfirm) {
      onClose();
      return;
    }

    try {
      setInternalLoading(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Don't close on error - let user see the error or retry
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      description={message}
      loading={loading}
      testId={testId}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-lg
              focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center gap-2
              ${config.buttonClass}
            `}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-gray-600">{message}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </BaseModal>
  );
}

/**
 * useConfirmModal - Hook for easier confirmation modal usage
 *
 * Usage:
 * const { confirm, ConfirmDialog } = useConfirmModal();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Supprimer?',
 *     message: 'Cette action est irréversible.',
 *     variant: 'danger'
 *   });
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Supprimer</button>
 *     <ConfirmDialog />
 *   </>
 * );
 */
export function useConfirmModal() {
  const [state, setState] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
    resolve: null
  });

  const confirm = useCallback(({
    title = 'Confirmer',
    message,
    variant = 'warning',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler'
  }) => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        title,
        message,
        variant,
        confirmLabel,
        cancelLabel,
        resolve
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    state.resolve?.(false);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = useCallback(() => (
    <ConfirmModal
      isOpen={state.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
    />
  ), [state, handleClose, handleConfirm]);

  return { confirm, ConfirmDialog };
}

// Export variant config for external use
export { VARIANTS };
