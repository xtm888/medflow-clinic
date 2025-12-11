import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, User, Phone, Building2, Briefcase } from 'lucide-react';
import { toast } from 'react-toastify';
import Wizard from '../Wizard';
import BiometricStep from './BiometricStep';
import PersonalInfoStep from './PersonalInfoStep';
import ContactInfoStep from './ContactInfoStep';
import InsuranceStep from './InsuranceStep';
import MedicalHistoryStep from './MedicalHistoryStep';
import medicationService from '../../services/medicationService';
import referrerService from '../../services/referrerService';
import { searchCompanies } from '../../services/companyService';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/apiConfig';
import queueService from '../../services/queueService';

/**
 * Patient Registration Wizard - Main Orchestrator
 *
 * 5-step wizard for registering new patients:
 * 0. Photo Capture & Duplicate Check (biometric)
 * 1. Personal Information (name, DOB, gender)
 * 2. Contact Details (phone, email, address)
 * 3. Convention / Company (employer/insurance)
 * 4. Medical Information (blood type, allergies, medications)
 */
const PatientRegistrationWizard = ({ onClose, onSubmit, onSelectExistingPatient }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});

  // Form data state
  const [formData, setFormData] = useState({
    // Step 0: Photo / Biometric
    capturedPhoto: null,
    faceEncoding: null,
    biometricConsent: false,
    duplicateCheckPassed: false,

    // Step 1: Personal Info
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',

    // Step 2: Contact
    phoneNumber: '',
    email: '',
    address: '',
    city: '',
    country: 'RDC',

    // Step 3: Convention/Company
    convention: {
      hasConvention: false,
      company: null,
      companyName: '',
      employeeId: '',
      jobTitle: '',
      department: '',
      beneficiaryType: 'employee',
      primaryEmployee: null,
      notes: ''
    },

    // Step 4: Medical
    bloodType: '',
    allergies: '',
    insurance: '',
    vip: false,
    priority: 'normal',
    medications: [],
    referrer: '',
    externalReferenceNumber: ''
  });

  // Photo capture state
  const [showCamera, setShowCamera] = useState(false);
  const [showDuplicateCheck, setShowDuplicateCheck] = useState(false);
  const [duplicateCheckStatus, setDuplicateCheckStatus] = useState('idle');
  const [duplicateCheckResults, setDuplicateCheckResults] = useState(null);

  // Referrers list
  const [referrers, setReferrers] = useState([]);
  const [loadingReferrers, setLoadingReferrers] = useState(false);

  // Company search state
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Medication search state
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [searchingMedications, setSearchingMedications] = useState(false);
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);

  // Load referrers on mount
  useEffect(() => {
    const loadReferrers = async () => {
      setLoadingReferrers(true);
      try {
        const result = await referrerService.getReferrers({ isActive: 'true' });
        setReferrers(result.data || []);
      } catch (error) {
        console.error('Error loading referrers:', error);
        setReferrers([]);
      } finally {
        setLoadingReferrers(false);
      }
    };
    loadReferrers();
  }, []);

  // Search medications with debounce
  useEffect(() => {
    if (medicationSearch.length < 2) {
      setMedicationResults([]);
      setShowMedicationDropdown(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setSearchingMedications(true);
      try {
        const result = await medicationService.searchMedications(medicationSearch, { limit: 10 });
        setMedicationResults(result.data || []);
        setShowMedicationDropdown(true);
      } catch (error) {
        console.error('Medication search error:', error);
        setMedicationResults([]);
      } finally {
        setSearchingMedications(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [medicationSearch]);

  // Search companies with debounce
  useEffect(() => {
    if (companySearch.length < 2) {
      setCompanyResults([]);
      setShowCompanyDropdown(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const result = await searchCompanies(companySearch);
        setCompanyResults(result.data || []);
        setShowCompanyDropdown(true);
      } catch (error) {
        console.error('Company search error:', error);
        setCompanyResults([]);
      } finally {
        setSearchingCompanies(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [companySearch]);

  // Async duplicate check - runs in background after photo capture
  const runAsyncDuplicateCheck = useCallback(async (imageData) => {
    if (!imageData) return;

    setDuplicateCheckStatus('checking');
    setDuplicateCheckResults(null);

    try {
      const response = await api.post('/face-recognition/check-duplicates', {
        image: imageData
      });

      setDuplicateCheckResults(response.data);

      if (response.data.serviceUnavailable) {
        setDuplicateCheckStatus('complete');
        setFormData(prev => ({
          ...prev,
          duplicateCheckPassed: true
        }));
      } else if (!response.data.hasPossibleDuplicates) {
        setDuplicateCheckStatus('complete');
        setFormData(prev => ({
          ...prev,
          faceEncoding: response.data.newEncoding,
          duplicateCheckPassed: true,
          biometricConsent: true
        }));
      } else {
        setDuplicateCheckStatus('duplicates_found');
      }
    } catch (err) {
      console.error('Async duplicate check error:', err);
      setDuplicateCheckStatus('error');
    }
  }, []);

  // Wizard steps configuration
  const steps = [
    {
      label: 'Photo',
      title: 'Photo du patient',
      description: 'Capture photo et vérification d\'identité',
      icon: Camera
    },
    {
      label: 'Personnel',
      title: 'Informations personnelles',
      description: 'Nom, date de naissance et sexe du patient',
      icon: User
    },
    {
      label: 'Contact',
      title: 'Coordonnées',
      description: 'Téléphone, email et adresse',
      icon: Phone
    },
    {
      label: 'Convention',
      title: 'Convention / Entreprise',
      description: 'Employeur ou assurance du patient',
      icon: Building2
    },
    {
      label: 'Médical',
      title: 'Informations médicales',
      description: 'Groupe sanguin, allergies et médicaments',
      icon: Briefcase
    }
  ];

  // Validation functions
  const validateStep0 = () => {
    if (!formData.capturedPhoto) {
      setErrors({ photo: 'La capture de photo est obligatoire' });
      return false;
    }

    if (!isAdmin && duplicateCheckStatus === 'duplicates_found' && duplicateCheckResults?.potentialDuplicates) {
      const hasHighSimilarity = duplicateCheckResults.potentialDuplicates.some(match => match.confidence >= 0.5);
      if (hasHighSimilarity) {
        setErrors({ photo: 'Ressemblance trop élevée (≥50%). Sélectionnez le patient existant.' });
        setShowDuplicateCheck(true);
        return false;
      }
    }

    if (isAdmin && formData.adminDuplicateOverride) {
      return true;
    }

    if (!formData.duplicateCheckPassed) {
      setErrors({ photo: 'Vérification des doublons requise' });
      return false;
    }

    return true;
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'Le prénom doit contenir au moins 2 caractères';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Le nom doit contenir au moins 2 caractères';
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = 'La date de naissance est requise';
    } else {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      if (dob > today) {
        newErrors.dateOfBirth = 'La date de naissance ne peut pas être dans le futur';
      }
    }

    if (!formData.gender) {
      newErrors.gender = 'Le sexe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Le téléphone est requis';
    } else if (!/^\+?[0-9\s-]{10,}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Format invalide (ex: +243 81 234 5678)';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};

    if (formData.convention.hasConvention && !formData.convention.company) {
      newErrors.company = 'Veuillez sélectionner une entreprise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    return true;
  };

  // Step handlers
  const handleStepChange = (newStep) => {
    let isValid = true;
    if (newStep > currentStep) {
      if (currentStep === 0) isValid = validateStep0();
      else if (currentStep === 1) isValid = validateStep1();
      else if (currentStep === 2) isValid = validateStep2();
      else if (currentStep === 3) isValid = validateStep3();
      else if (currentStep === 4) isValid = validateStep4();
    }

    if (isValid || newStep < currentStep) {
      setCurrentStep(newStep);
      setErrors({});
    }
  };

  // Photo handlers
  const handlePhotoCapture = (imageData) => {
    setFormData(prev => ({ ...prev, capturedPhoto: imageData }));
    setShowCamera(false);
    setShowDuplicateCheck(true);
    runAsyncDuplicateCheck(imageData);
  };

  const handleNoDuplicates = (encoding) => {
    setFormData(prev => ({
      ...prev,
      faceEncoding: encoding,
      duplicateCheckPassed: true,
      biometricConsent: true
    }));
    setShowDuplicateCheck(false);
    setDuplicateCheckStatus('complete');
    setCurrentStep(1);
  };

  const handleSelectExisting = (patient) => {
    if (onSelectExistingPatient) {
      onSelectExistingPatient(patient);
    }
    onClose();
  };

  const handleViewProfile = (patientId) => {
    onClose();
    navigate(`/patients/${patientId}`);
  };

  const handleAddToQueue = async (patient) => {
    try {
      await queueService.checkIn({
        walkIn: true,
        patientId: patient._id || patient.patientId,
        patientInfo: {
          firstName: patient.firstName || patient.name?.split(' ')[0],
          lastName: patient.lastName || patient.name?.split(' ').slice(1).join(' '),
          phoneNumber: patient.phone || patient.phoneNumber
        },
        reason: 'Walk-in consultation',
        priority: patient.vip ? 'vip' : 'normal'
      });
      toast.success(`${patient.name || patient.firstName} ajouté à la file d'attente`);
      onClose();
      navigate('/queue');
    } catch (err) {
      console.error('Failed to add to queue:', err);
      toast.error('Erreur lors de l\'ajout à la file');
    }
  };

  const handleProceedAnyway = (encoding) => {
    if (!isAdmin) {
      toast.error('Seul un administrateur peut créer un patient malgré les doublons détectés');
      return;
    }

    setFormData(prev => ({
      ...prev,
      faceEncoding: encoding,
      duplicateCheckPassed: true,
      biometricConsent: true,
      adminDuplicateOverride: true
    }));
    setShowDuplicateCheck(false);
    setDuplicateCheckStatus('complete');
    setCurrentStep(1);
  };

  const handleCancelDuplicateCheck = () => {
    setShowDuplicateCheck(false);
    setFormData(prev => ({
      ...prev,
      capturedPhoto: null,
      faceEncoding: null,
      duplicateCheckPassed: false
    }));
    setDuplicateCheckResults(null);
    setDuplicateCheckStatus('idle');
  };

  const handleRetakePhoto = () => {
    setFormData(prev => ({ ...prev, capturedPhoto: null, duplicateCheckPassed: false }));
    setShowCamera(true);
  };

  // Company handlers
  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setCompanySearch(company.name);
    setShowCompanyDropdown(false);
    setFormData(prev => ({
      ...prev,
      convention: {
        ...prev.convention,
        hasConvention: true,
        company: company._id,
        companyName: company.name
      }
    }));
  };

  const handleClearCompany = () => {
    setSelectedCompany(null);
    setCompanySearch('');
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
        primaryEmployee: null,
        notes: ''
      }
    }));
  };

  // Medication handlers
  const handleAddMedication = (medication) => {
    const newMed = {
      name: medication.name,
      dosage: '',
      frequency: '',
      reason: ''
    };
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, newMed]
    }));
    setMedicationSearch('');
    setMedicationResults([]);
    setShowMedicationDropdown(false);
  };

  const handleRemoveMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateMedication = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  // Generic field change handler
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Convention field change handler
  const handleConventionChange = (hasConvention, field, value) => {
    if (field) {
      setFormData(prev => ({
        ...prev,
        convention: { ...prev.convention, [field]: value }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        convention: { ...prev.convention, hasConvention }
      }));
    }
  };

  // Form submission
  const handleComplete = async () => {
    if (!validateStep4()) return;

    if (!isAdmin && formData.capturedPhoto) {
      if (duplicateCheckStatus === 'checking') {
        setErrors({ submission: 'Vérification des doublons en cours...' });
        return;
      }

      if (duplicateCheckStatus === 'duplicates_found') {
        setShowDuplicateCheck(true);
        return;
      }

      if (duplicateCheckStatus === 'error') {
        runAsyncDuplicateCheck(formData.capturedPhoto);
        setErrors({ submission: 'Réessai de la vérification...' });
        return;
      }
    }

    try {
      const allergiesArray = formData.allergies
        ? formData.allergies.split(',').map(a => ({ allergen: a.trim() }))
        : [];

      const patientData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phoneNumber: formData.phoneNumber,
        address: {
          street: formData.address || '',
          city: formData.city || '',
          country: formData.country || 'RD Congo'
        },
        photoUrl: formData.capturedPhoto
      };

      if (formData.email) patientData.email = formData.email;
      if (formData.bloodType) patientData.bloodType = formData.bloodType;

      if (formData.insurance) {
        patientData.insurance = { provider: formData.insurance };
      }

      if (allergiesArray.length > 0) {
        patientData.medicalHistory = { allergies: allergiesArray };
      }

      if (formData.medications && formData.medications.length > 0) {
        patientData.medications = formData.medications;
      }

      if (formData.vip) patientData.vip = formData.vip;
      if (formData.priority && formData.priority !== 'normal') {
        patientData.priority = formData.priority;
      }

      if (formData.referrer) patientData.referrer = formData.referrer;
      if (formData.externalReferenceNumber) {
        patientData.externalReferenceNumber = formData.externalReferenceNumber;
      }

      if (formData.convention.hasConvention && formData.convention.company) {
        patientData.convention = {
          company: formData.convention.company,
          employeeId: formData.convention.employeeId,
          jobTitle: formData.convention.jobTitle,
          department: formData.convention.department,
          beneficiaryType: formData.convention.beneficiaryType,
          primaryEmployee: formData.convention.primaryEmployee,
          notes: formData.convention.notes,
          isActive: true,
          enrollmentDate: new Date().toISOString()
        };

        if (!formData.insurance && formData.convention.companyName) {
          patientData.insurance = { provider: formData.convention.companyName };
        }
      }

      if (formData.faceEncoding) {
        patientData.biometric = {
          faceEncoding: formData.faceEncoding,
          consentGiven: formData.biometricConsent,
          consentDate: formData.biometricConsent ? new Date().toISOString() : null
        };
      }

      if (formData.adminDuplicateOverride) {
        patientData.adminDuplicateOverride = formData.adminDuplicateOverride;
      }

      await onSubmit(patientData);
    } catch (error) {
      console.error('Error submitting patient:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Close Button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        {/* Wizard */}
        <Wizard
          steps={steps}
          currentStep={currentStep}
          onStepChange={handleStepChange}
          onComplete={handleComplete}
          hideNavigation={showDuplicateCheck || showCamera}
        >
          {currentStep === 0 && (
            <BiometricStep
              formData={formData}
              errors={errors}
              showCamera={showCamera}
              showDuplicateCheck={showDuplicateCheck}
              duplicateCheckStatus={duplicateCheckStatus}
              duplicateCheckResults={duplicateCheckResults}
              isAdmin={isAdmin}
              onPhotoCapture={handlePhotoCapture}
              onShowCamera={setShowCamera}
              onShowDuplicateCheck={setShowDuplicateCheck}
              onNoDuplicates={handleNoDuplicates}
              onSelectExisting={handleSelectExisting}
              onProceedAnyway={handleProceedAnyway}
              onViewProfile={handleViewProfile}
              onAddToQueue={handleAddToQueue}
              onCancelDuplicateCheck={handleCancelDuplicateCheck}
              onRetakePhoto={handleRetakePhoto}
              onBiometricConsentChange={(value) => handleChange('biometricConsent', value)}
            />
          )}

          {currentStep === 1 && (
            <PersonalInfoStep
              formData={formData}
              errors={errors}
              duplicateCheckStatus={duplicateCheckStatus}
              onChange={handleChange}
              onShowDuplicateCheck={() => setShowDuplicateCheck(true)}
              onRetryDuplicateCheck={() => runAsyncDuplicateCheck(formData.capturedPhoto)}
            />
          )}

          {currentStep === 2 && (
            <ContactInfoStep
              formData={formData}
              errors={errors}
              onChange={handleChange}
            />
          )}

          {currentStep === 3 && (
            <InsuranceStep
              formData={formData}
              errors={errors}
              companySearch={companySearch}
              companyResults={companyResults}
              searchingCompanies={searchingCompanies}
              showCompanyDropdown={showCompanyDropdown}
              selectedCompany={selectedCompany}
              onCompanySearchChange={setCompanySearch}
              onSelectCompany={handleSelectCompany}
              onClearCompany={handleClearCompany}
              onConventionChange={handleConventionChange}
            />
          )}

          {currentStep === 4 && (
            <MedicalHistoryStep
              formData={formData}
              errors={errors}
              duplicateCheckStatus={duplicateCheckStatus}
              medicationSearch={medicationSearch}
              medicationResults={medicationResults}
              searchingMedications={searchingMedications}
              showMedicationDropdown={showMedicationDropdown}
              referrers={referrers}
              loadingReferrers={loadingReferrers}
              onChange={handleChange}
              onMedicationSearchChange={setMedicationSearch}
              onAddMedication={handleAddMedication}
              onRemoveMedication={handleRemoveMedication}
              onUpdateMedication={handleUpdateMedication}
            />
          )}
        </Wizard>
      </div>
    </div>
  );
};

export default PatientRegistrationWizard;
