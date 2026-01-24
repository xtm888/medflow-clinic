/**
 * StudioVisionHeader - Patient info bar and action buttons for StudioVision consultation
 */

import { Save, Printer, X, Check, Loader2, Camera, Briefcase, UserCheck } from 'lucide-react';

import CriticalAlertBanner from '../../../components/patient/CriticalAlertBanner';
import StudioVisionTabNavigation from '../../../components/consultation/StudioVisionTabNavigation';
import QuickActionsBar from '../../../components/consultation/QuickActionsBar';
import AutoSaveIndicator from '../../../components/AutoSaveIndicator';

export default function StudioVisionHeader({
  patient,
  patientId,
  visitId,
  lastSaved,
  saving,
  completing,
  activeTab,
  tabChanges,
  canCopyODtoOG,
  copyingOD,
  loadingLastVisit,
  hasPreviousVisit,
  consultationDuration,
  autoSaveStatus = 'idle',
  autoSaveError = null,
  // Send to optical
  canSendToOptical = false,
  sendingToOptical = false,
  onSendToOptical,
  // Lab order callback
  onLabOrderCreated,
  onSave,
  onComplete,
  onClose,
  onTabChange,
  onCopyODtoOG,
  onImportLastVisit,
  onPrint,
  onAddDiagnosis,
  onOpenSchema,
  onTimerUpdate
}) {
  return (
    <header className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-50">
      {/* Patient Info Bar */}
      <div className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between max-w-7xl mx-auto gap-2 md:gap-0">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {/* Patient Photo */}
            <div className="relative">
              {(patient?.photoUrl || patient?.photo) ? (
                <img
                  src={patient.photoUrl || patient.photo}
                  alt={`${patient.firstName} ${patient.lastName}`}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/50 cursor-pointer hover:border-white transition"
                  onClick={() => window.open(patient.photoUrl || patient.photo, '_blank')}
                  title="Cliquer pour agrandir"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition"
                  title="Aucune photo - Cliquer pour capturer"
                >
                  <Camera className="w-5 h-5 text-white/70" />
                </div>
              )}
            </div>

            {/* Patient Name */}
            <div>
              <h1 className="text-xl font-bold">
                {patient?.lastName?.toUpperCase()} {patient?.firstName}
              </h1>
              {/* Profession Badge */}
              {(patient?.occupation || patient?.profession) && (
                <div className="flex items-center gap-1 text-xs text-white/80">
                  <Briefcase className="w-3 h-3" />
                  <span>{patient.occupation || patient.profession}</span>
                </div>
              )}
            </div>

            {/* Age Badge */}
            {patient?.dateOfBirth && (
              <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-sm font-bold rounded">
                {Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))} Ans
              </span>
            )}

            {/* Referring Doctor */}
            {patient?.referringDoctor && (
              <div className="flex items-center gap-1 text-sm text-white/80 bg-white/10 px-2 py-0.5 rounded">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{patient.referringDoctor.startsWith('Dr') ? patient.referringDoctor : `Dr ${patient.referringDoctor}`}</span>
              </div>
            )}

            {/* Critical Alerts - Compact View */}
            {(patient?.alerts?.length > 0 || patient?.allergies?.length > 0 || patient?.importantNotes) && (
              <CriticalAlertBanner
                alerts={patient.alerts || []}
                allergies={patient.allergies || []}
                importantNotes={patient.importantNotes}
                canEdit={false}
                compact={true}
              />
            )}

            <span className="text-sm opacity-80">
              Fiche: {patient?.fileNumber || patientId?.slice(-8)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Auto-Save Status Indicator */}
            <div className="text-white/90">
              <AutoSaveIndicator
                saveStatus={autoSaveStatus}
                lastSaved={lastSaved}
                error={autoSaveError}
              />
            </div>

            {/* Action Buttons */}
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition text-sm md:text-base"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Sauvegarder
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition text-sm md:text-base"
            >
              <Printer className="h-4 w-4" />
              Imprimer
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition text-sm md:text-base"
            >
              <X className="h-4 w-4" />
              Fermer
            </button>

            <button
              onClick={onComplete}
              disabled={completing}
              className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-1.5 rounded-lg transition font-medium text-sm md:text-base ${
                completing
                  ? 'bg-green-400 cursor-wait'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {completing ? 'Finalisation...' : 'Terminer'}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <StudioVisionTabNavigation
        activeTab={activeTab}
        onTabChange={onTabChange}
        hasChanges={tabChanges}
      />

      {/* Quick Actions Bar */}
      <QuickActionsBar
        patientId={patientId}
        visitId={visitId}
        onCopyODtoOG={onCopyODtoOG}
        canCopyODtoOG={canCopyODtoOG}
        copyingOD={copyingOD}
        onImportLastVisit={onImportLastVisit}
        hasPreviousVisit={hasPreviousVisit}
        loadingLastVisit={loadingLastVisit}
        onPrint={onPrint}
        onAddDiagnosis={onAddDiagnosis}
        onOpenSchema={onOpenSchema}
        onTimerUpdate={onTimerUpdate}
        initialTimerSeconds={consultationDuration || 0}
        autoStartTimer={true}
        canSendToOptical={canSendToOptical}
        sendingToOptical={sendingToOptical}
        onSendToOptical={onSendToOptical}
        onLabOrderCreated={onLabOrderCreated}
      />
    </header>
  );
}
