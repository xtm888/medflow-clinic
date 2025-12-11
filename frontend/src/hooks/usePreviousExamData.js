import { useState, useEffect, useCallback } from 'react';
import ophthalmologyService from '../services/ophthalmologyService';

/**
 * Hook to fetch and manage previous exam data for pre-filling consultation forms
 *
 * Features:
 * - Fetches most recent completed exam for patient
 * - Provides functions to copy individual fields or all data
 * - Tracks what has been copied for diff highlighting
 * - Supports keyboard shortcut (Alt+P) integration
 *
 * @param {string} patientId - Patient ID to fetch history for
 * @param {object} currentData - Current form data (for diff comparison)
 * @returns {object} { previousData, loading, error, copyField, copyAll, copiedFields, hasPreviousData }
 */
export function usePreviousExamData(patientId, currentData = {}) {
  const [previousData, setPreviousData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedFields, setCopiedFields] = useState(new Set());

  // Fetch previous exam data
  useEffect(() => {
    if (!patientId) {
      setPreviousData(null);
      return;
    }

    const fetchPreviousData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get refraction history (most recent completed exams)
        const response = await ophthalmologyService.getRefractionHistory(patientId, 1);

        if (response?.data?.length > 0) {
          const lastExam = response.data[0];

          // Structure the data for easy form pre-filling
          const structuredData = {
            examId: lastExam._id,
            examDate: lastExam.createdAt,
            visualAcuity: lastExam.visualAcuity || {
              OD: { uncorrected: '', corrected: '', pinhole: '', near: '' },
              OS: { uncorrected: '', corrected: '', pinhole: '', near: '' }
            },
            objective: lastExam.refraction?.objective || {
              OD: { sphere: '', cylinder: '', axis: '' },
              OS: { sphere: '', cylinder: '', axis: '' },
              device: 'autorefractor'
            },
            subjective: lastExam.refraction?.subjective || lastExam.refraction?.finalPrescription || {
              OD: { sphere: '', cylinder: '', axis: '', add: '' },
              OS: { sphere: '', cylinder: '', axis: '', add: '' },
              pd: { distance: '', near: '' }
            },
            keratometry: lastExam.keratometry || {
              OD: { k1: '', k1Axis: '', k2: '', k2Axis: '' },
              OS: { k1: '', k1Axis: '', k2: '', k2Axis: '' }
            },
            iop: lastExam.iop || {
              OD: { value: '', method: '' },
              OS: { value: '', method: '' }
            },
            diagnoses: lastExam.assessment?.diagnoses || [],
            rawData: lastExam
          };

          setPreviousData(structuredData);
        } else {
          setPreviousData(null);
        }
      } catch (err) {
        console.error('Error fetching previous exam data:', err);
        setError(err.message || 'Erreur lors du chargement des données précédentes');
        setPreviousData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviousData();
  }, [patientId]);

  // Copy a specific field from previous data
  const copyField = useCallback((fieldPath) => {
    if (!previousData) return null;

    // Navigate to the field using dot notation (e.g., 'visualAcuity.OD.uncorrected')
    const keys = fieldPath.split('.');
    let value = previousData;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    // Track that this field was copied
    setCopiedFields(prev => new Set([...prev, fieldPath]));

    return value;
  }, [previousData]);

  // Copy all refraction data (VA, objective, subjective, keratometry)
  const copyAllRefraction = useCallback(() => {
    if (!previousData) return null;

    const refractionData = {
      visualAcuity: previousData.visualAcuity,
      objective: previousData.objective,
      subjective: previousData.subjective,
      keratometry: previousData.keratometry
    };

    // Track all fields as copied
    setCopiedFields(new Set([
      'visualAcuity', 'objective', 'subjective', 'keratometry'
    ]));

    return refractionData;
  }, [previousData]);

  // Copy visual acuity only
  const copyVisualAcuity = useCallback(() => {
    if (!previousData?.visualAcuity) return null;
    setCopiedFields(prev => new Set([...prev, 'visualAcuity']));
    return previousData.visualAcuity;
  }, [previousData]);

  // Copy objective refraction only
  const copyObjective = useCallback(() => {
    if (!previousData?.objective) return null;
    setCopiedFields(prev => new Set([...prev, 'objective']));
    return previousData.objective;
  }, [previousData]);

  // Copy subjective refraction only
  const copySubjective = useCallback(() => {
    if (!previousData?.subjective) return null;
    setCopiedFields(prev => new Set([...prev, 'subjective']));
    return previousData.subjective;
  }, [previousData]);

  // Copy for a specific eye (OD or OS)
  const copyEye = useCallback((eye) => {
    if (!previousData) return null;

    const eyeData = {
      visualAcuity: previousData.visualAcuity?.[eye],
      objective: previousData.objective?.[eye],
      subjective: previousData.subjective?.[eye],
      keratometry: previousData.keratometry?.[eye]
    };

    setCopiedFields(prev => new Set([
      ...prev,
      `visualAcuity.${eye}`,
      `objective.${eye}`,
      `subjective.${eye}`,
      `keratometry.${eye}`
    ]));

    return eyeData;
  }, [previousData]);

  // Check if a field was copied from previous
  const wasFieldCopied = useCallback((fieldPath) => {
    return copiedFields.has(fieldPath);
  }, [copiedFields]);

  // Reset copied fields tracking
  const resetCopiedFields = useCallback(() => {
    setCopiedFields(new Set());
  }, []);

  // Format prescription for display
  const formatPrescription = useCallback((eye) => {
    const data = previousData?.subjective?.[eye];
    if (!data?.sphere) return '--';

    const sph = parseFloat(data.sphere);
    const cyl = parseFloat(data.cylinder) || 0;
    const axis = data.axis || '';

    const sphStr = sph >= 0 ? `+${sph.toFixed(2)}` : sph.toFixed(2);
    const cylStr = cyl !== 0 ? ` (${cyl >= 0 ? '+' : ''}${cyl.toFixed(2)}) x ${axis}°` : '';

    return `${sphStr}${cylStr}`;
  }, [previousData]);

  // Get summary of previous exam
  const getPreviousSummary = useCallback(() => {
    if (!previousData) return null;

    const date = previousData.examDate
      ? new Date(previousData.examDate).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      : 'Date inconnue';

    return {
      date,
      prescription: {
        OD: formatPrescription('OD'),
        OS: formatPrescription('OS')
      },
      visualAcuity: {
        OD: previousData.visualAcuity?.OD?.corrected || '--',
        OS: previousData.visualAcuity?.OS?.corrected || '--'
      }
    };
  }, [previousData, formatPrescription]);

  return {
    // Data
    previousData,
    loading,
    error,
    hasPreviousData: !!previousData,

    // Copy functions
    copyField,
    copyAllRefraction,
    copyVisualAcuity,
    copyObjective,
    copySubjective,
    copyEye,

    // Tracking
    copiedFields,
    wasFieldCopied,
    resetCopiedFields,

    // Display helpers
    formatPrescription,
    getPreviousSummary
  };
}

export default usePreviousExamData;
