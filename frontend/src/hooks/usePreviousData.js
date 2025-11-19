import { useState, useEffect, useCallback } from 'react';
import ophthalmologyService from '../services/ophthalmologyService';
import prescriptionService from '../services/prescriptionService';

/**
 * Hook to fetch and manage previous exam/prescription data for copy functionality
 */
export function usePreviousRefraction(patientId) {
  const [previousExam, setPreviousExam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setPreviousExam(null);
      return;
    }

    const fetchPreviousExam = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await ophthalmologyService.getPatientExams(patientId, { limit: 1 });
        const exams = response.data || response || [];
        if (exams.length > 0) {
          setPreviousExam(exams[0]);
        } else {
          setPreviousExam(null);
        }
      } catch (err) {
        console.error('Error fetching previous exam:', err);
        setError(err.message);
        setPreviousExam(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviousExam();
  }, [patientId]);

  // Copy visual acuity data
  const copyVisualAcuity = useCallback(() => {
    if (!previousExam?.visualAcuity) return null;
    return { ...previousExam.visualAcuity };
  }, [previousExam]);

  // Copy objective refraction data
  const copyObjectiveRefraction = useCallback(() => {
    if (!previousExam?.objectiveRefraction) return null;
    return { ...previousExam.objectiveRefraction };
  }, [previousExam]);

  // Copy subjective refraction data
  const copySubjectiveRefraction = useCallback(() => {
    if (!previousExam?.subjectiveRefraction) return null;
    return { ...previousExam.subjectiveRefraction };
  }, [previousExam]);

  // Copy keratometry data
  const copyKeratometry = useCallback(() => {
    if (!previousExam?.keratometry) return null;
    return { ...previousExam.keratometry };
  }, [previousExam]);

  // Copy additional tests data
  const copyAdditionalTests = useCallback(() => {
    if (!previousExam?.additionalTests) return null;
    return { ...previousExam.additionalTests };
  }, [previousExam]);

  // Copy final prescription data
  const copyFinalPrescription = useCallback(() => {
    if (!previousExam?.finalPrescription) return null;
    return { ...previousExam.finalPrescription };
  }, [previousExam]);

  // Copy all refraction data
  const copyAllRefraction = useCallback(() => {
    if (!previousExam) return null;
    return {
      visualAcuity: previousExam.visualAcuity ? { ...previousExam.visualAcuity } : null,
      objectiveRefraction: previousExam.objectiveRefraction ? { ...previousExam.objectiveRefraction } : null,
      subjectiveRefraction: previousExam.subjectiveRefraction ? { ...previousExam.subjectiveRefraction } : null,
      keratometry: previousExam.keratometry ? { ...previousExam.keratometry } : null,
      additionalTests: previousExam.additionalTests ? { ...previousExam.additionalTests } : null,
      finalPrescription: previousExam.finalPrescription ? { ...previousExam.finalPrescription } : null
    };
  }, [previousExam]);

  return {
    previousExam,
    loading,
    error,
    hasPreviousExam: !!previousExam,
    copyVisualAcuity,
    copyObjectiveRefraction,
    copySubjectiveRefraction,
    copyKeratometry,
    copyAdditionalTests,
    copyFinalPrescription,
    copyAllRefraction
  };
}

/**
 * Hook to fetch and manage previous prescription data
 */
export function usePreviousPrescription(patientId) {
  const [previousPrescription, setPreviousPrescription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patientId) {
      setPreviousPrescription(null);
      return;
    }

    const fetchPreviousPrescription = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await prescriptionService.getPrescriptions({
          patient: patientId,
          limit: 1,
          sort: '-createdAt'
        });
        const prescriptions = response.data || response || [];
        if (prescriptions.length > 0) {
          setPreviousPrescription(prescriptions[0]);
        } else {
          setPreviousPrescription(null);
        }
      } catch (err) {
        console.error('Error fetching previous prescription:', err);
        setError(err.message);
        setPreviousPrescription(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviousPrescription();
  }, [patientId]);

  // Copy medications from previous prescription
  const copyMedications = useCallback(() => {
    if (!previousPrescription?.medications) return [];
    return previousPrescription.medications.map(med => ({
      ...med,
      _id: undefined, // Remove IDs so new ones are generated
      id: undefined
    }));
  }, [previousPrescription]);

  // Copy optical prescription data
  const copyOpticalPrescription = useCallback(() => {
    if (!previousPrescription) return null;
    return {
      od: previousPrescription.od ? { ...previousPrescription.od } : null,
      os: previousPrescription.os ? { ...previousPrescription.os } : null,
      pupillaryDistance: previousPrescription.pupillaryDistance,
      lensType: previousPrescription.lensType,
      recommendations: previousPrescription.recommendations
    };
  }, [previousPrescription]);

  // Create renewal prescription
  const createRenewal = useCallback(() => {
    if (!previousPrescription) return null;
    return {
      ...previousPrescription,
      _id: undefined,
      id: undefined,
      date: new Date().toISOString(),
      status: 'draft',
      isRenewal: true,
      renewedFrom: previousPrescription._id || previousPrescription.id,
      medications: previousPrescription.medications?.map(med => ({
        ...med,
        _id: undefined,
        id: undefined
      })) || []
    };
  }, [previousPrescription]);

  return {
    previousPrescription,
    loading,
    error,
    hasPreviousPrescription: !!previousPrescription,
    copyMedications,
    copyOpticalPrescription,
    createRenewal
  };
}

export default { usePreviousRefraction, usePreviousPrescription };
