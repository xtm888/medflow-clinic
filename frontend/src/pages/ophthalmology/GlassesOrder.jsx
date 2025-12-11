import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Glasses, ShoppingCart, ArrowLeft, Save, Plus, Trash2,
  Eye, CheckCircle, AlertCircle, Loader2, Search, Package,
  AlertTriangle, X, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ophthalmologyService from '../../services/ophthalmologyService';
import glassesOrderService from '../../services/glassesOrderService';
import { toast } from 'react-toastify';
import ApprovalWarningBanner, { useApprovalWarnings } from '../../components/ApprovalWarningBanner';

// Frame Selector Component
const FrameSelector = ({ selectedFrame, onSelect, onClear }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchFrames = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await glassesOrderService.searchFrames(query);
      setSearchResults(response.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching frames:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchFrames(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchFrames]);

  const handleSelect = (frame) => {
    onSelect(frame);
    setSearchQuery('');
    setShowDropdown(false);
  };

  if (selectedFrame) {
    return (
      <div className="border border-green-300 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">
              {selectedFrame.brand} {selectedFrame.model}
            </p>
            <p className="text-sm text-green-600">
              {selectedFrame.color} • {selectedFrame.size || 'Taille standard'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              SKU: {selectedFrame.sku} •
              <span className={selectedFrame.available > 0 ? 'text-green-600' : 'text-red-600'}>
                {selectedFrame.available} en stock
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-800">
              {new Intl.NumberFormat('fr-CD').format(selectedFrame.price)} CDF
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-red-600 hover:text-red-800 mt-1"
            >
              Changer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une monture (marque, modèle, SKU)..."
          className="input pl-10"
          onFocus={() => searchQuery && setShowDropdown(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {searchResults.map((frame) => (
            <button
              key={frame.id}
              type="button"
              onClick={() => handleSelect(frame)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{frame.brand} {frame.model}</p>
                  <p className="text-sm text-gray-500">{frame.color} • {frame.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{new Intl.NumberFormat('fr-CD').format(frame.price)} CDF</p>
                  <p className={`text-xs ${frame.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {frame.available > 0 ? `${frame.available} en stock` : 'Rupture'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          Aucune monture trouvée
        </div>
      )}
    </div>
  );
};

// Contact Lens Selector Component
const ContactLensSelector = ({ eye, selectedLens, onSelect, onClear, prescription }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchLenses = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await glassesOrderService.searchContactLenses({
        query,
        power: prescription?.sphere
      });
      setSearchResults(response.data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching lenses:', err);
    } finally {
      setSearching(false);
    }
  }, [prescription]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchLenses(searchQuery);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchLenses]);

  const handleSelect = (lens) => {
    onSelect(lens);
    setSearchQuery('');
    setShowDropdown(false);
  };

  if (selectedLens) {
    return (
      <div className="border border-blue-300 bg-blue-50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800">
              {selectedLens.brand} {selectedLens.productLine}
            </p>
            <p className="text-xs text-blue-600">
              BC: {selectedLens.parameters?.baseCurve} • DIA: {selectedLens.parameters?.diameter}
            </p>
            <p className="text-xs text-gray-600">
              {selectedLens.available} boîtes en stock
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-blue-800">
              {new Intl.NumberFormat('fr-CD').format(selectedLens.price)} CDF
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Changer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Rechercher lentille ${eye}...`}
          className="input pl-10 text-sm"
          onFocus={() => searchQuery && setShowDropdown(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
          {searchResults.map((lens) => (
            <button
              key={lens.id}
              type="button"
              onClick={() => handleSelect(lens)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0 text-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{lens.brand} {lens.productLine}</p>
                  <p className="text-xs text-gray-500">
                    {lens.wearSchedule} • BC {lens.parameters?.baseCurve}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{new Intl.NumberFormat('fr-CD').format(lens.price)} CDF</p>
                  <p className={`text-xs ${lens.available > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lens.available > 0 ? `${lens.available} boîtes` : 'Rupture'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function GlassesOrder() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState(null);
  const [patient, setPatient] = useState(null);

  // Order form state
  const [orderType, setOrderType] = useState('glasses');
  const [lensType, setLensType] = useState('single-vision-distance');
  const [lensMaterial, setLensMaterial] = useState('cr39');
  const [coatings, setCoatings] = useState([]);

  // Inventory selection state
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [selectedLensOd, setSelectedLensOd] = useState(null);
  const [selectedLensOs, setSelectedLensOs] = useState(null);
  const [contactLensQuantity, setContactLensQuantity] = useState({ od: 1, os: 1 });

  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({ clinical: '', production: '' });
  const [priority, setPriority] = useState('normal');
  const [deliveryMethod, setDeliveryMethod] = useState('pickup');

  // Approval warnings hook
  const { warnings, company, loading: warningsLoading, checkWarnings, hasBlockingWarnings } = useApprovalWarnings();

  // Calculate convention coverage for optical
  const conventionCoverage = useMemo(() => {
    if (!company) return null;

    // Find optical category settings
    const opticalConfig = company.coveredCategories?.find(c => c.category === 'optical');

    let coveragePercentage = 0;
    let opticalNotCovered = false;

    if (opticalConfig) {
      if (opticalConfig.notCovered) {
        opticalNotCovered = true;
        coveragePercentage = 0;
      } else {
        coveragePercentage = opticalConfig.coveragePercentage ?? company.defaultCoverage?.percentage ?? 100;
      }
    } else {
      // No specific optical config - use company default
      coveragePercentage = company.defaultCoverage?.percentage ?? 100;
    }

    const total = calculateTotal();
    const companyPays = Math.round(total * coveragePercentage / 100);
    const patientPays = total - companyPays;

    return {
      hasConvention: true,
      companyName: company.name,
      coveragePercentage,
      opticalNotCovered,
      companyPays,
      patientPays
    };
  }, [company, selectedFrame, selectedLensOd, selectedLensOs, contactLensQuantity, coatings, items]);

  // Build act codes for approval check based on order type and selections
  const opticalActCodes = useMemo(() => {
    const codes = [];

    // Add appropriate codes based on order type
    if (orderType === 'glasses' || orderType === 'both') {
      codes.push('OPT-LUNETTES'); // Generic glasses code
      if (lensType === 'progressive') codes.push('OPT-PROGRESSIFS');
      if (lensType === 'bifocal') codes.push('OPT-BIFOCAUX');
      if (coatings.includes('photochromic')) codes.push('OPT-PHOTOCHROMIQUE');
    }

    if (orderType === 'contact-lenses' || orderType === 'both') {
      codes.push('OPT-LENTILLES'); // Generic contact lens code
    }

    // Add frame code if selected
    if (selectedFrame?.sku) {
      codes.push(selectedFrame.sku);
    }

    return codes;
  }, [orderType, lensType, coatings, selectedFrame]);

  // Check approval warnings when patient or order changes
  useEffect(() => {
    if (patient?._id && opticalActCodes.length > 0) {
      checkWarnings(patient._id, opticalActCodes);
    }
  }, [patient?._id, opticalActCodes.length]);

  // Product options
  const lensTypes = [
    { value: 'single-vision-distance', label: 'Vision de loin (Simple)' },
    { value: 'single-vision-near', label: 'Vision de près (Simple)' },
    { value: 'bifocal', label: 'Bifocaux' },
    { value: 'progressive', label: 'Progressifs' },
    { value: 'varifocal', label: 'Multifocaux' },
    { value: 'two-pairs', label: 'Deux paires (Loin + Près)' }
  ];

  const lensMaterials = [
    { value: 'cr39', label: 'CR-39 (Standard)', index: '1.50' },
    { value: 'polycarbonate', label: 'Polycarbonate', index: '1.59' },
    { value: 'trivex', label: 'Trivex', index: '1.53' },
    { value: 'hi-index-1.60', label: 'Haut indice', index: '1.60' },
    { value: 'hi-index-1.67', label: 'Haut indice', index: '1.67' },
    { value: 'hi-index-1.74', label: 'Ultra haut indice', index: '1.74' }
  ];

  const coatingOptions = [
    { value: 'anti-reflective', label: 'Anti-reflet', price: 25000 },
    { value: 'blue-light', label: 'Filtre lumière bleue', price: 30000 },
    { value: 'photochromic', label: 'Photochromique', price: 50000 },
    { value: 'polarized', label: 'Polarisé', price: 45000 },
    { value: 'scratch-resistant', label: 'Anti-rayures', price: 15000 },
    { value: 'uv-protection', label: 'Protection UV', price: 10000 },
    { value: 'hydrophobic', label: 'Hydrophobe', price: 20000 }
  ];

  useEffect(() => {
    fetchExamData();
  }, [examId]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      const response = await ophthalmologyService.getExam(examId);
      const examData = response.data || response;
      setExam(examData);
      setPatient(examData.patient);

      // Initialize items with base lens price
      setItems([
        {
          description: 'Verres correcteurs',
          category: 'lens',
          quantity: 2,
          unitPrice: 50000,
          discount: 0,
          total: 100000
        }
      ]);
    } catch (err) {
      toast.error('Erreur lors du chargement de l\'examen');
      console.error('Error fetching exam:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoatingChange = (coatingValue) => {
    setCoatings(prev => {
      if (prev.includes(coatingValue)) {
        return prev.filter(c => c !== coatingValue);
      } else {
        return [...prev, coatingValue];
      }
    });
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      category: 'accessory',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0
    }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Recalculate total
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const qty = newItems[index].quantity || 1;
      const price = newItems[index].unitPrice || 0;
      const discount = newItems[index].discount || 0;
      newItems[index].total = (qty * price) - discount;
    }

    setItems(newItems);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => {
    let total = items.reduce((sum, item) => sum + (item.total || 0), 0);

    // Add coatings
    total += coatings.reduce((sum, c) => {
      const coating = coatingOptions.find(opt => opt.value === c);
      return sum + (coating?.price || 0);
    }, 0);

    // Add frame from inventory
    if (selectedFrame) {
      total += selectedFrame.price || 0;
    }

    // Add contact lenses from inventory
    if (selectedLensOd) {
      total += (selectedLensOd.price || 0) * (contactLensQuantity.od || 1);
    }
    if (selectedLensOs) {
      total += (selectedLensOs.price || 0) * (contactLensQuantity.os || 1);
    }

    return total;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!exam) {
      toast.error('Données d\'examen manquantes');
      return;
    }

    // Validate inventory selection
    if (orderType !== 'contact-lenses' && selectedFrame && selectedFrame.available < 1) {
      toast.error('La monture sélectionnée n\'est plus en stock');
      return;
    }

    try {
      setSaving(true);

      // Add coating items
      const allItems = [...items];
      coatings.forEach(c => {
        const coating = coatingOptions.find(opt => opt.value === c);
        if (coating) {
          allItems.push({
            description: coating.label,
            category: 'coating',
            quantity: 1,
            unitPrice: coating.price,
            discount: 0,
            total: coating.price
          });
        }
      });

      // Add frame item if selected from inventory
      if (selectedFrame) {
        allItems.push({
          description: `Monture ${selectedFrame.brand} ${selectedFrame.model} - ${selectedFrame.color}`,
          category: 'frame',
          quantity: 1,
          unitPrice: selectedFrame.price,
          discount: 0,
          total: selectedFrame.price,
          inventoryRef: selectedFrame.id
        });
      }

      // Add contact lens items if selected from inventory
      if (selectedLensOd) {
        allItems.push({
          description: `Lentilles OD - ${selectedLensOd.brand} ${selectedLensOd.productLine}`,
          category: 'contact-lens',
          quantity: contactLensQuantity.od,
          unitPrice: selectedLensOd.price,
          discount: 0,
          total: selectedLensOd.price * contactLensQuantity.od,
          inventoryRef: selectedLensOd.id
        });
      }
      if (selectedLensOs) {
        allItems.push({
          description: `Lentilles OS - ${selectedLensOs.brand} ${selectedLensOs.productLine}`,
          category: 'contact-lens',
          quantity: contactLensQuantity.os,
          unitPrice: selectedLensOs.price,
          discount: 0,
          total: selectedLensOs.price * contactLensQuantity.os,
          inventoryRef: selectedLensOs.id
        });
      }

      const orderData = {
        examId,
        orderType,
        glasses: orderType !== 'contact-lenses' ? {
          lensType,
          lensMaterial,
          coatings,
          frame: selectedFrame ? {
            brand: selectedFrame.brand,
            model: selectedFrame.model,
            color: selectedFrame.color,
            size: selectedFrame.size,
            inventoryItem: selectedFrame.id,
            sku: selectedFrame.sku,
            sellingPrice: selectedFrame.price,
            costPrice: selectedFrame.costPrice
          } : undefined
        } : undefined,
        contactLenses: orderType !== 'glasses' ? {
          od: selectedLensOd ? {
            brand: selectedLensOd.brand,
            productLine: selectedLensOd.productLine,
            baseCurve: selectedLensOd.parameters?.baseCurve,
            diameter: selectedLensOd.parameters?.diameter,
            power: exam.finalPrescription?.od?.sphere,
            inventoryItem: selectedLensOd.id,
            quantity: contactLensQuantity.od,
            sellingPrice: selectedLensOd.price,
            costPrice: selectedLensOd.costPrice
          } : undefined,
          os: selectedLensOs ? {
            brand: selectedLensOs.brand,
            productLine: selectedLensOs.productLine,
            baseCurve: selectedLensOs.parameters?.baseCurve,
            diameter: selectedLensOs.parameters?.diameter,
            power: exam.finalPrescription?.os?.sphere,
            inventoryItem: selectedLensOs.id,
            quantity: contactLensQuantity.os,
            sellingPrice: selectedLensOs.price,
            costPrice: selectedLensOs.costPrice
          } : undefined
        } : undefined,
        items: allItems,
        notes,
        priority,
        deliveryInfo: {
          method: deliveryMethod
        }
      };

      const result = await glassesOrderService.createOrder(orderData);

      toast.success('Commande créée avec succès!');

      // Navigate to order details or back to ophthalmology
      setTimeout(() => {
        navigate('/ophthalmology');
      }, 1500);

    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création de la commande');
      console.error('Error creating order:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des données...</span>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Glasses className="h-6 w-6 mr-2 text-primary-600" />
              Commander Lunettes/Lentilles
            </h1>
            <p className="text-sm text-gray-500">
              Patient: {patient?.firstName} {patient?.lastName} |
              Examen du {exam.examDate ? format(new Date(exam.examDate), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Approval Warnings Banner */}
        {(warnings.blocking.length > 0 || warnings.warning.length > 0 || warnings.info.length > 0) && (
          <ApprovalWarningBanner
            warnings={warnings}
            company={company}
            patient={patient}
            showRequestButton={true}
            compact={false}
          />
        )}

        {/* Prescription Summary */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            Prescription
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-500 mb-1">OD (Droit)</p>
              <p className="font-mono text-sm">
                Sph: {exam.finalPrescription?.od?.sphere || 0} |
                Cyl: {exam.finalPrescription?.od?.cylinder || 0} |
                Axe: {exam.finalPrescription?.od?.axis || 0}°
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">OS (Gauche)</p>
              <p className="font-mono text-sm">
                Sph: {exam.finalPrescription?.os?.sphere || 0} |
                Cyl: {exam.finalPrescription?.os?.cylinder || 0} |
                Axe: {exam.finalPrescription?.os?.axis || 0}°
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Addition</p>
              <p className="font-mono text-sm">
                {exam.finalPrescription?.od?.add || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">ÉP</p>
              <p className="font-mono text-sm">
                {exam.finalPrescription?.pd?.binocular || 'N/A'} mm
              </p>
            </div>
          </div>
        </div>

        {/* Order Type */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Type de commande</h2>
          <div className="flex space-x-4">
            {[
              { value: 'glasses', label: 'Lunettes' },
              { value: 'contact-lenses', label: 'Lentilles' },
              { value: 'both', label: 'Les deux' }
            ].map(type => (
              <label key={type.value} className="flex items-center">
                <input
                  type="radio"
                  name="orderType"
                  value={type.value}
                  checked={orderType === type.value}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="mr-2"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        {/* Glasses Options */}
        {orderType !== 'contact-lenses' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Options Lunettes</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lens Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de verres
                </label>
                <select
                  value={lensType}
                  onChange={(e) => setLensType(e.target.value)}
                  className="input"
                >
                  {lensTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lens Material */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matériau des verres
                </label>
                <select
                  value={lensMaterial}
                  onChange={(e) => setLensMaterial(e.target.value)}
                  className="input"
                >
                  {lensMaterials.map(material => (
                    <option key={material.value} value={material.value}>
                      {material.label} (n={material.index})
                    </option>
                  ))}
                </select>
              </div>

              {/* Coatings */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Traitements
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {coatingOptions.map(coating => (
                    <label
                      key={coating.value}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                        coatings.includes(coating.value)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={coatings.includes(coating.value)}
                        onChange={() => handleCoatingChange(coating.value)}
                        className="mr-2"
                      />
                      <div>
                        <span className="text-sm">{coating.label}</span>
                        <span className="text-xs text-gray-500 block">
                          {new Intl.NumberFormat('fr-CD').format(coating.price)} CDF
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Frame Selection from Inventory */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="h-4 w-4 inline mr-1" />
                  Monture (sélection du stock)
                </label>
                <FrameSelector
                  selectedFrame={selectedFrame}
                  onSelect={setSelectedFrame}
                  onClear={() => setSelectedFrame(null)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Contact Lens Options */}
        {orderType !== 'glasses' && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Options Lentilles de Contact</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">OD (Droit)</h3>
                <div className="space-y-3">
                  <ContactLensSelector
                    eye="OD"
                    selectedLens={selectedLensOd}
                    onSelect={setSelectedLensOd}
                    onClear={() => setSelectedLensOd(null)}
                    prescription={exam.finalPrescription?.od}
                  />
                  {selectedLensOd && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Quantité (boîtes):</label>
                      <input
                        type="number"
                        min="1"
                        value={contactLensQuantity.od}
                        onChange={(e) => setContactLensQuantity({
                          ...contactLensQuantity,
                          od: parseInt(e.target.value) || 1
                        })}
                        className="input w-20"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">OS (Gauche)</h3>
                <div className="space-y-3">
                  <ContactLensSelector
                    eye="OS"
                    selectedLens={selectedLensOs}
                    onSelect={setSelectedLensOs}
                    onClear={() => setSelectedLensOs(null)}
                    prescription={exam.finalPrescription?.os}
                  />
                  {selectedLensOs && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Quantité (boîtes):</label>
                      <input
                        type="number"
                        min="1"
                        value={contactLensQuantity.os}
                        onChange={(e) => setContactLensQuantity({
                          ...contactLensQuantity,
                          os: parseInt(e.target.value) || 1
                        })}
                        className="input w-20"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Items */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Articles et Tarification</h2>
            <button
              type="button"
              onClick={addItem}
              className="btn btn-secondary text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter article
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="input flex-1"
                />
                <input
                  type="number"
                  placeholder="Qté"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="input w-20"
                  min="1"
                />
                <input
                  type="number"
                  placeholder="Prix"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="input w-28"
                />
                <span className="font-semibold w-32 text-right">
                  {new Intl.NumberFormat('fr-CD').format(item.total || 0)} CDF
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t space-y-2">
            {/* Coatings */}
            {coatings.length > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Traitements ({coatings.length}):</span>
                <span>+{new Intl.NumberFormat('fr-CD').format(coatings.reduce((sum, c) => {
                  const coating = coatingOptions.find(opt => opt.value === c);
                  return sum + (coating?.price || 0);
                }, 0))} CDF</span>
              </div>
            )}

            {/* Frame from inventory */}
            {selectedFrame && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Monture ({selectedFrame.brand} {selectedFrame.model}):</span>
                <span>+{new Intl.NumberFormat('fr-CD').format(selectedFrame.price)} CDF</span>
              </div>
            )}

            {/* Contact lenses from inventory */}
            {selectedLensOd && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Lentilles OD ({contactLensQuantity.od} boîte(s)):</span>
                <span>+{new Intl.NumberFormat('fr-CD').format(selectedLensOd.price * contactLensQuantity.od)} CDF</span>
              </div>
            )}
            {selectedLensOs && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Lentilles OS ({contactLensQuantity.os} boîte(s)):</span>
                <span>+{new Intl.NumberFormat('fr-CD').format(selectedLensOs.price * contactLensQuantity.os)} CDF</span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-semibold">Total:</span>
              <span className="text-2xl font-bold text-primary-600">
                {new Intl.NumberFormat('fr-CD').format(calculateTotal())} CDF
              </span>
            </div>

            {/* Convention Coverage Display */}
            {conventionCoverage && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center mb-2">
                  <Building2 className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">
                    Convention: {conventionCoverage.companyName}
                  </span>
                </div>

                {conventionCoverage.opticalNotCovered ? (
                  <div className="text-amber-700 text-sm flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Optique non couvert par cette convention
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-blue-600 mb-2">
                      Couverture optique: {conventionCoverage.coveragePercentage}%
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-100 rounded p-2">
                        <span className="text-blue-600">Part entreprise:</span>
                        <p className="font-bold text-blue-800">
                          {new Intl.NumberFormat('fr-CD').format(conventionCoverage.companyPays)} CDF
                        </p>
                      </div>
                      <div className="bg-orange-100 rounded p-2">
                        <span className="text-orange-600">Vous payez:</span>
                        <p className="font-bold text-orange-800">
                          {new Intl.NumberFormat('fr-CD').format(conventionCoverage.patientPays)} CDF
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Additional Options */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Options supplémentaires</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="input"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="rush">Express</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Livraison
              </label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                className="input"
              >
                <option value="pickup">Retrait sur place</option>
                <option value="delivery">Livraison</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes cliniques
              </label>
              <textarea
                value={notes.clinical}
                onChange={(e) => setNotes({ ...notes, clinical: e.target.value })}
                className="input"
                rows="3"
                placeholder="Notes pour le dossier patient..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes de production
              </label>
              <textarea
                value={notes.production}
                onChange={(e) => setNotes({ ...notes, production: e.target.value })}
                className="input"
                rows="3"
                placeholder="Instructions pour le laboratoire..."
              />
            </div>
          </div>
        </div>

        {/* Submit */}
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
