import { useState, useEffect } from 'react';
import {
  Pill,
  Search,
  Plus,
  X,
  Check,
  ChevronRight,
  Clock,
  AlertTriangle,
  Eye,
  Droplet,
  Star,
  History,
  Trash2
} from 'lucide-react';
import api from '../services/apiConfig';

/**
 * QuickTreatmentBuilder - Fermer-style 3-column drug selection interface
 * Left: Drug categories
 * Middle: Drugs in selected category
 * Right: Dosage/posology options
 */
export default function QuickTreatmentBuilder({
  patientId,
  onMedicationAdd,
  onPrescriptionComplete,
  existingMedications = [],
  showHeader = true
}) {
  // Drug categories data - ophthalmology specific
  const drugCategories = [
    { id: 'antibiotics', name: 'Antibiotiques', icon: Pill, color: 'red' },
    { id: 'anti-inflammatory', name: 'Anti-inflammatoires', icon: Pill, color: 'orange' },
    { id: 'steroids', name: 'Corticoïdes', icon: Droplet, color: 'yellow' },
    { id: 'lubricants', name: 'Lubrifiants', icon: Droplet, color: 'blue' },
    { id: 'anti-glaucoma', name: 'Anti-glaucomateux', icon: Eye, color: 'green' },
    { id: 'mydriatics', name: 'Mydriatiques', icon: Eye, color: 'purple' },
    { id: 'antivirals', name: 'Antiviraux', icon: Pill, color: 'pink' },
    { id: 'antihistamines', name: 'Antihistaminiques', icon: Pill, color: 'indigo' },
    { id: 'vitamins', name: 'Vitamines', icon: Star, color: 'amber' },
    { id: 'other', name: 'Autres', icon: Pill, color: 'gray' }
  ];

  // State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugs, setDrugs] = useState([]);
  const [loadingDrugs, setLoadingDrugs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState(existingMedications);
  const [favoritesDrugs, setFavoritesDrugs] = useState([]);
  const [recentDrugs, setRecentDrugs] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Dosage presets for quick selection
  const dosagePresets = {
    eye_drops: [
      { label: '1 goutte x 3/jour', frequency: '3x/jour', dose: '1 goutte', duration: '7 jours' },
      { label: '1 goutte x 4/jour', frequency: '4x/jour', dose: '1 goutte', duration: '7 jours' },
      { label: '1 goutte x 2/jour', frequency: '2x/jour', dose: '1 goutte', duration: '14 jours' },
      { label: '1 goutte toutes les 2h', frequency: 'toutes les 2h', dose: '1 goutte', duration: '48h' },
      { label: '1 goutte au coucher', frequency: '1x/jour au coucher', dose: '1 goutte', duration: '30 jours' },
    ],
    ointment: [
      { label: 'Application x 3/jour', frequency: '3x/jour', dose: 'Application', duration: '7 jours' },
      { label: 'Application au coucher', frequency: '1x/jour au coucher', dose: 'Application', duration: '14 jours' },
    ],
    oral: [
      { label: '1 comprimé x 2/jour', frequency: '2x/jour', dose: '1 comprimé', duration: '7 jours' },
      { label: '1 comprimé x 3/jour', frequency: '3x/jour', dose: '1 comprimé', duration: '7 jours' },
      { label: '500mg x 2/jour', frequency: '2x/jour', dose: '500mg', duration: '10 jours' },
    ]
  };

  // Load drugs from API when category changes
  useEffect(() => {
    if (selectedCategory) {
      loadDrugsForCategory(selectedCategory);
    }
  }, [selectedCategory]);

  // Load favorites and recent from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('ophthalmology_favorite_drugs');
    const savedRecent = localStorage.getItem('ophthalmology_recent_drugs');
    if (savedFavorites) setFavoritesDrugs(JSON.parse(savedFavorites));
    if (savedRecent) setRecentDrugs(JSON.parse(savedRecent));
  }, []);

  const loadDrugsForCategory = async (categoryId) => {
    try {
      setLoadingDrugs(true);
      const response = await api.get('/drugs', {
        params: { category: categoryId, limit: 100 }
      });
      // Safely extract array from various API response formats
      const rawDrugs = response?.data?.data ?? response?.data ?? [];
      setDrugs(Array.isArray(rawDrugs) ? rawDrugs : []);
    } catch (error) {
      console.error('Error loading drugs:', error);
      // Fallback to static data for demo
      setDrugs(getStaticDrugsForCategory(categoryId));
    } finally {
      setLoadingDrugs(false);
    }
  };

  // Static fallback data
  const getStaticDrugsForCategory = (categoryId) => {
    const staticDrugs = {
      antibiotics: [
        { _id: '1', name: 'Tobramycine', brandName: 'Tobrex', form: 'eye_drops', concentration: '0.3%' },
        { _id: '2', name: 'Ciprofloxacine', brandName: 'Ciloxan', form: 'eye_drops', concentration: '0.3%' },
        { _id: '3', name: 'Ofloxacine', brandName: 'Exocine', form: 'eye_drops', concentration: '0.3%' },
        { _id: '4', name: 'Azithromycine', brandName: 'Azyter', form: 'eye_drops', concentration: '1.5%' },
        { _id: '5', name: 'Fucidine', brandName: 'Fucithalmic', form: 'ointment', concentration: '1%' },
      ],
      'anti-inflammatory': [
        { _id: '6', name: 'Diclofénac', brandName: 'Voltarène opht.', form: 'eye_drops', concentration: '0.1%' },
        { _id: '7', name: 'Kétorolac', brandName: 'Acular', form: 'eye_drops', concentration: '0.5%' },
        { _id: '8', name: 'Indométacine', brandName: 'Indocollyre', form: 'eye_drops', concentration: '0.1%' },
        { _id: '9', name: 'Népafénac', brandName: 'Nevanac', form: 'eye_drops', concentration: '0.1%' },
      ],
      steroids: [
        { _id: '10', name: 'Dexaméthasone', brandName: 'Maxidex', form: 'eye_drops', concentration: '0.1%' },
        { _id: '11', name: 'Prednisolone', brandName: 'Pred Forte', form: 'eye_drops', concentration: '1%' },
        { _id: '12', name: 'Fluorométholone', brandName: 'Flucon', form: 'eye_drops', concentration: '0.1%' },
        { _id: '13', name: 'Rimexolone', brandName: 'Vexol', form: 'eye_drops', concentration: '1%' },
      ],
      lubricants: [
        { _id: '14', name: 'Hyaluronate de sodium', brandName: 'Hyabak', form: 'eye_drops', concentration: '0.15%' },
        { _id: '15', name: 'Carbomère', brandName: 'Lacrigel', form: 'gel', concentration: '0.25%' },
        { _id: '16', name: 'Hydroxypropyl guar', brandName: 'Systane', form: 'eye_drops', concentration: '' },
        { _id: '17', name: 'Polyvidone', brandName: 'Refresh', form: 'eye_drops', concentration: '' },
      ],
      'anti-glaucoma': [
        { _id: '18', name: 'Timolol', brandName: 'Timoptol', form: 'eye_drops', concentration: '0.5%' },
        { _id: '19', name: 'Latanoprost', brandName: 'Xalatan', form: 'eye_drops', concentration: '0.005%' },
        { _id: '20', name: 'Brimonidine', brandName: 'Alphagan', form: 'eye_drops', concentration: '0.2%' },
        { _id: '21', name: 'Dorzolamide', brandName: 'Trusopt', form: 'eye_drops', concentration: '2%' },
        { _id: '22', name: 'Brinzolamide', brandName: 'Azopt', form: 'eye_drops', concentration: '1%' },
      ],
      mydriatics: [
        { _id: '23', name: 'Tropicamide', brandName: 'Mydriaticum', form: 'eye_drops', concentration: '0.5%' },
        { _id: '24', name: 'Phényléphrine', brandName: 'Néosynéphrine', form: 'eye_drops', concentration: '10%' },
        { _id: '25', name: 'Atropine', brandName: 'Atropine', form: 'eye_drops', concentration: '1%' },
        { _id: '26', name: 'Cyclopentolate', brandName: 'Skiacol', form: 'eye_drops', concentration: '1%' },
      ],
      antivirals: [
        { _id: '27', name: 'Aciclovir', brandName: 'Zovirax', form: 'ointment', concentration: '3%' },
        { _id: '28', name: 'Ganciclovir', brandName: 'Virgan', form: 'gel', concentration: '0.15%' },
        { _id: '29', name: 'Valaciclovir', brandName: 'Zelitrex', form: 'oral', concentration: '500mg' },
      ],
      antihistamines: [
        { _id: '30', name: 'Olopatadine', brandName: 'Opatanol', form: 'eye_drops', concentration: '0.1%' },
        { _id: '31', name: 'Kétotifène', brandName: 'Zaditen', form: 'eye_drops', concentration: '0.025%' },
        { _id: '32', name: 'Azélastine', brandName: 'Allergodil', form: 'eye_drops', concentration: '0.05%' },
      ],
      vitamins: [
        { _id: '33', name: 'Vitamine A', brandName: 'Vitamine A Dulcis', form: 'ointment', concentration: '' },
        { _id: '34', name: 'AREDS Formula', brandName: 'Ocuvite', form: 'oral', concentration: '' },
      ],
      other: []
    };
    return staticDrugs[categoryId] || [];
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedDrug(null);
    setShowFavorites(false);
  };

  const handleDrugSelect = (drug) => {
    setSelectedDrug(drug);
    // Add to recent drugs
    addToRecent(drug);
  };

  const handleDosageSelect = (dosage) => {
    if (!selectedDrug) return;

    const newItem = {
      id: Date.now(),
      drug: selectedDrug,
      ...dosage,
      eye: 'OU', // Both eyes by default
      instructions: ''
    };

    setPrescriptionItems([...prescriptionItems, newItem]);
    if (onMedicationAdd) {
      onMedicationAdd(newItem);
    }

    // Reset selection for next drug
    setSelectedDrug(null);
  };

  const handleRemoveItem = (itemId) => {
    setPrescriptionItems(prescriptionItems.filter(item => item.id !== itemId));
  };

  const handleEyeChange = (itemId, eye) => {
    setPrescriptionItems(prescriptionItems.map(item =>
      item.id === itemId ? { ...item, eye } : item
    ));
  };

  const addToFavorites = (drug) => {
    const newFavorites = [...favoritesDrugs, drug].slice(-20);
    setFavoritesDrugs(newFavorites);
    localStorage.setItem('ophthalmology_favorite_drugs', JSON.stringify(newFavorites));
  };

  const removeFromFavorites = (drugId) => {
    const newFavorites = favoritesDrugs.filter(d => d._id !== drugId);
    setFavoritesDrugs(newFavorites);
    localStorage.setItem('ophthalmology_favorite_drugs', JSON.stringify(newFavorites));
  };

  const addToRecent = (drug) => {
    const filtered = recentDrugs.filter(d => d._id !== drug._id);
    const newRecent = [drug, ...filtered].slice(0, 10);
    setRecentDrugs(newRecent);
    localStorage.setItem('ophthalmology_recent_drugs', JSON.stringify(newRecent));
  };

  const isFavorite = (drugId) => favoritesDrugs.some(d => d._id === drugId);

  const filteredDrugs = searchTerm
    ? drugs.filter(d =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.brandName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : drugs;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
          <h2 className="text-lg font-semibold flex items-center">
            <Pill className="w-5 h-5 mr-2" />
            Prescription Rapide
          </h2>
          <p className="text-sm text-blue-100">Sélectionnez catégorie → médicament → posologie</p>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="flex h-96">
        {/* Column 1: Categories */}
        <div className="w-1/4 border-r bg-gray-50 overflow-y-auto">
          <div className="p-2">
            {/* Quick Access Buttons */}
            <div className="mb-2 flex gap-1">
              <button
                onClick={() => setShowFavorites(false)}
                className={`flex-1 text-xs px-2 py-1 rounded ${!showFavorites ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                Catégories
              </button>
              <button
                onClick={() => setShowFavorites(true)}
                className={`flex-1 text-xs px-2 py-1 rounded flex items-center justify-center ${showFavorites ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              >
                <Star className="w-3 h-3 mr-1" />
                Favoris
              </button>
            </div>

            {!showFavorites ? (
              // Categories list
              <div className="space-y-1">
                {drugCategories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    <category.icon className={`w-4 h-4 mr-2 ${
                      selectedCategory === category.id ? 'text-white' : `text-${category.color}-500`
                    }`} />
                    {category.name}
                  </button>
                ))}
              </div>
            ) : (
              // Favorites and Recent
              <div className="space-y-3">
                {favoritesDrugs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">Favoris</h4>
                    {favoritesDrugs.map(drug => (
                      <button
                        key={drug._id}
                        onClick={() => handleDrugSelect(drug)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-200"
                      >
                        {drug.brandName || drug.name}
                      </button>
                    ))}
                  </div>
                )}
                {recentDrugs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center">
                      <History className="w-3 h-3 mr-1" />
                      Récents
                    </h4>
                    {recentDrugs.map(drug => (
                      <button
                        key={drug._id}
                        onClick={() => handleDrugSelect(drug)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-200"
                      >
                        {drug.brandName || drug.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Drugs */}
        <div className="w-1/3 border-r overflow-y-auto">
          {selectedCategory || showFavorites ? (
            <>
              {/* Search */}
              <div className="p-2 border-b sticky top-0 bg-white">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Drugs list */}
              <div className="p-2 space-y-1">
                {loadingDrugs ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Chargement...
                  </div>
                ) : filteredDrugs.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Aucun médicament trouvé
                  </div>
                ) : (
                  filteredDrugs.map(drug => (
                    <div
                      key={drug._id}
                      className={`flex items-center gap-1 ${
                        selectedDrug?._id === drug._id ? 'bg-blue-50 rounded-lg' : ''
                      }`}
                    >
                      <button
                        onClick={() => handleDrugSelect(drug)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedDrug?._id === drug._id
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{drug.brandName || drug.name}</div>
                        <div className={`text-xs ${
                          selectedDrug?._id === drug._id ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {drug.name} {drug.concentration}
                        </div>
                      </button>
                      <button
                        onClick={() => isFavorite(drug._id) ? removeFromFavorites(drug._id) : addToFavorites(drug)}
                        className={`p-1.5 rounded ${
                          isFavorite(drug._id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={isFavorite(drug._id) ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Sélectionnez une catégorie
            </div>
          )}
        </div>

        {/* Column 3: Dosage Options */}
        <div className="w-5/12 overflow-y-auto">
          {selectedDrug ? (
            <div className="p-3">
              {/* Selected Drug Info */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3">
                <h4 className="font-semibold text-blue-900">{selectedDrug.brandName || selectedDrug.name}</h4>
                <p className="text-sm text-blue-700">{selectedDrug.name} {selectedDrug.concentration}</p>
                <p className="text-xs text-blue-600">{selectedDrug.form}</p>
              </div>

              {/* Eye Selection */}
              <div className="mb-3">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Œil</label>
                <div className="flex gap-1">
                  {['OD', 'OS', 'OU'].map(eye => (
                    <button
                      key={eye}
                      className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100"
                      onClick={() => {}}
                    >
                      {eye === 'OD' ? 'Droit' : eye === 'OS' ? 'Gauche' : 'Les deux'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Dosage Presets */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Posologie rapide</label>
                {(dosagePresets[selectedDrug.form] || dosagePresets.eye_drops).map((dosage, index) => (
                  <button
                    key={index}
                    onClick={() => handleDosageSelect(dosage)}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 rounded-lg hover:bg-green-50 hover:border-green-300 border border-transparent transition-colors flex items-center justify-between"
                  >
                    <span>{dosage.label}</span>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {dosage.duration}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Dosage */}
              <button className="w-full mt-2 px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                <Plus className="w-4 h-4 inline mr-1" />
                Posologie personnalisée
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Sélectionnez un médicament
            </div>
          )}
        </div>
      </div>

      {/* Prescription Summary */}
      {prescriptionItems.length > 0 && (
        <div className="border-t bg-gray-50 p-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
            <Check className="w-4 h-4 mr-1 text-green-600" />
            Ordonnance ({prescriptionItems.length} médicament{prescriptionItems.length > 1 ? 's' : ''})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {prescriptionItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded p-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{item.drug.brandName || item.drug.name}</span>
                  <span className="text-gray-500 ml-2">{item.dose} {item.frequency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.eye}
                    onChange={(e) => handleEyeChange(item.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  >
                    <option value="OD">OD</option>
                    <option value="OS">OS</option>
                    <option value="OU">OU</option>
                  </select>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {onPrescriptionComplete && (
            <button
              onClick={() => onPrescriptionComplete(prescriptionItems)}
              className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <Check className="w-4 h-4 mr-2" />
              Valider l'ordonnance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for modal/sidebar use
 */
export function CompactTreatmentBuilder(props) {
  return (
    <div className="max-w-2xl">
      <QuickTreatmentBuilder {...props} showHeader={false} />
    </div>
  );
}
