/**
 * MedicationPrescriptionTab Component
 *
 * Tab content for medication prescription with both standard and StudioVision modes.
 */

import { useState } from 'react';
import { Pill, Check, CheckCircle, AlertTriangle, Loader2, LayoutGrid, List, Save, Star, BookOpen, Shield } from 'lucide-react';
import { toast } from 'react-toastify';
import QuickTreatmentBuilder from '../../../../components/QuickTreatmentBuilder';
import MedicationTemplateSelector from '../../../../components/MedicationTemplateSelector';
import MedicationEntryForm from '../../../../components/MedicationEntryForm';
import TreatmentBuilder from '../../../../components/treatment/TreatmentBuilder';
import FavoriteMedicationsBar from '../../../../components/prescription/FavoriteMedicationsBar';
import TreatmentProtocolSelector from '../../../../components/prescription/TreatmentProtocolSelector';
import DrugInteractionPanel from '../../../../components/prescription/DrugInteractionPanel';
import prescriptionService from '../../../../services/prescriptionService';

export default function MedicationPrescriptionTab({
  patient,
  patientId,
  visitId,
  consultationSessionId,
  medicationList,
  setMedicationList,
  savedPrescription,
  onPrescriptionSaved,
  onChange
}) {
  const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'studiovision'
  const [saving, setSaving] = useState(false);

  // Handle medication added from QuickTreatmentBuilder
  const handleMedicationAdd = (medication) => {
    setMedicationList(prev => [...prev, medication]);
  };

  // Handle prescription completion (from QuickTreatmentBuilder)
  const handlePrescriptionComplete = (medications) => {
    if (medications && medications.length > 0) {
      setMedicationList(medications);
      if (patient?._id || patientId) {
        toast.info('Cliquez sur "Enregistrer ordonnance" pour sauvegarder');
      }
    }
  };

  // Handle TreatmentBuilder changes (StudioVision mode)
  const handleTreatmentBuilderChange = (treatmentData) => {
    const medications = (treatmentData.medications || []).map((med, index) => ({
      id: med.id || `sv-${index}-${Date.now()}`,
      name: med.name,
      genericName: med.genericName,
      quantity: 1,
      unit: 'boîte',
      route: 'ophthalmic',
      applicationLocation: { eye: 'OU' },
      dosage: {
        amount: parseInt(med.dose?.split(' ')[0]) || 1,
        unit: med.dose?.includes('goutte') ? 'goutte' : 'comprimé',
        frequency: med.posologie,
        duration: { value: parseInt(med.duration) || 7, unit: 'days' },
        instructions: med.details || ''
      },
      tapering: { enabled: false },
      indication: '',
      notes: med.details || ''
    }));

    setMedicationList(medications);
  };

  // Save medication prescription
  const handleSaveMedicationPrescription = async () => {
    if (medicationList.length === 0) {
      toast.warning('Aucun médicament sélectionné');
      return;
    }

    const pid = patient?._id || patientId;
    if (!pid) {
      toast.error('Patient non identifié');
      return;
    }

    setSaving(true);
    try {
      const prescriptionData = {
        patient: pid,
        type: 'medication',
        visit: visitId || null,
        consultationSession: consultationSessionId || null,
        medications: medicationList.map(med => ({
          name: med.name,
          genericName: med.genericName || med.name,
          quantity: med.quantity || 1,
          unit: med.unit || 'comprimé',
          route: med.route || 'oral',
          applicationLocation: {
            eye: med.applicationLocation?.eye || null,
            eyeArea: med.applicationLocation?.eyeArea || null,
            bodyPart: med.applicationLocation?.bodyPart || null,
            specificLocation: med.applicationLocation?.specificLocation || null
          },
          tapering: med.tapering?.enabled ? {
            enabled: true,
            reason: med.tapering.reason || '',
            template: med.tapering.template || null,
            schedule: (med.tapering.schedule || []).map(step => ({
              stepNumber: step.stepNumber,
              dose: step.dose,
              frequency: step.frequency,
              frequencyTimes: step.frequencyTimes,
              durationDays: step.durationDays,
              startDay: step.startDay,
              endDay: step.endDay,
              instructions: step.instructions
            })),
            totalDurationDays: med.tapering.totalDurationDays || 0
          } : { enabled: false },
          dosage: {
            amount: med.dosage?.amount || med.dosageAmount || 1,
            unit: med.dosage?.unit || med.dosageUnit || 'goutte',
            frequency: med.tapering?.enabled
              ? med.tapering.schedule?.[0]?.frequency
              : (med.dosage?.frequency || med.frequency),
            duration: med.tapering?.enabled
              ? { value: med.tapering.totalDurationDays, unit: 'days' }
              : (med.dosage?.duration || { value: parseInt(med.duration) || 7, unit: 'days' }),
            withFood: med.dosage?.withFood || med.withFood || 'anytime',
            instructions: med.dosage?.instructions || med.instructions || ''
          },
          indication: med.indication || '',
          notes: med.notes || ''
        })),
        status: 'pending'
      };

      const result = await prescriptionService.createDrugPrescription(prescriptionData);

      if (result.success !== false) {
        toast.success('Ordonnance médicale enregistrée');
        onPrescriptionSaved(result.data || result);

        // Update parent data with saved prescription ID
        onChange(prev => ({
          ...prev,
          savedMedicationPrescriptionId: (result.data || result)._id
        }));
      } else {
        throw new Error(result.error || 'Échec de l\'enregistrement');
      }
    } catch (error) {
      console.error('Error saving medication prescription:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement de l\'ordonnance médicale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6">
      {/* View Mode Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('standard')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'standard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Vue standard"
          >
            <List className="w-4 h-4" />
            Standard
          </button>
          <button
            onClick={() => setViewMode('studiovision')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
              viewMode === 'studiovision'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Vue StudioVision (4 colonnes)"
          >
            <LayoutGrid className="w-4 h-4" />
            StudioVision
          </button>
        </div>
      </div>

      {/* Favorites & Protocols - Quick Access (Standard Mode) */}
      {viewMode === 'standard' && (
        <div className="space-y-4 mb-6">
          {/* Favorite Medications Bar - 1-Click Prescription */}
          <FavoriteMedicationsBar
            onMedicationAdd={handleMedicationAdd}
            compact={false}
          />

          {/* Treatment Protocol Selector - 2-Click Protocol Application */}
          <TreatmentProtocolSelector
            diagnoses={patient?.diagnoses || []}
            onProtocolApply={(medications, protocol) => {
              handlePrescriptionComplete(medications);
              toast.success(`Protocole "${protocol?.nameFr || protocol?.name}" appliqué`);
            }}
            collapsed={true}
            showSuggestions={true}
          />

          {/* Drug Interaction Safety Panel */}
          {medicationList.length > 0 && (
            <DrugInteractionPanel
              medications={medicationList}
              patientId={patient?._id || patientId}
              patientAllergies={patient?.allergies || []}
              existingMedications={patient?.activeMedications || []}
              collapsed={true}
              autoCheck={true}
            />
          )}
        </div>
      )}

      {/* StudioVision Mode - TreatmentBuilder */}
      {viewMode === 'studiovision' && (
        <div className="border-2 border-purple-200 rounded-lg overflow-hidden mb-4">
          <TreatmentBuilder
            value={{
              medications: medicationList.map(med => ({
                id: med.id,
                name: med.name,
                genericName: med.genericName,
                dose: med.dosage?.amount ? `${med.dosage.amount} ${med.dosage.unit}` : '',
                posologie: med.dosage?.frequency || '',
                details: med.dosage?.instructions || med.notes || '',
                duration: med.dosage?.duration?.value?.toString() || '7'
              })),
              activeTab: 0,
              prescriptionType: 'OPHTHALMIQUE'
            }}
            onChange={handleTreatmentBuilderChange}
            height={500}
          />
        </div>
      )}

      {/* Standard Mode - Current Medications List with Full Entry Form */}
      {viewMode === 'standard' && medicationList.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Pill className="w-5 h-5 text-green-600" />
            Médicaments prescrits ({medicationList.length})
          </h4>
          <div className="space-y-4">
            {medicationList.map((med, index) => (
              <MedicationEntryForm
                key={med.id || index}
                medication={med}
                onUpdate={(updatedMed) => {
                  setMedicationList(prev => prev.map((m, i) =>
                    i === index ? updatedMed : m
                  ));
                }}
                onRemove={() => setMedicationList(prev => prev.filter((_, i) => i !== index))}
                showTapering={true}
                compact={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standard Mode - Fermer-style Medication Selector */}
      {viewMode === 'standard' && (
        <div className="border rounded-lg h-[500px] overflow-hidden">
          <MedicationTemplateSelector
            onAddMedication={(med) => {
              const enhancedMed = {
                ...med,
                route: med.route || 'ophthalmic',
                applicationLocation: med.applicationLocation || { eye: 'OU' },
                tapering: med.tapering || { enabled: false }
              };
              setMedicationList(prev => [...prev, enhancedMed]);
            }}
          />
        </div>
      )}

      {/* Standard Mode - QuickTreatmentBuilder (Alternative) */}
      {viewMode === 'standard' && (
        <div className="mt-4 pt-4 border-t">
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              Mode alternatif (QuickTreatmentBuilder)
            </summary>
            <div className="mt-3">
              <QuickTreatmentBuilder
                patientId={patientId || patient?._id}
                onMedicationAdd={handleMedicationAdd}
                onPrescriptionComplete={handlePrescriptionComplete}
                existingMedications={medicationList}
              />
            </div>
          </details>
        </div>
      )}

      {/* Save Medication Prescription Button */}
      {medicationList.length > 0 && (
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          {savedPrescription ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>Ordonnance médicale enregistrée (ID: {savedPrescription.prescriptionId || savedPrescription._id})</span>
            </div>
          ) : (
            <div className="flex items-center text-amber-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span>{medicationList.length} médicament(s) non enregistré(s)</span>
            </div>
          )}
          <button
            onClick={handleSaveMedicationPrescription}
            disabled={saving || savedPrescription}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              savedPrescription
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : savedPrescription ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Enregistré
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Enregistrer ordonnance médicale
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
