/**
 * PatientEdit Page - Main Component
 *
 * Orchestrates patient editing with modular components.
 * Reduced from ~1400 lines to ~200 lines through modularization.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import logger from '../../services/logger';
import { useAuth } from '../../contexts/AuthContext';
import patientService from '../../services/patientService';
import FaceVerification from '../../components/biometric/FaceVerification';

// Constants and helpers
import { mapPatientToFormData } from './constants';

// Hooks
import { usePatientForm, useMedicationSearch, useCompanySearch } from './hooks';

// Components
import {
  PatientEditHeader,
  SectionNavigation,
  PersonalInfoSection,
  ContactSection,
  EmergencyContactSection,
  MedicalInfoSection,
  MedicationsSection,
  ConventionSection,
  PreferencesSection
} from './components';

// Helper to validate MongoDB ObjectId format
const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

export default function PatientEdit() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Form hook
  const {
    formData,
    errors,
    handleChange,
    setAllFormData,
    handleAddAllergy,
    handleUpdateAllergy,
    handleRemoveAllergy,
    handleAddMedication,
    handleUpdateMedication,
    handleRemoveMedication,
    handleSelectCompany,
    handleClearCompany,
    handleConventionChange,
    validateForm
  } = usePatientForm();

  // Search hooks
  const medicationSearch = useMedicationSearch();
  const companySearch = useCompanySearch();

  // Load patient data
  const loadPatient = useCallback(async () => {
    // Validate patientId format before API call
    if (!patientId || !isValidObjectId(patientId)) {
      setLoadError('ID patient invalide');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const response = await patientService.getPatient(patientId);
      const patientData = response.data;

      if (!patientData) {
        setLoadError('Patient non trouvé');
        setLoading(false);
        return;
      }

      setPatient(patientData);

      // Map patient data to form
      setAllFormData(mapPatientToFormData(patientData));

      if (patientData.photoUrl) {
        setPhotoPreview(patientData.photoUrl);
      }

      // Initialize company if convention exists
      if (patientData.convention?.company) {
        const companyData = typeof patientData.convention.company === 'object'
          ? patientData.convention.company
          : { _id: patientData.convention.company, name: patientData.convention.companyName };
        companySearch.initializeWithCompany(companyData);
      }
    } catch (err) {
      logger.error('Error loading patient:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Erreur lors du chargement du patient';
      setLoadError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [patientId, setAllFormData, companySearch]);

  useEffect(() => {
    if (patientId) {
      loadPatient();
    } else {
      setLoadError('ID patient manquant');
      setLoading(false);
    }
  }, [patientId]);

  // Face verification check
  useEffect(() => {
    if (!patient) return;

    const isDoctorRole = ['doctor', 'ophthalmologist', 'admin', 'nurse'].includes(user?.role);

    if (isDoctorRole && patient?.biometric?.faceEncoding) {
      const sessionKey = `faceVerified_${patient._id || patient.id}`;
      const alreadyVerified = sessionStorage.getItem(sessionKey);

      if (alreadyVerified === 'true') {
        setVerificationPassed(true);
      } else {
        setShowVerification(true);
        setVerificationPassed(false);
      }
    } else {
      setVerificationPassed(true);
    }
  }, [patient, user]);

  // Photo change handler
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      await patientService.uploadPatientPhoto(patientId, file);
      toast.success('Photo mise a jour');
    } catch (err) {
      toast.error('Erreur lors du telechargement de la photo');
    }
  };

  // Form submission
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs');
      return;
    }

    try {
      setSaving(true);
      await patientService.updatePatient(patientId, formData);
      toast.success('Patient mis a jour avec succes');
      navigate(`/patients/${patientId}`);
    } catch (err) {
      toast.error('Erreur lors de la mise a jour');
      logger.error('Error updating patient:', err);
    } finally {
      setSaving(false);
    }
  };

  // Company selection wrapper
  const onSelectCompany = (company) => {
    handleSelectCompany(company);
    companySearch.selectCompany(company);
  };

  const onClearCompany = () => {
    handleClearCompany();
    companySearch.clearCompany();
  };

  // Show face verification modal
  if (showVerification && patient) {
    return (
      <FaceVerification
        patient={patient}
        onVerified={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${patient._id || patient.id}`, 'true');
        }}
        onSkip={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${patient._id || patient.id}`, 'true');
        }}
        onCancel={() => navigate(-1)}
        allowSkip={user?.role === 'admin'}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement du patient...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="bg-red-100 rounded-full p-4 inline-block mb-4">
            <svg className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erreur de chargement</h2>
          <p className="text-gray-600 mb-4">{loadError}</p>
          <button
            onClick={() => navigate('/patients')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retour à la liste des patients
          </button>
        </div>
      </div>
    );
  }

  if (patient && !verificationPassed) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verification en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PatientEditHeader
        patientName={`${formData.firstName} ${formData.lastName}`}
        patientId={patientId}
        saving={saving}
        onBack={() => navigate(`/patients/${patientId}`)}
        onCancel={() => navigate(`/patients/${patientId}`)}
        onSave={handleSubmit}
      />

      <div className="flex">
        <SectionNavigation
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />

        <div className="flex-1 p-6">
          <form onSubmit={handleSubmit} className="max-w-3xl">
            {activeSection === 'personal' && (
              <PersonalInfoSection
                formData={formData}
                errors={errors}
                photoPreview={photoPreview}
                handleChange={handleChange}
                onPhotoChange={handlePhotoChange}
              />
            )}

            {activeSection === 'contact' && (
              <ContactSection
                formData={formData}
                errors={errors}
                handleChange={handleChange}
              />
            )}

            {activeSection === 'emergency' && (
              <EmergencyContactSection
                formData={formData}
                handleChange={handleChange}
              />
            )}

            {activeSection === 'medical' && (
              <MedicalInfoSection
                formData={formData}
                handleChange={handleChange}
                handleAddAllergy={handleAddAllergy}
                handleUpdateAllergy={handleUpdateAllergy}
                handleRemoveAllergy={handleRemoveAllergy}
              />
            )}

            {activeSection === 'medications' && (
              <MedicationsSection
                formData={formData}
                medicationSearch={medicationSearch.searchTerm}
                setMedicationSearch={medicationSearch.setSearchTerm}
                medicationResults={medicationSearch.results}
                searchingMeds={medicationSearch.searching}
                handleAddMedication={(med) => {
                  handleAddMedication(med);
                  medicationSearch.clearSearch();
                }}
                handleUpdateMedication={handleUpdateMedication}
                handleRemoveMedication={handleRemoveMedication}
              />
            )}

            {activeSection === 'convention' && (
              <ConventionSection
                formData={formData}
                companySearch={companySearch.searchTerm}
                setCompanySearch={companySearch.setSearchTerm}
                companyResults={companySearch.results}
                searchingCompanies={companySearch.searching}
                showCompanyDropdown={companySearch.showDropdown}
                selectedCompany={companySearch.selectedCompany}
                handleSelectCompany={onSelectCompany}
                handleClearCompany={onClearCompany}
                handleConventionChange={handleConventionChange}
              />
            )}

            {activeSection === 'preferences' && (
              <PreferencesSection
                formData={formData}
                handleChange={handleChange}
              />
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
