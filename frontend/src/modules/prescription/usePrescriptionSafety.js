import { useState, useCallback, useMemo } from 'react';
import {
  checkAllergies,
  checkDrugInteractions,
  checkAgeAppropriateDosing
} from '../../utils/prescriptionSafety';

/**
 * usePrescriptionSafety - Hook for prescription safety checks
 *
 * Centralizes safety validation logic used across:
 * - PatientVisit
 * - Prescriptions page
 * - Quick prescriptions
 *
 * Features:
 * - Allergy checking
 * - Drug interaction detection
 * - Age-appropriate dosing validation
 * - Warning aggregation
 */
export default function usePrescriptionSafety(options = {}) {
  const {
    patientAllergies = [],
    currentMedications = [],
    patientAge = null
  } = options;

  const [warnings, setWarnings] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  // Check a single medication
  const checkMedication = useCallback(async (medication) => {
    const medicationWarnings = [];
    const medicationErrors = [];

    // Check allergies
    const allergyResult = checkAllergies(medication, patientAllergies);
    if (allergyResult.hasAllergy) {
      medicationErrors.push({
        type: 'allergy',
        severity: 'critical',
        message: `Allergie détectée: ${allergyResult.allergen}`,
        medication: medication.name || medication,
        details: allergyResult
      });
    }

    // Check drug interactions with current medications
    const interactionResult = checkDrugInteractions(medication, currentMedications);
    if (interactionResult.hasInteraction) {
      const severity = interactionResult.severity || 'warning';
      const item = {
        type: 'interaction',
        severity,
        message: `Interaction médicamenteuse: ${interactionResult.interactingDrug}`,
        medication: medication.name || medication,
        details: interactionResult
      };

      if (severity === 'critical') {
        medicationErrors.push(item);
      } else {
        medicationWarnings.push(item);
      }
    }

    // Check age-appropriate dosing
    if (patientAge !== null) {
      const dosingResult = checkAgeAppropriateDosing(medication, patientAge);
      if (!dosingResult.isAppropriate) {
        medicationWarnings.push({
          type: 'dosing',
          severity: 'warning',
          message: dosingResult.message || `Dosage à vérifier pour l'âge (${patientAge} ans)`,
          medication: medication.name || medication,
          details: dosingResult
        });
      }
    }

    return {
      warnings: medicationWarnings,
      errors: medicationErrors,
      isValid: medicationErrors.length === 0
    };
  }, [patientAllergies, currentMedications, patientAge]);

  // Check multiple medications
  const checkMedications = useCallback(async (medications) => {
    setIsChecking(true);

    const allWarnings = [];
    const allErrors = [];

    for (const medication of medications) {
      const result = await checkMedication(medication);
      allWarnings.push(...result.warnings);
      allErrors.push(...result.errors);
    }

    // Check interactions between new medications
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const interactionResult = checkDrugInteractions(medications[i], [medications[j]]);
        if (interactionResult.hasInteraction) {
          allWarnings.push({
            type: 'interaction',
            severity: interactionResult.severity || 'warning',
            message: `Interaction entre ${medications[i].name || medications[i]} et ${medications[j].name || medications[j]}`,
            details: interactionResult
          });
        }
      }
    }

    setWarnings(allWarnings);
    setErrors(allErrors);
    setIsChecking(false);

    return {
      warnings: allWarnings,
      errors: allErrors,
      isValid: allErrors.length === 0,
      hasCriticalIssues: allErrors.some(e => e.severity === 'critical')
    };
  }, [checkMedication]);

  // Clear all warnings and errors
  const clearSafetyChecks = useCallback(() => {
    setWarnings([]);
    setErrors([]);
  }, []);

  // Dismiss a specific warning
  const dismissWarning = useCallback((index) => {
    setWarnings(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Computed values
  const hasWarnings = useMemo(() => warnings.length > 0, [warnings]);
  const hasErrors = useMemo(() => errors.length > 0, [errors]);
  const hasCriticalErrors = useMemo(
    () => errors.some(e => e.severity === 'critical'),
    [errors]
  );

  // Group warnings by type
  const warningsByType = useMemo(() => {
    const grouped = {
      allergy: [],
      interaction: [],
      dosing: [],
      other: []
    };

    warnings.forEach(warning => {
      const type = warning.type || 'other';
      if (grouped[type]) {
        grouped[type].push(warning);
      } else {
        grouped.other.push(warning);
      }
    });

    return grouped;
  }, [warnings]);

  // Get severity color
  const getSeverityColor = useCallback((severity) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'yellow';
      case 'info':
        return 'blue';
      default:
        return 'gray';
    }
  }, []);

  return {
    // State
    warnings,
    errors,
    isChecking,
    hasWarnings,
    hasErrors,
    hasCriticalErrors,

    // Grouped data
    warningsByType,

    // Actions
    checkMedication,
    checkMedications,
    clearSafetyChecks,
    dismissWarning,

    // Helpers
    getSeverityColor
  };
}

// Standalone safety check functions for quick use
export const quickAllergyCheck = (medication, allergies) => {
  return checkAllergies(medication, allergies);
};

export const quickInteractionCheck = (medication, currentMeds) => {
  return checkDrugInteractions(medication, currentMeds);
};

export const quickDosingCheck = (medication, age) => {
  return checkAgeAppropriateDosing(medication, age);
};
