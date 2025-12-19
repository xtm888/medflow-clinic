/**
 * BaseModal - Foundation modal component with full accessibility
 *
 * Features:
 * - Focus trap (Tab cycles within modal)
 * - Escape key to close
 * - ARIA attributes for screen readers
 * - Focus restoration on close
 * - Click outside to close (optional)
 * - Body scroll lock
 * - Portal rendering
 * - Animation support
 *
 * Usage:
 * <BaseModal isOpen={isOpen} onClose={handleClose} title="Modal Title">
 *   <p>Modal content goes here</p>
 * </BaseModal>
 */

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

// Size presets
const SIZE_CLASSES = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[95vw]'
};

export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnClickOutside = true,
  closeOnEscape = true,
  showCloseButton = true,
  description,
  footer,
  headerExtra,
  className = '',
  bodyClassName = '',
  footerClassName = '',
  loading = false,
  // Test support
  testId
}) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const descriptionId = useRef(`modal-desc-${Math.random().toString(36).substr(2, 9)}`);

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return modalRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
  }, []);

  // Focus trap handler
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape && !loading) {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab on first element -> go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
      // Tab on last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, [closeOnEscape, loading, onClose, getFocusableElements]);

  // Handle click outside
  const handleBackdropClick = useCallback((e) => {
    if (closeOnClickOutside && !loading && e.target === e.currentTarget) {
      onClose();
    }
  }, [closeOnClickOutside, loading, onClose]);

  // Lock body scroll and manage focus when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement;

      // Lock body scroll
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      // Focus first focusable element after a brief delay
      setTimeout(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 50);

      // Add keyboard event listener
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isOpen) {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // Remove keyboard event listener
        document.removeEventListener('keydown', handleKeyDown);

        // Restore focus to previous element
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          setTimeout(() => previousActiveElement.current?.focus(), 0);
        }
      }
    };
  }, [isOpen, handleKeyDown, getFocusableElements]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleBackdropClick}
      role="presentation"
      aria-hidden="false"
      data-testid={testId ? `${testId}-backdrop` : undefined}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        aria-describedby={description ? descriptionId.current : undefined}
        tabIndex={-1}
        className={`
          bg-white rounded-xl shadow-2xl w-full ${SIZE_CLASSES[size] || SIZE_CLASSES.md}
          max-h-[90vh] flex flex-col
          animate-in fade-in zoom-in-95 duration-200
          ${className}
        `}
        data-testid={testId}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 id={titleId.current} className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h2>
            {headerExtra}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ml-2"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Description (hidden visually but available to screen readers) */}
        {description && (
          <p id={descriptionId.current} className="sr-only">
            {description}
          </p>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-6 py-4 ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0 ${footerClassName}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render using portal to ensure modal is at root level
  return createPortal(modalContent, document.body);
}

// Export size constants for external use
export { SIZE_CLASSES };
