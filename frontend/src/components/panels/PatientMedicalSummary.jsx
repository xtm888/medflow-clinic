import { useState, useEffect } from 'react';
import {
  User, AlertTriangle, Heart, Pill, FlaskConical, Calendar,
  Phone, Mail, CreditCard, Clock, Activity, Eye, Droplet,
  FileText, ChevronRight, Shield, Baby, Star
} from 'lucide-react';
import { Panel, SectionCard, StatBox, AlertBadge, MiniList, VIPBadge, MiniSparkline } from './PanelBase';
import patientService from '../../services/patientService';
import { safeString } from '../../utils/apiHelpers';

/**
 * Patient Medical Summary Panel
 * Comprehensive at-a-glance patient information
 */
export default function PatientMedicalSummary({
  patient,
  patientId,
  variant = 'sidebar',
  onClose,
  onNavigateToProfile,
  showFinancials = true,
  showAppointments = true,
  compact = false
}) {
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState(patient || null);
  const [visits, setVisits] = useState([]);
  const [medications, setMedications] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [iopHistory, setIopHistory] = useState([]);

  useEffect(() => {
    if (patientId && !patient) {
      fetchPatientData(patientId);
    } else if (patient) {
      setPatientData(patient);
      fetchAdditionalData(patient._id || patient.id);
    }
  }, [patientId, patient]);

  const fetchPatientData = async (id) => {
    setLoading(true);
    try {
      const response = await patientService.getPatient(id);
      setPatientData(response.data || response);
      fetchAdditionalData(id);
    } catch (error) {
      console.error('Error fetching patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdditionalData = async (id) => {
    try {
      // Fetch recent visits, medications, labs in parallel
      const [visitsRes, prescriptionsRes] = await Promise.all([
        patientService.getPatientVisits?.(id).catch(() => ({ data: [] })),
        patientService.getPatientPrescriptions?.(id).catch(() => ({ data: [] }))
      ]);

      setVisits((visitsRes?.data || visitsRes || []).slice(0, 5));
      setMedications((prescriptionsRes?.data || prescriptionsRes || []).slice(0, 5));

      // Extract IOP history from visits for sparkline
      const iops = (visitsRes?.data || visitsRes || [])
        .filter(v => v.vitalSigns?.iop?.od || v.vitalSigns?.iop?.og)
        .slice(0, 10)
        .map(v => ({
          od: v.vitalSigns?.iop?.od,
          og: v.vitalSigns?.iop?.og,
          date: v.date
        }))
        .reverse();
      setIopHistory(iops);

    } catch (error) {
      console.error('Error fetching additional data:', error);
    }
  };

  if (loading) {
    return (
      <Panel title="Patient" icon={User} variant={variant} onClose={onClose}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </Panel>
    );
  }

  if (!patientData) {
    return (
      <Panel title="Patient" icon={User} variant={variant} onClose={onClose}>
        <div className="text-center py-8 text-gray-500 text-sm">
          Selectionnez un patient
        </div>
      </Panel>
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

  // Get last IOP values
  const lastIOP = iopHistory[iopHistory.length - 1];
  const iopOdValues = iopHistory.map(i => i.od).filter(Boolean);
  const iopOgValues = iopHistory.map(i => i.og).filter(Boolean);

  return (
    <Panel
      title={compact ? 'Patient' : `${patientData.firstName} ${patientData.lastName}`}
      icon={User}
      variant={variant}
      onClose={onClose}
      collapsible={!compact}
    >
      {/* Identity Section */}
      <SectionCard compact>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-lg">
              {patientData.firstName?.[0]}{patientData.lastName?.[0]}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900 truncate">
                {patientData.firstName} {patientData.lastName}
              </h4>
              {isVIP && <VIPBadge type="vip" />}
              {isPregnant && <VIPBadge type="pregnant" />}
              {isElderly && <VIPBadge type="elderly" />}
              {isChild && <VIPBadge type="child" />}
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
              {age && <span>{age} ans</span>}
              <span>{patientData.gender === 'male' ? 'M' : patientData.gender === 'female' ? 'F' : '-'}</span>
              {patientData.bloodType && (
                <span className="flex items-center gap-0.5">
                  <Droplet className="h-3 w-3 text-red-400" />
                  {patientData.bloodType}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              {patientData.phone && (
                <a href={`tel:${patientData.phone}`} className="flex items-center gap-0.5 hover:text-purple-600">
                  <Phone className="h-3 w-3" />
                  {patientData.phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick action */}
        {onNavigateToProfile && (
          <button
            onClick={() => onNavigateToProfile(patientData._id || patientData.id)}
            className="mt-2 w-full text-xs text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1 py-1 rounded hover:bg-purple-50"
          >
            Voir profil complet <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </SectionCard>

      {/* CRITICAL: Allergies Alert */}
      {hasAllergies && (
        <SectionCard
          title="Allergies"
          icon={AlertTriangle}
          alert
          alertType="danger"
        >
          <div className="flex flex-wrap gap-1.5">
            {patientData.allergies.map((allergy, idx) => (
              <AlertBadge key={idx} type="danger" pulse>
                {typeof allergy === 'string' ? allergy : allergy.name || allergy.allergen}
              </AlertBadge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Chronic Conditions */}
      {hasChronicConditions && (
        <SectionCard title="Conditions" icon={Heart} alert alertType="warning">
          <div className="flex flex-wrap gap-1.5">
            {(patientData.chronicConditions || patientData.medicalHistory?.conditions || []).map((cond, idx) => (
              <AlertBadge key={idx} type="warning">
                {typeof cond === 'string' ? cond : cond.name}
              </AlertBadge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Vital Signs - IOP Focus */}
      {(lastIOP || patientData.vitalSigns) && (
        <SectionCard title="Derniers Signes Vitaux" icon={Activity}>
          <div className="grid grid-cols-2 gap-2">
            {lastIOP && (
              <>
                <StatBox
                  label="PIO OD"
                  value={lastIOP.od || '-'}
                  subvalue="mmHg"
                  alert={lastIOP.od > 21}
                  alertType={lastIOP.od > 25 ? 'danger' : 'warning'}
                />
                <StatBox
                  label="PIO OG"
                  value={lastIOP.og || '-'}
                  subvalue="mmHg"
                  alert={lastIOP.og > 21}
                  alertType={lastIOP.og > 25 ? 'danger' : 'warning'}
                />
              </>
            )}
          </div>

          {/* IOP Sparkline */}
          {iopOdValues.length > 2 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Tendance PIO (OD)</div>
              <MiniSparkline
                data={iopOdValues}
                height={25}
                color={iopOdValues[iopOdValues.length - 1] > 21 ? '#ef4444' : '#8b5cf6'}
              />
            </div>
          )}
        </SectionCard>
      )}

      {/* Active Medications */}
      <SectionCard title="Medicaments Actifs" icon={Pill}>
        <MiniList
          items={medications}
          maxItems={4}
          emptyText="Aucun medicament actif"
          renderItem={(med) => (
            <div className="py-1 border-b border-gray-100 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium text-gray-800">
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
                  <span className="w-2 h-2 rounded-full bg-green-500" title="Actif" />
                )}
              </div>
            </div>
          )}
          onViewAll={onNavigateToProfile ? () => onNavigateToProfile(patientData._id, 'medications') : undefined}
        />
      </SectionCard>

      {/* Recent Lab Results */}
      <SectionCard title="Derniers Resultats Labo" icon={FlaskConical}>
        <MiniList
          items={labResults.length > 0 ? labResults : patientData.recentLabResults || []}
          maxItems={3}
          emptyText="Aucun resultat recent"
          renderItem={(lab) => (
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-700">{lab.testName || lab.name}</span>
              <div className="flex items-center gap-1">
                <span className={`font-medium ${lab.isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
                  {lab.value} {lab.unit}
                </span>
                {lab.isAbnormal && (
                  <span className="text-red-500 text-xs">
                    {lab.abnormalFlag === 'high' ? '↑' : lab.abnormalFlag === 'low' ? '↓' : '!'}
                  </span>
                )}
              </div>
            </div>
          )}
        />
      </SectionCard>

      {/* Recent Visits */}
      <SectionCard title="Visites Recentes" icon={Calendar}>
        <MiniList
          items={visits}
          maxItems={3}
          emptyText="Aucune visite recente"
          renderItem={(visit) => (
            <div className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div>
                <span className="text-gray-700">
                  {new Date(visit.date || visit.createdAt).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </span>
                <span className="text-gray-500 ml-2 text-xs">
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
          )}
          onViewAll={onNavigateToProfile ? () => onNavigateToProfile(patientData._id, 'history') : undefined}
        />
      </SectionCard>

      {/* Upcoming Appointments */}
      {showAppointments && (
        <SectionCard title="Prochains RDV" icon={Clock}>
          <MiniList
            items={appointments.length > 0 ? appointments : patientData.upcomingAppointments || []}
            maxItems={2}
            emptyText="Aucun RDV programme"
            renderItem={(apt) => (
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-700">
                  {new Date(apt.date || apt.startTime).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                <span className="text-xs text-gray-500">{apt.type || apt.appointmentType}</span>
              </div>
            )}
          />
        </SectionCard>
      )}

      {/* Financial Summary */}
      {showFinancials && (
        <SectionCard title="Solde" icon={CreditCard}>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Montant du:</span>
            <span className={`font-bold ${
              (patientData.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {(patientData.balance || 0).toFixed(2)} €
            </span>
          </div>
          {patientData.insurance && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Assurance:
              </span>
              <span className="text-gray-700">{patientData.insurance.provider || (typeof patientData.insurance === 'string' ? patientData.insurance : 'Assurance')}</span>
            </div>
          )}
        </SectionCard>
      )}
    </Panel>
  );
}
