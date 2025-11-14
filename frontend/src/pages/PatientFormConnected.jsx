import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Calendar, MapPin, Heart, AlertCircle, Shield, Save, ArrowLeft } from 'lucide-react';
import { usePatients, useAuth, useAppDispatch } from '../hooks/useRedux';
import { fetchPatientDetails, createPatient, updatePatient } from '../store/slices/patientSlice';
import { addToast } from '../store/slices/notificationSlice';

const FormSection = ({ title, icon: Icon, children }) => (
  <div className="card">
    <div className="flex items-center mb-4 pb-3 border-b">
      <Icon className="h-5 w-5 text-gray-600 mr-2" />
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const FormField = ({ label, required = false, error, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
  </div>
);

export default function PatientFormConnected() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentPatient, loading } = usePatients();
  const { hasPermission } = useAuth();

  const isEdit = !!id;

  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    height: '',
    weight: '',

    // Contact Information
    phone: '',
    email: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA'
    },

    // Emergency Contact
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    },

    // Medical History
    medicalHistory: {
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      previousSurgeries: [],
      familyHistory: ''
    },

    // Insurance Information
    insurance: {
      provider: '',
      policyNumber: '',
      groupNumber: '',
      validUntil: ''
    }
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');
  const [surgeryInput, setSurgeryInput] = useState('');

  // Fetch patient data if editing
  useEffect(() => {
    if (isEdit && id) {
      dispatch(fetchPatientDetails(id));
    }
  }, [isEdit, id, dispatch]);

  // Populate form with patient data
  useEffect(() => {
    if (isEdit && currentPatient) {
      setFormData({
        firstName: currentPatient.firstName || '',
        lastName: currentPatient.lastName || '',
        dateOfBirth: currentPatient.dateOfBirth ? new Date(currentPatient.dateOfBirth).toISOString().split('T')[0] : '',
        gender: currentPatient.gender || '',
        bloodType: currentPatient.bloodType || '',
        height: currentPatient.height || '',
        weight: currentPatient.weight || '',
        phone: currentPatient.phone || '',
        email: currentPatient.email || '',
        address: {
          street: currentPatient.address?.street || '',
          city: currentPatient.address?.city || '',
          state: currentPatient.address?.state || '',
          zipCode: currentPatient.address?.zipCode || '',
          country: currentPatient.address?.country || 'USA'
        },
        emergencyContact: {
          name: currentPatient.emergencyContact?.name || '',
          relationship: currentPatient.emergencyContact?.relationship || '',
          phone: currentPatient.emergencyContact?.phone || '',
          email: currentPatient.emergencyContact?.email || ''
        },
        medicalHistory: {
          allergies: currentPatient.medicalHistory?.allergies || [],
          chronicConditions: currentPatient.medicalHistory?.chronicConditions || [],
          currentMedications: currentPatient.medicalHistory?.currentMedications || [],
          previousSurgeries: currentPatient.medicalHistory?.previousSurgeries || [],
          familyHistory: currentPatient.medicalHistory?.familyHistory || ''
        },
        insurance: {
          provider: currentPatient.insurance?.provider || '',
          policyNumber: currentPatient.insurance?.policyNumber || '',
          groupNumber: currentPatient.insurance?.groupNumber || '',
          validUntil: currentPatient.insurance?.validUntil ? new Date(currentPatient.insurance.validUntil).toISOString().split('T')[0] : ''
        }
      });
    }
  }, [isEdit, currentPatient]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddItem = (category, inputValue, setInputValue) => {
    if (inputValue.trim()) {
      setFormData(prev => ({
        ...prev,
        medicalHistory: {
          ...prev.medicalHistory,
          [category]: [...prev.medicalHistory[category], inputValue.trim()]
        }
      }));
      setInputValue('');
    }
  };

  const handleRemoveItem = (category, index) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        [category]: prev.medicalHistory[category].filter((_, i) => i !== index)
      }
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';

    // Email validation
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    // Phone validation
    if (formData.phone && !/^\+?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      dispatch(addToast({
        type: 'error',
        message: 'Please fill in all required fields'
      }));
      return;
    }

    setSubmitting(true);

    try {
      let result;
      if (isEdit) {
        result = await dispatch(updatePatient({ id, data: formData })).unwrap();
      } else {
        result = await dispatch(createPatient(formData)).unwrap();
      }

      dispatch(addToast({
        type: 'success',
        message: `Patient ${isEdit ? 'updated' : 'created'} successfully`
      }));

      navigate(`/patients/${result._id || result.id}`);
    } catch (error) {
      dispatch(addToast({
        type: 'error',
        message: error.message || `Failed to ${isEdit ? 'update' : 'create'} patient`
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPermission(['doctor', 'nurse', 'receptionist'])) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">You don't have permission to {isEdit ? 'edit' : 'create'} patients.</p>
        </div>
      </div>
    );
  }

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/patients')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Patient' : 'New Patient Registration'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isEdit ? 'Update patient information' : 'Fill in the patient details below'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <FormSection title="Personal Information" icon={User}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="First Name" required error={errors.firstName}>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter first name"
              />
            </FormField>

            <FormField label="Last Name" required error={errors.lastName}>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter last name"
              />
            </FormField>

            <FormField label="Date of Birth" required error={errors.dateOfBirth}>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleInputChange}
                className="input-primary"
                max={new Date().toISOString().split('T')[0]}
              />
            </FormField>

            <FormField label="Gender" required error={errors.gender}>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                className="input-primary"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </FormField>

            <FormField label="Blood Type">
              <select
                name="bloodType"
                value={formData.bloodType}
                onChange={handleInputChange}
                className="input-primary"
              >
                <option value="">Select blood type</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </FormField>

            <FormField label="Height (cm)">
              <input
                type="number"
                name="height"
                value={formData.height}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter height"
                min="0"
              />
            </FormField>

            <FormField label="Weight (kg)">
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter weight"
                min="0"
                step="0.1"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Contact Information */}
        <FormSection title="Contact Information" icon={Phone}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Phone Number" required error={errors.phone}>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter phone number"
              />
            </FormField>

            <FormField label="Email Address" error={errors.email}>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter email address"
              />
            </FormField>

            <FormField label="Street Address">
              <input
                type="text"
                name="address.street"
                value={formData.address.street}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter street address"
              />
            </FormField>

            <FormField label="City">
              <input
                type="text"
                name="address.city"
                value={formData.address.city}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter city"
              />
            </FormField>

            <FormField label="State/Province">
              <input
                type="text"
                name="address.state"
                value={formData.address.state}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter state"
              />
            </FormField>

            <FormField label="ZIP/Postal Code">
              <input
                type="text"
                name="address.zipCode"
                value={formData.address.zipCode}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter ZIP code"
              />
            </FormField>

            <FormField label="Country">
              <input
                type="text"
                name="address.country"
                value={formData.address.country}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter country"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Emergency Contact */}
        <FormSection title="Emergency Contact" icon={AlertCircle}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Contact Name">
              <input
                type="text"
                name="emergencyContact.name"
                value={formData.emergencyContact.name}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter contact name"
              />
            </FormField>

            <FormField label="Relationship">
              <input
                type="text"
                name="emergencyContact.relationship"
                value={formData.emergencyContact.relationship}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="e.g., Spouse, Parent, Sibling"
              />
            </FormField>

            <FormField label="Contact Phone">
              <input
                type="tel"
                name="emergencyContact.phone"
                value={formData.emergencyContact.phone}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter contact phone"
              />
            </FormField>

            <FormField label="Contact Email">
              <input
                type="email"
                name="emergencyContact.email"
                value={formData.emergencyContact.email}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter contact email"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Medical History */}
        <FormSection title="Medical History" icon={Heart}>
          <div className="space-y-4">
            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Enter allergy"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('allergies', allergyInput, setAllergyInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddItem('allergies', allergyInput, setAllergyInput)}
                  className="btn-secondary"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.medicalHistory.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('allergies', index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Chronic Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chronic Conditions</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Enter condition"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('chronicConditions', conditionInput, setConditionInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddItem('chronicConditions', conditionInput, setConditionInput)}
                  className="btn-secondary"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.medicalHistory.chronicConditions.map((condition, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                  >
                    {condition}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('chronicConditions', index)}
                      className="ml-2 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={medicationInput}
                  onChange={(e) => setMedicationInput(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Enter medication"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('currentMedications', medicationInput, setMedicationInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddItem('currentMedications', medicationInput, setMedicationInput)}
                  className="btn-secondary"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.medicalHistory.currentMedications.map((medication, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {medication}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('currentMedications', index)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Previous Surgeries */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Previous Surgeries</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={surgeryInput}
                  onChange={(e) => setSurgeryInput(e.target.value)}
                  className="input-primary flex-1"
                  placeholder="Enter surgery"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem('previousSurgeries', surgeryInput, setSurgeryInput);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddItem('previousSurgeries', surgeryInput, setSurgeryInput)}
                  className="btn-secondary"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.medicalHistory.previousSurgeries.map((surgery, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                  >
                    {surgery}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem('previousSurgeries', index)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Family History */}
            <FormField label="Family History">
              <textarea
                name="medicalHistory.familyHistory"
                value={formData.medicalHistory.familyHistory}
                onChange={handleInputChange}
                className="input-primary"
                rows="3"
                placeholder="Enter relevant family medical history"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Insurance Information */}
        <FormSection title="Insurance Information" icon={Shield}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Insurance Provider">
              <input
                type="text"
                name="insurance.provider"
                value={formData.insurance.provider}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter insurance provider"
              />
            </FormField>

            <FormField label="Policy Number">
              <input
                type="text"
                name="insurance.policyNumber"
                value={formData.insurance.policyNumber}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter policy number"
              />
            </FormField>

            <FormField label="Group Number">
              <input
                type="text"
                name="insurance.groupNumber"
                value={formData.insurance.groupNumber}
                onChange={handleInputChange}
                className="input-primary"
                placeholder="Enter group number"
              />
            </FormField>

            <FormField label="Valid Until">
              <input
                type="date"
                name="insurance.validUntil"
                value={formData.insurance.validUntil}
                onChange={handleInputChange}
                className="input-primary"
                min={new Date().toISOString().split('T')[0]}
              />
            </FormField>
          </div>
        </FormSection>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isEdit ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'Update Patient' : 'Create Patient'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}