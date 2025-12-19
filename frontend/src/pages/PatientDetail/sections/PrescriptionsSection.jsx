import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pill, Plus, Eye, Printer, RefreshCw, Calendar, Check, Clock, AlertTriangle, PenTool, CheckCircle } from 'lucide-react';
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import prescriptionService from '../../../services/prescriptionService';
import { normalizeToArray, safeString } from '../../../utils/apiHelpers';
import { toast } from 'react-toastify';

/**
 * PrescriptionsSection - Active/Pending counts, recent prescriptions list
 */
export default function PrescriptionsSection({
  patientId,
  canCreatePrescription,
  canSign = false,
  onViewPrescription,
  onPrintPrescription,
  onRenewPrescription,
  forceExpand = false
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [signingId, setSigningId] = useState(null);
  const [signingAll, setSigningAll] = useState(false);

  const loadData = async (force = false) => {
    if (!force && prescriptions.length > 0) return;

    setLoading(true);
    try {
      const res = await prescriptionService.getPatientPrescriptions(patientId);
      setPrescriptions(normalizeToArray(res));
    } catch (err) {
      console.error('Error loading prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load data when patientId changes
  useEffect(() => {
    if (patientId) {
      loadData(true);
    }
  }, [patientId]);

  // Calculate counts
  const activePrescriptions = prescriptions.filter(p => p.status === 'active' || p.status === 'dispensed');
  const pendingPrescriptions = prescriptions.filter(p => p.status === 'pending');

  // Check if prescription is unsigned
  const isUnsigned = (rx) => {
    return !rx.signature?.prescriber?.signed &&
           !rx.signature?.prescriber?.signedAt &&
           rx.status !== 'cancelled';
  };

  const unsignedPrescriptions = prescriptions.filter(isUnsigned);

  // Sign single prescription
  const handleSign = async (prescription) => {
    const id = prescription._id || prescription.id;
    setSigningId(id);
    try {
      await prescriptionService.signPrescription(id);
      toast.success('Ordonnance signée');
      loadData(true); // Reload
    } catch (err) {
      console.error('Error signing prescription:', err);
      toast.error('Erreur lors de la signature');
    } finally {
      setSigningId(null);
    }
  };

  // Sign all unsigned prescriptions
  const handleSignAll = async () => {
    if (unsignedPrescriptions.length === 0) return;

    setSigningAll(true);
    let successCount = 0;
    let errorCount = 0;

    for (const rx of unsignedPrescriptions) {
      try {
        await prescriptionService.signPrescription(rx._id || rx.id);
        successCount++;
      } catch (err) {
        console.error('Error signing prescription:', err);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} ordonnance(s) signée(s)`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de la signature`);
    }

    setSigningAll(false);
    loadData(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleRenew = async (prescription) => {
    try {
      if (onRenewPrescription) {
        await onRenewPrescription(prescription);
      } else {
        await prescriptionService.renewPrescription(prescription._id || prescription.id);
        toast.success('Ordonnance renouvelée');
        // Reload
        const res = await prescriptionService.getPatientPrescriptions(patientId);
        setPrescriptions(normalizeToArray(res));
      }
    } catch (err) {
      console.error('Error renewing:', err);
      navigate('/prescriptions', {
        state: { renewFrom: prescription, patientId }
      });
    }
  };

  return (
    <CollapsibleSection
      title="Prescriptions"
      icon={Pill}
      iconColor="text-orange-600"
      gradient="from-orange-50 to-amber-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading}
      badge={
        prescriptions.length > 0 && (
          <div className="flex items-center gap-2">
            {pendingPrescriptions.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {pendingPrescriptions.length} en attente
              </span>
            )}
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
              {prescriptions.length} total
            </span>
          </div>
        )
      }
      actions={
        canCreatePrescription && (
          <SectionActionButton
            icon={Plus}
            onClick={() => navigate(`/ophthalmology/studio/${patientId}`)}
            variant="primary"
          >
            Ordonnance
          </SectionActionButton>
        )
      }
    >
      {/* Unsigned Prescriptions Alert - Always show if there are unsigned ones */}
      {canSign && unsignedPrescriptions.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <h4 className="font-medium text-amber-800">
                  {unsignedPrescriptions.length} ordonnance(s) non signée(s)
                </h4>
                <p className="text-sm text-amber-600">
                  Ces ordonnances nécessitent votre signature
                </p>
              </div>
            </div>
            <button
              onClick={handleSignAll}
              disabled={signingAll}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
            >
              {signingAll ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Signature...
                </>
              ) : (
                <>
                  <PenTool className="h-4 w-4" />
                  Tout signer
                </>
              )}
            </button>
          </div>

          {/* List unsigned prescriptions */}
          <div className="mt-3 space-y-2">
            {unsignedPrescriptions.map((rx) => {
              const rxId = rx._id || rx.id;
              return (
                <div
                  key={rxId}
                  className="flex items-center justify-between bg-white rounded-lg p-2 border border-amber-100"
                >
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-gray-700">
                      {formatDate(rx.createdAt || rx.date)}
                    </span>
                    <span className="text-xs text-gray-500">
                      - {rx.medications?.length || 0} médicament(s)
                    </span>
                  </div>
                  <button
                    onClick={() => handleSign(rx)}
                    disabled={signingId === rxId}
                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
                  >
                    {signingId === rxId ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Signature...
                      </>
                    ) : (
                      <>
                        <PenTool className="h-3 w-3" />
                        Signer
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <SectionEmptyState
          icon={Pill}
          message="Aucune prescription pour ce patient"
          action={
            canCreatePrescription && (
              <SectionActionButton
                icon={Plus}
                onClick={() => navigate(`/ophthalmology/studio/${patientId}`)}
              >
                Nouvelle ordonnance
              </SectionActionButton>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{activePrescriptions.length}</p>
              <p className="text-xs text-green-700">Actives</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{pendingPrescriptions.length}</p>
              <p className="text-xs text-yellow-700">En attente</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{prescriptions.length}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
          </div>

          {/* Recent Prescriptions */}
          <div className="space-y-2">
            {prescriptions.slice(0, 5).map((rx) => (
              <PrescriptionCard
                key={rx._id || rx.id}
                prescription={rx}
                formatDate={formatDate}
                onView={() => onViewPrescription?.(rx)}
                onPrint={() => onPrintPrescription?.(rx)}
                onRenew={() => handleRenew(rx)}
                onSign={() => handleSign(rx)}
                canSign={canSign}
                signingId={signingId}
              />
            ))}
          </div>

          {prescriptions.length > 5 && (
            <button
              onClick={() => navigate(`/prescriptions?patientId=${patientId}`)}
              className="w-full text-center text-sm text-orange-600 hover:text-orange-700 py-2"
            >
              Voir les {prescriptions.length} ordonnances →
            </button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// Prescription card component
function PrescriptionCard({ prescription, formatDate, onView, onPrint, onRenew, onSign, canSign, signingId }) {
  const rx = prescription;
  const rxId = rx._id || rx.id;
  const isSigned = rx.signature?.prescriber?.signed || rx.signature?.prescriber?.signedAt;
  const isUnsigned = !isSigned && rx.status !== 'cancelled';

  return (
    <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {formatDate(rx.createdAt || rx.date)}
          </span>
          <span className="text-xs text-gray-500">
            - {rx.prescriber?.name || 'Dr. Inconnu'}
          </span>
          {/* Signature status indicator */}
          {isSigned ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              <CheckCircle className="h-3 w-3" />
              Signée
            </span>
          ) : isUnsigned ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              <AlertTriangle className="h-3 w-3" />
              Non signée
            </span>
          ) : null}
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          rx.status === 'dispensed' ? 'bg-green-100 text-green-700' :
          rx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          rx.status === 'active' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {rx.status === 'dispensed' ? 'Dispensée' :
           rx.status === 'pending' ? 'En attente' :
           rx.status === 'active' ? 'Active' : rx.status}
        </span>
      </div>

      {/* Medications preview */}
      <div className="mb-2 space-y-1">
        {Array.isArray(rx.medications) && rx.medications.slice(0, 3).map((med, idx) => (
          <div key={idx} className="text-sm text-gray-600">
            <div className="flex items-center gap-1 flex-wrap">
              <span>• {safeString(med.medication, '') || safeString(med.name, '') || 'Médicament'}</span>
              {med.route && med.route !== 'oral' && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                  {med.route === 'ophthalmic' ? 'Collyre' : med.route}
                </span>
              )}
              {med.applicationLocation?.eye && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                  {med.applicationLocation.eye}
                </span>
              )}
              {med.taperingSchedule && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700">↘</span>
              )}
            </div>
            {med.dosage && <span className="text-gray-400 text-xs ml-2">{safeString(med.dosage, '')}</span>}
          </div>
        ))}
        {rx.medications?.length > 3 && (
          <p className="text-xs text-gray-400">+{rx.medications.length - 3} autres</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={onView}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Eye className="h-3 w-3" />
          Voir
        </button>
        <button
          onClick={onPrint}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-700"
        >
          <Printer className="h-3 w-3" />
          Imprimer
        </button>
        {rx.status === 'pending' && (
          <button
            onClick={onRenew}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
          >
            <RefreshCw className="h-3 w-3" />
            Renouveler
          </button>
        )}
        {/* Sign button for unsigned prescriptions */}
        {canSign && isUnsigned && (
          <button
            onClick={onSign}
            disabled={signingId === rxId}
            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 ml-auto disabled:opacity-50"
          >
            {signingId === rxId ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Signature...
              </>
            ) : (
              <>
                <PenTool className="h-3 w-3" />
                Signer
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
