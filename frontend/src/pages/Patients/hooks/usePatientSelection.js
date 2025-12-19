/**
 * usePatientSelection Hook
 *
 * Handles batch patient selection and operations.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function usePatientSelection(filteredPatients) {
  const navigate = useNavigate();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  const togglePatientSelection = useCallback((patientId) => {
    setSelectedPatients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  }, []);

  const selectAllPatients = useCallback(() => {
    setSelectedPatients(new Set(filteredPatients.map(p => p._id || p.id)));
  }, [filteredPatients]);

  const clearSelection = useCallback(() => {
    setSelectedPatients(new Set());
    setSelectionMode(false);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) {
      clearSelection();
    }
    setSelectionMode(!selectionMode);
  }, [selectionMode, clearSelection]);

  // Batch export
  const handleBatchExport = useCallback(async () => {
    if (selectedPatients.size === 0) return;

    setBatchActionLoading(true);
    try {
      const selectedIds = Array.from(selectedPatients);
      toast.info(`Export de ${selectedIds.length} patient(s)...`);

      const selectedData = filteredPatients.filter(p =>
        selectedPatients.has(p._id || p.id)
      );

      const headers = ['ID', 'Prénom', 'Nom', 'Téléphone', 'Email', 'Date de naissance'];
      const rows = selectedData.map(p => [
        p.patientId || p._id,
        p.firstName,
        p.lastName,
        p.phone || '',
        p.email || '',
        p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('fr-FR') : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_selection_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${selectedIds.length} patient(s) exporté(s)`);
      clearSelection();
    } catch (err) {
      console.error('Batch export error:', err);
      toast.error("Erreur lors de l'export");
    } finally {
      setBatchActionLoading(false);
    }
  }, [selectedPatients, filteredPatients, clearSelection]);

  // Batch book appointments
  const handleBatchBookAppointments = useCallback(() => {
    if (selectedPatients.size === 0) return;

    const selectedIds = Array.from(selectedPatients);
    sessionStorage.setItem('batchPatientIds', JSON.stringify(selectedIds));
    toast.info(`${selectedIds.length} patient(s) sélectionné(s) pour prise de RDV`);
    navigate('/appointments?batch=true');
  }, [selectedPatients, navigate]);

  // Batch send message
  const handleBatchSendMessage = useCallback(() => {
    if (selectedPatients.size === 0) return;

    const selectedData = filteredPatients.filter(p =>
      selectedPatients.has(p._id || p.id)
    );

    const withEmail = selectedData.filter(p => p.email);
    const withPhone = selectedData.filter(p => p.phone);

    toast.info(
      `${withEmail.length} patient(s) avec email, ${withPhone.length} avec téléphone`
    );
  }, [selectedPatients, filteredPatients]);

  return {
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
  };
}
