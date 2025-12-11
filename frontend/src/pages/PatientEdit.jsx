import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Heart, Pill, Plus, Trash2,
  Camera, Save, Loader2, AlertCircle, Calendar, Droplets, Building2, Search, X, CheckCircle
} from 'lucide-react';
import patientService from '../services/patientService';
import medicationService from '../services/medicationService';
import { searchCompanies } from '../services/companyService';
import { toast } from 'react-toastify';
import FaceVerification from '../components/biometric/FaceVerification';
import { useAuth } from '../contexts/AuthContext';

export default function PatientEdit() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const photoInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('personal');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [patient, setPatient] = useState(null);

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Personal Info
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    nationalId: '',
    occupation: '',
    maritalStatus: '',

    // Contact
    phoneNumber: '',
    alternativePhone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'RD Congo'
    },

    // Emergency Contact
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    },

    // Medical Info
    bloodType: '',
    medicalHistory: {
      allergies: [],
      chronicConditions: [],
      surgeries: [],
      familyHistory: []
    },
    medications: [],

    // Insurance
    insurance: {
      provider: '',
      policyNumber: '',
      groupNumber: '',
      validUntil: '',
      coverageType: '',
      copayAmount: ''
    },

    // Convention
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
    },

    // Preferences
    preferences: {
      language: 'fr',
      communicationMethod: 'phone',
      appointmentReminders: true
    },
    preferredPharmacy: '',

    // Status
    status: 'active',
    vip: false
  });

  // Medication search state
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [searchingMeds, setSearchingMeds] = useState(false);

  // Company search state
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    if (patientId) {
      loadPatient();
    }
  }, [patientId]);

  // Medication search
  useEffect(() => {
    if (medicationSearch.length < 2) {
      setMedicationResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingMeds(true);
      try {
        const result = await medicationService.searchMedications(medicationSearch, { limit: 10 });
        setMedicationResults(result.data || []);
      } catch (err) {
        console.error('Medication search error:', err);
      } finally {
        setSearchingMeds(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [medicationSearch]);

  // Company search
  useEffect(() => {
    if (companySearch.length < 2) {
      setCompanyResults([]);
      setShowCompanyDropdown(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingCompanies(true);
      try {
        const result = await searchCompanies(companySearch);
        setCompanyResults(result.data || []);
        setShowCompanyDropdown(true);
      } catch (err) {
        console.error('Company search error:', err);
        setCompanyResults([]);
      } finally {
        setSearchingCompanies(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [companySearch]);

  // Company selection handlers
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
        status: 'active',
        notes: ''
      }
    }));
  };

  // Face verification check when patient data loads
  useEffect(() => {
    if (!patient) return;

    const isDoctorRole = user?.role === 'doctor' || user?.role === 'ophthalmologist' || user?.role === 'admin' || user?.role === 'nurse';

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
      // Skip verification if not required role or patient has no biometric
      setVerificationPassed(true);
    }
  }, [patient, user]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      const response = await patientService.getPatient(patientId);
      const patientData = response.data;
      setPatient(patientData);

      // Map patient data to form
      setFormData({
        firstName: patientData.firstName || '',
        lastName: patientData.lastName || '',
        dateOfBirth: patientData.dateOfBirth ? patientData.dateOfBirth.split('T')[0] : '',
        gender: patientData.gender || '',
        nationalId: patientData.nationalId || '',
        occupation: patientData.occupation || '',
        maritalStatus: patientData.maritalStatus || '',
        phoneNumber: patientData.phoneNumber || '',
        alternativePhone: patientData.alternativePhone || '',
        email: patientData.email || '',
        address: {
          street: patientData.address?.street || '',
          city: patientData.address?.city || '',
          state: patientData.address?.state || '',
          postalCode: patientData.address?.postalCode || '',
          country: patientData.address?.country || 'RD Congo'
        },
        emergencyContact: {
          name: patientData.emergencyContact?.name || '',
          relationship: patientData.emergencyContact?.relationship || '',
          phone: patientData.emergencyContact?.phone || '',
          email: patientData.emergencyContact?.email || ''
        },
        bloodType: patientData.bloodType || '',
        medicalHistory: {
          allergies: patientData.medicalHistory?.allergies || [],
          chronicConditions: patientData.medicalHistory?.chronicConditions || [],
          surgeries: patientData.medicalHistory?.surgeries || [],
          familyHistory: patientData.medicalHistory?.familyHistory || []
        },
        medications: patientData.medications || [],
        insurance: {
          provider: patientData.insurance?.provider || '',
          policyNumber: patientData.insurance?.policyNumber || '',
          groupNumber: patientData.insurance?.groupNumber || '',
          validUntil: patientData.insurance?.validUntil ? patientData.insurance.validUntil.split('T')[0] : '',
          coverageType: patientData.insurance?.coverageType || '',
          copayAmount: patientData.insurance?.copayAmount || ''
        },
        convention: {
          hasConvention: !!patientData.convention?.company,
          company: patientData.convention?.company?._id || patientData.convention?.company || null,
          companyName: patientData.convention?.company?.name || patientData.convention?.companyName || '',
          employeeId: patientData.convention?.employeeId || '',
          jobTitle: patientData.convention?.jobTitle || '',
          department: patientData.convention?.department || '',
          beneficiaryType: patientData.convention?.beneficiaryType || 'employee',
          status: patientData.convention?.status || 'active',
          notes: patientData.convention?.notes || ''
        },
        preferences: {
          language: patientData.preferences?.language || 'fr',
          communicationMethod: patientData.preferences?.communicationMethod || 'phone',
          appointmentReminders: patientData.preferences?.appointmentReminders ?? true
        },
        preferredPharmacy: patientData.preferredPharmacy || '',
        status: patientData.status || 'active',
        vip: patientData.vip || false
      });

      if (patientData.photoUrl) {
        setPhotoPreview(patientData.photoUrl);
      }

      // Set selected company if convention exists
      if (patientData.convention?.company) {
        const companyData = typeof patientData.convention.company === 'object'
          ? patientData.convention.company
          : { _id: patientData.convention.company, name: patientData.convention.companyName };
        setSelectedCompany(companyData);
        setCompanySearch(companyData.name || '');
      }
    } catch (err) {
      toast.error('Erreur lors du chargement du patient');
      console.error('Error loading patient:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
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
  };

  const handleAddAllergy = () => {
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
  };

  const handleUpdateAllergy = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        allergies: prev.medicalHistory.allergies.map((a, i) =>
          i === index ? { ...a, [field]: value } : a
        )
      }
    }));
  };

  const handleRemoveAllergy = (index) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        allergies: prev.medicalHistory.allergies.filter((_, i) => i !== index)
      }
    }));
  };

  const handleAddMedication = (med) => {
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
    setMedicationSearch('');
    setMedicationResults([]);
  };

  const handleUpdateMedication = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      )
    }));
  };

  const handleRemoveMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);

    // Upload
    try {
      await patientService.uploadPatientPhoto(patientId, file);
      toast.success('Photo mise a jour');
    } catch (err) {
      toast.error('Erreur lors du telechargement de la photo');
    }
  };

  const validateForm = () => {
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      console.error('Error updating patient:', err);
    } finally {
      setSaving(false);
    }
  };

  // Sections for patient edit - Convention IS the insurance, no separate insurance section needed
  const sections = [
    { id: 'personal', label: 'Informations personnelles', icon: User },
    { id: 'contact', label: 'Coordonnees', icon: Phone },
    { id: 'emergency', label: 'Contact d\'urgence', icon: AlertCircle },
    { id: 'medical', label: 'Informations medicales', icon: Heart },
    { id: 'medications', label: 'Medicaments', icon: Pill },
    { id: 'convention', label: 'Convention / Assurance', icon: Building2 },
    { id: 'preferences', label: 'Preferences', icon: Calendar }
  ];

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

  // Block content until verification passed
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/patients/${patientId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Modifier le patient
                </h1>
                <p className="text-sm text-gray-500">
                  {formData.firstName} {formData.lastName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/patients/${patientId}`)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-4">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6">
          <form onSubmit={handleSubmit} className="max-w-3xl">
            {/* Personal Information */}
            {activeSection === 'personal' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Informations personnelles
                </h2>

                {/* Photo */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Patient" className="w-full h-full object-cover" />
                      ) : (
                        `${formData.firstName?.charAt(0) || ''}${formData.lastName?.charAt(0) || ''}`
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-2 bg-white rounded-full shadow border hover:bg-gray-50"
                    >
                      <Camera className="h-4 w-4 text-gray-600" />
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Photo du patient</p>
                    <p className="text-xs text-gray-400">JPG, PNG. Max 5MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prenom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleChange('firstName', e.target.value)}
                      className={`input ${errors.firstName ? 'border-red-500' : ''}`}
                    />
                    {errors.firstName && (
                      <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleChange('lastName', e.target.value)}
                      className={`input ${errors.lastName ? 'border-red-500' : ''}`}
                    />
                    {errors.lastName && (
                      <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de naissance <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className={`input ${errors.dateOfBirth ? 'border-red-500' : ''}`}
                    />
                    {errors.dateOfBirth && (
                      <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sexe <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className={`input ${errors.gender ? 'border-red-500' : ''}`}
                    >
                      <option value="">Selectionner</option>
                      <option value="male">Homme</option>
                      <option value="female">Femme</option>
                    </select>
                    {errors.gender && (
                      <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CNI / Passeport
                    </label>
                    <input
                      type="text"
                      value={formData.nationalId}
                      onChange={(e) => handleChange('nationalId', e.target.value)}
                      className="input"
                      placeholder="Numero d'identite"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Situation matrimoniale
                    </label>
                    <select
                      value={formData.maritalStatus}
                      onChange={(e) => handleChange('maritalStatus', e.target.value)}
                      className="input"
                    >
                      <option value="">Selectionner</option>
                      <option value="single">Celibataire</option>
                      <option value="married">Marie(e)</option>
                      <option value="divorced">Divorce(e)</option>
                      <option value="widowed">Veuf/Veuve</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Profession
                    </label>
                    <input
                      type="text"
                      value={formData.occupation}
                      onChange={(e) => handleChange('occupation', e.target.value)}
                      className="input"
                      placeholder="Ex: Ingenieur, Enseignant..."
                    />
                  </div>
                </div>

                {/* VIP Status */}
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="vip"
                    checked={formData.vip}
                    onChange={(e) => handleChange('vip', e.target.checked)}
                    className="h-5 w-5 rounded text-purple-600"
                  />
                  <label htmlFor="vip" className="text-sm font-medium text-purple-900">
                    Patient VIP (priorite dans la file d'attente)
                  </label>
                </div>
              </div>
            )}

            {/* Contact Information */}
            {activeSection === 'contact' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-600" />
                  Coordonnees
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telephone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handleChange('phoneNumber', e.target.value)}
                      className={`input ${errors.phoneNumber ? 'border-red-500' : ''}`}
                      placeholder="+243 XXX XXX XXX"
                    />
                    {errors.phoneNumber && (
                      <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telephone alternatif
                    </label>
                    <input
                      type="tel"
                      value={formData.alternativePhone}
                      onChange={(e) => handleChange('alternativePhone', e.target.value)}
                      className="input"
                      placeholder="+243 XXX XXX XXX"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="input"
                      placeholder="patient@email.com"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Adresse
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => handleChange('address.street', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => handleChange('address.city', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                      <input
                        type="text"
                        value={formData.address.postalCode}
                        onChange={(e) => handleChange('address.postalCode', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                      <input
                        type="text"
                        value={formData.address.state}
                        onChange={(e) => handleChange('address.state', e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                      <select
                        value={formData.address.country}
                        onChange={(e) => handleChange('address.country', e.target.value)}
                        className="input"
                      >
                        <option value="RD Congo">RD Congo</option>
                        <option value="Congo-Brazzaville">Congo-Brazzaville</option>
                        <option value="Angola">Angola</option>
                        <option value="Other">Autre</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            {activeSection === 'emergency' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Contact d'urgence
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                    <input
                      type="text"
                      value={formData.emergencyContact.name}
                      onChange={(e) => handleChange('emergencyContact.name', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                    <select
                      value={formData.emergencyContact.relationship}
                      onChange={(e) => handleChange('emergencyContact.relationship', e.target.value)}
                      className="input"
                    >
                      <option value="">Selectionner</option>
                      <option value="spouse">Conjoint(e)</option>
                      <option value="parent">Parent</option>
                      <option value="child">Enfant</option>
                      <option value="sibling">Frere/Soeur</option>
                      <option value="friend">Ami(e)</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
                    <input
                      type="tel"
                      value={formData.emergencyContact.phone}
                      onChange={(e) => handleChange('emergencyContact.phone', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.emergencyContact.email}
                      onChange={(e) => handleChange('emergencyContact.email', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Medical Information */}
            {activeSection === 'medical' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Informations medicales
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Droplets className="h-4 w-4 inline mr-1" />
                    Groupe sanguin
                  </label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) => handleChange('bloodType', e.target.value)}
                    className="input w-48"
                  >
                    <option value="">Selectionner</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                {/* Allergies */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Allergies</h3>
                    <button
                      type="button"
                      onClick={handleAddAllergy}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </button>
                  </div>

                  {formData.medicalHistory.allergies.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucune allergie enregistree</p>
                  ) : (
                    <div className="space-y-3">
                      {formData.medicalHistory.allergies.map((allergy, index) => (
                        <div key={index} className="flex items-start gap-3 bg-red-50 p-3 rounded-lg">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={allergy.allergen}
                              onChange={(e) => handleUpdateAllergy(index, 'allergen', e.target.value)}
                              className="input text-sm"
                              placeholder="Allergene"
                            />
                            <input
                              type="text"
                              value={allergy.reaction}
                              onChange={(e) => handleUpdateAllergy(index, 'reaction', e.target.value)}
                              className="input text-sm"
                              placeholder="Reaction"
                            />
                            <select
                              value={allergy.severity}
                              onChange={(e) => handleUpdateAllergy(index, 'severity', e.target.value)}
                              className="input text-sm"
                            >
                              <option value="mild">Legere</option>
                              <option value="moderate">Moderee</option>
                              <option value="severe">Severe</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAllergy(index)}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Medications */}
            {activeSection === 'medications' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-600" />
                  Medicaments actuels
                </h2>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    className="input pl-10"
                    placeholder="Rechercher un medicament..."
                  />
                  <Pill className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  {searchingMeds && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                  )}

                  {medicationResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {medicationResults.map((med, idx) => (
                        <button
                          key={med._id || idx}
                          type="button"
                          onClick={() => handleAddMedication(med)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4 text-blue-500" />
                          {med.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Medications List */}
                {formData.medications.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Aucun medicament enregistre</p>
                ) : (
                  <div className="space-y-3">
                    {formData.medications.map((med, index) => (
                      <div key={index} className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{med.name}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={med.status}
                              onChange={(e) => handleUpdateMedication(index, 'status', e.target.value)}
                              className="text-xs px-2 py-1 border rounded"
                            >
                              <option value="active">Actif</option>
                              <option value="completed">Termine</option>
                              <option value="discontinued">Arrete</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(index)}
                              className="p-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => handleUpdateMedication(index, 'dosage', e.target.value)}
                            className="input text-sm"
                            placeholder="Dosage (ex: 500mg)"
                          />
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => handleUpdateMedication(index, 'frequency', e.target.value)}
                            className="input text-sm"
                            placeholder="Frequence (ex: 2x/jour)"
                          />
                          <input
                            type="text"
                            value={med.reason}
                            onChange={(e) => handleUpdateMedication(index, 'reason', e.target.value)}
                            className="input text-sm"
                            placeholder="Raison"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Convention / Assurance */}
            {activeSection === 'convention' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-green-600" />
                  Convention / Assurance
                </h2>

                {/* Convention Toggle */}
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-green-900">Patient conventionné</h3>
                      <p className="text-sm text-green-700">Affilié à une entreprise ou assurance conventionnée</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.convention.hasConvention}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleClearCompany();
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              convention: { ...prev.convention, hasConvention: true }
                            }));
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>

                  {formData.convention.hasConvention && (
                    <div className="space-y-4 pt-4 border-t border-green-200">
                      {/* Company Search */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Entreprise / Assurance *
                        </label>
                        <div className="relative">
                          {selectedCompany ? (
                            <div className="flex items-center justify-between px-4 py-3 bg-green-100 border-2 border-green-300 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-800">{selectedCompany.name}</span>
                                {selectedCompany.companyId && (
                                  <span className="text-sm text-green-600">({selectedCompany.companyId})</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={handleClearCompany}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                value={companySearch}
                                onChange={(e) => setCompanySearch(e.target.value)}
                                className="input pl-10"
                                placeholder="Rechercher une entreprise..."
                              />
                              {searchingCompanies && (
                                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 animate-spin text-green-500" />
                              )}
                              {showCompanyDropdown && companyResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {companyResults.map((company) => (
                                    <button
                                      key={company._id}
                                      type="button"
                                      onClick={() => handleSelectCompany(company)}
                                      className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-2 border-b last:border-b-0"
                                    >
                                      <Building2 className="h-4 w-4 text-green-500" />
                                      <div>
                                        <span className="font-medium">{company.name}</span>
                                        {company.companyId && (
                                          <span className="text-sm text-gray-500 ml-2">({company.companyId})</span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Employee ID & Job Title */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">N° Matricule</label>
                          <input
                            type="text"
                            value={formData.convention.employeeId}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              convention: { ...prev.convention, employeeId: e.target.value }
                            }))}
                            className="input"
                            placeholder="Ex: EMP001"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fonction</label>
                          <input
                            type="text"
                            value={formData.convention.jobTitle}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              convention: { ...prev.convention, jobTitle: e.target.value }
                            }))}
                            className="input"
                            placeholder="Ex: Directeur"
                          />
                        </div>
                      </div>

                      {/* Beneficiary Type & Department */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type de bénéficiaire</label>
                          <select
                            value={formData.convention.beneficiaryType}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              convention: { ...prev.convention, beneficiaryType: e.target.value }
                            }))}
                            className="input"
                          >
                            <option value="employee">Employé(e)</option>
                            <option value="spouse">Conjoint(e)</option>
                            <option value="child">Enfant</option>
                            <option value="dependent">Personne à charge</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                          <input
                            type="text"
                            value={formData.convention.department}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              convention: { ...prev.convention, department: e.target.value }
                            }))}
                            className="input"
                            placeholder="Ex: Direction"
                          />
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Statut convention</label>
                        <select
                          value={formData.convention.status}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            convention: { ...prev.convention, status: e.target.value }
                          }))}
                          className="input w-48"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspendue</option>
                          <option value="expired">Expirée</option>
                          <option value="terminated">Résiliée</option>
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                          value={formData.convention.notes}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            convention: { ...prev.convention, notes: e.target.value }
                          }))}
                          className="input"
                          rows="2"
                          placeholder="Notes sur la convention..."
                        />
                      </div>

                      {/* Coverage Info */}
                      {selectedCompany?.defaultCoverage && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <h4 className="font-semibold text-yellow-800 mb-2">Couverture par défaut</h4>
                          <p className="text-sm text-yellow-700">
                            {selectedCompany.defaultCoverage.percentage}% pris en charge par l'entreprise
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!formData.convention.hasConvention && (
                    <p className="text-sm text-gray-500 italic">
                      Activez si le patient est affilié à une entreprise conventionnée.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preferences */}
            {activeSection === 'preferences' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  Preferences
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Langue preferee</label>
                    <select
                      value={formData.preferences.language}
                      onChange={(e) => handleChange('preferences.language', e.target.value)}
                      className="input"
                    >
                      <option value="fr">Francais</option>
                      <option value="ar">Arabe</option>
                      <option value="en">Anglais</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode de communication</label>
                    <select
                      value={formData.preferences.communicationMethod}
                      onChange={(e) => handleChange('preferences.communicationMethod', e.target.value)}
                      className="input"
                    >
                      <option value="phone">Telephone</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacie preferee</label>
                    <input
                      type="text"
                      value={formData.preferredPharmacy}
                      onChange={(e) => handleChange('preferredPharmacy', e.target.value)}
                      className="input"
                      placeholder="Nom de la pharmacie"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="reminders"
                    checked={formData.preferences.appointmentReminders}
                    onChange={(e) => handleChange('preferences.appointmentReminders', e.target.checked)}
                    className="h-5 w-5 rounded text-blue-600"
                  />
                  <label htmlFor="reminders" className="text-sm font-medium text-gray-900">
                    Recevoir des rappels de rendez-vous
                  </label>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
