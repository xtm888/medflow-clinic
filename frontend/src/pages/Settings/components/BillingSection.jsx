/**
 * BillingSection Component
 *
 * Tax rates configuration (admin & accountant).
 */

import { Loader2, Plus, Edit2, Trash2, DollarSign, AlertCircle, X } from 'lucide-react';
import { TAX_CATEGORIES, TAX_TYPES } from '../constants';

export default function BillingSection({
  taxes,
  taxesLoading,
  showTaxModal,
  editingTax,
  taxForm,
  onTaxFormChange,
  saving,
  onOpenModal,
  onCloseModal,
  onSaveTax,
  onDeleteTax
}) {
  return (
    <div className="space-y-6">
      {/* Tax Rates Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Taux de Taxe</h2>
            <p className="text-sm text-gray-500">Configurez les taux de taxe appliqués aux factures</p>
          </div>
          <button
            onClick={() => onOpenModal()}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter</span>
          </button>
        </div>

        {taxesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <span className="ml-2 text-gray-600">Chargement...</span>
          </div>
        ) : taxes.length > 0 ? (
          <TaxList taxes={taxes} onEdit={onOpenModal} onDelete={onDeleteTax} />
        ) : (
          <EmptyTaxState />
        )}
      </div>

      {/* Info Card */}
      <TaxInfoCard />

      {/* Tax Modal */}
      {showTaxModal && (
        <TaxModal
          editingTax={editingTax}
          taxForm={taxForm}
          onTaxFormChange={onTaxFormChange}
          saving={saving}
          onClose={onCloseModal}
          onSave={onSaveTax}
        />
      )}
    </div>
  );
}

// Sub-components
function TaxList({ taxes, onEdit, onDelete }) {
  return (
    <div className="space-y-3">
      {taxes.map((tax) => (
        <div
          key={tax._id}
          className={`p-4 rounded-lg border ${
            tax.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${tax.active ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="font-semibold text-gray-900">{tax.name}</p>
                <p className="text-sm text-gray-500">Code: {tax.code}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-bold text-lg text-primary-600">
                  {tax.rate}{tax.type === 'percentage' ? '%' : ' CDF'}
                </p>
                <p className="text-xs text-gray-500">
                  {tax.applicableCategories?.includes('all')
                    ? 'Toutes catégories'
                    : tax.applicableCategories?.join(', ')}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(tax)}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                  title="Modifier"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {tax.active && (
                  <button
                    onClick={() => onDelete(tax._id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Désactiver"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {tax.description && (
            <p className="mt-2 text-sm text-gray-600 border-t pt-2">{tax.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyTaxState() {
  return (
    <div className="text-center py-8 text-gray-500">
      <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-4" />
      <p>Aucun taux de taxe configuré</p>
      <p className="text-sm">Cliquez sur "Ajouter" pour créer un taux de taxe</p>
    </div>
  );
}

function TaxInfoCard() {
  return (
    <div className="card bg-blue-50 border-blue-200">
      <div className="flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">À propos de la configuration des taxes</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Les taxes actives sont automatiquement appliquées aux nouvelles factures</li>
            <li>Vous pouvez configurer des taxes en pourcentage ou en montant fixe</li>
            <li>Les catégories permettent d'appliquer des taxes spécifiques à certains types de services</li>
            <li>La désactivation d'une taxe n'affecte pas les factures existantes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function TaxModal({ editingTax, taxForm, onTaxFormChange, saving, onClose, onSave }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {editingTax ? 'Modifier le taux de taxe' : 'Ajouter un taux de taxe'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              className="input"
              placeholder="ex: TVA"
              value={taxForm.name}
              onChange={(e) => onTaxFormChange({ ...taxForm, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input
              type="text"
              className="input"
              placeholder="ex: VAT"
              value={taxForm.code}
              onChange={(e) => onTaxFormChange({ ...taxForm, code: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taux *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder="ex: 18"
                value={taxForm.rate}
                onChange={(e) => onTaxFormChange({ ...taxForm, rate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="input"
                value={taxForm.type}
                onChange={(e) => onTaxFormChange({ ...taxForm, type: e.target.value })}
              >
                {TAX_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégories applicables</label>
            <select
              className="input"
              value={taxForm.applicableCategories[0] || 'all'}
              onChange={(e) => onTaxFormChange({
                ...taxForm,
                applicableCategories: [e.target.value]
              })}
            >
              {TAX_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input"
              rows="2"
              placeholder="Description optionnelle..."
              value={taxForm.description}
              onChange={(e) => onTaxFormChange({ ...taxForm, description: e.target.value })}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="tax-active"
              checked={taxForm.active}
              onChange={(e) => onTaxFormChange({ ...taxForm, active: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="tax-active" className="text-sm text-gray-700">
              Taxe active
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary" disabled={saving}>
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving || !taxForm.name || !taxForm.code || !taxForm.rate}
            className="btn btn-primary"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sauvegarde...
              </>
            ) : (
              editingTax ? 'Mettre à jour' : 'Créer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
