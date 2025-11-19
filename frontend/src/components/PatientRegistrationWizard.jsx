import React, { useState, useEffect } from 'react';
import { X, AlertCircle, User, Phone, Briefcase, Plus, Trash2, Search } from 'lucide-react';
import Wizard from './Wizard';
import DateOfBirthInput from './DateOfBirthInput';
import { format } from 'date-fns';
import medicationService from '../services/medicationService';

/**
 * Patient Registration Wizard
 *
 * 3-step wizard for registering new patients:
 * 1. Personal Information (name, DOB, gender)
 * 2. Contact Details (phone, email, address)
 * 3. Medical Information (blood type, allergies, insurance)
 */
const PatientRegistrationWizard = ({ onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
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

    // Step 3: Medical
    bloodType: '',
    allergies: '',
    insurance: '',
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    },
    vip: false,
    // Current medications
    medications: []
  });

  // Medication search state
  const [medicationSearch, setMedicationSearch] = useState('');
  const [medicationResults, setMedicationResults] = useState([]);
  const [searchingMedications, setSearchingMedications] = useState(false);
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);

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

  // Add medication to list
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

  // Remove medication from list
  const handleRemoveMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  // Update medication details
  const handleUpdateMedication = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const steps = [
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
      label: 'Médical',
      title: 'Informations médicales',
      description: 'Groupe sanguin, allergies et assurance',
      icon: Briefcase
    }
  ];

  // Validation functions
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
    // Step 3 is optional, always valid
    return true;
  };

  // Handle step navigation
  const handleStepChange = (newStep) => {
    // Validate current step before proceeding
    let isValid = true;
    if (newStep > currentStep) {
      if (currentStep === 0) isValid = validateStep1();
      else if (currentStep === 1) isValid = validateStep2();
      else if (currentStep === 2) isValid = validateStep3();
    }

    if (isValid || newStep < currentStep) {
      setCurrentStep(newStep);
      setErrors({});
    }
  };

  // Handle form completion
  const handleComplete = async () => {
    if (!validateStep3()) return;

    try {
      // Parse allergies (comma-separated)
      const allergiesArray = formData.allergies
        ? formData.allergies.split(',').map(a => ({ allergen: a.trim() }))
        : [];

      const patientData = {
        ...formData,
        allergies: allergiesArray
      };

      await onSubmit(patientData);
    } catch (error) {
      console.error('Error submitting patient:', error);
    }
  };

  // Field change handler
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
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
        >
          {/* STEP 1: Personal Information */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleChange('firstName', e.target.value)}
                    className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                      errors.firstName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Jean"
                    autoFocus
                  />
                  {errors.firstName && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.firstName}
                    </p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                      errors.lastName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                    }`}
                    placeholder="Kabila"
                  />
                  {errors.lastName && (
                    <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Date de naissance <span className="text-red-500">*</span>
                </label>
                <DateOfBirthInput
                  value={formData.dateOfBirth}
                  onChange={(date) => handleChange('dateOfBirth', date)}
                  error={errors.dateOfBirth}
                />
                {errors.dateOfBirth && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.dateOfBirth}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Sexe <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'male')}
                    className={`p-6 border-3 rounded-lg font-semibold text-lg transition transform hover:scale-105 ${
                      formData.gender === 'male'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">👨</span>
                      <span>Homme</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'female')}
                    className={`p-6 border-3 rounded-lg font-semibold text-lg transition transform hover:scale-105 ${
                      formData.gender === 'female'
                        ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-lg'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">👩</span>
                      <span>Femme</span>
                    </div>
                  </button>
                </div>
                {errors.gender && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.gender}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Contact Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                    errors.phoneNumber ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                  }`}
                  placeholder="+243 81 234 5678"
                  autoFocus
                />
                {errors.phoneNumber && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition ${
                    errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                  }`}
                  placeholder="patient@email.com"
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Adresse (optionnel)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="123 Avenue Kasa-Vubu"
                />
              </div>

              {/* City & Country */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="Kinshasa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Pays
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="RDC">RDC</option>
                    <option value="Congo-Brazzaville">Congo-Brazzaville</option>
                    <option value="Rwanda">Rwanda</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Other">Autre</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Medical Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Blood Type & Insurance */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Groupe sanguin
                  </label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) => handleChange('bloodType', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option value="">Sélectionner</option>
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assurance
                  </label>
                  <input
                    type="text"
                    value={formData.insurance}
                    onChange={(e) => handleChange('insurance', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="Nom de l'assurance"
                  />
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Allergies connues
                </label>
                <textarea
                  value={formData.allergies}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                  rows="3"
                  placeholder="Pénicilline, arachides, latex... (séparez par des virgules)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Séparez les allergies par des virgules
                </p>
              </div>

              {/* Current Medications */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Médicaments actuels
                </label>

                {/* Medication Search */}
                <div className="relative mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={medicationSearch}
                      onChange={(e) => setMedicationSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition"
                      placeholder="Rechercher un médicament..."
                    />
                    {searchingMedications && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showMedicationDropdown && medicationResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {medicationResults.map((med, index) => (
                        <button
                          key={med._id || index}
                          type="button"
                          onClick={() => handleAddMedication(med)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-2 border-b last:border-b-0"
                        >
                          <Plus className="h-4 w-4 text-blue-500" />
                          <div>
                            <span className="font-medium">{med.name}</span>
                            {med.form && (
                              <span className="text-sm text-gray-500 ml-2">({med.form})</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No Results Message */}
                  {showMedicationDropdown && medicationResults.length === 0 && medicationSearch.length >= 2 && !searchingMedications && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 text-center">
                      <p className="text-gray-500">Aucun médicament trouvé</p>
                      <button
                        type="button"
                        onClick={() => handleAddMedication({ name: medicationSearch })}
                        className="text-blue-600 hover:text-blue-700 mt-2 text-sm"
                      >
                        + Ajouter "{medicationSearch}" manuellement
                      </button>
                    </div>
                  )}
                </div>

                {/* Medications List */}
                {formData.medications.length > 0 && (
                  <div className="space-y-3">
                    {formData.medications.map((med, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-800">{med.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedication(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => handleUpdateMedication(index, 'dosage', e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Dosage (ex: 500mg)"
                          />
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => handleUpdateMedication(index, 'frequency', e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Fréquence (ex: 2x/jour)"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {formData.medications.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Aucun médicament ajouté. Recherchez et ajoutez les médicaments que prend actuellement le patient.
                  </p>
                )}
              </div>

              {/* VIP Status */}
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-5">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.vip}
                    onChange={(e) => handleChange('vip', e.target.checked)}
                    className="w-6 h-6 rounded border-purple-400 text-purple-600 focus:ring-purple-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-lg font-bold text-purple-900 block mb-1">
                      ⭐ Marquer comme VIP
                    </span>
                    <p className="text-sm text-purple-700">
                      Les patients VIP ont la priorité dans la file d'attente
                    </p>
                  </div>
                </label>
              </div>

              {/* Success Message */}
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                <p className="text-green-800 text-center font-medium">
                  ✓ Toutes les informations requises ont été remplies
                </p>
                <p className="text-green-700 text-center text-sm mt-1">
                  Cliquez sur "Terminer" pour créer le dossier patient
                </p>
              </div>
            </div>
          )}
        </Wizard>
      </div>
    </div>
  );
};

export default PatientRegistrationWizard;
