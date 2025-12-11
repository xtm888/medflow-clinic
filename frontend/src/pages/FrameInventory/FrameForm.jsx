import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import frameInventoryService from '../../services/frameInventoryService';

const FrameForm = ({ frame, onClose, onSave }) => {
  const isEdit = !!frame;

  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    brand: '',
    model: '',
    color: '',
    colorCode: '',
    size: '',
    category: 'standard',
    material: 'plastic',
    frameType: 'full-rim',
    gender: 'unisex',
    style: 'classic',
    dimensions: {
      lensWidth: '',
      bridgeWidth: '',
      templeLength: '',
      lensHeight: '',
      frameWidth: ''
    },
    location: {
      store: 'Main Store',
      section: '',
      shelf: '',
      position: ''
    },
    pricing: {
      costPrice: '',
      sellingPrice: '',
      currency: 'CDF'
    },
    inventory: {
      minimumStock: 2,
      reorderPoint: 5,
      maximumStock: '',
      optimalStock: ''
    },
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  // Categories
  const categories = [
    { value: 'economic', label: 'Economique' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'luxury', label: 'Luxe' },
    { value: 'children', label: 'Enfant' },
    { value: 'sport', label: 'Sport' }
  ];

  // Materials
  const materials = [
    { value: 'metal', label: 'Metal' },
    { value: 'plastic', label: 'Plastique' },
    { value: 'titanium', label: 'Titane' },
    { value: 'acetate', label: 'Acetate' },
    { value: 'tr90', label: 'TR90' },
    { value: 'wood', label: 'Bois' },
    { value: 'carbon-fiber', label: 'Fibre de carbone' },
    { value: 'stainless-steel', label: 'Acier inoxydable' },
    { value: 'memory-metal', label: 'Metal a memoire' },
    { value: 'mixed', label: 'Mixte' }
  ];

  // Frame types
  const frameTypes = [
    { value: 'full-rim', label: 'Cerclage complet' },
    { value: 'half-rim', label: 'Demi-cerclage' },
    { value: 'rimless', label: 'Sans cerclage' }
  ];

  // Genders
  const genders = [
    { value: 'unisex', label: 'Unisexe' },
    { value: 'men', label: 'Homme' },
    { value: 'women', label: 'Femme' },
    { value: 'children', label: 'Enfant' }
  ];

  // Styles
  const styles = [
    { value: 'classic', label: 'Classique' },
    { value: 'modern', label: 'Moderne' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'sport', label: 'Sport' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'professional', label: 'Professionnel' }
  ];

  // Load frame data for editing
  useEffect(() => {
    if (frame) {
      setFormData({
        sku: frame.sku || '',
        barcode: frame.barcode || '',
        brand: frame.brand || '',
        model: frame.model || '',
        color: frame.color || '',
        colorCode: frame.colorCode || '',
        size: frame.size || '',
        category: frame.category || 'standard',
        material: frame.material || 'plastic',
        frameType: frame.frameType || 'full-rim',
        gender: frame.gender || 'unisex',
        style: frame.style || 'classic',
        dimensions: {
          lensWidth: frame.dimensions?.lensWidth || '',
          bridgeWidth: frame.dimensions?.bridgeWidth || '',
          templeLength: frame.dimensions?.templeLength || '',
          lensHeight: frame.dimensions?.lensHeight || '',
          frameWidth: frame.dimensions?.frameWidth || ''
        },
        location: {
          store: frame.location?.store || 'Main Store',
          section: frame.location?.section || '',
          shelf: frame.location?.shelf || '',
          position: frame.location?.position || ''
        },
        pricing: {
          costPrice: frame.pricing?.costPrice || '',
          sellingPrice: frame.pricing?.sellingPrice || '',
          currency: frame.pricing?.currency || 'CDF'
        },
        inventory: {
          minimumStock: frame.inventory?.minimumStock || 2,
          reorderPoint: frame.inventory?.reorderPoint || 5,
          maximumStock: frame.inventory?.maximumStock || '',
          optimalStock: frame.inventory?.optimalStock || ''
        },
        notes: frame.notes || ''
      });
    }
  }, [frame]);

  // Generate SKU from brand, model, color
  const generateSku = () => {
    if (formData.brand && formData.model && formData.color) {
      const brandCode = formData.brand.substring(0, 3).toUpperCase();
      const modelCode = formData.model.replace(/\s+/g, '').substring(0, 4).toUpperCase();
      const colorCode = formData.color.substring(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      setFormData(prev => ({
        ...prev,
        sku: `${brandCode}-${modelCode}-${colorCode}-${random}`
      }));
    }
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.sku || !formData.brand || !formData.model || !formData.color) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!formData.pricing.costPrice || !formData.pricing.sellingPrice) {
      toast.error('Veuillez entrer les prix');
      return;
    }

    try {
      setLoading(true);

      // Prepare data
      const data = {
        ...formData,
        pricing: {
          ...formData.pricing,
          costPrice: parseFloat(formData.pricing.costPrice),
          sellingPrice: parseFloat(formData.pricing.sellingPrice)
        },
        inventory: {
          ...formData.inventory,
          minimumStock: parseInt(formData.inventory.minimumStock) || 2,
          reorderPoint: parseInt(formData.inventory.reorderPoint) || 5,
          maximumStock: formData.inventory.maximumStock ? parseInt(formData.inventory.maximumStock) : undefined,
          optimalStock: formData.inventory.optimalStock ? parseInt(formData.inventory.optimalStock) : undefined
        },
        dimensions: {
          lensWidth: formData.dimensions.lensWidth ? parseFloat(formData.dimensions.lensWidth) : undefined,
          bridgeWidth: formData.dimensions.bridgeWidth ? parseFloat(formData.dimensions.bridgeWidth) : undefined,
          templeLength: formData.dimensions.templeLength ? parseFloat(formData.dimensions.templeLength) : undefined,
          lensHeight: formData.dimensions.lensHeight ? parseFloat(formData.dimensions.lensHeight) : undefined,
          frameWidth: formData.dimensions.frameWidth ? parseFloat(formData.dimensions.frameWidth) : undefined
        }
      };

      if (isEdit) {
        await frameInventoryService.updateFrame(frame._id, data);
      } else {
        await frameInventoryService.createFrame(data);
      }

      onSave();
    } catch (error) {
      console.error('Error saving frame:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier la Monture' : 'Nouvelle Monture'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Identification */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Identification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">SKU *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    disabled={isEdit}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Ex: RAY-WAY-BLK-A1B"
                  />
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={generateSku}
                      className="px-3 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                    >
                      Generer
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Code-barres</label>
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Code-barres"
                />
              </div>
            </div>
          </div>

          {/* Frame Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Details de la monture</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Marque *</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Ray-Ban, Oakley"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Modele *</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Wayfarer, Holbrook"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Couleur *</label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Noir, Ecaille"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Taille (Largeur-Pont-Branche)</label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 52-18-140"
                />
              </div>
            </div>
          </div>

          {/* Categorization */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Categorisation</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Categorie</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Materiau</label>
                <select
                  name="material"
                  value={formData.material}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {materials.map(mat => (
                    <option key={mat.value} value={mat.value}>{mat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type</label>
                <select
                  name="frameType"
                  value={formData.frameType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {frameTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Genre</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {genders.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Prix</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Prix d'achat *</label>
                <input
                  type="number"
                  name="pricing.costPrice"
                  value={formData.pricing.costPrice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Prix de vente *</label>
                <input
                  type="number"
                  name="pricing.sellingPrice"
                  value={formData.pricing.sellingPrice}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Devise</label>
                <select
                  name="pricing.currency"
                  value={formData.pricing.currency}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CDF">CDF</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            {formData.pricing.costPrice && formData.pricing.sellingPrice && (
              <p className="mt-2 text-sm text-gray-500">
                Marge: {((formData.pricing.sellingPrice - formData.pricing.costPrice) / formData.pricing.costPrice * 100).toFixed(1)}%
              </p>
            )}
          </div>

          {/* Stock Thresholds */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Seuils de stock</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Stock minimum</label>
                <input
                  type="number"
                  name="inventory.minimumStock"
                  value={formData.inventory.minimumStock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Point de reordre</label>
                <input
                  type="number"
                  name="inventory.reorderPoint"
                  value={formData.inventory.reorderPoint}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Stock maximum</label>
                <input
                  type="number"
                  name="inventory.maximumStock"
                  value={formData.inventory.maximumStock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Stock optimal</label>
                <input
                  type="number"
                  name="inventory.optimalStock"
                  value={formData.inventory.optimalStock}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Emplacement</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Magasin</label>
                <input
                  type="text"
                  name="location.store"
                  value={formData.location.store}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Section</label>
                <input
                  type="text"
                  name="location.section"
                  value={formData.location.section}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Etagere</label>
                <input
                  type="text"
                  name="location.shelf"
                  value={formData.location.shelf}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Position</label>
                <input
                  type="text"
                  name="location.position"
                  value={formData.location.position}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Notes additionnelles..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Sauvegarde...' : (isEdit ? 'Mettre a jour' : 'Creer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FrameForm;
