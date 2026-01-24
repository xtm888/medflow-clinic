/**
 * PatientCompactDashboard - 3-Column StudioVision Layout
 *
 * Compact dashboard view showing all patient data at a glance.
 * Designed for efficient clinical workflow with quick access to key information.
 *
 * Layout:
 * - Left (25%): Patient Info, Quick Actions, Alerts, Documents, Antecedents
 * - Center (50%): Clinical Data with COLOR-CODED sections (StudioVision style)
 *   - PINK: Refraction
 *   - GREEN: Tonometry/IOP
 *   - YELLOW: Pathologies/Diagnoses
 *   - ORANGE: Treatment/Medications
 * - Right (25%): Visit History, Quick Print, Appointments, Notes
 *
 * StudioVision Parity: Color-coded clinical sections, French medical fields
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import patientService from '../../services/patientService';
import deviceDataService from '../../services/deviceDataService';
import {
  Eye,
  Glasses,
  Activity,
  FileText,
  Calendar,
  Printer,
  AlertTriangle,
  Bell,
  Pill,
  Stethoscope,
  Camera,
  ChevronRight,
  ChevronDown,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Edit,
  LayoutGrid,
  List,
  Plus,
  Download,
  Upload,
  History,
  Settings,
  Heart,
  Shield,
  CreditCard,
  Briefcase,
  Hash,
  Star
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { safeFormatDate } from '../../utils/dateHelpers';

// ============================================================================
// STUDIOVISION COLOR-CODED SECTION SYSTEM
// ============================================================================

/**
 * StudioVision-style color variants for clinical sections
 * Matches the exact color scheme from oph1.jpg reference
 */
const SECTION_VARIANTS = {
  // Pink/Rose - Refraction section
  refraction: {
    container: 'bg-pink-50 border-pink-300',
    header: 'bg-pink-100 border-pink-200',
    headerText: 'text-pink-800',
    icon: 'text-pink-600',
    accent: 'bg-pink-200',
  },
  // Green - Tonometry/IOP section
  tonometry: {
    container: 'bg-green-50 border-green-300',
    header: 'bg-green-100 border-green-200',
    headerText: 'text-green-800',
    icon: 'text-green-600',
    accent: 'bg-green-200',
  },
  // Yellow - Pathologies/Diagnoses section
  pathology: {
    container: 'bg-yellow-50 border-yellow-300',
    header: 'bg-yellow-100 border-yellow-200',
    headerText: 'text-yellow-800',
    icon: 'text-yellow-600',
    accent: 'bg-yellow-200',
  },
  // Orange - Treatment/Medications section
  treatment: {
    container: 'bg-orange-50 border-orange-300',
    header: 'bg-orange-100 border-orange-200',
    headerText: 'text-orange-800',
    icon: 'text-orange-600',
    accent: 'bg-orange-200',
  },
  // Blue - Patient Info (left column)
  patient: {
    container: 'bg-blue-50 border-blue-300',
    header: 'bg-blue-100 border-blue-200',
    headerText: 'text-blue-800',
    icon: 'text-blue-600',
    accent: 'bg-blue-200',
  },
  // Red - Important/Alerts
  important: {
    container: 'bg-red-50 border-red-300',
    header: 'bg-red-100 border-red-200',
    headerText: 'text-red-800',
    icon: 'text-red-600',
    accent: 'bg-red-200',
  },
  // Default gray
  default: {
    container: 'bg-white border-gray-200',
    header: 'bg-gray-50 border-gray-200',
    headerText: 'text-gray-700',
    icon: 'text-gray-500',
    accent: 'bg-gray-100',
  },
};

/**
 * Compact card component for consistent styling
 * @param {string} variant - StudioVision color variant: refraction, tonometry, pathology, treatment, patient, important, default
 */
function CompactCard({ title, icon: Icon, children, className = '', headerAction, collapsed, onToggle, variant = 'default' }) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed || false);

  // Get color styles from variant
  const colors = SECTION_VARIANTS[variant] || SECTION_VARIANTS.default;

  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isCollapsed);
    }
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`rounded-lg border shadow-sm ${colors.container} ${className}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 border-b cursor-pointer ${colors.header}`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${colors.icon}`} />}
          <span className={`text-sm font-medium ${colors.headerText}`}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {isCollapsed ? (
            <ChevronRight className={`w-4 h-4 ${colors.icon}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${colors.icon}`} />
          )}
        </div>
      </div>
      {!isCollapsed && <div className="p-3">{children}</div>}
    </div>
  );
}

/**
 * Quick action button component
 */
function QuickAction({ icon: Icon, label, onClick, variant = 'default', disabled }) {
  const variants = {
    default: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    primary: 'bg-blue-100 hover:bg-blue-200 text-blue-700',
    success: 'bg-green-100 hover:bg-green-200 text-green-700',
    warning: 'bg-amber-100 hover:bg-amber-200 text-amber-700',
    danger: 'bg-red-100 hover:bg-red-200 text-red-700'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Clinical value display with OD/OS
 */
function ClinicalValue({ label, od, os, unit = '', highlight = false }) {
  return (
    <div className={`flex items-center justify-between py-1 ${highlight ? 'bg-blue-50 px-2 rounded' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-800 font-medium">{od || '-'}{unit}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">{os || '-'}{unit}</span>
      </div>
    </div>
  );
}

/**
 * Alert badge component
 */
function AlertBadge({ type, count, label }) {
  const colors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  if (count === 0) return null;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded border ${colors[type]}`}>
      <AlertTriangle className="w-3 h-3" />
      <span className="text-xs font-medium">{count} {label}</span>
    </div>
  );
}

export default function PatientCompactDashboard({
  patient,
  onToggleView,
  onAction,
  onNavigateToSection
}) {
  const navigate = useNavigate();

  // Calculate patient age
  const patientAge = useMemo(() => {
    if (!patient?.dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(patient.dateOfBirth));
  }, [patient?.dateOfBirth]);

  // State for visits and refraction data loaded from API
  const [visitsData, setVisitsData] = useState([]);
  const [extractedRefraction, setExtractedRefraction] = useState({});
  const [extractedVisualAcuity, setExtractedVisualAcuity] = useState({});
  const [extractedIOP, setExtractedIOP] = useState({});
  const [careVisionImages, setCareVisionImages] = useState([]);
  const [careVisionKeratometry, setCareVisionKeratometry] = useState(null);
  const [latestIOPFromBridge, setLatestIOPFromBridge] = useState(null);

  // Device integration data (TONOREF, TOPCON, HFA, SOLIX, TOMEY)
  const [deviceExams, setDeviceExams] = useState([]);
  const [deviceRefraction, setDeviceRefraction] = useState(null);
  const [deviceIOP, setDeviceIOP] = useState(null);
  const [deviceKeratometry, setDeviceKeratometry] = useState(null);
  const [deviceImages, setDeviceImages] = useState([]);

  // Visit analytics (from CareVision bridge)
  const [visitAnalytics, setVisitAnalytics] = useState(null);

  // Check if patient has CareVision link
  const hasCareVisionLink = patient?.hasLegacyData || patient?.legacyIds?.lv || patient?.legacyIds?.careVision;

  // Load visits data to extract refraction (including legacy CareVision data)
  useEffect(() => {
    const loadVisitsData = async () => {
      if (!patient?._id) return;
      try {
        const response = await patientService.getPatientVisits(patient._id);
        // Handle different response structures (same as OphthalmologySection)
        const visitsArray = Array.isArray(response?.data) ? response.data : (response?.data?.data || response?.data?.visits || []);
        setVisitsData(visitsArray);

        // Find latest visit with refraction data
        const visitWithRefraction = visitsArray.find(v =>
          v.refraction?.subjective?.OD || v.refraction?.subjective?.OS ||
          v.refraction?.finalPrescription?.OD || v.refraction?.finalPrescription?.OS ||
          v.refraction?.OD || v.refraction?.OS ||
          v.refractions?.length > 0 || v.clinicalData?.refractions?.length > 0
        );

        if (visitWithRefraction) {
          // Extract refraction - check multiple possible paths (matches OphthalmologySection logic)
          const refData = visitWithRefraction.refraction?.finalPrescription ||
                          visitWithRefraction.refraction?.subjective ||
                          visitWithRefraction.refraction ||
                          {};
          setExtractedRefraction(refData);

          // Extract visual acuity from the visit
          const vaData = visitWithRefraction.visualAcuity ||
                         visitWithRefraction.refraction?.visualAcuity ||
                         {};
          setExtractedVisualAcuity(vaData);
        }

        // Find latest visit with IOP data (may be different from refraction visit)
        const visitWithIOP = visitsArray.find(v =>
          v.iop?.OD?.value || v.iop?.OS?.value || v.iop?.OD || v.iop?.OS
        );
        if (visitWithIOP?.iop) {
          setExtractedIOP(visitWithIOP.iop);
        }
      } catch (err) {
        console.error('Error loading visits for refraction:', err);
      }
    };
    loadVisitsData();
  }, [patient?._id]);

  // Load CareVision bridge data if patient has legacy link
  useEffect(() => {
    const loadCareVisionData = async () => {
      if (!patient?._id || !hasCareVisionLink) return;

      try {
        // Fetch combined history from CareVision bridge
        const history = await patientService.getCombinedHistory(patient._id, { limit: 100 });

        if (history) {
          // Extract images from CareVision
          if (history.carevision?.images?.length > 0) {
            setCareVisionImages(history.carevision.images);
          }

          // Extract keratometry from CareVision
          if (history.carevision?.keratometry?.length > 0) {
            setCareVisionKeratometry(history.carevision.keratometry[0]);
          }

          // Extract latest IOP from consultations if not already found
          const consultWithIOP = history.carevision?.consultations?.find(c =>
            c.tonometry?.od || c.tonometry?.os
          );
          if (consultWithIOP?.tonometry) {
            setLatestIOPFromBridge({
              OD: { value: consultWithIOP.tonometry.od },
              OS: { value: consultWithIOP.tonometry.os }
            });
          }

          // If no MedFlow refraction, try CareVision refraction
          if (!extractedRefraction?.OD && !extractedRefraction?.OS && history.carevision?.refractions?.length > 0) {
            const cvRef = history.carevision.refractions[0];
            setExtractedRefraction({
              OD: {
                sphere: cvRef.od?.sphere,
                cylinder: cvRef.od?.cylinder,
                axis: cvRef.od?.axis,
                add: cvRef.od?.add
              },
              OS: {
                sphere: cvRef.os?.sphere,
                cylinder: cvRef.os?.cylinder,
                axis: cvRef.os?.axis,
                add: cvRef.os?.add
              }
            });
            setExtractedVisualAcuity({
              OD: {
                corrected: cvRef.od?.visualAcuity?.distance,
                near: cvRef.od?.visualAcuity?.near
              },
              OS: {
                corrected: cvRef.os?.visualAcuity?.distance,
                near: cvRef.os?.visualAcuity?.near
              }
            });
          }

          // Extract visit analytics
          if (history.carevision?.visitAnalytics) {
            setVisitAnalytics(history.carevision.visitAnalytics);
          }
        }
      } catch (err) {
        console.error('Error loading CareVision bridge data:', err);
      }
    };
    loadCareVisionData();
  }, [patient?._id, hasCareVisionLink, extractedRefraction?.OD, extractedRefraction?.OS]);

  // Load device integration data (TONOREF, TOPCON, HFA, SOLIX, TOMEY)
  useEffect(() => {
    const loadDeviceData = async () => {
      if (!patient?._id) return;

      try {
        const response = await deviceDataService.getPatientDeviceData(patient._id);
        const exams = response?.data || response || [];
        setDeviceExams(exams);

        // Extract latest data from each device type
        exams.forEach(exam => {
          const source = exam.deviceSource || exam.source;

          // TONOREF III - refraction + IOP + keratometry
          if (source === 'TONOREF_III') {
            if (exam.measurements?.refraction && !deviceRefraction) {
              setDeviceRefraction({
                OD: exam.measurements.refraction.OD,
                OS: exam.measurements.refraction.OS,
                source: 'TONOREF III',
                date: exam.examDate || exam.createdAt
              });
            }
            if (exam.measurements?.tonometry && !deviceIOP) {
              setDeviceIOP({
                OD: { value: exam.measurements.tonometry.OD },
                OS: { value: exam.measurements.tonometry.OS },
                source: 'TONOREF III',
                date: exam.examDate || exam.createdAt
              });
            }
            if (exam.measurements?.keratometry && !deviceKeratometry) {
              setDeviceKeratometry({
                OD: exam.measurements.keratometry.OD,
                OS: exam.measurements.keratometry.OS,
                source: 'TONOREF III',
                date: exam.examDate || exam.createdAt
              });
            }
          }

          // TOPCON Maestro2 (ACQUISITION) - images
          if (source === 'ACQUISITION' && exam.files?.length > 0) {
            setDeviceImages(prev => [
              ...prev,
              ...exam.files.map((f, idx) => ({
                id: `${exam._id}-${idx}`,
                deviceSource: source,
                type: exam.reportType || 'FUNDUS',
                url: deviceDataService.getFileUrl(exam._id, idx),
                date: exam.examDate || exam.createdAt,
                eye: exam.eye
              }))
            ]);
          }

          // SOLIX OCT - images
          if (source === 'SOLIX_OCT' && exam.files?.length > 0) {
            setDeviceImages(prev => [
              ...prev,
              ...exam.files.map((f, idx) => ({
                id: `${exam._id}-${idx}`,
                deviceSource: source,
                type: exam.reportType || 'OCT',
                url: deviceDataService.getFileUrl(exam._id, idx),
                date: exam.examDate || exam.createdAt,
                eye: exam.eye
              }))
            ]);
          }

          // TOMEY MR-6000 - keratometry/topography images
          if (source === 'TOMEY_MR6000' && exam.files?.length > 0) {
            setDeviceImages(prev => [
              ...prev,
              ...exam.files.map((f, idx) => ({
                id: `${exam._id}-${idx}`,
                deviceSource: source,
                type: exam.reportType || 'TOPO',
                url: deviceDataService.getFileUrl(exam._id, idx),
                date: exam.examDate || exam.createdAt,
                eye: exam.eye
              }))
            ]);
          }

          // HFA Visual Field - PDFs/images
          if (source === 'HFA_VISUAL_FIELD' && exam.files?.length > 0) {
            setDeviceImages(prev => [
              ...prev,
              ...exam.files.map((f, idx) => ({
                id: `${exam._id}-${idx}`,
                deviceSource: source,
                type: exam.reportType || 'VF',
                url: deviceDataService.getFileUrl(exam._id, idx),
                date: exam.examDate || exam.createdAt,
                eye: exam.eye
              }))
            ]);
          }
        });
      } catch (err) {
        console.error('Error loading device integration data:', err);
      }
    };
    loadDeviceData();
  }, [patient?._id]);

  // ============================================================================
  // UNIFIED DATA PRIORITY: MedFlow → Device → CareVision → Legacy Exam
  // ============================================================================

  const latestExam = patient?.latestOphthalmologyExam || {};

  // Refraction priority: MedFlow visits → Device (TONOREF) → Legacy exam
  const latestRefraction = extractedRefraction?.OD || extractedRefraction?.OS
    ? extractedRefraction
    : (deviceRefraction?.OD || deviceRefraction?.OS)
      ? deviceRefraction
      : (patient?.latestRefraction || latestExam?.refraction || {});

  // Visual acuity priority: MedFlow visits → Legacy exam
  const latestVisualAcuity = extractedVisualAcuity?.OD || extractedVisualAcuity?.OS
    ? extractedVisualAcuity
    : latestExam.visualAcuity || {};

  // IOP priority: MedFlow visits → Device (TONOREF) → CareVision → Legacy exam
  const latestIOP = extractedIOP?.OD || extractedIOP?.OS
    ? extractedIOP
    : (deviceIOP?.OD || deviceIOP?.OS)
      ? deviceIOP
      : (latestIOPFromBridge?.OD || latestIOPFromBridge?.OS)
        ? latestIOPFromBridge
        : latestExam.iop || {};

  // Keratometry priority: Device (TONOREF/TOMEY) → CareVision → Legacy exam
  const latestKeratometry = deviceKeratometry?.OD || deviceKeratometry?.OS
    ? deviceKeratometry
    : careVisionKeratometry
      ? careVisionKeratometry
      : latestExam.keratometry || {};

  // Combined images from all sources
  const allImages = useMemo(() => {
    const combined = [];

    // Add device images
    deviceImages.forEach(img => {
      combined.push({
        ...img,
        source: 'device',
        sourceBadge: img.deviceSource?.replace('_', ' ') || 'Device'
      });
    });

    // Add CareVision images
    careVisionImages.forEach(img => {
      combined.push({
        id: `cv-${img.photoId || img.id}`,
        url: img.thumbnailUrl || `/api/carevision/bridge/images/${img.photoId}/thumbnail`,
        fullUrl: `/api/carevision/bridge/images/${img.photoId}/full`,
        type: img.albumName || 'Photo',
        date: img.date,
        eye: img.eye,
        source: 'carevision',
        sourceBadge: 'CareVision'
      });
    });

    // Sort by date (most recent first)
    return combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [deviceImages, careVisionImages]);

  // Count alerts
  const alertCounts = useMemo(() => {
    const alerts = patient?.patientAlerts || [];
    return {
      critical: alerts.filter(a => a.severity === 'critical' && !a.dismissed).length,
      warning: alerts.filter(a => a.severity === 'warning' && !a.dismissed).length,
      info: alerts.filter(a => a.severity === 'info' && !a.dismissed).length,
      allergies: (patient?.allergies || []).length
    };
  }, [patient?.patientAlerts, patient?.allergies]);

  // Format refraction display
  const formatRefraction = (eye) => {
    const data = latestRefraction?.[eye] || {};
    if (!data.sphere && !data.cylinder) return '-';
    const sph = data.sphere ? `${data.sphere > 0 ? '+' : ''}${data.sphere}` : 'pl';
    const cyl = data.cylinder ? `${data.cylinder > 0 ? '+' : ''}${data.cylinder}` : '';
    const axis = data.axis ? `x${data.axis}°` : '';
    return `${sph} ${cyl} ${axis}`.trim();
  };

  // Handle quick actions
  const handleNewConsultation = () => navigate(`/ophthalmology/studio/${patient?._id}`);
  const handleNewAppointment = () => navigate(`/appointments/new?patientId=${patient?._id}`);
  const handleViewHistory = () => onNavigateToSection?.('history');
  const handlePrintPrescription = () => onAction?.('print-prescription');
  const handlePrintCertificate = () => onAction?.('print-certificate');

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Chargement du patient...
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        {/* Patient Info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt={`${patient.firstName} ${patient.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {patient.lastName?.toUpperCase()} {patient.firstName}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{patient.patientId}</span>
              {patientAge && <span>{patientAge} ans</span>}
              {patient.gender && (
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                  {patient.gender === 'male' ? 'H' : 'F'}
                </span>
              )}
              {patient.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {patient.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle & Actions */}
        <div className="flex items-center gap-3">
          {/* Visit Analytics Badge */}
          {visitAnalytics && (
            <div className="flex items-center gap-2">
              {visitAnalytics.isRegularPatient && (
                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium" title={`Patient depuis ${visitAnalytics.patientSinceYears || 0} an(s) - ${visitAnalytics.completedVisits || 0} visites`}>
                  <Star className="w-3 h-3" />
                  Patient régulier
                </div>
              )}
              {visitAnalytics.visitFrequency && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded text-xs" title={`Intervalle moyen: ${visitAnalytics.averageIntervalDays || '?'} jours`}>
                  <Calendar className="w-3 h-3" />
                  {visitAnalytics.visitFrequency === 'monthly' && 'Mensuel'}
                  {visitAnalytics.visitFrequency === 'quarterly' && 'Trimestriel'}
                  {visitAnalytics.visitFrequency === 'biannual' && 'Semestriel'}
                  {visitAnalytics.visitFrequency === 'annual' && 'Annuel'}
                  {visitAnalytics.visitFrequency === 'irregular' && 'Irrégulier'}
                </div>
              )}
              {visitAnalytics.noShowRate > 20 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded text-xs" title={`${visitAnalytics.noShows} absences sur ${visitAnalytics.totalAppointments} RDV`}>
                  <AlertTriangle className="w-3 h-3" />
                  {visitAnalytics.noShowRate}% absences
                </div>
              )}
            </div>
          )}

          {/* Alert Summary */}
          <div className="flex items-center gap-2">
            <AlertBadge type="critical" count={alertCounts.critical} label="critique(s)" />
            <AlertBadge type="warning" count={alertCounts.allergies} label="allergie(s)" />
          </div>

          {/* View Toggle */}
          <button
            onClick={onToggleView}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
          >
            <List className="w-4 h-4" />
            Vue standard
          </button>

          {/* Edit Patient */}
          <button
            onClick={() => navigate(`/patients/${patient._id}/edit`)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Modifier le patient"
          >
            <Edit className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 gap-2">
        {/* LEFT COLUMN - Navigation & Quick Actions (25%) */}
        <div className="w-full lg:w-1/4 flex flex-col gap-2 overflow-y-auto">
          {/* Quick Actions */}
          <CompactCard title="Actions Rapides" icon={Activity}>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction
                icon={Eye}
                label="Consultation"
                onClick={handleNewConsultation}
                variant="primary"
              />
              <QuickAction
                icon={Calendar}
                label="RDV"
                onClick={handleNewAppointment}
              />
              <QuickAction
                icon={Printer}
                label="Ordonnance"
                onClick={handlePrintPrescription}
                variant="success"
              />
              <QuickAction
                icon={FileText}
                label="Certificat"
                onClick={handlePrintCertificate}
              />
            </div>
          </CompactCard>

          {/* French Medical Information - BLUE (StudioVision style) */}
          <CompactCard title="Informations Médicales" icon={Shield} variant="patient">
            <div className="space-y-2 text-xs">
              {/* Social Security Number */}
              <div className="flex items-center gap-2">
                <Hash className="w-3 h-3 text-blue-400" />
                <span className="text-gray-500">N° SS:</span>
                <span className="font-mono font-medium text-gray-800">
                  {patient.socialSecurityNumber || patient.ssn || '-'}
                </span>
              </div>

              {/* Convention/Insurance */}
              {patient.convention && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-500">Convention:</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {typeof patient.convention === 'string'
                      ? patient.convention
                      : patient.convention.name ||
                        patient.convention.companyName ||
                        patient.convention.company?.name ||
                        (patient.convention.status ? `Actif (${patient.convention.beneficiaryType || 'Titulaire'})` : 'Convention')}
                  </span>
                </div>
              )}

              {/* ALD Status */}
              <div className="flex items-center gap-2">
                <Heart className="w-3 h-3 text-blue-400" />
                <span className="text-gray-500">ALD:</span>
                {patient.ald || patient.aldStatus ? (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                    Oui {patient.aldCode ? `(${patient.aldCode})` : ''}
                  </span>
                ) : (
                  <span className="text-gray-400">Non</span>
                )}
              </div>

              {/* CMU Status */}
              <div className="flex items-center gap-2">
                <CreditCard className="w-3 h-3 text-blue-400" />
                <span className="text-gray-500">CMU/CSS:</span>
                {patient.cmu || patient.cmuStatus ? (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                    Oui
                  </span>
                ) : (
                  <span className="text-gray-400">Non</span>
                )}
              </div>

              {/* Mutuelle */}
              {patient.mutuelle && (
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span className="text-gray-500">Mutuelle:</span>
                  <span className="text-gray-700">{patient.mutuelle}</span>
                </div>
              )}
            </div>
          </CompactCard>

          {/* Antécédents Médicaux - StudioVision key field */}
          <CompactCard title="Antécédents" icon={History} collapsed={patient.antecedents?.length === 0}>
            <div className="space-y-2">
              {/* Medical History */}
              {patient.antecedents?.length > 0 ? (
                <div className="space-y-1">
                  {patient.antecedents.slice(0, 5).map((ant, idx) => (
                    <div key={idx} className="flex items-start gap-2 py-1 border-b last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-gray-700">{typeof ant === 'string' ? ant : ant.description || ant.name}</span>
                    </div>
                  ))}
                </div>
              ) : patient.medicalHistory ? (
                <div className="text-xs text-gray-600 whitespace-pre-line">
                  {typeof patient.medicalHistory === 'string'
                    ? patient.medicalHistory
                    : patient.medicalHistory.general || 'Aucun antécédent renseigné'}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">Aucun antécédent renseigné</p>
              )}

              {/* Family History */}
              {(patient.familyHistory?.length > 0 || patient.medicalHistory?.family) && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs font-medium text-gray-500 mb-1">Antécédents familiaux:</div>
                  <div className="text-xs text-gray-600">
                    {Array.isArray(patient.familyHistory)
                      ? patient.familyHistory.join(', ')
                      : patient.medicalHistory?.family || '-'}
                  </div>
                </div>
              )}

              {/* Ophthalmic History */}
              {(patient.ophthalmicHistory?.length > 0 || patient.medicalHistory?.ophthalmic) && (
                <div className="mt-2 pt-2 border-t">
                  <div className="text-xs font-medium text-gray-500 mb-1">Antécédents ophtalmologiques:</div>
                  <div className="text-xs text-gray-600">
                    {Array.isArray(patient.ophthalmicHistory)
                      ? patient.ophthalmicHistory.join(', ')
                      : patient.medicalHistory?.ophthalmic || '-'}
                  </div>
                </div>
              )}
            </div>
          </CompactCard>

          {/* Alerts & Allergies - RED (StudioVision style) */}
          {(alertCounts.critical > 0 || alertCounts.warning > 0 || alertCounts.allergies > 0) && (
            <CompactCard title="Alertes" icon={AlertTriangle} variant="important">
              <div className="space-y-2">
                {/* Allergies */}
                {patient.allergies?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="text-xs font-medium text-red-700 mb-1">Allergies:</div>
                    <div className="flex flex-wrap gap-1">
                      {patient.allergies.map((allergy, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          {typeof allergy === 'string' ? allergy : allergy.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Clinical Alerts */}
                {patient.patientAlerts?.filter(a => !a.dismissed).slice(0, 3).map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-xs ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}
                  >
                    {alert.message || alert.title}
                  </div>
                ))}
              </div>
            </CompactCard>
          )}

          {/* Document Archive */}
          <CompactCard title="Documents" icon={FileText} collapsed={true}>
            <div className="space-y-2">
              {patient.documents?.slice(0, 5).map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-xs text-gray-600 truncate">{doc.name || doc.title}</span>
                  <button className="text-blue-600 hover:text-blue-800">
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {(!patient.documents || patient.documents.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Aucun document</p>
              )}
              <button className="w-full flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600">
                <Upload className="w-3 h-3" />
                Ajouter un document
              </button>
            </div>
          </CompactCard>

          {/* Visit History */}
          <CompactCard title="Historique" icon={History} collapsed={true}>
            <div className="space-y-2">
              {patient.visits?.slice(0, 5).map((visit, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1 border-b last:border-0 cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/visits/${visit._id}`)}
                >
                  <div>
                    <div className="text-xs font-medium text-gray-700">
                      {safeFormatDate(visit.visitDate || visit.createdAt, 'dd/MM/yyyy', { fallback: '-' })}
                    </div>
                    <div className="text-xs text-gray-500">{visit.reason || visit.type}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </div>
              ))}
              <button
                onClick={handleViewHistory}
                className="w-full py-1.5 text-xs text-blue-600 hover:text-blue-800"
              >
                Voir tout l'historique
              </button>
            </div>
          </CompactCard>
        </div>

        {/* CENTER COLUMN - Clinical Data (50%) */}
        <div className="w-full lg:w-1/2 flex flex-col gap-2 overflow-y-auto">
          {/* Visual Acuity & Refraction - PINK (StudioVision style) */}
          <CompactCard
            title={
              <span className="flex items-center gap-2">
                Réfraction
                {latestRefraction?.source && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    latestRefraction.source === 'TONOREF III' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {latestRefraction.source}
                  </span>
                )}
              </span>
            }
            icon={Glasses}
            variant="refraction"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* OD Column */}
              <div>
                <div className="text-center mb-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">OD</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">AV sc:</span>
                    <span className="font-medium">{latestVisualAcuity?.OD?.uncorrected || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">AV ac:</span>
                    <span className="font-medium">{latestVisualAcuity?.OD?.corrected || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs bg-blue-50 p-1 rounded">
                    <span className="text-gray-500">Rx:</span>
                    <span className="font-medium text-blue-700 truncate max-w-[120px]" title={formatRefraction('OD')}>{formatRefraction('OD')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Add:</span>
                    <span className="font-medium">{latestRefraction?.OD?.add || latestRefraction?.OD?.addition || '-'}</span>
                  </div>
                </div>
              </div>
              {/* OS Column */}
              <div>
                <div className="text-center mb-2">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">OS</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">AV sc:</span>
                    <span className="font-medium">{latestVisualAcuity?.OS?.uncorrected || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">AV ac:</span>
                    <span className="font-medium">{latestVisualAcuity?.OS?.corrected || '-'}</span>
                  </div>
                  <div className="flex justify-between text-xs bg-green-50 p-1 rounded">
                    <span className="text-gray-500">Rx:</span>
                    <span className="font-medium text-green-700 truncate max-w-[120px]" title={formatRefraction('OS')}>{formatRefraction('OS')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Add:</span>
                    <span className="font-medium">{latestRefraction?.OS?.add || latestRefraction?.OS?.addition || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Keratometry - unified from Device → CareVision → Legacy */}
            {(latestKeratometry?.OD || latestKeratometry?.OS || latestKeratometry?.od || latestKeratometry?.os) && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Kératométrie:</span>
                  {latestKeratometry.source && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      latestKeratometry.source === 'TONOREF III' ? 'bg-purple-100 text-purple-700' :
                      latestKeratometry.source === 'TOMEY' ? 'bg-green-100 text-green-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {latestKeratometry.source}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    OD: K1 {latestKeratometry.OD?.k1 || latestKeratometry.od?.k1 || '-'} / K2 {latestKeratometry.OD?.k2 || latestKeratometry.od?.k2 || '-'}
                    {(latestKeratometry.OD?.axis || latestKeratometry.od?.axis) && (
                      <span className="text-gray-400"> @{latestKeratometry.OD?.axis || latestKeratometry.od?.axis}°</span>
                    )}
                  </div>
                  <div>
                    OS: K1 {latestKeratometry.OS?.k1 || latestKeratometry.os?.k1 || '-'} / K2 {latestKeratometry.OS?.k2 || latestKeratometry.os?.k2 || '-'}
                    {(latestKeratometry.OS?.axis || latestKeratometry.os?.axis) && (
                      <span className="text-gray-400"> @{latestKeratometry.OS?.axis || latestKeratometry.os?.axis}°</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CompactCard>

          {/* IOP & Tonometry - GREEN (StudioVision style) */}
          <CompactCard title="Pression Intraoculaire" icon={Activity} variant="tonometry">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">OD</div>
                <div className={`text-2xl font-bold ${
                  (latestIOP?.OD?.value || 0) > 21 ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {latestIOP?.OD?.value || '-'}
                </div>
                <div className="text-xs text-gray-400">mmHg</div>
              </div>
              <div className="h-12 w-px bg-gray-200" />
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">OS</div>
                <div className={`text-2xl font-bold ${
                  (latestIOP?.OS?.value || 0) > 21 ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {latestIOP?.OS?.value || '-'}
                </div>
                <div className="text-xs text-gray-400">mmHg</div>
              </div>
            </div>
            {/* Method and source indicator */}
            <div className="flex items-center justify-center gap-2 mt-2 text-xs">
              {latestIOP?.OD?.method && latestIOP.OD.method !== 'unknown' && (
                <span className="text-gray-400">Méthode: {latestIOP.OD.method}</span>
              )}
              {latestIOP?.source && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  latestIOP.source === 'TONOREF III' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {latestIOP.source}
                </span>
              )}
            </div>
          </CompactCard>

          {/* Diagnoses - YELLOW (StudioVision style) */}
          <CompactCard title="Diagnostics" icon={Stethoscope} variant="pathology">
            <div className="space-y-1">
              {patient.diagnoses?.slice(0, 5).map((diagnosis, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-xs gap-2"
                >
                  <span className="font-medium text-gray-700 truncate flex-1" title={diagnosis.name || diagnosis.description}>
                    {diagnosis.name || diagnosis.description}
                  </span>
                  {diagnosis.code && (
                    <span className="text-gray-400 shrink-0">{diagnosis.code}</span>
                  )}
                </div>
              ))}
              {(!patient.diagnoses || patient.diagnoses.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Aucun diagnostic enregistré</p>
              )}
            </div>
          </CompactCard>

          {/* Active Medications - ORANGE (StudioVision style) */}
          <CompactCard title="Traitements en Cours" icon={Pill} variant="treatment">
            <div className="space-y-1">
              {patient.activeMedications?.slice(0, 5).map((med, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1 px-2 bg-green-50 rounded text-xs"
                >
                  <span className="font-medium text-gray-700">{med.name}</span>
                  <span className="text-gray-500">{med.dosage || med.frequency}</span>
                </div>
              ))}
              {(!patient.activeMedications || patient.activeMedications.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Aucun traitement en cours</p>
              )}
            </div>
          </CompactCard>

          {/* Exam Summary */}
          {latestExam.anteriorSegment && (
            <CompactCard title="Examen Segment Antérieur" icon={Eye} collapsed={true}>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium text-blue-600 mb-1">OD</div>
                  {Object.entries(latestExam.anteriorSegment.OD || {}).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex justify-between py-0.5">
                        <span className="text-gray-500 capitalize">{key}:</span>
                        <span>{value}</span>
                      </div>
                    )
                  ))}
                </div>
                <div>
                  <div className="font-medium text-green-600 mb-1">OS</div>
                  {Object.entries(latestExam.anteriorSegment.OS || {}).map(([key, value]) => (
                    value && (
                      <div key={key} className="flex justify-between py-0.5">
                        <span className="text-gray-500 capitalize">{key}:</span>
                        <span>{value}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </CompactCard>
          )}
        </div>

        {/* RIGHT COLUMN - Print, Devices, Scheduling (25%) */}
        <div className="w-full lg:w-1/4 flex flex-col gap-2 overflow-y-auto">
          {/* Quick Print */}
          <CompactCard title="Impression Rapide" icon={Printer}>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm text-blue-700">
                <Glasses className="w-4 h-4" />
                Ordonnance Lunettes
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-sm text-green-700">
                <Pill className="w-4 h-4" />
                Ordonnance Médicale
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-sm text-purple-700">
                <FileText className="w-4 h-4" />
                Certificat Médical
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 rounded-lg text-sm text-amber-700">
                <Eye className="w-4 h-4" />
                Fiche d'Examen
              </button>
            </div>
          </CompactCard>

          {/* Unified Images - MedFlow Devices + CareVision */}
          {allImages.length > 0 && (
            <CompactCard title="Images & Examens" icon={Camera}>
              <div className="grid grid-cols-2 gap-2">
                {allImages.slice(0, 4).map((image, idx) => {
                  const isDevice = image.source === 'device';
                  const isCareVision = image.source === 'carevision';
                  const bgColor = isDevice ? 'bg-purple-50' : isCareVision ? 'bg-amber-50' : 'bg-gray-100';
                  const ringColor = isDevice ? 'ring-purple-500' : isCareVision ? 'ring-amber-500' : 'ring-blue-500';
                  const badgeColor = isDevice ? 'bg-purple-600' : isCareVision ? 'bg-amber-500' : 'bg-blue-500';

                  return (
                    <div
                      key={image.id || idx}
                      className={`aspect-square ${bgColor} rounded-lg overflow-hidden cursor-pointer hover:ring-2 ${ringColor} relative`}
                      onClick={() => onAction?.('view-image', {
                        ...image,
                        url: image.fullUrl || image.url
                      })}
                    >
                      <img
                        src={image.url}
                        alt={image.type || `Image ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                          const fallbackDiv = document.createElement('div');
                          fallbackDiv.className = 'text-center p-2';
                          fallbackDiv.innerHTML = `<span class="text-xs text-gray-500">${image.type || 'Image'}</span>`;
                          e.target.parentElement.appendChild(fallbackDiv);
                        }}
                      />
                      {/* Source badge */}
                      <div className={`absolute bottom-1 right-1 px-1.5 py-0.5 ${badgeColor} text-white text-[9px] rounded font-medium`}>
                        {isDevice ? (image.type || 'DEV') : isCareVision ? 'CV' : 'MF'}
                      </div>
                      {/* Eye indicator */}
                      {image.eye && (
                        <div className="absolute top-1 left-1 px-1 py-0.5 bg-black/50 text-white text-[9px] rounded">
                          {image.eye}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Show count of additional images */}
              {allImages.length > 4 && (
                <button
                  className="w-full mt-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => onNavigateToSection?.('images')}
                >
                  Voir {allImages.length - 4} autres images
                </button>
              )}
              {/* Source legend */}
              <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-600 rounded"></span> Appareils
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-500 rounded"></span> CareVision
                </span>
              </div>
            </CompactCard>
          )}

          {/* Upcoming Appointments */}
          <CompactCard title="Prochains RDV" icon={Calendar}>
            <div className="space-y-2">
              {patient.upcomingAppointments?.slice(0, 3).map((apt, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">
                      {safeFormatDate(apt.scheduledDate, 'dd/MM à HH:mm', { fallback: '-' })}
                    </span>
                    <span className="text-xs text-gray-500">{apt.type}</span>
                  </div>
                  {apt.provider && (
                    <div className="text-xs text-gray-400 mt-1">Dr. {apt.provider.name}</div>
                  )}
                </div>
              ))}
              {(!patient.upcomingAppointments || patient.upcomingAppointments.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-2">Aucun RDV programmé</p>
              )}
              <button
                onClick={handleNewAppointment}
                className="w-full flex items-center justify-center gap-1 py-1.5 bg-blue-100 hover:bg-blue-200 rounded text-xs text-blue-700"
              >
                <Plus className="w-3 h-3" />
                Nouveau RDV
              </button>
            </div>
          </CompactCard>

          {/* Notes */}
          <CompactCard title="Notes" icon={FileText} collapsed={true}>
            <div className="space-y-2">
              {patient.notes?.slice(0, 3).map((note, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                  <div className="text-gray-500 mb-1">
                    {safeFormatDate(note.createdAt, 'dd/MM/yyyy', { fallback: '-' })}
                  </div>
                  <div className="text-gray-700 line-clamp-2">{note.content}</div>
                </div>
              ))}
              <textarea
                placeholder="Ajouter une note..."
                className="w-full p-2 border rounded text-xs resize-none"
                rows={2}
              />
            </div>
          </CompactCard>

          {/* Contact Info - BLUE (StudioVision style) */}
          <CompactCard title="Contact" icon={Phone} collapsed={true} variant="patient">
            <div className="space-y-2 text-xs">
              {patient.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <a href={`tel:${patient.phone}`} className="text-blue-600 hover:underline">
                    {patient.phone}
                  </a>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3 h-3 text-gray-400" />
                  <a href={`mailto:${patient.email}`} className="text-blue-600 hover:underline truncate">
                    {patient.email}
                  </a>
                </div>
              )}
              {patient.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3 h-3 text-gray-400 mt-0.5" />
                  <span className="text-gray-600">
                    {typeof patient.address === 'string'
                      ? patient.address
                      : [patient.address.street, patient.address.city, patient.address.postalCode, patient.address.country]
                          .filter(Boolean)
                          .join(', ') || 'Non renseignée'}
                  </span>
                </div>
              )}
            </div>
          </CompactCard>
        </div>
      </div>
    </div>
  );
}
