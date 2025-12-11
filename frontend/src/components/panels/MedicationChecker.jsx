import { useState, useEffect, useMemo } from 'react';
import {
  Pill, AlertTriangle, AlertCircle, CheckCircle, XCircle,
  Clock, Shield, FileText, ChevronRight, RefreshCw, Info,
  AlertOctagon, Zap
} from 'lucide-react';
import { Panel, SectionCard, AlertBadge, MiniList } from './PanelBase';
import patientService from '../../services/patientService';
import { safeString } from '../../utils/apiHelpers';

// Common drug interactions database (simplified - in production, use a real drug database API)
const DRUG_INTERACTIONS = {
  'warfarin': ['aspirin', 'ibuprofen', 'naproxen', 'vitamin e', 'ginkgo'],
  'aspirin': ['warfarin', 'heparin', 'clopidogrel', 'ibuprofen'],
  'metformin': ['alcohol', 'contrast dye'],
  'lisinopril': ['potassium', 'spironolactone', 'nsaids'],
  'simvastatin': ['grapefruit', 'erythromycin', 'clarithromycin', 'gemfibrozil'],
  'methotrexate': ['nsaids', 'trimethoprim', 'penicillin'],
  'digoxin': ['amiodarone', 'verapamil', 'quinidine', 'diuretics'],
  'lithium': ['nsaids', 'ace inhibitors', 'diuretics'],
  'theophylline': ['ciprofloxacin', 'erythromycin', 'cimetidine'],
  'cyclosporine': ['nsaids', 'aminoglycosides', 'amphotericin']
};

// Severity levels
const INTERACTION_SEVERITY = {
  major: { label: 'Majeure', color: 'danger', icon: AlertOctagon },
  moderate: { label: 'Moderee', color: 'warning', icon: AlertTriangle },
  minor: { label: 'Mineure', color: 'info', icon: Info }
};

/**
 * Medication Checker Panel
 * Drug interaction checking, allergy alerts, and prescription safety
 */
export default function MedicationChecker({
  patient,
  patientId,
  newMedication, // Optional: medication being prescribed to check against
  variant = 'sidebar',
  onClose,
  onNavigateToMedications
}) {
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(patient || null);
  const [currentMedications, setCurrentMedications] = useState([]);
  const [prescriptionHistory, setPrescriptionHistory] = useState([]);
  const [priorAuths, setPriorAuths] = useState([]);

  useEffect(() => {
    const id = patientId || patient?._id || patient?.id;
    if (id) {
      fetchMedicationData(id);
    }
  }, [patientId, patient]);

  const fetchMedicationData = async (id) => {
    setLoading(true);
    try {
      // Fetch patient and prescriptions
      const [patientRes, prescriptionsRes] = await Promise.all([
        patient ? Promise.resolve(patient) : patientService.getPatient(id),
        patientService.getPatientPrescriptions?.(id).catch(() => ({ data: [] }))
      ]);

      setPatientData(patientRes?.data || patientRes);

      const prescriptions = prescriptionsRes?.data || prescriptionsRes || [];

      // Separate current vs history
      const active = prescriptions.filter(p =>
        p.status === 'active' || p.status === 'dispensed' ||
        (p.endDate && new Date(p.endDate) > new Date())
      );
      const history = prescriptions.filter(p =>
        p.status === 'completed' || p.status === 'discontinued' ||
        (p.endDate && new Date(p.endDate) <= new Date())
      ).slice(0, 10);

      setCurrentMedications(active);
      setPrescriptionHistory(history);

      // Extract prior auth requests
      const pas = prescriptions.filter(p => p.priorAuthorization || p.requiresPriorAuth);
      setPriorAuths(pas);

    } catch (error) {
      console.error('Error fetching medication data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check for drug interactions
  const interactions = useMemo(() => {
    const found = [];
    const meds = currentMedications.map(m =>
      (m.medication?.name || m.drugName || m.name || '').toLowerCase()
    );

    // Add new medication if provided
    if (newMedication) {
      meds.push(newMedication.toLowerCase());
    }

    // Check each medication pair
    meds.forEach((med1, idx) => {
      const drug1Interactions = Object.entries(DRUG_INTERACTIONS).find(([drug]) =>
        med1.includes(drug.toLowerCase())
      );

      if (drug1Interactions) {
        const [drug, interactsWith] = drug1Interactions;
        meds.forEach((med2, idx2) => {
          if (idx !== idx2) {
            const hasInteraction = interactsWith.some(interacting =>
              med2.includes(interacting.toLowerCase())
            );
            if (hasInteraction) {
              found.push({
                drug1: med1,
                drug2: med2,
                severity: 'major', // In production, get from database
                description: `Interaction potentielle entre ${med1} et ${med2}`
              });
            }
          }
        });
      }
    });

    // Remove duplicates
    const unique = found.filter((item, idx) =>
      found.findIndex(i =>
        (i.drug1 === item.drug1 && i.drug2 === item.drug2) ||
        (i.drug1 === item.drug2 && i.drug2 === item.drug1)
      ) === idx
    );

    return unique;
  }, [currentMedications, newMedication]);

  // Check for allergy conflicts
  const allergyConflicts = useMemo(() => {
    if (!patientData?.allergies || patientData.allergies.length === 0) return [];

    const conflicts = [];
    const allergies = patientData.allergies.map(a =>
      (typeof a === 'string' ? a : a.name || a.allergen || '').toLowerCase()
    );

    const medsToCheck = [...currentMedications];
    if (newMedication) {
      medsToCheck.push({ name: newMedication });
    }

    medsToCheck.forEach(med => {
      const medName = (med.medication?.name || med.drugName || med.name || '').toLowerCase();
      const medClass = (med.medication?.class || med.drugClass || '').toLowerCase();

      allergies.forEach(allergy => {
        if (medName.includes(allergy) || medClass.includes(allergy) || allergy.includes(medName)) {
          conflicts.push({
            medication: medName,
            allergy: allergy,
            severity: 'critical'
          });
        }
      });
    });

    return conflicts;
  }, [currentMedications, newMedication, patientData]);

  // Count issues
  const totalIssues = interactions.length + allergyConflicts.length;
  const hasCriticalIssues = allergyConflicts.length > 0 || interactions.some(i => i.severity === 'major');

  if (loading) {
    return (
      <Panel title="Verification Medicaments" icon={Pill} variant={variant} onClose={onClose}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Verification Medicaments"
      icon={Pill}
      variant={variant}
      onClose={onClose}
    >
      {/* Critical Alerts Summary */}
      {totalIssues > 0 && (
        <SectionCard
          alert
          alertType={hasCriticalIssues ? 'danger' : 'warning'}
        >
          <div className="flex items-center gap-2">
            {hasCriticalIssues ? (
              <AlertOctagon className="h-5 w-5 text-red-600 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <div className={`font-bold ${hasCriticalIssues ? 'text-red-700' : 'text-yellow-700'}`}>
                {totalIssues} Alerte{totalIssues > 1 ? 's' : ''} detectee{totalIssues > 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-600">
                {allergyConflicts.length > 0 && `${allergyConflicts.length} conflit(s) allergique(s)`}
                {allergyConflicts.length > 0 && interactions.length > 0 && ' • '}
                {interactions.length > 0 && `${interactions.length} interaction(s)`}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* No Issues - All Clear */}
      {totalIssues === 0 && currentMedications.length > 0 && (
        <SectionCard alert alertType="success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <div className="font-medium text-green-700">Aucun probleme detecte</div>
              <div className="text-xs text-green-600">
                {currentMedications.length} medicament(s) verifie(s)
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Allergy Conflicts - CRITICAL */}
      {allergyConflicts.length > 0 && (
        <SectionCard
          title="Conflits Allergiques"
          icon={AlertOctagon}
          alert
          alertType="danger"
        >
          <div className="space-y-2">
            {allergyConflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="p-2 bg-red-50 border border-red-200 rounded-lg animate-pulse-subtle"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="font-bold text-red-800 uppercase">CONTRE-INDIQUE</span>
                </div>
                <div className="text-sm text-red-700 mt-1">
                  <span className="font-medium">{conflict.medication}</span>
                  {' '}conflit avec allergie:{' '}
                  <span className="font-bold">{conflict.allergy}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Drug Interactions */}
      {interactions.length > 0 && (
        <SectionCard
          title="Interactions Medicamenteuses"
          icon={Zap}
          alert
          alertType={interactions.some(i => i.severity === 'major') ? 'danger' : 'warning'}
        >
          <div className="space-y-2">
            {interactions.map((interaction, idx) => {
              const severity = INTERACTION_SEVERITY[interaction.severity] || INTERACTION_SEVERITY.moderate;
              const SeverityIcon = severity.icon;
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border ${
                    severity.color === 'danger' ? 'bg-red-50 border-red-200' :
                    severity.color === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SeverityIcon className={`h-4 w-4 ${
                      severity.color === 'danger' ? 'text-red-600' :
                      severity.color === 'warning' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                    <AlertBadge type={severity.color}>{severity.label}</AlertBadge>
                  </div>
                  <div className="text-sm mt-1">
                    <span className="font-medium capitalize">{interaction.drug1}</span>
                    {' + '}
                    <span className="font-medium capitalize">{interaction.drug2}</span>
                  </div>
                  {interaction.description && (
                    <div className="text-xs text-gray-600 mt-1">{interaction.description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Patient Allergies */}
      {patientData?.allergies?.length > 0 && (
        <SectionCard title="Allergies Patient" icon={AlertTriangle} alert alertType="warning">
          <div className="flex flex-wrap gap-1.5">
            {patientData.allergies.map((allergy, idx) => (
              <AlertBadge key={idx} type="danger">
                {typeof allergy === 'string' ? allergy : allergy.name || allergy.allergen}
              </AlertBadge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Current Medications */}
      <SectionCard title="Medicaments Actifs" icon={Pill}>
        {currentMedications.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Aucun medicament actif</p>
        ) : (
          <div className="space-y-2">
            {currentMedications.map((med, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
              >
                <div>
                  <div className="font-medium text-gray-800 text-sm">
                    {med.medication?.name || med.drugName || med.name}
                  </div>
                  {med.dosage && (
                    <div className="text-xs text-gray-500">{safeString(med.dosage, '')}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {med.requiresPriorAuth && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      med.priorAuthStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      med.priorAuthStatus === 'denied' ? 'bg-red-100 text-red-700' :
                      med.priorAuthStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      PA: {med.priorAuthStatus || 'Requis'}
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${
                    med.status === 'active' ? 'bg-green-500' :
                    med.status === 'dispensed' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`} title={med.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {onNavigateToMedications && (
          <button
            onClick={() => onNavigateToMedications(patientData?._id)}
            className="mt-2 w-full text-xs text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1 py-1"
          >
            Voir tous les medicaments <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </SectionCard>

      {/* Prior Authorization Status */}
      {priorAuths.length > 0 && (
        <SectionCard title="Autorisations Prealables" icon={Shield}>
          <div className="space-y-2">
            {priorAuths.slice(0, 3).map((pa, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate max-w-[150px]">
                  {pa.medication?.name || pa.drugName}
                </span>
                <span className={`px-1.5 py-0.5 rounded ${
                  pa.priorAuthStatus === 'approved' ? 'bg-green-100 text-green-700' :
                  pa.priorAuthStatus === 'denied' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {pa.priorAuthStatus === 'approved' ? 'Approuve' :
                   pa.priorAuthStatus === 'denied' ? 'Refuse' :
                   pa.priorAuthStatus === 'pending' ? 'En attente' : 'A soumettre'}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recent Prescription History */}
      {prescriptionHistory.length > 0 && (
        <SectionCard title="Historique Recent" icon={FileText}>
          <MiniList
            items={prescriptionHistory}
            maxItems={4}
            emptyText="Aucun historique"
            renderItem={(rx) => (
              <div className="flex items-center justify-between py-1 text-xs border-b border-gray-100 last:border-0">
                <span className="text-gray-600">
                  {rx.medication?.name || rx.drugName || rx.name}
                </span>
                <span className="text-gray-400">
                  {new Date(rx.prescribedDate || rx.createdAt).toLocaleDateString('fr-FR', {
                    month: 'short',
                    year: '2-digit'
                  })}
                </span>
              </div>
            )}
          />
        </SectionCard>
      )}

      {/* New Medication Check */}
      {newMedication && (
        <SectionCard
          title="Nouveau Medicament"
          icon={Pill}
          alert
          alertType={allergyConflicts.length > 0 || interactions.length > 0 ? 'warning' : 'success'}
        >
          <div className="flex items-center gap-2">
            {allergyConflicts.length === 0 && interactions.length === 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 text-sm">
                  <span className="font-medium capitalize">{newMedication}</span> peut etre prescrit
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700 text-sm">
                  Verifier les alertes ci-dessus avant de prescrire{' '}
                  <span className="font-medium capitalize">{newMedication}</span>
                </span>
              </>
            )}
          </div>
        </SectionCard>
      )}
    </Panel>
  );
}
