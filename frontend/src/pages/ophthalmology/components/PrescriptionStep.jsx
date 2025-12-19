/**
 * PrescriptionStep Component
 *
 * Final step in the ophthalmology exam workflow for creating prescriptions.
 * Handles both optical (glasses/contacts) and medication prescriptions.
 *
 * Split into sub-components for maintainability:
 * - OpticalPrescriptionTab: Glasses and contact lens prescriptions
 * - MedicationPrescriptionTab: Drug prescriptions with TreatmentBuilder
 * - PrescriptionPreviewModal: Print preview modal
 *
 * Enhanced with:
 * - Prominent StudioVision mode shortcut for 4-column TreatmentBuilder access
 */

import { useState, useMemo, useEffect } from 'react';
import { Glasses, Pill, LayoutGrid, Sparkles } from 'lucide-react';
import { calculateReadingAdd } from '../../../utils/ophthalmologyCalculations';
import ApprovalWarningBanner, { useApprovalWarnings } from '../../../components/ApprovalWarningBanner';
import {
  OpticalPrescriptionTab,
  MedicationPrescriptionTab,
  PrescriptionPreviewModal,
  DEFAULT_SUBJECTIVE,
  DEFAULT_PUPIL_DISTANCE
} from './prescription';

export default function PrescriptionStep({
  data,
  onChange,
  patient,
  patientId,
  visitId,
  consultationSessionId,
  examId
}) {
  // Tab state
  const [activeTab, setActiveTab] = useState('optical'); // 'optical' | 'medication'

  // Prescription preview modal
  const [showPrescriptionPreview, setShowPrescriptionPreview] = useState(false);

  // Medication list (shared between modes)
  const [medicationList, setMedicationList] = useState([]);

  // Saved prescription tracking
  const [savedPrescriptions, setSavedPrescriptions] = useState({
    medication: null,
    optical: null
  });

  // Lens types for approval check
  const [selectedLensTypes, setSelectedLensTypes] = useState([]);
  const [prescriptionType, setPrescriptionType] = useState('glasses');

  // Initialize data structures if not present
  useEffect(() => {
    if (!data.subjective) {
      onChange(prev => ({
        ...prev,
        subjective: DEFAULT_SUBJECTIVE
      }));
    }
    if (!data.pupilDistance) {
      onChange(prev => ({
        ...prev,
        pupilDistance: DEFAULT_PUPIL_DISTANCE
      }));
    }
    if (!data.finalPrescription) {
      onChange(prev => ({
        ...prev,
        finalPrescription: {}
      }));
    }
  }, []);

  // Approval warnings hook
  const { warnings, company, loading: warningsLoading, checkWarnings } = useApprovalWarnings();

  // Build act codes for approval check based on prescription type and lens types
  const opticalActCodes = useMemo(() => {
    const codes = [];
    if (prescriptionType === 'glasses') {
      codes.push('OPT-LUNETTES');
      if (selectedLensTypes.includes('progressive')) codes.push('OPT-PROGRESSIFS');
      if (selectedLensTypes.includes('bifocal')) codes.push('OPT-BIFOCAUX');
    } else if (prescriptionType === 'contacts') {
      codes.push('OPT-LENTILLES');
    }
    return codes;
  }, [prescriptionType, selectedLensTypes]);

  // Check approval warnings when patient or prescription changes
  useEffect(() => {
    const pid = patient?._id || patientId;
    if (pid && opticalActCodes.length > 0) {
      checkWarnings(pid, opticalActCodes);
    }
  }, [patient?._id, patientId, opticalActCodes.length]);

  // Calculate reading addition if needed
  const readingAdd = patient?.age >= 40 ? calculateReadingAdd(patient.age) : null;

  const handlePrint = () => window.print();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center">
        <Glasses className="w-5 h-5 mr-2 text-blue-600" />
        Prescription Finale
      </h2>

      {/* Approval Warnings Banner */}
      {(warnings.blocking.length > 0 || warnings.warning.length > 0 || warnings.info.length > 0) && (
        <div className="mb-6">
          <ApprovalWarningBanner
            warnings={warnings}
            company={company}
            patient={patient}
            showRequestButton={true}
            compact={true}
          />
        </div>
      )}

      {/* Tab Navigation with StudioVision Shortcut */}
      <div className="flex items-center justify-between border-b mb-6">
        <div className="flex">
          <button
            onClick={() => setActiveTab('optical')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'optical'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Glasses className="w-4 h-4" />
            Ordonnance Optique
          </button>
          <button
            onClick={() => setActiveTab('medication')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'medication'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pill className="w-4 h-4" />
            Traitement Médical
          </button>
        </div>

        {/* StudioVision Mode Quick Access - Only show on medication tab */}
        {activeTab === 'medication' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-purple-700">
              Utilisez le <strong>toggle StudioVision</strong> ci-dessous pour le mode 4 colonnes
            </span>
            <LayoutGrid className="w-4 h-4 text-purple-500" />
          </div>
        )}
      </div>

      {/* Medication Tab */}
      {activeTab === 'medication' && (
        <MedicationPrescriptionTab
          patient={patient}
          patientId={patientId}
          visitId={visitId}
          consultationSessionId={consultationSessionId}
          medicationList={medicationList}
          setMedicationList={setMedicationList}
          savedPrescription={savedPrescriptions.medication}
          onPrescriptionSaved={(prescription) => {
            setSavedPrescriptions(prev => ({ ...prev, medication: prescription }));
          }}
          onChange={onChange}
        />
      )}

      {/* Optical Tab */}
      {activeTab === 'optical' && (
        <OpticalPrescriptionTab
          data={data}
          onChange={onChange}
          patient={patient}
          patientId={patientId}
          visitId={visitId}
          consultationSessionId={consultationSessionId}
          readingAdd={readingAdd}
          savedPrescription={savedPrescriptions.optical}
          onPrescriptionSaved={(prescription) => {
            setSavedPrescriptions(prev => ({ ...prev, optical: prescription }));
          }}
          onShowPreview={() => setShowPrescriptionPreview(true)}
        />
      )}

      {/* Prescription Preview Modal */}
      <PrescriptionPreviewModal
        isOpen={showPrescriptionPreview}
        onClose={() => setShowPrescriptionPreview(false)}
        data={data}
        patient={patient}
        selectedLensTypes={selectedLensTypes}
        readingAdd={readingAdd}
        onPrint={handlePrint}
      />
    </div>
  );
}
