import { useState, useEffect } from 'react';
import { FileText, Search, Plus, Printer, Check, X, AlertCircle } from 'lucide-react';
import prescriptionService from '../services/prescriptionService';
import patientService from '../services/patientService';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';

export default function Prescriptions() {
  const { toasts, success, error: showError, removeToast } = useToast();
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPrescription, setShowNewPrescription] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dispensing, setDispensing] = useState({});

  const [prescriptionForm, setPrescriptionForm] = useState({
    patient: '',
    prescriptionType: 'drug',
    medications: [],
    instructions: '',
    diagnosis: '',
    validUntil: ''
  });

  const [currentMedication, setCurrentMedication] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: 1,
    instructions: ''
  });

  // Fetch prescriptions and patients on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prescriptionsRes, patientsRes] = await Promise.all([
        prescriptionService.getPrescriptions(),
        patientService.getPatients()
      ]);

      setPrescriptions(prescriptionsRes.data || []);
      setPatients(patientsRes.data || []);
    } catch (err) {
      showError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add medication to prescription
  const handleAddMedication = () => {
    if (!currentMedication.medication || !currentMedication.dosage) {
      showError('Please fill in medication name and dosage');
      return;
    }

    setPrescriptionForm(prev => ({
      ...prev,
      medications: [...prev.medications, { ...currentMedication }]
    }));

    setCurrentMedication({
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: ''
    });

    success('Medication added');
  };

  // Remove medication from prescription
  const handleRemoveMedication = (index) => {
    setPrescriptionForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  // Create new prescription
  const handleCreatePrescription = async (e) => {
    e.preventDefault();

    if (!prescriptionForm.patient) {
      showError('Please select a patient');
      return;
    }

    if (prescriptionForm.medications.length === 0) {
      showError('Please add at least one medication');
      return;
    }

    try {
      setSubmitting(true);

      const prescriptionData = {
        patient: prescriptionForm.patient,
        prescriptionType: prescriptionForm.prescriptionType,
        medications: prescriptionForm.medications,
        instructions: prescriptionForm.instructions,
        diagnosis: prescriptionForm.diagnosis,
        status: 'pending',
        validUntil: prescriptionForm.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default
      };

      await prescriptionService.createPrescription(prescriptionData);

      success('Prescription created successfully!');
      setShowNewPrescription(false);

      // Reset form
      setPrescriptionForm({
        patient: '',
        prescriptionType: 'drug',
        medications: [],
        instructions: '',
        diagnosis: '',
        validUntil: ''
      });

      // Refresh prescriptions list
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to create prescription');
      console.error('Error creating prescription:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Dispense prescription
  const handleDispense = async (prescriptionId) => {
    if (!window.confirm('Confirmer la dispensation de cette prescription?')) {
      return;
    }

    try {
      setDispensing(prev => ({ ...prev, [prescriptionId]: true }));

      await prescriptionService.dispensePrescription(prescriptionId, {
        dispensedBy: 'current_user', // Should be from auth context
        dispensedAt: new Date(),
        notes: 'Dispensed from staff portal'
      });

      success('Prescription dispensed successfully!');

      // Refresh list
      fetchData();

    } catch (err) {
      showError(err.response?.data?.error || 'Failed to dispense prescription');
      console.error('Error dispensing prescription:', err);
    } finally {
      setDispensing(prev => ({ ...prev, [prescriptionId]: false }));
    }
  };

  // Print prescription
  const handlePrint = async (prescriptionId) => {
    try {
      const blob = await prescriptionService.printPrescription(prescriptionId, 'pdf');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription_${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      success('Prescription downloaded successfully!');
    } catch (err) {
      showError('Failed to print prescription');
      console.error('Error printing prescription:', err);
    }
  };

  // Get patient name
  const getPatientName = (patientId) => {
    const patient = patients.find(p => p._id === patientId || p.id === patientId);
    if (patient) {
      return `${patient.firstName} ${patient.lastName}`;
    }
    return 'Unknown Patient';
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading prescriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des prescriptions et dispensation
          </p>
        </div>
        <button
          onClick={() => setShowNewPrescription(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle prescription</span>
        </button>
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No prescriptions found</h3>
          <p className="text-gray-500 mb-4">Create your first prescription to get started</p>
          <button
            onClick={() => setShowNewPrescription(true)}
            className="btn btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Create Prescription</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {prescriptions.map((prescription) => (
            <div key={prescription._id || prescription.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getPatientName(prescription.patient)}
                    </h3>
                    <span className={`badge ${
                      prescription.status === 'dispensed' ? 'badge-success' :
                      prescription.status === 'pending' ? 'badge-warning' :
                      prescription.status === 'cancelled' ? 'badge-danger' :
                      'badge'
                    }`}>
                      {prescription.status === 'dispensed' ? 'Dispensée' :
                       prescription.status === 'pending' ? 'En attente' :
                       prescription.status === 'cancelled' ? 'Annulée' :
                       prescription.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {prescription.prescriber?.name || 'Dr. Unknown'} - {formatDate(prescription.date || prescription.createdAt)}
                  </p>

                  {/* Medications List */}
                  <div className="space-y-2">
                    {prescription.medications?.map((med, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{med.medication || med.name}</p>
                          <p className="text-sm text-gray-600">{med.dosage}</p>
                          <p className="text-xs text-gray-500">
                            {med.frequency} - Durée: {med.duration}
                          </p>
                          {med.instructions && (
                            <p className="text-xs text-gray-500 italic mt-1">{med.instructions}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">Qté: {med.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Diagnosis and Instructions */}
                  {prescription.diagnosis && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <p className="text-xs font-medium text-blue-900">Diagnostic:</p>
                      <p className="text-sm text-blue-800">{prescription.diagnosis}</p>
                    </div>
                  )}
                  {prescription.instructions && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-xs font-medium text-yellow-900">Instructions:</p>
                      <p className="text-sm text-yellow-800">{prescription.instructions}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 ml-4">
                  {prescription.status === 'pending' && (
                    <button
                      onClick={() => handleDispense(prescription._id || prescription.id)}
                      disabled={dispensing[prescription._id || prescription.id]}
                      className="btn btn-success text-sm"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {dispensing[prescription._id || prescription.id] ? 'Dispensing...' : 'Dispenser'}
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint(prescription._id || prescription.id)}
                    className="btn btn-secondary text-sm"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Prescription Modal */}
      {showNewPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nouvelle Prescription</h2>
              <button
                onClick={() => setShowNewPrescription(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePrescription} className="p-6 space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  className="input"
                  value={prescriptionForm.patient}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, patient: e.target.value })}
                  required
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prescription Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de prescription</label>
                <select
                  className="input"
                  value={prescriptionForm.prescriptionType}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, prescriptionType: e.target.value })}
                >
                  <option value="drug">Médicaments</option>
                  <option value="optical">Optique</option>
                </select>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
                <input
                  type="text"
                  className="input"
                  value={prescriptionForm.diagnosis}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, diagnosis: e.target.value })}
                  placeholder="Ex: Hypertension, Diabète..."
                />
              </div>

              {/* Current Medications */}
              {prescriptionForm.medications.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Médicaments ajoutés</label>
                  <div className="space-y-2">
                    {prescriptionForm.medications.map((med, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{med.medication}</p>
                          <p className="text-sm text-gray-600">{med.dosage} - {med.frequency}</p>
                          <p className="text-xs text-gray-500">Durée: {med.duration} | Qté: {med.quantity}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Medication Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Ajouter un médicament</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    className="input"
                    placeholder="Nom du médicament *"
                    value={currentMedication.medication}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, medication: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Dosage (ex: 500mg) *"
                    value={currentMedication.dosage}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, dosage: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Fréquence (ex: 2x/jour)"
                    value={currentMedication.frequency}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, frequency: e.target.value })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Durée (ex: 7 jours)"
                    value={currentMedication.duration}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, duration: e.target.value })}
                  />
                  <input
                    type="number"
                    className="input"
                    placeholder="Quantité"
                    min="1"
                    value={currentMedication.quantity}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, quantity: parseInt(e.target.value) })}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Instructions (ex: Avec repas)"
                    value={currentMedication.instructions}
                    onChange={(e) => setCurrentMedication({ ...currentMedication, instructions: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="mt-3 btn btn-secondary text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter ce médicament
                </button>
              </div>

              {/* General Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions générales</label>
                <textarea
                  className="input"
                  rows="3"
                  value={prescriptionForm.instructions}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                  placeholder="Instructions générales pour le patient..."
                />
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valide jusqu'au</label>
                <input
                  type="date"
                  className="input"
                  value={prescriptionForm.validUntil}
                  onChange={(e) => setPrescriptionForm({ ...prescriptionForm, validUntil: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500 mt-1">Laissez vide pour 30 jours par défaut</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewPrescription(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || prescriptionForm.medications.length === 0}
                >
                  {submitting ? 'Création en cours...' : 'Créer la prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
