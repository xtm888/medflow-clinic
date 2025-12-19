/**
 * FormModal - Modal designed for form workflows
 *
 * Features:
 * - Dirty state tracking with unsaved changes warning
 * - Form submission handling with loading state
 * - Optional form validation
 * - Reset button option
 * - Keyboard shortcut (Ctrl+Enter to submit)
 *
 * Usage:
 * <FormModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={handleSave}
 *   title="Nouveau patient"
 *   isDirty={formDirty}
 * >
 *   <form>...</form>
 * </FormModal>
 */

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import BaseModal from './BaseModal';
import ConfirmModal from './ConfirmModal';

export default function FormModal({
  isOpen,
  onClose,
  onSave,
  onReset,
  title,
  children,
  // Form state
  isDirty = false,
  isValid = true,
  loading: externalLoading,
  // Button customization
  saveLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  resetLabel = 'Réinitialiser',
  showReset = false,
  // Behavior
  confirmUnsavedChanges = true,
  closeOnSave = true,
  // Size and styling
  size = 'md',
  className = '',
  testId
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const loading = externalLoading ?? internalLoading;

  // Handle save
  const handleSave = async () => {
    if (!onSave || loading) return;

    try {
      setInternalLoading(true);
      await onSave();
      if (closeOnSave) {
        onClose();
      }
    } catch (error) {
      console.error('Save failed:', error);
      // Don't close on error
    } finally {
      setInternalLoading(false);
    }
  };

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (isDirty && confirmUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, confirmUnsavedChanges, onClose]);

  // Handle reset
  const handleReset = async () => {
    if (onReset) {
      await onReset();
    }
  };

  // Keyboard shortcut: Ctrl+Enter to save
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading && isValid) {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, isValid]);

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={handleClose}
        title={title}
        size={size}
        loading={loading}
        className={className}
        testId={testId}
        headerExtra={
          isDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Non enregistré
            </span>
          )
        }
        footer={
          <div className="flex items-center justify-between">
            {/* Left side - Reset button */}
            <div>
              {showReset && onReset && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading || !isDirty}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {resetLabel}
                </button>
              )}
            </div>

            {/* Right side - Cancel and Save */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || !isValid}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Ctrl+Entrée"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveLabel}
              </button>
            </div>
          </div>
        }
      >
        {children}
      </BaseModal>

      {/* Unsaved changes confirmation */}
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        onClose={() => setShowUnsavedConfirm(false)}
        onConfirm={() => {
          setShowUnsavedConfirm(false);
          onClose();
        }}
        title="Modifications non enregistrées"
        message="Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter sans enregistrer?"
        variant="warning"
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Continuer l'édition"
      />
    </>
  );
}

/**
 * useFormModal - Hook for managing form modal state
 *
 * Usage:
 * const { modalProps, openModal, closeModal, setDirty } = useFormModal();
 *
 * return (
 *   <>
 *     <button onClick={openModal}>Ouvrir</button>
 *     <FormModal {...modalProps} title="Mon formulaire" onSave={handleSave}>
 *       <input onChange={() => setDirty(true)} />
 *     </FormModal>
 *   </>
 * );
 */
export function useFormModal(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isDirty, setIsDirty] = useState(false);

  const openModal = useCallback(() => {
    setIsOpen(true);
    setIsDirty(false);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setIsDirty(false);
  }, []);

  const setDirty = useCallback((dirty = true) => {
    setIsDirty(dirty);
  }, []);

  return {
    modalProps: {
      isOpen,
      onClose: closeModal,
      isDirty
    },
    isOpen,
    isDirty,
    openModal,
    closeModal,
    setDirty
  };
}
