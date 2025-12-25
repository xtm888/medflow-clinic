/**
 * Patients Page - Main Component
 *
 * Orchestrates patient management with modular components.
 * Reduced from ~1470 lines to ~200 lines through modularization.
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import logger from '../../services/logger';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useClinic } from '../../contexts/ClinicContext';
import patientService from '../../services/patientService';
import PatientRegistrationWizard from '../../components/PatientRegistration';

// Hooks
import { usePatientsData, usePatientSelection } from './hooks';

// Components
import {
  PatientsHeader,
  SearchFilters,
  PatientTable,
  BatchActionsToolbar,
  PatientDetailsModal,
  MergeDuplicatesModal,
  KeyboardShortcutsModal
} from './components';

export default function Patients() {
  const navigate = useNavigate();
  const { selectedClinic } = useClinic();
  const searchInputRef = useRef(null);

  // Data hook
  const {
    patients,
    filteredPatients,
    pagination,
    loading,
    searching,
    error,
    searchTerm,
    setSearchTerm,
    searchType,
    setSearchType,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    advancedFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    handleAdvancedFilterChange,
    hasActiveFilters,
    fetchPatients,
    applyAdvancedFilters,
    resetFilters,
    goToPage
  } = usePatientsData(selectedClinic);

  // Selection hook
  const {
    selectionMode,
    selectedPatients,
    batchActionLoading,
    togglePatientSelection,
    selectAllPatients,
    clearSelection,
    toggleSelectionMode,
    handleBatchExport,
    handleBatchBookAppointments,
    handleBatchSendMessage
  } = usePatientSelection(filteredPatients);

  // UI state
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Duplicate merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedForMerge, setSelectedForMerge] = useState({ primary: null, secondary: null });

  // Export handler
  const handleExport = useCallback(async (format = 'csv') => {
    try {
      setShowExportMenu(false);
      toast.info(`Export ${format.toUpperCase()} en cours...`);
      const response = await fetch(`/api/patients/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export terminé!');
    } catch (err) {
      logger.error('Export error:', err);
      toast.error('Erreur lors de l\'export');
    }
  }, []);

  // Check for duplicates
  const handleCheckDuplicates = useCallback(async () => {
    try {
      toast.info('Recherche de doublons...');
      const response = await patientService.checkDuplicates({});
      if (response.hasDuplicates) {
        setDuplicates(response.data);
        setShowMergeModal(true);
      } else {
        toast.info('Aucun doublon detecte');
      }
    } catch (err) {
      toast.error('Erreur lors de la recherche de doublons');
    }
  }, []);

  // Merge patients
  const handleMergePatients = useCallback(async () => {
    if (!selectedForMerge.primary || !selectedForMerge.secondary) {
      toast.error('Selectionnez les deux patients a fusionner');
      return;
    }

    try {
      await patientService.mergePatients(selectedForMerge.primary, selectedForMerge.secondary);
      toast.success('Patients fusionnes avec succes');
      setShowMergeModal(false);
      setSelectedForMerge({ primary: null, secondary: null });
      fetchPatients();
    } catch (err) {
      toast.error('Erreur lors de la fusion');
    }
  }, [selectedForMerge, fetchPatients]);

  // Handle wizard submission
  const handleWizardSubmit = useCallback(async (patientData) => {
    try {
      const response = await patientService.createPatient(patientData);
      const newPatient = response?.data?.data || response?.data || response;
      const patientId = newPatient?._id || newPatient?.id;

      toast.success('Patient créé avec succès!');
      setShowWizard(false);
      await fetchPatients();

      if (patientId) {
        navigate(`/patients/${patientId}`);
      }
    } catch (error) {
      logger.error('Error creating patient:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la création du patient';
      toast.error(errorMessage);
    }
  }, [fetchPatients, navigate]);

  // Check if any modal is open
  const isModalOpen = showWizard || showMergeModal || showShortcutsHelp;

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => ({
    'n': () => !isModalOpen && setShowWizard(true),
    '/': () => !isModalOpen && searchInputRef.current?.focus(),
    'f': () => !isModalOpen && setShowAdvancedFilters(prev => !prev),
    'r': () => { if (!isModalOpen) { fetchPatients(); toast.info('Liste actualisée'); } },
    'd': () => !isModalOpen && handleCheckDuplicates(),
    '1': () => !isModalOpen && patients[0] && navigate(`/patients/${patients[0]._id}`),
    '2': () => !isModalOpen && patients[1] && navigate(`/patients/${patients[1]._id}`),
    '3': () => !isModalOpen && patients[2] && navigate(`/patients/${patients[2]._id}`),
    'esc': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showWizard) setShowWizard(false);
      else if (showMergeModal) setShowMergeModal(false);
      else if (showAdvancedFilters) setShowAdvancedFilters(false);
      else if (showExportMenu) setShowExportMenu(false);
    },
    '?': () => setShowShortcutsHelp(true)
  }), [isModalOpen, showAdvancedFilters, showExportMenu, patients, navigate, fetchPatients, handleCheckDuplicates, showShortcutsHelp, showWizard, showMergeModal, setShowAdvancedFilters]);

  useKeyboardShortcuts(keyboardShortcuts, true);

  return (
    <div className="space-y-6">
      <PatientsHeader
        totalPatients={pagination.total}
        selectionMode={selectionMode}
        toggleSelectionMode={toggleSelectionMode}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        handleExport={handleExport}
        setShowWizard={setShowWizard}
        setShowShortcutsHelp={setShowShortcutsHelp}
      />

      <SearchFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchType={searchType}
        setSearchType={setSearchType}
        searching={searching}
        searchInputRef={searchInputRef}
        resultCount={filteredPatients.length}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        advancedFilters={advancedFilters}
        handleAdvancedFilterChange={handleAdvancedFilterChange}
        hasActiveFilters={hasActiveFilters}
        applyAdvancedFilters={applyAdvancedFilters}
        resetFilters={resetFilters}
        resetPage={() => goToPage(1)}
      />

      <PatientTable
        patients={filteredPatients}
        loading={loading}
        error={error}
        selectionMode={selectionMode}
        selectedPatients={selectedPatients}
        togglePatientSelection={togglePatientSelection}
        selectAllPatients={selectAllPatients}
        clearSelection={clearSelection}
        hasActiveFilters={hasActiveFilters}
        searchTerm={searchTerm}
        priorityFilter={priorityFilter}
        pagination={pagination}
        goToPage={goToPage}
        setShowWizard={setShowWizard}
        fetchPatients={fetchPatients}
      />

      {/* Modals */}
      {selectedPatient && (
        <PatientDetailsModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}

      {showMergeModal && (
        <MergeDuplicatesModal
          duplicates={duplicates}
          selectedForMerge={selectedForMerge}
          setSelectedForMerge={setSelectedForMerge}
          handleMergePatients={handleMergePatients}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {showWizard && (
        <PatientRegistrationWizard
          onClose={() => setShowWizard(false)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {showShortcutsHelp && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsHelp(false)} />
      )}

      {/* Batch Actions Toolbar */}
      {selectionMode && (
        <BatchActionsToolbar
          selectedCount={selectedPatients.size}
          batchActionLoading={batchActionLoading}
          handleBatchExport={handleBatchExport}
          handleBatchBookAppointments={handleBatchBookAppointments}
          handleBatchSendMessage={handleBatchSendMessage}
          clearSelection={clearSelection}
        />
      )}
    </div>
  );
}
