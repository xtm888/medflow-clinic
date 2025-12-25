/**
 * QuickActionsBar - Quick-action buttons for StudioVision consultation
 *
 * Provides rapid access to common consultation actions:
 * - OD→OG: Mirror refraction values (with axis ±90°)
 * - Import Last Visit: Load all data from previous visit
 * - Print: Dropdown with document options
 * - Quick Diagnosis: Dropdown with common diagnoses (ICD-10)
 * - Timer: Consultation duration tracker
 *
 * All buttons have keyboard shortcuts for power users.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Copy,
  History,
  Printer,
  Stethoscope,
  Timer,
  Play,
  Pause,
  ChevronDown,
  FileText,
  Pill,
  Award,
  User,
  ClipboardList,
  Eye,
  AlertTriangle,
  Check,
  Loader2,
  PenTool
} from 'lucide-react';

// Keyboard shortcuts mapping
const SHORTCUTS = {
  copyODtoOG: { key: 'm', ctrl: true, label: 'Ctrl+M' },
  importLastVisit: { key: 'l', ctrl: true, label: 'Ctrl+L' },
  print: { key: 'p', ctrl: true, label: 'Ctrl+P' },
  quickDiagnosis: { key: 'd', ctrl: true, label: 'Ctrl+D' },
  schema: { key: 's', ctrl: true, shift: true, label: 'Ctrl+Shift+S' },
  timer: { key: 't', ctrl: true, label: 'Ctrl+T' }
};

// Print options
const PRINT_OPTIONS = [
  { id: 'ordonnance_verres', label: 'Ordonnance verres', icon: Eye },
  { id: 'ordonnance_medicaments', label: 'Ordonnance médicaments', icon: Pill },
  { id: 'certificat_medical', label: 'Certificat médical', icon: Award },
  { id: 'fiche_patient', label: 'Fiche patient', icon: User },
  { id: 'resume_consultation', label: 'Résumé consultation', icon: ClipboardList }
];

// Quick diagnosis options with ICD-10 codes
const DIAGNOSIS_OPTIONS = {
  refraction: {
    label: 'Réfraction',
    items: [
      { id: 'myopia', label: 'Myopie', code: 'H52.1' },
      { id: 'hyperopia', label: 'Hypermétropie', code: 'H52.0' },
      { id: 'astigmatism', label: 'Astigmatisme', code: 'H52.2' },
      { id: 'presbyopia', label: 'Presbytie', code: 'H52.4' }
    ]
  },
  pathology: {
    label: 'Pathologies',
    items: [
      { id: 'cataract', label: 'Cataracte', code: 'H25' },
      { id: 'glaucoma', label: 'Glaucome', code: 'H40' },
      { id: 'amd', label: 'DMLA', code: 'H35.3' },
      { id: 'conjunctivitis', label: 'Conjonctivite', code: 'H10' }
    ]
  }
};

// Styles
const styles = {
  container: `
    flex items-center gap-2 p-2
    bg-gray-50 border-b border-gray-200
    flex-wrap
  `,
  buttonGroup: 'flex items-center gap-1',
  button: `
    inline-flex items-center gap-1.5 px-3 py-1.5
    text-sm font-medium rounded
    border transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-offset-1
  `,
  buttonPrimary: `
    bg-blue-600 border-blue-600 text-white
    hover:bg-blue-700 focus:ring-blue-500
  `,
  buttonSecondary: `
    bg-white border-gray-300 text-gray-700
    hover:bg-gray-50 focus:ring-gray-500
  `,
  buttonSuccess: `
    bg-green-600 border-green-600 text-white
    hover:bg-green-700 focus:ring-green-500
  `,
  buttonWarning: `
    bg-amber-500 border-amber-500 text-white
    hover:bg-amber-600 focus:ring-amber-500
  `,
  buttonDisabled: 'opacity-50 cursor-not-allowed',
  shortcutBadge: `
    ml-1 px-1 py-0.5 text-xs
    bg-black/10 rounded
    font-mono
  `,
  dropdown: `
    absolute top-full left-0 mt-1 z-50
    bg-white border border-gray-200 rounded-lg shadow-lg
    min-w-[200px] py-1
    animate-in fade-in slide-in-from-top-1 duration-150
  `,
  dropdownItem: `
    w-full flex items-center gap-2 px-3 py-2
    text-sm text-gray-700 hover:bg-gray-50
    transition-colors cursor-pointer
    text-left
  `,
  dropdownItemActive: 'bg-blue-50 text-blue-700',
  dropdownDivider: 'border-t border-gray-100 my-1',
  dropdownHeader: 'px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase',
  timerDisplay: `
    flex items-center gap-2 px-3 py-1.5
    bg-gray-800 text-white rounded
    font-mono text-sm
    min-w-[80px] justify-center
  `,
  timerRunning: 'bg-green-600',
  timerPaused: 'bg-amber-600',
  separator: 'w-px h-6 bg-gray-300 mx-1'
};

// Format timer display (MM:SS)
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Dropdown component for print and diagnosis options
 */
function ActionDropdown({
  trigger,
  options,
  onSelect,
  isOpen,
  onToggle,
  grouped = false
}) {
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={dropdownRef}>
      {trigger}
      {isOpen && (
        <div className={styles.dropdown}>
          {grouped ? (
            // Grouped options (for diagnoses)
            Object.entries(options).map(([groupKey, group]) => (
              <div key={groupKey}>
                <div className={styles.dropdownHeader}>{group.label}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      onToggle(false);
                    }}
                    className={styles.dropdownItem}
                  >
                    <span className="flex-1">{item.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                  </button>
                ))}
                {groupKey !== Object.keys(options).pop() && (
                  <div className={styles.dropdownDivider} />
                )}
              </div>
            ))
          ) : (
            // Flat options (for print)
            options.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onToggle(false);
                  }}
                  className={styles.dropdownItem}
                >
                  {Icon && <Icon className="h-4 w-4 text-gray-400" />}
                  <span>{item.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Timer component
 */
function ConsultationTimer({
  initialSeconds = 0,
  autoStart = true,
  onTimeUpdate
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef(null);

  // Start/stop timer
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          const newValue = s + 1;
          onTimeUpdate?.(newValue);
          return newValue;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onTimeUpdate]);

  const toggleTimer = () => {
    setIsRunning(prev => !prev);
  };

  return (
    <button
      onClick={toggleTimer}
      className={`${styles.timerDisplay} ${isRunning ? styles.timerRunning : styles.timerPaused}`}
      title={`${isRunning ? 'Pause' : 'Reprendre'} le chronomètre (Ctrl+T)`}
    >
      {isRunning ? (
        <Pause className="h-3 w-3" />
      ) : (
        <Play className="h-3 w-3" />
      )}
      <Timer className="h-3 w-3" />
      {formatTime(seconds)}
    </button>
  );
}

/**
 * QuickActionsBar component
 */
export default function QuickActionsBar({
  // OD→OG handler
  onCopyODtoOG,
  canCopyODtoOG = false,

  // Import last visit handler
  onImportLastVisit,
  hasPreviousVisit = false,
  loadingLastVisit = false,

  // Print handler
  onPrint,

  // Diagnosis handler
  onAddDiagnosis,

  // Schema handler
  onOpenSchema,

  // Timer handlers
  onTimerUpdate,
  initialTimerSeconds = 0,
  autoStartTimer = true,

  // Loading states
  copyingOD = false,

  // Style
  className = ''
}) {
  const [printOpen, setPrintOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  // Handle OD→OG copy
  const handleCopyOD = async () => {
    if (!canCopyODtoOG || copyingOD) return;

    try {
      await onCopyODtoOG?.();
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (e) {
      console.error('Failed to copy OD to OG:', e);
    }
  };

  // Handle import last visit
  const handleImportLastVisit = async () => {
    if (!hasPreviousVisit || loadingLastVisit) return;

    try {
      await onImportLastVisit?.();
      setShowImportSuccess(true);
      setTimeout(() => setShowImportSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to import last visit:', e);
    }
  };

  // Handle print
  const handlePrint = (option) => {
    onPrint?.(option.id);
  };

  // Handle diagnosis
  const handleDiagnosis = (diagnosis) => {
    onAddDiagnosis?.(diagnosis);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && key === SHORTCUTS.copyODtoOG.key) {
        e.preventDefault();
        handleCopyOD();
      } else if (ctrl && key === SHORTCUTS.importLastVisit.key) {
        e.preventDefault();
        handleImportLastVisit();
      } else if (ctrl && key === SHORTCUTS.print.key) {
        e.preventDefault();
        setPrintOpen(prev => !prev);
      } else if (ctrl && key === SHORTCUTS.quickDiagnosis.key) {
        e.preventDefault();
        setDiagnosisOpen(prev => !prev);
      } else if (ctrl && e.shiftKey && key === SHORTCUTS.schema.key) {
        e.preventDefault();
        onOpenSchema?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canCopyODtoOG, hasPreviousVisit, copyingOD, loadingLastVisit]);

  return (
    <div className={`${styles.container} ${className}`}>
      {/* OD→OG Button */}
      <button
        onClick={handleCopyOD}
        disabled={!canCopyODtoOG || copyingOD}
        className={`${styles.button} ${canCopyODtoOG ? styles.buttonPrimary : styles.buttonDisabled} ${!canCopyODtoOG ? 'bg-gray-200 border-gray-200 text-gray-400' : ''}`}
        title="Copier les valeurs OD vers OG (avec ajustement axe ±90°)"
      >
        {copyingOD ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showCopySuccess ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        OD→OG
        <span className={styles.shortcutBadge}>{SHORTCUTS.copyODtoOG.label}</span>
      </button>

      <div className={styles.separator} />

      {/* Import Last Visit Button */}
      <button
        onClick={handleImportLastVisit}
        disabled={!hasPreviousVisit || loadingLastVisit}
        className={`${styles.button} ${hasPreviousVisit ? styles.buttonSecondary : styles.buttonDisabled} ${!hasPreviousVisit ? 'bg-gray-100 border-gray-200 text-gray-400' : ''}`}
        title="Charger les données de la dernière visite"
      >
        {loadingLastVisit ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showImportSuccess ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <History className="h-4 w-4" />
        )}
        Dernière visite
        <span className={styles.shortcutBadge}>{SHORTCUTS.importLastVisit.label}</span>
      </button>

      <div className={styles.separator} />

      {/* Print Dropdown */}
      <ActionDropdown
        isOpen={printOpen}
        onToggle={setPrintOpen}
        options={PRINT_OPTIONS}
        onSelect={handlePrint}
        trigger={
          <button
            onClick={() => setPrintOpen(prev => !prev)}
            className={`${styles.button} ${styles.buttonSecondary}`}
            title="Options d'impression"
          >
            <Printer className="h-4 w-4" />
            Imprimer
            <ChevronDown className="h-3 w-3" />
            <span className={styles.shortcutBadge}>{SHORTCUTS.print.label}</span>
          </button>
        }
      />

      <div className={styles.separator} />

      {/* Quick Diagnosis Dropdown */}
      <ActionDropdown
        isOpen={diagnosisOpen}
        onToggle={setDiagnosisOpen}
        options={DIAGNOSIS_OPTIONS}
        onSelect={handleDiagnosis}
        grouped={true}
        trigger={
          <button
            onClick={() => setDiagnosisOpen(prev => !prev)}
            className={`${styles.button} ${styles.buttonWarning}`}
            title="Ajouter un diagnostic rapide"
          >
            <Stethoscope className="h-4 w-4" />
            Diag rapide
            <ChevronDown className="h-3 w-3" />
            <span className={styles.shortcutBadge}>{SHORTCUTS.quickDiagnosis.label}</span>
          </button>
        }
      />

      <div className={styles.separator} />

      {/* Schema Button */}
      <button
        onClick={onOpenSchema}
        className={`${styles.button} ${styles.buttonSecondary}`}
        title="Ouvrir l'outil de schéma oculaire"
      >
        <PenTool className="h-4 w-4" />
        Schéma
        <span className={styles.shortcutBadge}>{SHORTCUTS.schema.label}</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Timer */}
      <ConsultationTimer
        initialSeconds={initialTimerSeconds}
        autoStart={autoStartTimer}
        onTimeUpdate={onTimerUpdate}
      />
    </div>
  );
}

// Export sub-components and constants
export { ConsultationTimer, ActionDropdown, SHORTCUTS, PRINT_OPTIONS, DIAGNOSIS_OPTIONS, formatTime };
