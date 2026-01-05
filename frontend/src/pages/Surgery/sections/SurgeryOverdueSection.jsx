import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, User, Eye, Phone, Calendar, ChevronRight } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState } from '../../../components/CollapsibleSection';
import surgeryService from '../../../services/surgeryService';
import ConfirmationModal from '../../../components/ConfirmationModal';

/**
 * SurgeryOverdueSection - Patients waiting too long (>30 days)
 */
export default function SurgeryOverdueSection({ count, onRefresh }) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const loadData = async () => {
    if (loaded) return;
    try {
      setLoading(true);
      const response = await surgeryService.getOverdueCases(30);
      // Handle various API response formats defensively
      const casesData = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.cases)
        ? response.data.cases
        : Array.isArray(response?.data?.items)
        ? response.data.items
        : Array.isArray(response)
        ? response
        : [];
      setCases(casesData);
      setLoaded(true);
    } catch (err) {
      console.error('Error loading overdue cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!selectedCase || !scheduleDate) return;
    try {
      await surgeryService.scheduleCase(selectedCase._id, scheduleDate);
      setScheduleModal(false);
      setSelectedCase(null);
      setScheduleDate('');
      setLoaded(false);
      loadData();
      onRefresh?.();
    } catch (err) {
      console.error('Error scheduling surgery:', err);
    }
  };

  const getDaysWaiting = (paymentDate) => {
    if (!paymentDate) return 0;
    const now = new Date();
    const payment = new Date(paymentDate);
    return Math.floor((now - payment) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <>
      <CollapsibleSection
        title="Alertes - Attente prolongée"
        icon={AlertTriangle}
        iconColor="text-red-600"
        gradient="from-red-50 to-orange-50"
        badge={
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full animate-pulse">
            {count} en retard
          </span>
        }
        defaultExpanded={true}
        loading={loading}
        onExpand={loadData}
      >
        {cases.length === 0 ? (
          <SectionEmptyState
            icon={AlertTriangle}
            message="Aucun patient en attente prolongée"
          />
        ) : (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Ces patients attendent depuis plus de 30 jours. Veuillez les contacter pour programmer leur chirurgie.
              </p>
            </div>

            {cases.map((surgeryCase) => (
              <div
                key={surgeryCase._id}
                className="bg-white border border-red-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Days Badge */}
                    <div className="bg-red-100 rounded-lg p-3 text-center min-w-[70px]">
                      <p className="text-2xl font-bold text-red-600">
                        {getDaysWaiting(surgeryCase.paymentDate)}
                      </p>
                      <p className="text-xs text-red-500">jours</p>
                    </div>

                    {/* Patient Info */}
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {surgeryCase.patient?.firstName} {surgeryCase.patient?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {surgeryCase.patient?.medicalRecordNumber}
                        </p>
                      </div>
                    </div>

                    {/* Phone */}
                    {surgeryCase.patient?.phone && (
                      <a
                        href={`tel:${surgeryCase.patient.phone}`}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">{surgeryCase.patient.phone}</span>
                      </a>
                    )}

                    {/* Surgery Type */}
                    <div className="hidden md:block">
                      <p className="text-sm font-medium text-gray-700">
                        {surgeryCase.surgeryType?.name || 'Type non défini'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Payé le {formatDate(surgeryCase.paymentDate)}
                      </p>
                    </div>

                    {/* Eye */}
                    {surgeryCase.eye && surgeryCase.eye !== 'N/A' && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-600">
                          {surgeryCase.eye}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCase(surgeryCase);
                        setScheduleModal(true);
                      }}
                      className="btn btn-sm bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Programmer
                    </button>
                    <button
                      onClick={() => navigate(`/surgery/${surgeryCase._id}`)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Schedule Modal */}
      <ConfirmationModal
        isOpen={scheduleModal}
        onClose={() => {
          setScheduleModal(false);
          setSelectedCase(null);
          setScheduleDate('');
        }}
        onConfirm={handleSchedule}
        title="Programmer la chirurgie urgente"
        message={
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                Ce patient attend depuis{' '}
                <strong>{getDaysWaiting(selectedCase?.paymentDate)} jours</strong>
              </p>
            </div>
            <p>
              Programmer la chirurgie pour{' '}
              <strong>
                {selectedCase?.patient?.firstName} {selectedCase?.patient?.lastName}
              </strong>
            </p>
            <p className="text-sm text-gray-500">
              {selectedCase?.surgeryType?.name}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de chirurgie
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
        }
        confirmText="Programmer maintenant"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        disabled={!scheduleDate}
      />
    </>
  );
}
