/**
 * GlassesOrder - Main Component
 *
 * Orchestrates glasses and contact lens ordering workflow.
 */

import { Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import ApprovalWarningBanner from '../../../components/ApprovalWarningBanner';

import { useGlassesOrderForm } from './hooks';
import {
  OrderHeader,
  PrescriptionSummary,
  OrderTypeSection,
  GlassesOptionsSection,
  ContactLensOptionsSection,
  PricingSection,
  AdditionalOptionsSection
} from './components';

export default function GlassesOrder() {
  const {
    // Navigation
    navigate,

    // Loading states
    loading,
    saving,

    // Data
    exam,
    patient,

    // Form state
    formState,
    updateField,

    // Coatings
    handleCoatingChange,

    // Items
    addItem,
    updateItem,
    removeItem,

    // Notes
    updateNotes,

    // Contact lens quantity
    updateContactLensQuantity,

    // Approval
    warnings,
    company,

    // Convention
    conventionCoverage,

    // Total
    orderTotal,

    // Submit
    handleSubmit
  } = useGlassesOrderForm();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

  // Error state
  if (!exam) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Examen introuvable</p>
        <button
          onClick={() => navigate('/ophthalmology')}
          className="btn btn-primary mt-4"
        >
          Retour
        </button>
      </div>
    );
  }

  const hasWarnings = warnings.blocking.length > 0 ||
                      warnings.warning.length > 0 ||
                      warnings.info.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <OrderHeader
        patient={patient}
        exam={exam}
        onBack={() => navigate(-1)}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Approval Warnings Banner */}
        {hasWarnings && (
          <ApprovalWarningBanner
            warnings={warnings}
            company={company}
            patient={patient}
            showRequestButton={true}
            compact={false}
          />
        )}

        {/* Prescription Summary */}
        <PrescriptionSummary exam={exam} />

        {/* Order Type */}
        <OrderTypeSection
          orderType={formState.orderType}
          onOrderTypeChange={(value) => updateField('orderType', value)}
        />

        {/* Glasses Options */}
        {formState.orderType !== 'contact-lenses' && (
          <GlassesOptionsSection
            lensType={formState.lensType}
            onLensTypeChange={(value) => updateField('lensType', value)}
            lensMaterial={formState.lensMaterial}
            onLensMaterialChange={(value) => updateField('lensMaterial', value)}
            coatings={formState.coatings}
            onCoatingChange={handleCoatingChange}
            selectedFrame={formState.selectedFrame}
            onSelectFrame={(frame) => updateField('selectedFrame', frame)}
            onClearFrame={() => updateField('selectedFrame', null)}
          />
        )}

        {/* Contact Lens Options */}
        {formState.orderType !== 'glasses' && (
          <ContactLensOptionsSection
            exam={exam}
            selectedLensOd={formState.selectedLensOd}
            onSelectLensOd={(lens) => updateField('selectedLensOd', lens)}
            onClearLensOd={() => updateField('selectedLensOd', null)}
            selectedLensOs={formState.selectedLensOs}
            onSelectLensOs={(lens) => updateField('selectedLensOs', lens)}
            onClearLensOs={() => updateField('selectedLensOs', null)}
            contactLensQuantity={formState.contactLensQuantity}
            onUpdateQuantity={updateContactLensQuantity}
          />
        )}

        {/* Pricing Items */}
        <PricingSection
          items={formState.items}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          coatings={formState.coatings}
          selectedFrame={formState.selectedFrame}
          selectedLensOd={formState.selectedLensOd}
          selectedLensOs={formState.selectedLensOs}
          contactLensQuantity={formState.contactLensQuantity}
          orderTotal={orderTotal}
          conventionCoverage={conventionCoverage}
        />

        {/* Additional Options */}
        <AdditionalOptionsSection
          priority={formState.priority}
          onPriorityChange={(value) => updateField('priority', value)}
          deliveryMethod={formState.deliveryMethod}
          onDeliveryMethodChange={(value) => updateField('deliveryMethod', value)}
          notes={formState.notes}
          onNotesChange={updateNotes}
        />

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Créer la commande
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
