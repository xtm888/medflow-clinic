import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { unifiedInventoryService } from '../../services/inventory';

/**
 * UnifiedInventoryForm - Dynamic form for all inventory types
 *
 * Renders type-specific fields based on inventoryType prop
 */

// Common fields for all inventory types
const COMMON_FIELDS = [
  { name: 'sku', label: 'SKU', type: 'text', required: true },
  { name: 'name', label: 'Nom', type: 'text', required: true },
  { name: 'brand', label: 'Marque', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'currentStock', label: 'Stock actuel', type: 'number', min: 0 },
  { name: 'reorderPoint', label: 'Seuil de réapprovisionnement', type: 'number', min: 0 },
  { name: 'reorderQuantity', label: 'Quantité de réapprovisionnement', type: 'number', min: 0 }
];

// Pricing fields
const PRICING_FIELDS = [
  { name: 'pricing.unitPrice', label: 'Prix unitaire', type: 'number', min: 0, step: '0.01' },
  { name: 'pricing.costPrice', label: 'Prix de revient', type: 'number', min: 0, step: '0.01' }
];

// Type-specific field configurations
const TYPE_SPECIFIC_FIELDS = {
  frame: [
    { name: 'category', label: 'Catégorie', type: 'select', options: [
      { value: 'economic', label: 'Économique' },
      { value: 'standard', label: 'Standard' },
      { value: 'premium', label: 'Premium' },
      { value: 'luxury', label: 'Luxe' },
      { value: 'children', label: 'Enfant' },
      { value: 'sport', label: 'Sport' }
    ]},
    { name: 'material', label: 'Matériau', type: 'select', options: [
      { value: 'metal', label: 'Métal' },
      { value: 'plastic', label: 'Plastique' },
      { value: 'titanium', label: 'Titane' },
      { value: 'acetate', label: 'Acétate' },
      { value: 'wood', label: 'Bois' },
      { value: 'carbon', label: 'Carbone' }
    ]},
    { name: 'gender', label: 'Genre', type: 'select', options: [
      { value: 'male', label: 'Homme' },
      { value: 'female', label: 'Femme' },
      { value: 'unisex', label: 'Mixte' },
      { value: 'child', label: 'Enfant' }
    ]},
    { name: 'frameType', label: 'Type', type: 'select', options: [
      { value: 'full-rim', label: 'Cerclée' },
      { value: 'semi-rimless', label: 'Demi-cerclée' },
      { value: 'rimless', label: 'Percée' }
    ]},
    { name: 'color', label: 'Couleur', type: 'text' },
    { name: 'bridgeSize', label: 'Pont (mm)', type: 'number', min: 10, max: 30 },
    { name: 'templeLength', label: 'Branches (mm)', type: 'number', min: 100, max: 160 },
    { name: 'lensWidth', label: 'Largeur verre (mm)', type: 'number', min: 40, max: 70 }
  ],
  optical_lens: [
    { name: 'lensType', label: 'Type de verre', type: 'select', options: [
      { value: 'single_vision', label: 'Unifocal' },
      { value: 'bifocal', label: 'Bifocal' },
      { value: 'progressive', label: 'Progressif' },
      { value: 'degressive', label: 'Dégressif' }
    ]},
    { name: 'material', label: 'Matériau', type: 'select', options: [
      { value: 'cr39', label: 'CR-39' },
      { value: 'polycarbonate', label: 'Polycarbonate' },
      { value: 'trivex', label: 'Trivex' },
      { value: 'high_index_1.60', label: 'Indice 1.60' },
      { value: 'high_index_1.67', label: 'Indice 1.67' },
      { value: 'high_index_1.74', label: 'Indice 1.74' }
    ]},
    { name: 'coating', label: 'Traitement', type: 'select', options: [
      { value: 'none', label: 'Sans traitement' },
      { value: 'anti_reflective', label: 'Anti-reflet' },
      { value: 'blue_filter', label: 'Filtre lumière bleue' },
      { value: 'photochromic', label: 'Photochromique' },
      { value: 'polarized', label: 'Polarisé' }
    ]},
    { name: 'sphereRange', label: 'Plage sphère', type: 'text', placeholder: '-10.00 à +8.00' },
    { name: 'cylinderRange', label: 'Plage cylindre', type: 'text', placeholder: '0 à -6.00' }
  ],
  contact_lens: [
    { name: 'lensType', label: 'Type', type: 'select', options: [
      { value: 'soft', label: 'Souple' },
      { value: 'rigid', label: 'Rigide' },
      { value: 'hybrid', label: 'Hybride' }
    ]},
    { name: 'wearDuration', label: 'Durée de port', type: 'select', options: [
      { value: 'daily', label: 'Journalière' },
      { value: 'weekly', label: 'Hebdomadaire' },
      { value: 'bi-weekly', label: 'Bi-mensuelle' },
      { value: 'monthly', label: 'Mensuelle' },
      { value: 'yearly', label: 'Annuelle' }
    ]},
    { name: 'baseCurve', label: 'Rayon de courbure (BC)', type: 'number', step: '0.1', min: 7.0, max: 10.0 },
    { name: 'diameter', label: 'Diamètre (mm)', type: 'number', step: '0.1', min: 13.0, max: 15.0 },
    { name: 'sphere', label: 'Sphère', type: 'number', step: '0.25', min: -20, max: 20 },
    { name: 'cylinder', label: 'Cylindre', type: 'number', step: '0.25', min: -6, max: 0 },
    { name: 'waterContent', label: 'Teneur en eau (%)', type: 'number', min: 20, max: 80 }
  ],
  pharmacy: [
    { name: 'genericName', label: 'DCI (Nom générique)', type: 'text' },
    { name: 'dosageForm', label: 'Forme galénique', type: 'select', options: [
      { value: 'tablet', label: 'Comprimé' },
      { value: 'capsule', label: 'Gélule' },
      { value: 'syrup', label: 'Sirop' },
      { value: 'injection', label: 'Injectable' },
      { value: 'drops', label: 'Gouttes' },
      { value: 'ointment', label: 'Pommade' },
      { value: 'cream', label: 'Crème' },
      { value: 'gel', label: 'Gel' },
      { value: 'spray', label: 'Spray' },
      { value: 'suppository', label: 'Suppositoire' }
    ]},
    { name: 'strength', label: 'Dosage', type: 'text', placeholder: 'ex: 500mg' },
    { name: 'therapeuticClass', label: 'Classe thérapeutique', type: 'text' },
    { name: 'requiresPrescription', label: 'Ordonnance requise', type: 'checkbox' },
    { name: 'controlled', label: 'Produit contrôlé', type: 'checkbox' },
    { name: 'expirationDate', label: 'Date d\'expiration', type: 'date' },
    { name: 'storageConditions', label: 'Conditions de stockage', type: 'select', options: [
      { value: 'room_temp', label: 'Température ambiante' },
      { value: 'refrigerated', label: 'Réfrigéré (2-8°C)' },
      { value: 'frozen', label: 'Congelé (<-15°C)' }
    ]}
  ],
  reagent: [
    { name: 'reagentType', label: 'Type de réactif', type: 'select', options: [
      { value: 'diagnostic', label: 'Diagnostic' },
      { value: 'calibrator', label: 'Calibrateur' },
      { value: 'control', label: 'Contrôle' },
      { value: 'buffer', label: 'Tampon' },
      { value: 'stain', label: 'Colorant' }
    ]},
    { name: 'testType', label: 'Type de test', type: 'text', placeholder: 'ex: Glycémie, HbA1c' },
    { name: 'analyzerCompatibility', label: 'Analyseur compatible', type: 'text' },
    { name: 'expirationDate', label: 'Date d\'expiration', type: 'date' },
    { name: 'storageTemp', label: 'Température de stockage', type: 'select', options: [
      { value: 'room_temp', label: 'Ambiante (15-25°C)' },
      { value: 'refrigerated', label: 'Réfrigéré (2-8°C)' },
      { value: 'frozen', label: 'Congelé (<-20°C)' }
    ]},
    { name: 'testsPerKit', label: 'Tests par kit', type: 'number', min: 1 },
    { name: 'lotNumber', label: 'Numéro de lot', type: 'text' }
  ],
  lab_consumable: [
    { name: 'consumableType', label: 'Type', type: 'select', options: [
      { value: 'tube', label: 'Tube' },
      { value: 'slide', label: 'Lame' },
      { value: 'pipette', label: 'Pipette' },
      { value: 'container', label: 'Conteneur' },
      { value: 'swab', label: 'Écouvillon' },
      { value: 'needle', label: 'Aiguille' },
      { value: 'syringe', label: 'Seringue' },
      { value: 'gloves', label: 'Gants' },
      { value: 'other', label: 'Autre' }
    ]},
    { name: 'size', label: 'Taille/Volume', type: 'text', placeholder: 'ex: 5mL, M' },
    { name: 'material', label: 'Matériau', type: 'select', options: [
      { value: 'glass', label: 'Verre' },
      { value: 'plastic', label: 'Plastique' },
      { value: 'latex', label: 'Latex' },
      { value: 'nitrile', label: 'Nitrile' },
      { value: 'steel', label: 'Acier' }
    ]},
    { name: 'sterile', label: 'Stérile', type: 'checkbox' },
    { name: 'singleUse', label: 'Usage unique', type: 'checkbox' },
    { name: 'expirationDate', label: 'Date d\'expiration', type: 'date' },
    { name: 'unitsPerPack', label: 'Unités par paquet', type: 'number', min: 1 }
  ],
  surgical_supply: [
    { name: 'supplyType', label: 'Type', type: 'select', options: [
      { value: 'iol', label: 'Implant IOL' },
      { value: 'viscoelastic', label: 'Viscoélastique' },
      { value: 'suture', label: 'Suture' },
      { value: 'blade', label: 'Lame' },
      { value: 'cannula', label: 'Canule' },
      { value: 'drape', label: 'Champ opératoire' },
      { value: 'instrument', label: 'Instrument' },
      { value: 'other', label: 'Autre' }
    ]},
    { name: 'size', label: 'Taille/Dioptrie', type: 'text' },
    { name: 'sterile', label: 'Stérile', type: 'checkbox' },
    { name: 'singleUse', label: 'Usage unique', type: 'checkbox' },
    { name: 'expirationDate', label: 'Date d\'expiration', type: 'date' },
    { name: 'lotNumber', label: 'Numéro de lot', type: 'text' },
    { name: 'serialNumber', label: 'Numéro de série', type: 'text' }
  ]
};

// Helper to get nested value from object
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

// Helper to set nested value in object
const setNestedValue = (obj, path, value) => {
  const newObj = { ...obj };
  const parts = path.split('.');
  let current = newObj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    } else {
      current[parts[i]] = { ...current[parts[i]] };
    }
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
  return newObj;
};

export default function UnifiedInventoryForm({ inventoryType, item, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  const [loading, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data
  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    } else {
      // Default values for new item
      setFormData({
        inventoryType,
        currentStock: 0,
        reorderPoint: 5,
        reorderQuantity: 10,
        status: 'in_stock',
        pricing: {
          unitPrice: 0,
          costPrice: 0
        }
      });
    }
  }, [item, inventoryType]);

  // Get type-specific fields
  const typeFields = TYPE_SPECIFIC_FIELDS[inventoryType] || [];

  // Handle field change
  const handleChange = (name, value) => {
    setFormData(prev => setNestedValue(prev, name, value));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    // Check required fields
    COMMON_FIELDS.forEach(field => {
      if (field.required && !getNestedValue(formData, field.name)) {
        newErrors[field.name] = 'Ce champ est requis';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Veuillez corriger les erreurs');
      return;
    }

    try {
      setSaving(true);

      if (item?._id) {
        await unifiedInventoryService.update(item._id, formData);
      } else {
        await unifiedInventoryService.create({
          ...formData,
          inventoryType
        });
      }

      onSave();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Render field based on type
  const renderField = (field) => {
    const value = getNestedValue(formData, field.name);
    const error = errors[field.name];

    const baseInputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      error ? 'border-red-500' : 'border-gray-300'
    }`;

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={baseInputClass}
          >
            <option value="">Sélectionner...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleChange(field.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={baseInputClass}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleChange(field.name, e.target.value ? parseFloat(e.target.value) : '')}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className={baseInputClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value ? value.substring(0, 10) : ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className={baseInputClass}
          />
        );

      default:
        return (
          <input
            type={field.type || 'text'}
            value={value || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );
    }
  };

  // Inventory type labels
  const typeLabels = {
    frame: 'Monture',
    optical_lens: 'Verre Optique',
    contact_lens: 'Lentille de Contact',
    pharmacy: 'Médicament',
    reagent: 'Réactif',
    lab_consumable: 'Consommable Labo',
    surgical_supply: 'Fourniture Chirurgicale'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">
            {item ? 'Modifier' : 'Ajouter'} {typeLabels[inventoryType] || 'Article'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Common Fields */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">
                Informations générales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMMON_FIELDS.map(field => (
                  <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    {field.type !== 'checkbox' && (
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                    )}
                    {renderField(field)}
                    {errors[field.name] && (
                      <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Fields */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">
                Tarification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRICING_FIELDS.map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>

            {/* Type-Specific Fields */}
            {typeFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4 uppercase tracking-wider">
                  Détails spécifiques - {typeLabels[inventoryType]}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {typeFields.map(field => (
                    <div key={field.name} className={field.type === 'checkbox' ? '' : ''}>
                      {field.type !== 'checkbox' && (
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                        </label>
                      )}
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
