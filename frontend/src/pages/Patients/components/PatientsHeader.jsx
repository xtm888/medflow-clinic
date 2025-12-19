/**
 * PatientsHeader Component
 *
 * Header section with title, patient count, and action buttons.
 */

import { Plus, Download, ChevronDown, CheckSquare, Square, Keyboard } from 'lucide-react';
import PermissionGate from '../../../components/PermissionGate';

export default function PatientsHeader({
  totalPatients,
  selectionMode,
  toggleSelectionMode,
  showExportMenu,
  setShowExportMenu,
  handleExport,
  setShowWizard,
  setShowShortcutsHelp
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Patients</h1>
        <p className="mt-1 text-sm text-gray-500">
          {totalPatients} patients enregistres
          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
            title="Raccourcis clavier (appuyez sur ?)"
          >
            <Keyboard className="h-3 w-3 mr-1" />
            <span className="text-xs">Raccourcis</span>
          </button>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Batch Selection Mode Toggle */}
        <button
          onClick={toggleSelectionMode}
          className={`btn ${selectionMode ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
          title="Mode sélection multiple"
        >
          {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          <span className="hidden sm:inline">{selectionMode ? 'Annuler' : 'Sélection'}</span>
        </button>

        <PermissionGate permission="view_reports" roles={['accountant']}>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Exporter en CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Exporter en PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </PermissionGate>

        <PermissionGate permission="register_patients" roles={['admin', 'receptionist', 'nurse']}>
          <button
            onClick={() => setShowWizard(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            <span>Nouveau patient</span>
          </button>
        </PermissionGate>
      </div>
    </div>
  );
}
