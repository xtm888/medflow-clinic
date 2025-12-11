import { useState, useEffect, useMemo } from 'react';
import {
  User, AlertTriangle, Heart, Pill, FlaskConical, Calendar,
  Phone, Eye, Droplet, Activity, Shield, AlertOctagon,
  TrendingUp, TrendingDown, Minus, X, ChevronRight, Zap
} from 'lucide-react';
import { Panel, SectionCard, StatBox, AlertBadge, MiniList, MiniSparkline, VIPBadge } from './PanelBase';
import patientService from '../../services/patientService';
import { safeString } from '../../utils/apiHelpers';

// Common drug interactions database
const DRUG_INTERACTIONS = {
  'warfarin': ['aspirin', 'ibuprofen', 'naproxen', 'vitamin e', 'ginkgo'],
  'aspirin': ['warfarin', 'heparin', 'clopidogrel', 'ibuprofen'],
  'metformin': ['alcohol', 'contrast dye'],
  'lisinopril': ['potassium', 'spironolactone', 'nsaids'],
  'simvastatin': ['grapefruit', 'erythromycin', 'clarithromycin', 'gemfibrozil'],
  'methotrexate': ['nsaids', 'trimethoprim', 'penicillin'],
  'digoxin': ['amiodarone', 'verapamil', 'quinidine', 'diuretics'],
  'timolol': ['verapamil', 'diltiazem', 'beta-blockers'],
  'latanoprost': ['nsaids', 'thimerosal'],
  'pilocarpine': ['atropine', 'anticholinergics'],
  'acetazolamide': ['aspirin', 'lithium', 'methotrexate']
};

/**
 * Clinical Summary Panel - ALL-IN-ONE view for clinicians
 * Shows everything a doctor/nurse needs at a glance without tabs
 */
export default function ClinicalSummaryPanel({
  patient,
  patientId,
  variant = 'sidebar',
  onClose,
  onNavigateToProfile,
  showOphthalmology = true // Show IOP/refraction for eye clinics
}) {
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(patient || null);
  const [visits, setVisits] = useState([]);
  const [medications, setMedications] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [iopHistory, setIopHistory] = useState([]);

  useEffect(() => {
    const id = patientId || patient?._id || patient?.id;
    if (id) {
      if (!patient) {
        fetchPatientData(id);
      } else {
        setPatientData(patient);
        fetchAllData(id);
      }
    }
  }, [patientId, patient]);

  const fetchPatientData = async (id) => {
    setLoading(true);
    try {
      const response = await patientService.getPatient(id);
      setPatientData(response.data || response);
      fetchAllData(id);
    } catch (error) {
      console.error('Error fetching patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async (id) => {
    try {
      const [visitsRes, prescriptionsRes] = await Promise.all([
        patientService.getPatientVisits?.(id).catch(() => ({ data: [] })),
        patientService.getPatientPrescriptions?.(id).catch(() => ({ data: [] }))
      ]);

      const visitsData = Array.isArray(visitsRes?.data) ? visitsRes.data : (Array.isArray(visitsRes) ? visitsRes : []);
      setVisits(visitsData.slice(0, 5));

      const prescriptionsData = Array.isArray(prescriptionsRes?.data) ? prescriptionsRes.data : (Array.isArray(prescriptionsRes) ? prescriptionsRes : []);
      setMedications(prescriptionsData.slice(0, 10));

      // Extract IOP history
      const iops = visitsData
        .filter(v => v.vitalSigns?.iop?.od || v.vitalSigns?.iop?.og || v.examination?.iop)
        .slice(0, 10)
        .map(v => ({
          od: v.vitalSigns?.iop?.od || v.examination?.iop?.od,
          og: v.vitalSigns?.iop?.og || v.examination?.iop?.og,
          date: v.date || v.createdAt
        }))
        .reverse();
      setIopHistory(iops);

      // Extract lab results
      const labs = visitsData
        .flatMap(v => v.labResults || [])
        .slice(0, 5);
      setLabResults(labs);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Check drug interactions
  const interactions = useMemo(() => {
    const found = [];
    const medNames = medications.map(m =>
      (m.medication?.name || m.drugName || m.name || '').toLowerCase()
    );

    medNames.forEach((med1, i) => {
      const interactsWith = DRUG_INTERACTIONS[med1] || [];
      medNames.forEach((med2, j) => {
        if (i < j && interactsWith.some(int => med2.includes(int) || int.includes(med2))) {
          found.push({ drug1: medNames[i], drug2: medNames[j], severity: 'moderate' });
        }
      });
    });
    return found;
  }, [medications]);

  // Check allergy conflicts
  const allergyConflicts = useMemo(() => {
    if (!patientData?.allergies?.length) return [];
    const allergies = patientData.allergies.map(a =>
      (typeof a === 'string' ? a : a.name || a.allergen || '').toLowerCase()
    );

    return medications.filter(med => {
      const medName = (med.medication?.name || med.drugName || med.name || '').toLowerCase();
      return allergies.some(allergy =>
        medName.includes(allergy) || allergy.includes(medName)
      );
    });
  }, [medications, patientData?.allergies]);

  if (loading) {
    return (
      <div className="bg-white h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="bg-white h-full flex items-center justify-center text-gray-500">
        Selectionnez un patient
      </div>
    );
  }

  const age = patientData.dateOfBirth
    ? Math.floor((Date.now() - new Date(patientData.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const hasAllergies = patientData.allergies?.length > 0;
  const hasChronicConditions = patientData.chronicConditions?.length > 0 || patientData.medicalHistory?.conditions?.length > 0;
  const isVIP = patientData.isVIP || patientData.priority === 'vip';
  const isPregnant = patientData.isPregnant;
  const isElderly = age >= 65;
  const isChild = age < 18;

  const lastIOP = iopHistory[iopHistory.length - 1];
  const iopOdValues = iopHistory.map(i => i.od).filter(Boolean);
  const iopOgValues = iopHistory.map(i => i.og).filter(Boolean);

  const hasCriticalAlerts = allergyConflicts.length > 0 || interactions.length > 0;

  return (
    <div className={`bg-white h-full flex flex-col ${variant === 'sidebar' ? 'border-l border-gray-200 shadow-lg' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
            {patientData.firstName?.[0]}{patientData.lastName?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">
                {patientData.firstName} {patientData.lastName}
              </h3>
              {isVIP && <VIPBadge type="vip" />}
              {isPregnant && <VIPBadge type="pregnant" />}
              {isElderly && <VIPBadge type="elderly" />}
              {isChild && <VIPBadge type="child" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {age && <span>{age} ans</span>}
              <span>{patientData.gender === 'male' ? 'M' : patientData.gender === 'female' ? 'F' : '-'}</span>
              {patientData.bloodType && (
                <span className="flex items-center gap-0.5">
                  <Droplet className="h-3 w-3 text-red-400" />
                  {patientData.bloodType}
                </span>
              )}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Scrollable Content - Everything visible at once */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* CRITICAL SECTION - Always at top, always visible */}
        {(hasCriticalAlerts || hasAllergies) && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 animate-pulse">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <AlertOctagon className="h-5 w-5" />
              ALERTES CRITIQUES
            </div>

            {/* Allergy Conflicts with Medications */}
            {allergyConflicts.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-red-800 mb-1">⚠️ CONFLIT ALLERGIE-MEDICAMENT:</div>
                {allergyConflicts.map((med, idx) => (
                  <div key={idx} className="text-sm text-red-700 bg-red-100 rounded px-2 py-1 mb-1">
                    {med.medication?.name || med.drugName || med.name}
                  </div>
                ))}
              </div>
            )}

            {/* Drug Interactions */}
            {interactions.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-red-800 mb-1">⚠️ INTERACTIONS MEDICAMENTEUSES:</div>
                {interactions.map((int, idx) => (
                  <div key={idx} className="text-sm text-orange-700 bg-orange-100 rounded px-2 py-1 mb-1">
                    {int.drug1} ↔ {int.drug2}
                  </div>
                ))}
              </div>
            )}

            {/* Allergies */}
            {hasAllergies && (
              <div>
                <div className="text-xs font-semibold text-red-800 mb-1">ALLERGIES:</div>
                <div className="flex flex-wrap gap-1">
                  {patientData.allergies.map((allergy, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs font-medium">
                      {typeof allergy === 'string' ? allergy : allergy.name || allergy.allergen}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chronic Conditions */}
        {hasChronicConditions && (
          <SectionCard title="Antecedents" icon={Heart} alert alertType="warning">
            <div className="flex flex-wrap gap-1">
              {(patientData.chronicConditions || patientData.medicalHistory?.conditions || []).map((cond, idx) => (
                <AlertBadge key={idx} type="warning">
                  {typeof cond === 'string' ? cond : cond.name}
                </AlertBadge>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Current Medications - Always visible */}
        <SectionCard title="Medicaments Actuels" icon={Pill}>
          {medications.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucun medicament actif</p>
          ) : (
            <div className="space-y-1">
              {medications.slice(0, 6).map((med, idx) => (
                <div key={idx} className="py-1 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {med.medication?.name || med.drugName || med.name}
                        </span>
                        {med.route && med.route !== 'oral' && (
                          <span className="px-1 py-0.5 text-xs rounded bg-purple-100 text-purple-700">
                            {med.route === 'ophthalmic' ? 'Collyre' : med.route}
                          </span>
                        )}
                        {med.applicationLocation?.eye && (
                          <span className="px-1 py-0.5 text-xs rounded bg-blue-100 text-blue-700">
                            {med.applicationLocation.eye}
                          </span>
                        )}
                        {med.taperingSchedule && (
                          <span className="px-1 py-0.5 text-xs rounded bg-amber-100 text-amber-700">↘</span>
                        )}
                      </div>
                      {med.dosage && (
                        <span className="text-xs text-gray-500">{safeString(med.dosage, '')}</span>
                      )}
                    </div>
                    {med.status === 'active' && (
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </div>
                </div>
              ))}
              {medications.length > 6 && (
                <p className="text-xs text-purple-600">+{medications.length - 6} autres...</p>
              )}
            </div>
          )}
        </SectionCard>

        {/* IOP & Vital Signs - For Ophthalmology */}
        {showOphthalmology && (lastIOP || iopHistory.length > 0) && (
          <SectionCard title="PIO (Pression Intraoculaire)" icon={Eye}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <StatBox
                label="OD (Droit)"
                value={lastIOP?.od || '-'}
                subvalue="mmHg"
                alert={lastIOP?.od > 21}
                alertType={lastIOP?.od > 25 ? 'danger' : 'warning'}
              />
              <StatBox
                label="OG (Gauche)"
                value={lastIOP?.og || '-'}
                subvalue="mmHg"
                alert={lastIOP?.og > 21}
                alertType={lastIOP?.og > 25 ? 'danger' : 'warning'}
              />
            </div>

            {/* IOP Trend */}
            {iopOdValues.length > 2 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Tendance OD</span>
                  <span className="flex items-center gap-1">
                    {iopOdValues[iopOdValues.length - 1] > iopOdValues[0] ? (
                      <><TrendingUp className="h-3 w-3 text-red-500" /> En hausse</>
                    ) : iopOdValues[iopOdValues.length - 1] < iopOdValues[0] ? (
                      <><TrendingDown className="h-3 w-3 text-green-500" /> En baisse</>
                    ) : (
                      <><Minus className="h-3 w-3 text-gray-400" /> Stable</>
                    )}
                  </span>
                </div>
                <MiniSparkline
                  data={iopOdValues}
                  height={30}
                  color={iopOdValues[iopOdValues.length - 1] > 21 ? '#ef4444' : '#8b5cf6'}
                />
              </div>
            )}

            {/* Reference Guide */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-gray-500">Normal: 10-21 mmHg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-gray-500">Limite: 21-25 mmHg</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-gray-500">Elevee: &gt;25 mmHg</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Recent Lab Results */}
        {labResults.length > 0 && (
          <SectionCard title="Derniers Resultats Labo" icon={FlaskConical}>
            <div className="space-y-1">
              {labResults.slice(0, 4).map((lab, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{lab.testName || lab.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${lab.isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
                      {lab.value} {lab.unit}
                    </span>
                    {lab.isAbnormal && (
                      <span className="text-red-500 text-xs">
                        {lab.abnormalFlag === 'high' ? '↑' : lab.abnormalFlag === 'low' ? '↓' : '!'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Recent Visits */}
        <SectionCard title="Visites Recentes" icon={Calendar}>
          {visits.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune visite recente</p>
          ) : (
            <div className="space-y-1">
              {visits.slice(0, 3).map((visit, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-sm text-gray-700">
                      {new Date(visit.date || visit.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {visit.visitType || visit.type || 'Consultation'}
                    </span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                    visit.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {visit.status === 'completed' ? 'Termine' :
                     visit.status === 'in-progress' ? 'En cours' : visit.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Contact Info */}
        {patientData.phone && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
            <Phone className="h-4 w-4 text-gray-400" />
            <a href={`tel:${patientData.phone}`} className="text-purple-600 hover:underline">
              {patientData.phone}
            </a>
          </div>
        )}

        {/* View Full Profile Button */}
        {onNavigateToProfile && (
          <button
            onClick={() => onNavigateToProfile(patientData._id || patientData.id)}
            className="w-full py-2 text-sm text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
          >
            Voir profil complet <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
