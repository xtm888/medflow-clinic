import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Phone, Mail, Calendar, MapPin, FileText, Activity,
  Clock, DollarSign, Eye, Edit, Download, Plus, AlertCircle,
  Stethoscope, Pill, Clipboard, Heart
} from 'lucide-react';
import { usePatients, useVisits, useAppointments, usePrescriptions, useAuth, useAppDispatch } from '../hooks/useRedux';
import { fetchPatientDetails } from '../store/slices/patientSlice';
import { fetchPatientVisits } from '../store/slices/visitSlice';
import { fetchPatientAppointments } from '../store/slices/appointmentSlice';
import { fetchPatientPrescriptions } from '../store/slices/prescriptionSlice';
import { usePatientUpdates } from '../hooks/useWebSocket';
import { documentService, billingService } from '../services';

const InfoCard = ({ title, children, icon: Icon }) => (
  <div className="card">
    <div className="flex items-center mb-4">
      <Icon className="h-5 w-5 text-gray-600 mr-2" />
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value || 'N/A'}</span>
  </div>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
      active
        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

export default function PatientDetailsConnected() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentPatient, loading: patientLoading } = usePatients();
  const { patientVisits, loading: visitsLoading } = useVisits();
  const { patientAppointments, loading: appointmentsLoading } = useAppointments();
  const { patientPrescriptions, loading: prescriptionsLoading } = usePrescriptions();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [documents, setDocuments] = useState([]);
  const [billingInfo, setBillingInfo] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Real-time patient updates
  usePatientUpdates(id);

  // Fetch patient data
  useEffect(() => {
    if (id) {
      // Fetch patient details
      dispatch(fetchPatientDetails(id));

      // Fetch related data
      dispatch(fetchPatientVisits(id));
      dispatch(fetchPatientAppointments(id));
      dispatch(fetchPatientPrescriptions(id));

      // Fetch documents
      fetchDocuments();

      // Fetch billing info
      fetchBillingInfo();
    }
  }, [id, dispatch]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await documentService.getDocumentsByPatient(id);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchBillingInfo = async () => {
    setLoadingBilling(true);
    try {
      const response = await billingService.getPatientBillingInfo(id);
      setBillingInfo(response);
    } catch (error) {
      console.error('Error fetching billing info:', error);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleEdit = () => {
    navigate(`/patients/${id}/edit`);
  };

  const handleNewAppointment = () => {
    navigate(`/appointments/new?patientId=${id}`);
  };

  const handleNewVisit = () => {
    navigate(`/visits/new?patientId=${id}`);
  };

  const handleNewPrescription = () => {
    navigate(`/prescriptions/new?patientId=${id}`);
  };

  const handleViewDocument = async (documentId) => {
    try {
      const url = await documentService.getDocumentUrl(documentId);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
    }
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const age = Math.floor((new Date() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    return age;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentPatient) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Patient not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-4">
            <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">
                {currentPatient.firstName?.[0]}{currentPatient.lastName?.[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentPatient.firstName} {currentPatient.lastName}
              </h1>
              <p className="text-gray-600">Patient ID: {currentPatient.patientId || currentPatient._id}</p>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {calculateAge(currentPatient.dateOfBirth)} years old
                </span>
                <span>{currentPatient.gender}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentPatient.status === 'Active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {currentPatient.status || 'Active'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            {hasPermission(['doctor', 'nurse']) && (
              <button onClick={handleEdit} className="btn-secondary flex items-center">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={handleNewAppointment}
          className="card hover:shadow-md transition-shadow p-4 flex items-center justify-center space-x-2"
        >
          <Calendar className="h-5 w-5 text-blue-600" />
          <span className="font-medium">New Appointment</span>
        </button>
        <button
          onClick={handleNewVisit}
          className="card hover:shadow-md transition-shadow p-4 flex items-center justify-center space-x-2"
        >
          <Stethoscope className="h-5 w-5 text-green-600" />
          <span className="font-medium">New Visit</span>
        </button>
        <button
          onClick={handleNewPrescription}
          className="card hover:shadow-md transition-shadow p-4 flex items-center justify-center space-x-2"
        >
          <Pill className="h-5 w-5 text-purple-600" />
          <span className="font-medium">New Prescription</span>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className="card hover:shadow-md transition-shadow p-4 flex items-center justify-center space-x-2"
        >
          <FileText className="h-5 w-5 text-orange-600" />
          <span className="font-medium">Upload Document</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200 px-6">
          <div className="flex space-x-8">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              Overview
            </TabButton>
            <TabButton active={activeTab === 'visits'} onClick={() => setActiveTab('visits')}>
              Visits ({patientVisits?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')}>
              Appointments ({patientAppointments?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'prescriptions'} onClick={() => setActiveTab('prescriptions')}>
              Prescriptions ({patientPrescriptions?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
              Documents ({documents.length})
            </TabButton>
            <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')}>
              Billing
            </TabButton>
          </div>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoCard title="Personal Information" icon={User}>
                <InfoRow label="Full Name" value={`${currentPatient.firstName} ${currentPatient.lastName}`} />
                <InfoRow label="Date of Birth" value={formatDate(currentPatient.dateOfBirth)} />
                <InfoRow label="Age" value={`${calculateAge(currentPatient.dateOfBirth)} years`} />
                <InfoRow label="Gender" value={currentPatient.gender} />
                <InfoRow label="Blood Type" value={currentPatient.bloodType} />
                <InfoRow label="Height" value={currentPatient.height ? `${currentPatient.height} cm` : 'N/A'} />
                <InfoRow label="Weight" value={currentPatient.weight ? `${currentPatient.weight} kg` : 'N/A'} />
              </InfoCard>

              <InfoCard title="Contact Information" icon={Phone}>
                <InfoRow label="Phone" value={currentPatient.phone} />
                <InfoRow label="Email" value={currentPatient.email} />
                <InfoRow label="Address" value={currentPatient.address?.street} />
                <InfoRow label="City" value={currentPatient.address?.city} />
                <InfoRow label="State" value={currentPatient.address?.state} />
                <InfoRow label="ZIP Code" value={currentPatient.address?.zipCode} />
                <InfoRow label="Country" value={currentPatient.address?.country} />
              </InfoCard>

              <InfoCard title="Medical Information" icon={Heart}>
                <InfoRow label="Allergies" value={currentPatient.medicalHistory?.allergies?.join(', ') || 'None'} />
                <InfoRow label="Chronic Conditions" value={currentPatient.medicalHistory?.chronicConditions?.join(', ') || 'None'} />
                <InfoRow label="Current Medications" value={currentPatient.medicalHistory?.currentMedications?.join(', ') || 'None'} />
                <InfoRow label="Previous Surgeries" value={currentPatient.medicalHistory?.previousSurgeries?.join(', ') || 'None'} />
                <InfoRow label="Family History" value={currentPatient.medicalHistory?.familyHistory || 'N/A'} />
              </InfoCard>

              <InfoCard title="Emergency Contact" icon={AlertCircle}>
                <InfoRow label="Name" value={currentPatient.emergencyContact?.name} />
                <InfoRow label="Relationship" value={currentPatient.emergencyContact?.relationship} />
                <InfoRow label="Phone" value={currentPatient.emergencyContact?.phone} />
                <InfoRow label="Email" value={currentPatient.emergencyContact?.email} />
              </InfoCard>

              <InfoCard title="Insurance Information" icon={DollarSign}>
                <InfoRow label="Provider" value={currentPatient.insurance?.provider} />
                <InfoRow label="Policy Number" value={currentPatient.insurance?.policyNumber} />
                <InfoRow label="Group Number" value={currentPatient.insurance?.groupNumber} />
                <InfoRow label="Valid Until" value={formatDate(currentPatient.insurance?.validUntil)} />
              </InfoCard>

              <InfoCard title="Account Information" icon={Activity}>
                <InfoRow label="Registration Date" value={formatDate(currentPatient.createdAt)} />
                <InfoRow label="Last Visit" value={formatDate(currentPatient.lastVisitDate)} />
                <InfoRow label="Total Visits" value={patientVisits?.length || 0} />
                <InfoRow label="Upcoming Appointments" value={
                  patientAppointments?.filter(a => new Date(a.dateTime) > new Date()).length || 0
                } />
                <InfoRow label="Account Status" value={currentPatient.status || 'Active'} />
              </InfoCard>
            </div>
          )}

          {/* Visits Tab */}
          {activeTab === 'visits' && (
            <div className="space-y-4">
              {visitsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : patientVisits?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No visit records found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientVisits?.map(visit => (
                    <div key={visit._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            Visit #{visit.visitId || visit._id.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(visit.visitDate)} at {visit.visitTime}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Department: {visit.department}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Doctor: Dr. {visit.doctorName}
                          </p>
                          {visit.chiefComplaint && (
                            <p className="text-sm mt-2">
                              <span className="font-medium">Chief Complaint:</span> {visit.chiefComplaint}
                            </p>
                          )}
                          {visit.diagnosis && (
                            <p className="text-sm mt-1">
                              <span className="font-medium">Diagnosis:</span> {visit.diagnosis}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            visit.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : visit.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {visit.status}
                          </span>
                          <button
                            onClick={() => navigate(`/visits/${visit._id}`)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Appointments Tab */}
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              {appointmentsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : patientAppointments?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No appointments found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientAppointments?.map(appointment => (
                    <div key={appointment._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {appointment.appointmentType}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(appointment.dateTime)} at {new Date(appointment.dateTime).toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Department: {appointment.department}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Doctor: Dr. {appointment.doctorName}
                          </p>
                          {appointment.reason && (
                            <p className="text-sm mt-2">
                              <span className="font-medium">Reason:</span> {appointment.reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            appointment.status === 'confirmed'
                              ? 'bg-green-100 text-green-800'
                              : appointment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : appointment.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {appointment.status}
                          </span>
                          <button
                            onClick={() => navigate(`/appointments/${appointment._id}`)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              {prescriptionsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : patientPrescriptions?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No prescriptions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patientPrescriptions?.map(prescription => (
                    <div key={prescription._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            Prescription #{prescription.prescriptionId || prescription._id.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(prescription.createdAt)}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Prescribed by: Dr. {prescription.doctorName}
                          </p>
                          <div className="mt-2">
                            <p className="text-sm font-medium">Medications:</p>
                            {prescription.medications?.map((med, idx) => (
                              <div key={idx} className="text-sm text-gray-600 mt-1">
                                • {med.name} - {med.dosage} - {med.frequency} for {med.duration}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            prescription.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : prescription.status === 'dispensed'
                              ? 'bg-blue-100 text-blue-800'
                              : prescription.status === 'expired'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {prescription.status}
                          </span>
                          <button
                            onClick={() => navigate(`/prescriptions/${prescription._id}`)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              {loadingDocs ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No documents found</p>
                  <button
                    onClick={() => navigate(`/documents/upload?patientId=${id}`)}
                    className="mt-4 btn-primary"
                  >
                    Upload Document
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map(doc => (
                    <div key={doc._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{doc.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Type: {doc.type} • Size: {(doc.size / 1024).toFixed(2)} KB
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Uploaded: {formatDate(doc.uploadedAt)}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewDocument(doc._id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => documentService.downloadDocument(doc._id)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {loadingBilling ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-4">
                      <p className="text-sm text-gray-600">Total Balance</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${billingInfo?.totalBalance?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="card p-4">
                      <p className="text-sm text-gray-600">Last Payment</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${billingInfo?.lastPayment?.amount?.toFixed(2) || '0.00'}
                      </p>
                      {billingInfo?.lastPayment?.date && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(billingInfo.lastPayment.date)}
                        </p>
                      )}
                    </div>
                    <div className="card p-4">
                      <p className="text-sm text-gray-600">Insurance Coverage</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {billingInfo?.insuranceCoverage || 0}%
                      </p>
                    </div>
                  </div>

                  {billingInfo?.invoices && billingInfo.invoices.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-4">Recent Invoices</h4>
                      <div className="space-y-2">
                        {billingInfo.invoices.map(invoice => (
                          <div key={invoice._id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">Invoice #{invoice.invoiceNumber}</p>
                                <p className="text-sm text-gray-600">
                                  {formatDate(invoice.date)} • ${invoice.amount.toFixed(2)}
                                </p>
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                invoice.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : invoice.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {invoice.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}