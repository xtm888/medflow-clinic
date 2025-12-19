/**
 * ContactLensFittingStep - Clinical Workflow Step Wrapper
 *
 * Wraps the ContactLensFitting component to integrate with the ClinicalWorkflow system.
 * Adapts the step data structure to what ContactLensFitting expects.
 */

import ContactLensFitting from '../../../components/contactLens/ContactLensFitting';

export default function ContactLensFittingStep({
  data,
  onChange,
  patient,
  readOnly = false
}) {
  // Handle updates from ContactLensFitting
  const handleUpdate = (updateData) => {
    // ContactLensFitting sends { contactLensFitting: {...} }
    onChange(prev => ({
      ...prev,
      ...updateData
    }));
  };

  // Handle save from ContactLensFitting
  const handleSave = (saveData) => {
    onChange(prev => ({
      ...prev,
      ...saveData
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <ContactLensFitting
        examData={data}
        patient={patient}
        refraction={data?.refraction}
        keratometry={data?.keratometry}
        onUpdate={handleUpdate}
        onSave={handleSave}
        readOnly={readOnly}
        showPrint={true}
        defaultTab={0}
      />
    </div>
  );
}
