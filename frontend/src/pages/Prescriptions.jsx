import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Printer, Check, AlertTriangle, Link } from 'lucide-react';
import prescriptionService from '../services/prescriptionService';
import { toast } from 'react-toastify';
import EmptyState from '../components/EmptyState';
import { normalizeToArray, safeString } from '../utils/apiHelpers';
import DocumentGenerator from '../components/documents/DocumentGenerator';

export default function Prescriptions() {

  const [searchParams, setSearchParams] = useSearchParams();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState({});
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [patientFilter, setPatientFilter] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const highlightRef = useRef(null);

  // Fetch prescriptions on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Handle URL parameters for filtering and highlighting
  useEffect(() => {
    const patientId = searchParams.get('patientId');
    const highlight = searchParams.get('highlight');

    if (patientId) {
      setPatientFilter(patientId);
    }

    if (highlight) {
      setHighlightedId(highlight);
      // Clear highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
        // Remove highlight param from URL
        searchParams.delete('highlight');
        setSearchParams(searchParams);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Scroll to highlighted prescription
  useEffect(() => {
    if (highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedId, prescriptions]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const prescriptionsRes = await prescriptionService.getPrescriptions();
      setPrescriptions(normalizeToArray(prescriptionsRes));
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast.error('Erreur lors du chargement des prescriptions');
    } finally {
      setLoading(false);
    }
  };

  // Dispense prescription
  const handleDispense = async (prescriptionId) => {
    if (!window.confirm('Confirmer la dispensation de cette prescription?\n\nCette action déduira automatiquement les médicaments de l\'inventaire de la pharmacie.')) {
      return;
    }

    try {
      setDispensing(prev => ({ ...prev, [prescriptionId]: true }));

      const result = await prescriptionService.dispensePrescription(prescriptionId, {
        dispensedBy: 'current_user',
        dispensedAt: new Date(),
        notes: 'Dispensed from staff portal'
      });

      // Show detailed success message with inventory info
      if (result.inventoryUpdated && result.inventoryUpdated > 0) {
        const deductions = result.inventoryDeductions || [];
        const deductionInfo = deductions.map(d =>
          `${d.medication}: ${d.quantity} unités (Stock restant: ${d.remainingStock})`
        ).join('\n');

        toast.success(`Prescription dispensée avec succès!\n\nInventaire mis à jour:\n${deductionInfo}`);
      } else {
        toast.success('Prescription dispensée avec succès!');
      }

      // Refresh list
      fetchData();

    } catch (err) {
      // Handle insufficient stock error specially
      if (err.response?.data?.insufficientStock) {
        const stockErrors = err.response.data.insufficientStock;
        const errorMessage = stockErrors.map(s =>
          `${s.medication}: Besoin ${s.required}, Disponible ${s.available}`
        ).join('\n');

        toast.error(`Stock insuffisant:\n${errorMessage}`);
      } else {
        toast.error(err.response?.data?.error || 'Échec de la dispensation');
      }
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
      toast.success('Prescription downloaded successfully!');
    } catch (err) {
      toast.error('Failed to print prescription');
      console.error('Error printing prescription:', err);
    }
  };

  // Get patient name
  const getPatientName = (patientData) => {
    // If patient is already populated as an object
    if (patientData && typeof patientData === 'object' && patientData.firstName) {
      return `${patientData.firstName} ${patientData.lastName}`;
    }
    return 'Unknown Patient';
  };

  // Get patient list for filter display
  const getPatientList = () => {
    const patientMap = new Map();
    prescriptions.forEach(prescription => {
      const patient = prescription.patient;
      if (patient && typeof patient === 'object') {
        const id = patient._id || patient.id;
        if (id) {
          patientMap.set(id, patient);
        }
      }
    });
    return Array.from(patientMap.values());
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

  const patientList = getPatientList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prescriptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des prescriptions et dispensation
          </p>
        </div>
        <button
          onClick={() => {
            toast.info('Pour créer une prescription, sélectionnez un patient et créez ou ouvrez une visite');
            window.location.href = '/patients';
          }}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle Prescription</span>
        </button>
      </div>

      {/* Prescriptions List */}
      {prescriptions.length === 0 ? (
        <div className="card">
          <EmptyState
            type="prescriptions"
            customAction={{
              label: 'Aller aux Patients',
              onClick: () => window.location.href = '/patients'
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Patient filter indicator */}
          {patientFilter && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Filtré par patient: {patientList.find(p => (p._id || p.id) === patientFilter)?.firstName || 'Patient sélectionné'}
              </span>
              <button
                onClick={() => {
                  setPatientFilter('');
                  searchParams.delete('patientId');
                  setSearchParams(searchParams);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Effacer le filtre
              </button>
            </div>
          )}
          {prescriptions
            .filter(prescription => {
              if (!patientFilter) return true;
              const patientId = typeof prescription.patient === 'object'
                ? (prescription.patient._id || prescription.patient.id)
                : prescription.patient;
              return patientId === patientFilter;
            })
            .map((prescription) => {
              const prescriptionId = prescription._id || prescription.id;
              const isHighlighted = highlightedId === prescriptionId;
              return (
            <div
              key={prescriptionId}
              ref={isHighlighted ? highlightRef : null}
              className={`card transition-all duration-300 ${isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
            >
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
                       safeString(prescription.status, 'Unknown')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    {prescription.prescriber
                      ? (prescription.prescriber.name ||
                         (prescription.prescriber.firstName
                           ? `Dr. ${prescription.prescriber.firstName} ${prescription.prescriber.lastName || ''}`.trim()
                           : 'Dr. Unknown'))
                      : 'Dr. Unknown'} - {formatDate(prescription.date || prescription.createdAt)}
                  </p>
                  {prescription.visit && (
                    <p className="text-xs text-green-600 mb-3 flex items-center">
                      <Link className="h-3 w-3 mr-1" />
                      Visite: {prescription.visit.visitId || 'N/A'} ({prescription.visit.status === 'in-progress' ? 'En cours' : prescription.visit.status === 'completed' ? 'Terminée' : prescription.visit.status})
                    </p>
                  )}
                  {!prescription.visit && (
                    <div className="flex items-center text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 mb-3">
                      <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span>Non liée à une visite - Documentation clinique incomplète</span>
                    </div>
                  )}

                  {/* Medications List */}
                  <div className="space-y-2">
                    {Array.isArray(prescription.medications) && prescription.medications.map((med, idx) => {
                      // Get medication name - handle various data structures
                      let medName = 'Médicament';
                      if (med.name) {
                        medName = med.name;
                      } else if (med.drug && typeof med.drug === 'object' && med.drug.name) {
                        medName = med.drug.name;
                      } else if (med.medication && typeof med.medication === 'object' && med.medication.name) {
                        medName = med.medication.name;
                      } else if (typeof med.medication === 'string') {
                        medName = med.medication;
                      }

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">
                              {medName}
                              {med.form && <span className="text-gray-500 text-sm ml-1">({med.form})</span>}
                            </p>
                            <p className="text-sm text-gray-600">{safeString(med.dosage, 'Selon prescription')}</p>
                            {(med.frequency || med.duration) && (
                              <p className="text-xs text-gray-500">
                                {med.frequency && safeString(med.frequency, '')}
                                {med.frequency && med.duration && ' - '}
                                {med.duration && `Durée: ${safeString(med.duration, '')}`}
                              </p>
                            )}
                            {med.instructions && (
                              <p className="text-xs text-gray-500 italic mt-1">{safeString(med.instructions, '')}</p>
                            )}
                            {med.indication && (
                              <p className="text-xs text-blue-600 mt-1">Indication: {safeString(med.indication, '')}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              Qté: {typeof med.quantity === 'number' ? med.quantity : 1}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Diagnosis and Instructions */}
                  {prescription.diagnosis && (
                    <div className="mt-3 p-2 bg-blue-50 rounded">
                      <p className="text-xs font-medium text-blue-900">Diagnostic:</p>
                      <p className="text-sm text-blue-800">{safeString(prescription.diagnosis, '')}</p>
                    </div>
                  )}
                  {prescription.instructions && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded">
                      <p className="text-xs font-medium text-yellow-900">Instructions:</p>
                      <p className="text-sm text-yellow-800">{safeString(prescription.instructions, '')}</p>
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
                    onClick={() => {
                      setSelectedPrescription(prescription);
                      setShowDocumentGenerator(true);
                    }}
                    className="btn btn-primary text-sm"
                    title="Générer un certificat ou document"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Certificat
                  </button>
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
              );
            })}
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && selectedPrescription && (
        <DocumentGenerator
          patientId={selectedPrescription.patient?._id || selectedPrescription.patient?.id || selectedPrescription.patient}
          visitId={selectedPrescription.visit?._id}
          onClose={() => {
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
          onDocumentGenerated={(doc) => {
            toast.success('Document généré avec succès!');
            setShowDocumentGenerator(false);
            setSelectedPrescription(null);
          }}
        />
      )}
    </div>
  );
}
