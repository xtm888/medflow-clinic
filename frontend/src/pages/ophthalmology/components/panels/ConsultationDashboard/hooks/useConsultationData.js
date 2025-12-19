/**
 * useConsultationData Hook
 *
 * Manages consultation state, auto-save, and template application.
 */

import { useState, useEffect, useCallback } from 'react';
import feeScheduleService from '../../../../../../services/feeScheduleService';
import { getDefaultData, DEFAULT_EXPANDED_SECTIONS } from '../constants';

export default function useConsultationData(initialData, onSave, autoSave = true, autoSaveInterval = 30000) {
  // Core consultation data
  const [data, setData] = useState(initialData || getDefaultData());
  const [expandedSections, setExpandedSections] = useState(DEFAULT_EXPANDED_SECTIONS);

  // Save state
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Template state
  const [appliedTemplateId, setAppliedTemplateId] = useState(null);

  // Medications from fee schedule
  const [commonMedications, setCommonMedications] = useState([]);
  const [loadingMedications, setLoadingMedications] = useState(true);

  // Fetch medications from fee schedule
  useEffect(() => {
    const fetchMedications = async () => {
      try {
        setLoadingMedications(true);
        const medications = await feeScheduleService.getMedications();

        setCommonMedications(medications.map(med => ({
          name: med.name,
          dose: '',
          category: med.displayCategory || med.category || 'Médicament',
          code: med.code,
          price: med.price
        })));
      } catch (error) {
        console.error('Error fetching medications:', error);
        setCommonMedications([]);
      } finally {
        setLoadingMedications(false);
      }
    };

    fetchMedications();
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !hasChanges) return;

    const timer = setTimeout(async () => {
      await handleSave(true);
    }, autoSaveInterval);

    return () => clearTimeout(timer);
  }, [data, autoSave, hasChanges, autoSaveInterval]);

  // Update section data
  const updateSection = useCallback((section, value) => {
    setData(prev => ({ ...prev, [section]: value }));
    setHasChanges(true);
  }, []);

  // Toggle section visibility
  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Save handler
  const handleSave = useCallback(async (isAutoSave = false) => {
    setSaving(true);
    try {
      await onSave?.(data, isAutoSave);
      setLastSaved(new Date());
      setHasChanges(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  }, [data, onSave]);

  // Apply consultation template
  const handleApplyTemplate = useCallback((templateData, template) => {
    if (!templateData) {
      setAppliedTemplateId(null);
      return;
    }

    setData(prev => ({
      ...prev,
      complaint: {
        ...prev.complaint,
        motif: templateData.complaint?.motif || prev.complaint?.motif || '',
        duration: templateData.complaint?.duration || prev.complaint?.duration || '',
        notes: templateData.complaint?.notes || prev.complaint?.notes || ''
      },
      diagnostic: {
        ...prev.diagnostic,
        diagnoses: [
          ...(prev.diagnostic?.diagnoses || []),
          ...templateData.diagnoses.filter(d =>
            !(prev.diagnostic?.diagnoses || []).some(existing => existing.code === d.code)
          ).map((d, i) => ({
            ...d,
            isPrimary: (prev.diagnostic?.diagnoses || []).length === 0 && i === 0,
            addedAt: new Date().toISOString()
          }))
        ],
        procedures: [
          ...(prev.diagnostic?.procedures || []),
          ...templateData.procedures.filter(p =>
            !(prev.diagnostic?.procedures || []).some(existing => existing.code === p.code)
          )
        ]
      },
      prescription: {
        ...prev.prescription,
        medications: [
          ...(prev.prescription?.medications || []),
          ...templateData.medications.filter(m =>
            !(prev.prescription?.medications || []).some(existing => existing.name === m.name)
          )
        ]
      },
      _templateApplied: {
        id: template._id,
        name: template.name,
        appliedAt: new Date().toISOString()
      }
    }));

    setAppliedTemplateId(template._id);
    setHasChanges(true);
  }, []);

  return {
    // Data
    data,
    expandedSections,
    commonMedications,
    loadingMedications,

    // Save state
    saving,
    lastSaved,
    hasChanges,

    // Template
    appliedTemplateId,

    // Actions
    updateSection,
    toggleSection,
    handleSave,
    handleApplyTemplate
  };
}
