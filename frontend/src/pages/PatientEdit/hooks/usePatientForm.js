/**
 * usePatientForm Hook
 *
 * Manages patient form state, validation, and submission.
 */

import { useState, useCallback } from 'react';
import { INITIAL_FORM_DATA } from '../constants';

export default function usePatientForm() {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});

  // Generic field change handler
  const handleChange = useCallback((field, value) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      }
      return { ...prev, [field]: value };
    });

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Set entire form data (used when loading patient)
  const setAllFormData = useCallback((data) => {
    setFormData(data);
  }, []);

  // Allergy handlers
  const handleAddAllergy = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        allergies: [
          ...prev.medicalHistory.allergies,
          { allergen: '', reaction: '', severity: 'mild' }
        ]
      }
    }));
  }, []);

  const handleUpdateAllergy = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        allergies: prev.medicalHistory.allergies.map((a, i) =>
          i === index ? { ...a, [field]: value } : a
        )
      }
    }));
  }, []);

  const handleRemoveAllergy = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        allergies: prev.medicalHistory.allergies.filter((_, i) => i !== index)
      }
    }));
  }, []);

  // Medication handlers
  const handleAddMedication = useCallback((med) => {
    setFormData(prev => ({
      ...prev,
      medications: [
        ...prev.medications,
        {
          name: med.name,
          dosage: '',
          frequency: '',
          startDate: new Date().toISOString().split('T')[0],
          reason: '',
          status: 'active'
        }
      ]
    }));
  }, []);

  const handleUpdateMedication = useCallback((index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    }));
  }, []);

  const handleRemoveMedication = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  }, []);

  // Convention handlers
  const handleSelectCompany = useCallback((company) => {
    setFormData(prev => ({
      ...prev,
      convention: {
        ...prev.convention,
        hasConvention: true,
        company: company._id,
        companyName: company.name
      }
    }));
    return company;
  }, []);

  const handleClearCompany = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      convention: {
        hasConvention: false,
        company: null,
        companyName: '',
        employeeId: '',
        jobTitle: '',
        department: '',
        beneficiaryType: 'employee',
        status: 'active',
        notes: ''
      }
    }));
  }, []);

  const handleConventionChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      convention: { ...prev.convention, [field]: value }
    }));
  }, []);

  // Validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prenom est requis';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }
    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'La date de naissance est requise';
    }
    if (!formData.gender) {
      newErrors.gender = 'Le sexe est requis';
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Le telephone est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  return {
    formData,
    errors,
    handleChange,
    setAllFormData,
    // Allergy handlers
    handleAddAllergy,
    handleUpdateAllergy,
    handleRemoveAllergy,
    // Medication handlers
    handleAddMedication,
    handleUpdateMedication,
    handleRemoveMedication,
    // Convention handlers
    handleSelectCompany,
    handleClearCompany,
    handleConventionChange,
    // Validation
    validateForm
  };
}
