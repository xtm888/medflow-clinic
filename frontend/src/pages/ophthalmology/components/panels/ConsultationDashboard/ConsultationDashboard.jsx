/**
 * ConsultationDashboard - Single-page consolidated consultation view
 * Combines all consultation steps into one scrollable dashboard
 *
 * Supports two view modes:
 * - Standard: Traditional MedFlow UI panels
 * - StudioVision: Multi-column layouts with color-coded sections
 *
 * Sections:
 * 1. Patient Header + Chief Complaint
 * 2. Vitals (collapsible)
 * 3. Refraction Module (StudioVision: 2-column OD/OG grid)
 * 4. Examination Module (3-column with DR staging)
 * 5. Diagnostic Module (StudioVision: 3-column PathologyPicker)
 * 6. Prescription Module (StudioVision: 4-column TreatmentBuilder)
 * 7. Summary & Actions
 */

import { useMemo } from 'react';
import { Glasses, Search, Stethoscope, FileText, History, Printer, Send } from 'lucide-react';

// Standard panels
import RefractionPanel from '../RefractionPanel';
import ExaminationPanel from '../ExaminationPanel';
import DiagnosticPanel from '../DiagnosticPanel';

// StudioVision components
import StudioVisionRefractionGrid from '../../../../../components/refraction/StudioVisionRefractionGrid';
import PathologyPicker from '../../../../../components/pathology/PathologyPicker';
import DRStagingSelector from '../../../../../components/pathology/DRStagingSelector';
import RefractionQuickActions from '../../../../../components/refraction/RefractionQuickActions';

// Common components
import TemplateSelector from '../../../../../components/consultation/TemplateSelector';
import OrthopticSummaryCard from '../../../../../components/OrthopticSummaryCard';

// StudioVision mode context
import { useModuleViewMode, useStudioVisionMode } from '../../../../../contexts/StudioVisionModeContext';

import { useConsultationData } from './hooks';
import { validateData } from './constants';
import {
  ConsultationHeader,
  ChiefComplaintSection,
  VitalsSection,
  CollapsibleModuleWrapper,
  PrescriptionModule,
  ConsultationSummary
} from './components';

export default function ConsultationDashboard({
  patient,
  initialData,
  onSave,
  onComplete,
  onCancel,
  autoSave = true,
  autoSaveInterval = 30000
}) {
  const {
    data,
    expandedSections,
    commonMedications,
    loadingMedications,
    saving,
    lastSaved,
    hasChanges,
    appliedTemplateId,
    updateSection,
    toggleSection,
    handleSave,
    handleApplyTemplate
  } = useConsultationData(initialData, onSave, autoSave, autoSaveInterval);

  // StudioVision mode for each module
  const { isStudioVision: isRefractionStudioVision } = useModuleViewMode('refraction');
  const { isStudioVision: isDiagnosisStudioVision } = useModuleViewMode('diagnosis');
  const { isStudioVision: isExaminationStudioVision } = useModuleViewMode('examination');
  const { isStudioVision: globalStudioVision } = useStudioVisionMode();

  // Check if patient has diabetes for DR staging display
  const showDRStaging = useMemo(() => {
    const hasDiabetes = patient?.diagnoses?.some(d =>
      d.code?.startsWith('E10') ||
      d.code?.startsWith('E11') ||
      d.code?.startsWith('E13')
    );
    const hasDRDiagnosis = data.diagnostic?.diagnoses?.some(d =>
      d.code?.startsWith('E11.3') || d.code?.startsWith('H35.0')
    );
    return hasDiabetes || hasDRDiagnosis || data.examination?.fundus?.showDRStaging;
  }, [patient, data.diagnostic?.diagnoses, data.examination?.fundus?.showDRStaging]);

  // Map refraction data for StudioVisionRefractionGrid
  const refractionGridValue = useMemo(() => ({
    visualAcuity: data.refraction?.visualAcuity || {},
    autorefraction: data.refraction?.objective || {},
    subjectiveRefraction: data.refraction?.subjective || {},
    keratometry: data.refraction?.keratometry || {},
    pupillaryDistance: data.refraction?.subjective?.pd || {}
  }), [data.refraction]);

  // Handle StudioVisionRefractionGrid changes
  const handleRefractionGridChange = (gridData) => {
    updateSection('refraction', {
      visualAcuity: gridData.visualAcuity,
      objective: gridData.autorefraction,
      subjective: {
        ...gridData.subjectiveRefraction,
        pd: gridData.pupillaryDistance
      },
      keratometry: gridData.keratometry
    });
  };

  // Handle PathologyPicker changes
  const handlePathologyChange = (diagnoses) => {
    updateSection('diagnostic', {
      ...data.diagnostic,
      diagnoses: diagnoses
    });
  };

  // Handle DR staging changes
  const handleDRStagingChange = (staging) => {
    updateSection('examination', {
      ...data.examination,
      fundus: {
        ...data.examination?.fundus,
        OD: { ...data.examination?.fundus?.OD, drStaging: staging.OD },
        OS: { ...data.examination?.fundus?.OS, drStaging: staging.OS }
      }
    });
  };

  // Complete consultation with validation
  const handleComplete = async () => {
    const errors = validateData(data);

    if (errors.length > 0) {
      const message = 'Veuillez compléter les champs obligatoires:\n' + errors.join('\n');
      alert(message);
      return;
    }

    await handleSave();
    onComplete?.(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <ConsultationHeader
        patient={patient}
        saving={saving}
        lastSaved={lastSaved}
        hasChanges={hasChanges}
        appliedTemplateId={appliedTemplateId}
        onSave={() => handleSave()}
        onCancel={onCancel}
        onComplete={handleComplete}
        onApplyTemplate={handleApplyTemplate}
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Chief Complaint */}
        <ChiefComplaintSection
          data={data}
          updateSection={updateSection}
        />

        {/* Section 2: Vitals (Collapsible) */}
        <VitalsSection
          data={data}
          updateSection={updateSection}
          expanded={expandedSections.vitals}
          onToggle={() => toggleSection('vitals')}
        />

        {/* Section 3: Refraction Module */}
        <div className={globalStudioVision ? 'flex gap-4' : ''}>
          <div className="flex-1">
            <CollapsibleModuleWrapper
              title="Module Réfraction"
              icon={Glasses}
              iconColor="text-purple-600"
              expanded={expandedSections.refraction}
              onToggle={() => toggleSection('refraction')}
              badge={isRefractionStudioVision ? 'StudioVision' : null}
            >
              {isRefractionStudioVision ? (
                <StudioVisionRefractionGrid
                  value={refractionGridValue}
                  onChange={handleRefractionGridChange}
                  showKeratometry={true}
                  showPupillaryDistance={true}
                  compact={false}
                />
              ) : (
                <RefractionPanel
                  data={data.refraction}
                  onChange={(refraction) => updateSection('refraction', refraction)}
                  patient={patient}
                />
              )}
            </CollapsibleModuleWrapper>
          </div>

          {/* Quick Actions Sidebar - Only in StudioVision mode */}
          {globalStudioVision && expandedSections.refraction && (
            <div className="w-64 flex-shrink-0">
              <RefractionQuickActions
                patientId={patient?._id || patient?.id}
                onLoadPreviousExam={(exam) => {
                  if (exam?.refraction) {
                    updateSection('refraction', exam.refraction);
                  }
                }}
                onPrint={() => window.print()}
                onSendToDevice={() => {
                  // TODO: Implement device send
                  console.log('Send to device');
                }}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Section 4: Examination Module */}
        <CollapsibleModuleWrapper
          title="Module Examen Clinique"
          icon={Search}
          iconColor="text-green-600"
          expanded={expandedSections.examination}
          onToggle={() => toggleSection('examination')}
          badge={showDRStaging ? 'DR Staging' : null}
        >
          <ExaminationPanel
            data={data.examination}
            onChange={(examination) => updateSection('examination', examination)}
            patient={patient}
          />

          {/* DR Staging Selector - Shows for diabetic patients or DR diagnosis */}
          {showDRStaging && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <DRStagingSelector
                value={{
                  OD: data.examination?.fundus?.OD?.drStaging,
                  OS: data.examination?.fundus?.OS?.drStaging
                }}
                onChange={handleDRStagingChange}
              />
            </div>
          )}
        </CollapsibleModuleWrapper>

        {/* Section 4.5: Orthoptic Summary */}
        <OrthopticSummaryCard
          patientId={patient?._id || patient?.id}
          className="shadow-sm"
        />

        {/* Section 5: Diagnostic Module */}
        <CollapsibleModuleWrapper
          title="Module Diagnostic & Examens"
          icon={Stethoscope}
          iconColor="text-orange-600"
          expanded={expandedSections.diagnostic}
          onToggle={() => toggleSection('diagnostic')}
          badge={isDiagnosisStudioVision ? 'StudioVision' : null}
        >
          {isDiagnosisStudioVision ? (
            <div className="space-y-4">
              {/* StudioVision PathologyPicker for diagnoses */}
              <div className="border-2 border-orange-200 rounded-lg overflow-hidden">
                <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
                  <h3 className="text-sm font-semibold text-orange-800">Sélection des Pathologies</h3>
                </div>
                <PathologyPicker
                  selectedPathologies={data.diagnostic?.diagnoses || []}
                  onChange={handlePathologyChange}
                  showLaterality={true}
                  height={400}
                />
              </div>

              {/* Keep DiagnosticPanel for procedures/labs in compact mode */}
              <DiagnosticPanel
                data={data.diagnostic}
                onChange={(diagnostic) => updateSection('diagnostic', diagnostic)}
                patient={patient}
                hideDiagnosis={true}
              />
            </div>
          ) : (
            <DiagnosticPanel
              data={data.diagnostic}
              onChange={(diagnostic) => updateSection('diagnostic', diagnostic)}
              patient={patient}
            />
          )}
        </CollapsibleModuleWrapper>

        {/* Section 6: Prescription Module */}
        <CollapsibleModuleWrapper
          title="Module Prescription"
          icon={FileText}
          iconColor="text-indigo-600"
          expanded={expandedSections.prescription}
          onToggle={() => toggleSection('prescription')}
        >
          <PrescriptionModule
            data={data.prescription}
            onChange={(prescription) => updateSection('prescription', prescription)}
            refractionData={data.refraction}
            commonMedications={commonMedications}
            loadingMedications={loadingMedications}
            diagnoses={data.diagnostic?.diagnoses || []}
            patientId={patient?._id || patient?.id}
            patientAllergies={patient?.allergies || []}
          />
        </CollapsibleModuleWrapper>

        {/* Section 7: Summary */}
        <ConsultationSummary data={data} />
      </div>
    </div>
  );
}
