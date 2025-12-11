import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import opticalLensInventoryService from '../../services/opticalLensInventoryService';

const LensForm = ({ lens, onClose, onSave }) => {
  const isEdit = !!lens;

  const [formData, setFormData] = useState({
    sku: '',
    brand: '',
    productLine: '',
    manufacturer: '',
    lensType: 'blank',
    design: 'single-vision',
    progressiveType: '',
    progressiveBrand: '',
    material: 'cr39',
    refractiveIndex: '',
    coatings: [],
    isPhotochromic: false,
    photochromicType: '',
    photochromicColor: '',
    isPolarized: false,
    polarizedColor: '',
    isTinted: false,
    tintType: '',
    tintColor: '',
    tintDensity: '',
    diameter: 70,
    minFittingHeight: '',
    category: 'standard',
    pricing: {
      costPrice: '',
      sellingPrice: '',
      currency: 'CDF'
    },
    inventory: {
      minimumStock: 5,
      reorderPoint: 10,
      reorderQuantity: 20
    }
  });

  const [loading, setLoading] = useState(false);

  // Options
  const lensTypes = [
    { value: 'blank', label: 'Semi-fini (Blank)' },
    { value: 'semi-finished', label: 'Semi-fini' },
    { value: 'finished', label: 'Fini' },
    { value: 'stock', label: 'Stock' }
  ];

  const designs = [
    { value: 'single-vision', label: 'Unifocal' },
    { value: 'bifocal-ft28', label: 'Bifocal FT28' },
    { value: 'bifocal-ft35', label: 'Bifocal FT35' },
    { value: 'bifocal-round', label: 'Bifocal Rond' },
    { value: 'progressive', label: 'Progressif' },
    { value: 'office-progressive', label: 'Progressif Bureau' },
    { value: 'degressive', label: 'Degressif' },
    { value: 'lenticular', label: 'Lenticulaire' }
  ];

  const progressiveTypes = [
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'personalized', label: 'Personnalise' },
    { value: 'digital-freeform', label: 'Digital Freeform' },
    { value: 'occupational', label: 'Occupationnel' }
  ];

  const materials = [
    { value: 'cr39', label: 'CR-39 (1.50)', index: 1.50 },
    { value: 'cr39-1.56', label: 'CR-39 (1.56)', index: 1.56 },
    { value: 'polycarbonate', label: 'Polycarbonate (1.59)', index: 1.59 },
    { value: 'trivex', label: 'Trivex (1.53)', index: 1.53 },
    { value: 'hi-index-1.60', label: 'Hi-Index 1.60', index: 1.60 },
    { value: 'hi-index-1.67', label: 'Hi-Index 1.67', index: 1.67 },
    { value: 'hi-index-1.74', label: 'Hi-Index 1.74', index: 1.74 },
    { value: 'glass-1.52', label: 'Verre Crown (1.52)', index: 1.52 },
    { value: 'glass-1.70', label: 'Verre Hi-Index (1.70)', index: 1.70 },
    { value: 'glass-1.80', label: 'Verre Hi-Index (1.80)', index: 1.80 },
    { value: 'glass-1.90', label: 'Verre Hi-Index (1.90)', index: 1.90 }
  ];

  const coatingOptions = [
    { value: 'hard-coat', label: 'Anti-rayure' },
    { value: 'hmc', label: 'HMC (Hard Multi-Coat)' },
    { value: 'shmc', label: 'Super HMC' },
    { value: 'anti-reflective', label: 'Anti-reflet' },
    { value: 'blue-light-filter', label: 'Filtre lumiere bleue' },
    { value: 'uv400', label: 'UV400' },
    { value: 'hydrophobic', label: 'Hydrophobe' },
    { value: 'oleophobic', label: 'Oleophobe' },
    { value: 'anti-static', label: 'Anti-statique' },
    { value: 'easy-clean', label: 'Easy Clean' }
  ];

  const photochromicTypes = [
    { value: 'transitions-signature', label: 'Transitions Signature' },
    { value: 'transitions-xtractive', label: 'Transitions XTRActive' },
    { value: 'transitions-vantage', label: 'Transitions Vantage' },
    { value: 'sensity', label: 'Sensity (Hoya)' },
    { value: 'photofusion', label: 'PhotoFusion (Zeiss)' },
    { value: 'photomax', label: 'PhotoMax' },
    { value: 'other', label: 'Autre' }
  ];

  const photochromicColors = [
    { value: 'gray', label: 'Gris' },
    { value: 'brown', label: 'Brun' },
    { value: 'green', label: 'Vert' },
    { value: 'graphite-green', label: 'Vert Graphite' },
    { value: 'amber', label: 'Ambre' },
    { value: 'sapphire', label: 'Saphir' },
    { value: 'amethyst', label: 'Amethyste' },
    { value: 'emerald', label: 'Emeraude' }
  ];

  const tintTypes = [
    { value: 'solid', label: 'Uniforme' },
    { value: 'gradient', label: 'Degrade' },
    { value: 'mirror', label: 'Miroir' },
    { value: 'fashion', label: 'Fashion' }
  ];

  const categories = [
    { value: 'economy', label: 'Economique' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'specialty', label: 'Specialite' }
  ];

  // Load lens data for editing
  useEffect(() => {
    if (lens) {
      setFormData({
        sku: lens.sku || '',
        brand: lens.brand || '',
        productLine: lens.productLine || '',
        manufacturer: lens.manufacturer || '',
        lensType: lens.lensType || 'blank',
        design: lens.design || 'single-vision',
        progressiveType: lens.progressiveType || '',
        progressiveBrand: lens.progressiveBrand || '',
        material: lens.material || 'cr39',
        refractiveIndex: lens.refractiveIndex || '',
        coatings: lens.coatings || [],
        isPhotochromic: lens.isPhotochromic || false,
        photochromicType: lens.photochromicType || '',
        photochromicColor: lens.photochromicColor || '',
        isPolarized: lens.isPolarized || false,
        polarizedColor: lens.polarizedColor || '',
        isTinted: lens.isTinted || false,
        tintType: lens.tintType || '',
        tintColor: lens.tintColor || '',
        tintDensity: lens.tintDensity || '',
        diameter: lens.diameter || 70,
        minFittingHeight: lens.minFittingHeight || '',
        category: lens.category || 'standard',
        pricing: {
          costPrice: lens.pricing?.costPrice || '',
          sellingPrice: lens.pricing?.sellingPrice || '',
          currency: lens.pricing?.currency || 'CDF'
        },
        inventory: {
          minimumStock: lens.inventory?.minimumStock || 5,
          reorderPoint: lens.inventory?.reorderPoint || 10,
          reorderQuantity: lens.inventory?.reorderQuantity || 20
        }
      });
    }
  }, [lens]);

  // Generate SKU
  const generateSku = () => {
    if (formData.brand && formData.productLine && formData.material) {
      const brandCode = formData.brand.substring(0, 3).toUpperCase();
      const productCode = formData.productLine.replace(/\s+/g, '').substring(0, 4).toUpperCase();
      const materialCode = formData.material.substring(0, 3).toUpperCase();
      const random = Math.random().toString(36).substring(2, 5).toUpperCase();
      setFormData(prev => ({
        ...prev,
        sku: `VR-${brandCode}-${productCode}-${materialCode}-${random}`
      }));
    }
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Auto-set refractive index when material changes
    if (name === 'material') {
      const mat = materials.find(m => m.value === value);
      if (mat) {
        setFormData(prev => ({
          ...prev,
          refractiveIndex: mat.index
        }));
      }
    }
  };

  // Handle coating toggle
  const handleCoatingToggle = (coating) => {
    setFormData(prev => ({
      ...prev,
      coatings: prev.coatings.includes(coating)
        ? prev.coatings.filter(c => c !== coating)
        : [...prev.coatings, coating]
    }));
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.sku || !formData.brand || !formData.productLine || !formData.material || !formData.design) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!formData.pricing.costPrice || !formData.pricing.sellingPrice) {
      toast.error('Veuillez entrer les prix');
      return;
    }

    try {
      setLoading(true);

      const data = {
        ...formData,
        refractiveIndex: parseFloat(formData.refractiveIndex) || undefined,
        diameter: parseFloat(formData.diameter) || 70,
        minFittingHeight: formData.minFittingHeight ? parseFloat(formData.minFittingHeight) : undefined,
        tintDensity: formData.tintDensity ? parseInt(formData.tintDensity) : undefined,
        pricing: {
          ...formData.pricing,
          costPrice: parseFloat(formData.pricing.costPrice),
          sellingPrice: parseFloat(formData.pricing.sellingPrice)
        },
        inventory: {
          ...formData.inventory,
          minimumStock: parseInt(formData.inventory.minimumStock) || 5,
          reorderPoint: parseInt(formData.inventory.reorderPoint) || 10,
          reorderQuantity: parseInt(formData.inventory.reorderQuantity) || 20
        }
      };

      // Clear optional fields if not used
      if (!formData.isPhotochromic) {
        delete data.photochromicType;
        delete data.photochromicColor;
      }
      if (!formData.isPolarized) {
        delete data.polarizedColor;
      }
      if (!formData.isTinted) {
        delete data.tintType;
        delete data.tintColor;
        delete data.tintDensity;
      }
      if (!['progressive', 'office-progressive'].includes(formData.design)) {
        delete data.progressiveType;
        delete data.progressiveBrand;
        delete data.minFittingHeight;
      }

      if (isEdit) {
        await opticalLensInventoryService.updateLens(lens._id, data);
      } else {
        await opticalLensInventoryService.createLens(data);
      }

      onSave();
    } catch (error) {
      console.error('Error saving lens:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier le Verre' : 'Nouveau Verre Optique'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">SKU *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    disabled={isEdit}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="VR-ESS-PRO-CR3-A1B"
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
                <label className="block text-sm text-gray-600 mb-1">Type</label>
                <select
                  name="lensType"
                  value={formData.lensType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {lensTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
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
            </div>
          </div>

          {/* Brand & Product */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Marque & Produit</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Marque *</label>
                <input
                  type="text"
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Essilor, Hoya, Zeiss"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ligne de Produit *</label>
                <input
                  type="text"
                  name="productLine"
                  value={formData.productLine}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Varilux Comfort, iD MyStyle"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fabricant</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Fabricant"
                />
              </div>
            </div>
          </div>

          {/* Material & Design */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Materiau & Design</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Materiau *</label>
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
                <label className="block text-sm text-gray-600 mb-1">Indice</label>
                <input
                  type="number"
                  name="refractiveIndex"
                  value={formData.refractiveIndex}
                  onChange={handleChange}
                  step="0.01"
                  min="1.4"
                  max="2.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1.50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Design *</label>
                <select
                  name="design"
                  value={formData.design}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {designs.map(des => (
                    <option key={des.value} value={des.value}>{des.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Diametre (mm)</label>
                <input
                  type="number"
                  name="diameter"
                  value={formData.diameter}
                  onChange={handleChange}
                  min="50"
                  max="80"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="70"
                />
              </div>
            </div>

            {/* Progressive-specific fields */}
            {['progressive', 'office-progressive'].includes(formData.design) && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Type Progressif</label>
                  <select
                    name="progressiveType"
                    value={formData.progressiveType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selectionner</option>
                    {progressiveTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nom Commercial</label>
                  <input
                    type="text"
                    name="progressiveBrand"
                    value={formData.progressiveBrand}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Varilux Comfort"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hauteur min. (mm)</label>
                  <input
                    type="number"
                    name="minFittingHeight"
                    value={formData.minFittingHeight}
                    onChange={handleChange}
                    min="14"
                    max="22"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="18"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Coatings */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Traitements</h3>
            <div className="flex flex-wrap gap-2">
              {coatingOptions.map(coating => (
                <button
                  key={coating.value}
                  type="button"
                  onClick={() => handleCoatingToggle(coating.value)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    formData.coatings.includes(coating.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {coating.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Features */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Options Speciales</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Photochromic */}
              <div className="border rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    name="isPhotochromic"
                    checked={formData.isPhotochromic}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-medium text-gray-700">Photochromique</span>
                </label>
                {formData.isPhotochromic && (
                  <div className="space-y-3">
                    <select
                      name="photochromicType"
                      value={formData.photochromicType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Type</option>
                      {photochromicTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <select
                      name="photochromicColor"
                      value={formData.photochromicColor}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Couleur</option>
                      {photochromicColors.map(color => (
                        <option key={color.value} value={color.value}>{color.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Polarized */}
              <div className="border rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    name="isPolarized"
                    checked={formData.isPolarized}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-gray-700">Polarise</span>
                </label>
                {formData.isPolarized && (
                  <input
                    type="text"
                    name="polarizedColor"
                    value={formData.polarizedColor}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Couleur polarisation"
                  />
                )}
              </div>

              {/* Tinted */}
              <div className="border rounded-lg p-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    name="isTinted"
                    checked={formData.isTinted}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium text-gray-700">Teinte</span>
                </label>
                {formData.isTinted && (
                  <div className="space-y-3">
                    <select
                      name="tintType"
                      value={formData.tintType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Type</option>
                      {tintTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="tintColor"
                      value={formData.tintColor}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Couleur"
                    />
                    <input
                      type="number"
                      name="tintDensity"
                      value={formData.tintDensity}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="Densite (%)"
                    />
                  </div>
                )}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">Seuils de Stock</h3>
            <div className="grid grid-cols-3 gap-4">
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
                <label className="block text-sm text-gray-600 mb-1">Quantite reordre</label>
                <input
                  type="number"
                  name="inventory.reorderQuantity"
                  value={formData.inventory.reorderQuantity}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
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

export default LensForm;
