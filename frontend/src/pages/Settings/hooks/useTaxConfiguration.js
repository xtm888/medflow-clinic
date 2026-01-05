/**
 * useTaxConfiguration Hook
 *
 * Manages tax rate CRUD operations.
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import billingService from '../../../services/billingService';
import { getDefaultTaxForm, getDefaultConfirmModal } from '../constants';

export default function useTaxConfiguration(activeTab, canManageBilling) {
  const [taxes, setTaxes] = useState([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [taxForm, setTaxForm] = useState(getDefaultTaxForm());
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(getDefaultConfirmModal());

  // Fetch taxes when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing' && taxes.length === 0 && canManageBilling) {
      fetchTaxes();
    }
  }, [activeTab, canManageBilling]);

  const fetchTaxes = async () => {
    try {
      setTaxesLoading(true);
      const response = await billingService.getTaxRates({ active: 'all' });
      const rawData = response?.data?.data ?? response?.data ?? [];
      setTaxes(Array.isArray(rawData) ? rawData : []);
    } catch (error) {
      console.error('Error fetching taxes:', error);
      toast.error('Erreur lors du chargement des taux de taxe');
    } finally {
      setTaxesLoading(false);
    }
  };

  const handleOpenTaxModal = (tax = null) => {
    if (tax) {
      setEditingTax(tax);
      setTaxForm({
        name: tax.name || '',
        code: tax.code || '',
        rate: tax.rate?.toString() || '',
        type: tax.type || 'percentage',
        applicableCategories: tax.applicableCategories || ['all'],
        description: tax.description || '',
        active: tax.active !== false
      });
    } else {
      setEditingTax(null);
      setTaxForm(getDefaultTaxForm());
    }
    setShowTaxModal(true);
  };

  const handleCloseTaxModal = () => {
    setShowTaxModal(false);
    setEditingTax(null);
    setTaxForm(getDefaultTaxForm());
  };

  const handleSaveTax = async () => {
    if (!taxForm.name || !taxForm.code || !taxForm.rate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setSaving(true);
      const taxData = {
        ...taxForm,
        rate: parseFloat(taxForm.rate)
      };

      if (editingTax) {
        await billingService.updateTaxRate(editingTax._id, taxData);
        toast.success('Taux de taxe mis à jour');
      } else {
        await billingService.createTaxRate(taxData);
        toast.success('Taux de taxe créé');
      }

      handleCloseTaxModal();
      fetchTaxes();
    } catch (error) {
      console.error('Error saving tax:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTax = (taxId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Désactiver ce taux de taxe?',
      message: 'Êtes-vous sûr de vouloir désactiver ce taux de taxe? Les factures existantes ne seront pas affectées.',
      type: 'warning',
      onConfirm: async () => {
        try {
          await billingService.deleteTaxRate(taxId);
          toast.success('Taux de taxe désactivé');
          fetchTaxes();
        } catch (error) {
          console.error('Error deleting tax:', error);
          toast.error('Erreur lors de la désactivation');
        }
      }
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  return {
    // Taxes list
    taxes,
    taxesLoading,

    // Modal state
    showTaxModal,
    editingTax,
    taxForm,
    setTaxForm,
    saving,

    // Handlers
    handleOpenTaxModal,
    handleCloseTaxModal,
    handleSaveTax,
    handleDeleteTax,

    // Confirm modal
    confirmModal,
    closeConfirmModal
  };
}
