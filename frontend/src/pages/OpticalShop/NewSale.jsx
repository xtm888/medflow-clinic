import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Glasses, Eye, User, ChevronRight, ChevronLeft, Check,
  Package, DollarSign, AlertCircle, FileText, Search,
  Plus, Minus, Save, Send, X, Box, Truck, MapPin, Camera
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalShopService from '../../services/opticalShopService';
import frameInventoryService from '../../services/frameInventoryService';
import patientService from '../../services/patientService';
import { TryOnPhotoCapture, TryOnPhotoGallery } from '../../components/optical';
import tryOnPhotoService from '../../services/tryOnPhotoService';

const STEPS = [
  { id: 'prescription', label: 'Prescription', icon: FileText },
  { id: 'frame', label: 'Monture', icon: Glasses },
  { id: 'lenses', label: 'Verres', icon: Eye },
  { id: 'options', label: 'Options', icon: Package },
  { id: 'summary', label: 'Resume', icon: Check }
];

const NewSale = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Patient & Prescription data
  const [patient, setPatient] = useState(null);
  const [prescriptionData, setPrescriptionData] = useState(null);
  const [conventionInfo, setConventionInfo] = useState(null);

  // Order data
  const [orderId, setOrderId] = useState(null);
  const [orderData, setOrderData] = useState({
    rightLens: { sphere: '', cylinder: '', axis: '', add: '' },
    leftLens: { sphere: '', cylinder: '', axis: '', add: '' },
    frame: null,
    lensType: { material: 'cr39', design: 'single_vision' },
    lensOptions: {
      antiReflective: { selected: false, coatingType: '', price: 0 },
      photochromic: { selected: false, coatingType: '', price: 0 },
      blueLight: { selected: false, price: 0 },
      tint: { selected: false, color: '', price: 0 }
    },
    measurements: { pd: '', pdRight: '', pdLeft: '', segmentHeight: '' },
    pricing: { subtotal: 0, discount: 0, discountType: 'fixed', finalTotal: 0 }
  });

  // Frame search
  const [frameSearch, setFrameSearch] = useState('');
  const [frames, setFrames] = useState([]);
  const [searchingFrames, setSearchingFrames] = useState(false);
  const [showFrameResults, setShowFrameResults] = useState(false);
  const frameSearchRef = useRef(null);
  const frameSearchContainerRef = useRef(null);
  const frameSearchTimeoutRef = useRef(null);

  // Availability check
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Try-on photos
  const [tryOnPhotos, setTryOnPhotos] = useState([]);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  // Live frame search as user types with debounce
  useEffect(() => {
    if (frameSearchTimeoutRef.current) {
      clearTimeout(frameSearchTimeoutRef.current);
    }

    if (!frameSearch.trim() || frameSearch.trim().length < 2) {
      setFrames([]);
      setShowFrameResults(false);
      return;
    }

    frameSearchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingFrames(true);
        setShowFrameResults(true);
        const response = await frameInventoryService.searchFrames(frameSearch.trim(), {
          inStockOnly: false, // Show all but indicate stock status
          limit: 20
        });
        if (response.success) {
          // Sort: in-stock first, then out-of-stock
          const sorted = (response.data || []).sort((a, b) => {
            const aStock = a.inventory?.currentStock || 0;
            const bStock = b.inventory?.currentStock || 0;
            return bStock - aStock;
          });
          setFrames(sorted);
        }
      } catch (error) {
        console.error('Error searching frames:', error);
      } finally {
        setSearchingFrames(false);
      }
    }, 300);

    return () => {
      if (frameSearchTimeoutRef.current) {
        clearTimeout(frameSearchTimeoutRef.current);
      }
    };
  }, [frameSearch]);

  // Close frame dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (frameSearchContainerRef.current && !frameSearchContainerRef.current.contains(event.target)) {
        setShowFrameResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load try-on photos when order exists
  useEffect(() => {
    const loadTryOnPhotos = async () => {
      if (!orderId) return;
      setLoadingPhotos(true);
      try {
        const result = await tryOnPhotoService.getPhotos(orderId);
        setTryOnPhotos(result.data || []);
      } catch (error) {
        console.error('Failed to load try-on photos:', error);
      } finally {
        setLoadingPhotos(false);
      }
    };
    loadTryOnPhotos();
  }, [orderId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);

      // Load patient info
      const patientRes = await patientService.getPatient(patientId);
      setPatient(patientRes.data || patientRes);

      // Load convention info for optical services
      try {
        const conventionRes = await opticalShopService.getPatientConventionInfo(patientId);
        if (conventionRes.success) {
          setConventionInfo(conventionRes.data);
        }
      } catch (convError) {
        console.warn('Could not load convention info:', convError);
      }

      // Load prescription (may be empty if patient has no prior exam)
      try {
        const prescriptionRes = await opticalShopService.getPatientPrescription(patientId);
        if (prescriptionRes.success) {
          setPrescriptionData(prescriptionRes.data);

          // Pre-fill prescription values if available
          const exam = prescriptionRes.data?.exam;
          const prescription = prescriptionRes.data?.prescription;

          // Extract lens values from prescription data
          let extractedRightLens = { sphere: '', cylinder: '', axis: '', add: '' };
          let extractedLeftLens = { sphere: '', cylinder: '', axis: '', add: '' };

          // Check finalPrescription first (most complete), then subjective, then glasses prescription
          if (exam?.refraction?.finalPrescription?.OD || exam?.refraction?.finalPrescription?.OS) {
            const fp = exam.refraction.finalPrescription;
            extractedRightLens = {
              sphere: fp.OD?.sphere ?? '',
              cylinder: fp.OD?.cylinder ?? '',
              axis: fp.OD?.axis ?? '',
              add: fp.OD?.add ?? fp.add ?? ''
            };
            extractedLeftLens = {
              sphere: fp.OS?.sphere ?? '',
              cylinder: fp.OS?.cylinder ?? '',
              axis: fp.OS?.axis ?? '',
              add: fp.OS?.add ?? fp.add ?? ''
            };
          } else if (exam?.refraction?.subjective?.OD || exam?.refraction?.subjective?.OS) {
            const subjective = exam.refraction.subjective;
            extractedRightLens = {
              sphere: subjective.OD?.sphere ?? '',
              cylinder: subjective.OD?.cylinder ?? '',
              axis: subjective.OD?.axis ?? '',
              add: subjective.OD?.add ?? subjective.add ?? ''
            };
            extractedLeftLens = {
              sphere: subjective.OS?.sphere ?? '',
              cylinder: subjective.OS?.cylinder ?? '',
              axis: subjective.OS?.axis ?? '',
              add: subjective.OS?.add ?? subjective.add ?? ''
            };
          } else if (prescription?.glasses) {
            extractedRightLens = prescription.glasses.rightEye || {};
            extractedLeftLens = prescription.glasses.leftEye || {};
          }

          // Update state with extracted values
          setOrderData(prev => ({
            ...prev,
            rightLens: extractedRightLens,
            leftLens: extractedLeftLens
          }));

          // Start sale with extracted values (don't rely on state which is async)
          await startSaleWithPrescription(prescriptionRes.data, extractedRightLens, extractedLeftLens);
        }
      } catch (prescriptionError) {
        console.warn('No prescription found for patient:', prescriptionError);
        // Patient has no prescription - that's okay, they can enter manually
        // Still start the sale
        await startSaleWithPrescription(null, orderData.rightLens, orderData.leftLens);
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
      toast.error('Patient non trouve');
      navigate('/optical-shop');
    } finally {
      setLoading(false);
    }
  };

  const startSaleWithPrescription = async (presData, rightLens, leftLens) => {
    try {
      const response = await opticalShopService.startSale({
        patientId,
        prescriptionData: {
          examId: presData?.exam?._id,
          prescriptionId: presData?.prescription?._id,
          rightLens,
          leftLens
        }
      });

      if (response.success) {
        setOrderId(response.data._id);
      }
    } catch (error) {
      console.error('Error starting sale:', error);
    }
  };

  const selectFrame = (frame) => {
    const stock = frame.inventory?.currentStock || 0;
    const isInStock = stock > 0;

    setOrderData(prev => ({
      ...prev,
      frame: {
        inventoryItem: frame._id,
        brand: frame.brand,
        model: frame.model,
        color: frame.color,
        size: frame.size,
        price: frame.pricing?.retailPrice || 0,
        stock: stock,
        isInStock: isInStock,
        location: frame.inventory?.location || '',
        needsExternalOrder: !isInStock,
        images: frame.images || []  // Product catalog photos
      }
    }));
    setFrames([]);
    setFrameSearch('');
    setShowFrameResults(false);
    calculatePricing({ ...orderData, frame: { price: frame.pricing?.retailPrice || 0 } });

    if (!isInStock) {
      toast.info('Cette monture devra etre commandee chez un fournisseur');
    }
  };

  const clearFrameSelection = () => {
    setOrderData(prev => ({ ...prev, frame: null }));
    setFrameSearch('');
    frameSearchRef.current?.focus();
  };

  const calculatePricing = (data = orderData) => {
    let subtotal = 0;

    // Frame price
    if (data.frame?.price) {
      subtotal += data.frame.price;
    }

    // Lens price (based on material)
    const lensPrices = {
      'cr39': 15000,
      'cr39-1.56': 25000,
      'polycarbonate': 35000,
      'hi-index-1.60': 50000,
      'hi-index-1.67': 75000,
      'hi-index-1.74': 100000
    };
    subtotal += (lensPrices[data.lensType?.material] || 15000) * 2;

    // Progressive add
    if (data.lensType?.design === 'progressive') {
      subtotal += 50000;
    } else if (data.lensType?.design === 'bifocal') {
      subtotal += 25000;
    }

    // Options
    if (data.lensOptions?.antiReflective?.selected) {
      subtotal += data.lensOptions.antiReflective.price || 15000;
    }
    if (data.lensOptions?.photochromic?.selected) {
      subtotal += data.lensOptions.photochromic.price || 25000;
    }
    if (data.lensOptions?.blueLight?.selected) {
      subtotal += data.lensOptions.blueLight.price || 10000;
    }
    if (data.lensOptions?.tint?.selected) {
      subtotal += data.lensOptions.tint.price || 8000;
    }

    // Apply discount
    let discount = data.pricing?.discount || 0;
    if (data.pricing?.discountType === 'percent') {
      discount = subtotal * (discount / 100);
    }

    const finalTotal = Math.max(0, subtotal - discount);

    setOrderData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        subtotal,
        finalTotal
      }
    }));
  };

  const saveOrder = async () => {
    if (!orderId) return;

    try {
      setSaving(true);
      await opticalShopService.updateSale(orderId, orderData);
      calculatePricing();
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const checkAvailability = async () => {
    if (!orderId) return;

    try {
      setCheckingAvailability(true);
      const response = await opticalShopService.checkAvailability(orderId);
      if (response.success) {
        setAvailability(response.data);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Erreur verification disponibilite');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handlePhotosCaptured = (newPhotoSet) => {
    setTryOnPhotos(prev => [...prev, newPhotoSet]);
    setShowPhotoCapture(false);
  };

  const submitForVerification = async () => {
    if (!orderId) return;

    // Validate required fields
    if (!orderData.frame) {
      toast.error('Veuillez selectionner une monture');
      return;
    }
    if (!orderData.measurements?.pd) {
      toast.error('Veuillez entrer l\'ecart pupillaire (PD)');
      return;
    }

    try {
      setSaving(true);

      // Save final data
      await opticalShopService.updateSale(orderId, orderData);

      // Submit for verification
      const response = await opticalShopService.submitForVerification(orderId);
      if (response.success) {
        toast.success('Commande envoyee pour verification');
        navigate('/optical-shop');
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la soumission');
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    saveOrder();
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Glasses className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nouvelle Vente</h1>
                <p className="text-gray-500">
                  {patient?.firstName} {patient?.lastName} - {patient?.fileNumber}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/optical-shop')}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Convention Info Banner */}
          {conventionInfo && (
            <div className={`mt-4 p-4 rounded-lg ${
              conventionInfo.hasConvention && conventionInfo.opticalCovered
                ? 'bg-green-50 border border-green-200'
                : conventionInfo.hasConvention && !conventionInfo.opticalCovered
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {conventionInfo.hasConvention && conventionInfo.opticalCovered ? (
                    <>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">
                          Convention: {conventionInfo.company?.name}
                          {conventionInfo.company?.conventionCode && ` (${conventionInfo.company.conventionCode})`}
                        </p>
                        <p className="text-sm text-green-600">
                          {conventionInfo.message}
                          {conventionInfo.employeeId && ` | Matricule: ${conventionInfo.employeeId}`}
                        </p>
                      </div>
                    </>
                  ) : conventionInfo.hasConvention && !conventionInfo.opticalCovered ? (
                    <>
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-800">
                          Convention: {conventionInfo.company?.name} - OPTIQUE NON COUVERT
                        </p>
                        <p className="text-sm text-red-600">{conventionInfo.message}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">Patient sans convention</p>
                        <p className="text-sm text-gray-600">Paiement cash - 100% a charge du patient</p>
                      </div>
                    </>
                  )}
                </div>

                {conventionInfo.hasConvention && conventionInfo.opticalCovered && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{conventionInfo.coveragePercentage}%</p>
                    <p className="text-xs text-green-600">Couverture convention</p>
                    {conventionInfo.requiresApproval && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                        Approbation requise
                      </span>
                    )}
                  </div>
                )}
              </div>

              {conventionInfo.notes && (
                <p className="mt-2 text-sm text-gray-600 italic border-t pt-2">
                  Note: {conventionInfo.notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step Indicator */}
        <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                      isActive ? 'bg-purple-100 text-purple-700' :
                      isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}
                    onClick={() => index <= currentStep && setCurrentStep(index)}
                  >
                    <div className={`p-2 rounded-full ${
                      isActive ? 'bg-purple-600 text-white' :
                      isCompleted ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className="hidden sm:inline font-medium">{step.label}</span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          {/* Step 1: Prescription */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Prescription</h2>

              {prescriptionData?.exam && (
                <div className="p-4 bg-blue-50 rounded-lg mb-4">
                  <p className="text-sm text-blue-600">
                    Prescription du {new Date(prescriptionData.exam.examDate).toLocaleDateString('fr-FR')}
                    {prescriptionData.exam.performedBy &&
                      ` par Dr. ${prescriptionData.exam.performedBy.firstName} ${prescriptionData.exam.performedBy.lastName}`
                    }
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Right Eye */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5" /> Oeil Droit (OD)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Sphere</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.rightLens.sphere}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          rightLens: { ...prev.rightLens, sphere: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-2.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Cylindre</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.rightLens.cylinder}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          rightLens: { ...prev.rightLens, cylinder: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-0.50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Axe</label>
                      <input
                        type="number"
                        value={orderData.rightLens.axis}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          rightLens: { ...prev.rightLens, axis: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="180"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Addition</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.rightLens.add}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          rightLens: { ...prev.rightLens, add: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="+2.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Left Eye */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5" /> Oeil Gauche (OS)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Sphere</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.leftLens.sphere}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          leftLens: { ...prev.leftLens, sphere: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-2.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Cylindre</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.leftLens.cylinder}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          leftLens: { ...prev.leftLens, cylinder: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="-0.50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Axe</label>
                      <input
                        type="number"
                        value={orderData.leftLens.axis}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          leftLens: { ...prev.leftLens, axis: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="180"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Addition</label>
                      <input
                        type="number"
                        step="0.25"
                        value={orderData.leftLens.add}
                        onChange={(e) => setOrderData(prev => ({
                          ...prev,
                          leftLens: { ...prev.leftLens, add: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="+2.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Measurements */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">Mesures</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">PD Total *</label>
                    <input
                      type="number"
                      value={orderData.measurements.pd}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        measurements: { ...prev.measurements, pd: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="64"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">PD Droit</label>
                    <input
                      type="number"
                      value={orderData.measurements.pdRight}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        measurements: { ...prev.measurements, pdRight: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="32"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">PD Gauche</label>
                    <input
                      type="number"
                      value={orderData.measurements.pdLeft}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        measurements: { ...prev.measurements, pdLeft: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="32"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Hauteur Segment</label>
                    <input
                      type="number"
                      value={orderData.measurements.segmentHeight}
                      onChange={(e) => setOrderData(prev => ({
                        ...prev,
                        measurements: { ...prev.measurements, segmentHeight: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="18"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Frame */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Selection de la Monture</h2>

              {/* Current Selection */}
              {orderData.frame && (
                <div className={`p-4 rounded-lg border-2 ${
                  orderData.frame.isInStock
                    ? 'bg-green-50 border-green-200'
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        orderData.frame.isInStock ? 'bg-green-100' : 'bg-orange-100'
                      }`}>
                        <Glasses className={`w-6 h-6 ${
                          orderData.frame.isInStock ? 'text-green-600' : 'text-orange-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {orderData.frame.brand} {orderData.frame.model}
                        </p>
                        <p className="text-sm text-gray-500">
                          Couleur: {orderData.frame.color} | Taille: {orderData.frame.size}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {orderData.frame.isInStock ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <Box className="w-3 h-3" />
                              En stock ({orderData.frame.stock})
                              {orderData.frame.location && ` - ${orderData.frame.location}`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                              <Truck className="w-3 h-3" />
                              Commande externe requise
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        {formatCurrency(orderData.frame.price)}
                      </p>
                      <button
                        onClick={clearFrameSelection}
                        className="text-sm text-red-600 hover:text-red-700 mt-1"
                      >
                        Changer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Frame Search */}
              {!orderData.frame && (
                <div className="relative" ref={frameSearchContainerRef}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      ref={frameSearchRef}
                      type="text"
                      value={frameSearch}
                      onChange={(e) => setFrameSearch(e.target.value)}
                      onFocus={() => frameSearch.length >= 2 && setShowFrameResults(true)}
                      placeholder="Tapez pour rechercher une monture (marque, modele, couleur)..."
                      className="w-full pl-12 pr-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
                      autoComplete="off"
                    />
                    {frameSearch && (
                      <button
                        onClick={() => {
                          setFrameSearch('');
                          setFrames([]);
                          setShowFrameResults(false);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    )}
                    {searchingFrames && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Live Frame Results Dropdown */}
                  {showFrameResults && frameSearch.length >= 2 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
                      {searchingFrames ? (
                        <div className="p-4 text-center text-gray-500">
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Recherche en cours...
                        </div>
                      ) : frames.length > 0 ? (
                        <div className="divide-y">
                          {frames.map((frame) => {
                            const stock = frame.inventory?.currentStock || 0;
                            const isInStock = stock > 0;

                            return (
                              <div
                                key={frame._id}
                                className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${
                                  isInStock
                                    ? 'hover:bg-green-50'
                                    : 'hover:bg-orange-50 bg-gray-50'
                                }`}
                                onClick={() => selectFrame(frame)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">
                                      {frame.brand} {frame.model}
                                    </p>
                                    {isInStock ? (
                                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                        <Box className="w-3 h-3" />
                                        {stock} en stock
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                                        <Truck className="w-3 h-3" />
                                        A commander
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500 truncate">
                                    {frame.color} | {frame.size} | {frame.material || 'Metal'}
                                    {frame.inventory?.location && (
                                      <span className="ml-2 inline-flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {frame.inventory.location}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="font-bold text-purple-600">
                                    {formatCurrency(frame.pricing?.retailPrice)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <Glasses className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500">Aucune monture trouvee pour "{frameSearch}"</p>
                          <p className="text-sm text-gray-400 mt-1">Essayez une autre marque ou modele</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Helper text */}
                  <p className="text-sm text-gray-400 mt-2">
                    Commencez a taper pour rechercher automatiquement dans l'inventaire
                  </p>
                </div>
              )}

              {/* Stock Legend */}
              <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span>En stock local</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  <span>Commande fournisseur</span>
                </div>
              </div>

              {/* Product Images Section - Show frame catalog photos */}
              {orderData?.frame && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Photos du produit
                  </h4>
                  {orderData.frame.images && orderData.frame.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {orderData.frame.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                          <img
                            src={img.url}
                            alt={img.alt || `${orderData.frame.brand} ${orderData.frame.model} - ${img.type || 'photo'}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(img.url, '_blank')}
                          />
                          {img.type && (
                            <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                              {img.type === 'front' ? 'Vue de face' :
                               img.type === 'side' ? 'Vue de côté' :
                               img.type === 'folded' ? 'Plié' :
                               img.type === 'worn' ? 'Porté' :
                               img.type === 'detail' ? 'Détail' : img.type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <Glasses className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Aucune photo du produit disponible</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Try-On Photos Section - Customer photos with the frame */}
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Photos d'essayage client
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowPhotoCapture(true)}
                    disabled={!orderData?.frame?.inventoryItem && !orderData?.frame?.brand}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                    Capturer photos
                  </button>
                </div>

                {loadingPhotos ? (
                  <div className="text-center py-4 text-gray-500">
                    Chargement des photos...
                  </div>
                ) : (
                  <TryOnPhotoGallery
                    orderId={orderId}
                    photos={tryOnPhotos}
                    onPhotosChange={setTryOnPhotos}
                    canEdit={['draft', 'pending_verification', 'verification_rejected'].includes(orderData?.status)}
                  />
                )}
              </div>

              {/* Photo Capture Modal */}
              {showPhotoCapture && (
                <TryOnPhotoCapture
                  orderId={orderId}
                  frameId={orderData?.frame?.inventoryItem}
                  frameName={orderData?.frame ? `${orderData.frame.brand || ''} ${orderData.frame.model || ''}`.trim() : null}
                  onPhotosCaptured={handlePhotosCaptured}
                  onClose={() => setShowPhotoCapture(false)}
                />
              )}
            </div>
          )}

          {/* Step 3: Lenses */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Type de Verres</h2>

              {/* Lens Design */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Design</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: 'single_vision', label: 'Unifocal', desc: 'Vision simple' },
                    { value: 'bifocal', label: 'Bifocal', desc: 'Vision de pres et de loin' },
                    { value: 'progressive', label: 'Progressif', desc: 'Vision a toutes distances' }
                  ].map((design) => (
                    <div
                      key={design.value}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                        orderData.lensType.design === design.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => {
                        setOrderData(prev => ({
                          ...prev,
                          lensType: { ...prev.lensType, design: design.value }
                        }));
                        calculatePricing({ ...orderData, lensType: { ...orderData.lensType, design: design.value } });
                      }}
                    >
                      <p className="font-medium text-gray-900">{design.label}</p>
                      <p className="text-sm text-gray-500">{design.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lens Material */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Materiau</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { value: 'cr39', label: 'CR-39 (1.50)', price: 15000 },
                    { value: 'cr39-1.56', label: 'CR-39 (1.56)', price: 25000 },
                    { value: 'polycarbonate', label: 'Polycarbonate', price: 35000 },
                    { value: 'hi-index-1.60', label: 'Hi-Index 1.60', price: 50000 },
                    { value: 'hi-index-1.67', label: 'Hi-Index 1.67', price: 75000 },
                    { value: 'hi-index-1.74', label: 'Hi-Index 1.74', price: 100000 }
                  ].map((material) => (
                    <div
                      key={material.value}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                        orderData.lensType.material === material.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => {
                        setOrderData(prev => ({
                          ...prev,
                          lensType: { ...prev.lensType, material: material.value }
                        }));
                        calculatePricing({ ...orderData, lensType: { ...orderData.lensType, material: material.value } });
                      }}
                    >
                      <p className="font-medium text-gray-900">{material.label}</p>
                      <p className="text-sm text-purple-600">{formatCurrency(material.price)} / verre</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Options */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Options & Traitements</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Anti-Reflective */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    orderData.lensOptions.antiReflective.selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  onClick={() => {
                    setOrderData(prev => ({
                      ...prev,
                      lensOptions: {
                        ...prev.lensOptions,
                        antiReflective: {
                          ...prev.lensOptions.antiReflective,
                          selected: !prev.lensOptions.antiReflective.selected,
                          price: 15000
                        }
                      }
                    }));
                    calculatePricing();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Anti-Reflet</p>
                      <p className="text-sm text-gray-500">Reduit les reflets et la fatigue oculaire</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{formatCurrency(15000)}</p>
                      {orderData.lensOptions.antiReflective.selected && (
                        <Check className="w-5 h-5 text-green-600 ml-auto" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Photochromic */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    orderData.lensOptions.photochromic.selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  onClick={() => {
                    setOrderData(prev => ({
                      ...prev,
                      lensOptions: {
                        ...prev.lensOptions,
                        photochromic: {
                          ...prev.lensOptions.photochromic,
                          selected: !prev.lensOptions.photochromic.selected,
                          price: 25000
                        }
                      }
                    }));
                    calculatePricing();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Photochromique</p>
                      <p className="text-sm text-gray-500">S'adapte a la lumiere (Transitions)</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{formatCurrency(25000)}</p>
                      {orderData.lensOptions.photochromic.selected && (
                        <Check className="w-5 h-5 text-green-600 ml-auto" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Blue Light */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    orderData.lensOptions.blueLight.selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  onClick={() => {
                    setOrderData(prev => ({
                      ...prev,
                      lensOptions: {
                        ...prev.lensOptions,
                        blueLight: {
                          ...prev.lensOptions.blueLight,
                          selected: !prev.lensOptions.blueLight.selected,
                          price: 10000
                        }
                      }
                    }));
                    calculatePricing();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Filtre Lumiere Bleue</p>
                      <p className="text-sm text-gray-500">Protection ecrans et digital</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{formatCurrency(10000)}</p>
                      {orderData.lensOptions.blueLight.selected && (
                        <Check className="w-5 h-5 text-green-600 ml-auto" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Tint */}
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                    orderData.lensOptions.tint.selected
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  onClick={() => {
                    setOrderData(prev => ({
                      ...prev,
                      lensOptions: {
                        ...prev.lensOptions,
                        tint: {
                          ...prev.lensOptions.tint,
                          selected: !prev.lensOptions.tint.selected,
                          price: 8000
                        }
                      }
                    }));
                    calculatePricing();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Teinte</p>
                      <p className="text-sm text-gray-500">Coloration des verres</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{formatCurrency(8000)}</p>
                      {orderData.lensOptions.tint.selected && (
                        <Check className="w-5 h-5 text-green-600 ml-auto" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Discount */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">Remise</h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={orderData.pricing.discount}
                      onChange={(e) => {
                        setOrderData(prev => ({
                          ...prev,
                          pricing: { ...prev.pricing, discount: parseFloat(e.target.value) || 0 }
                        }));
                        calculatePricing();
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="0"
                    />
                  </div>
                  <select
                    value={orderData.pricing.discountType}
                    onChange={(e) => {
                      setOrderData(prev => ({
                        ...prev,
                        pricing: { ...prev.pricing, discountType: e.target.value }
                      }));
                      calculatePricing();
                    }}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="fixed">CDF</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Resume de la Commande</h2>

              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-200 rounded-full">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {patient?.firstName} {patient?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Dossier: {patient?.fileNumber} | Tel: {patient?.phone}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Prescription Summary */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Prescription</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">OD:</span>
                      <span>Sph {orderData.rightLens.sphere || '-'} Cyl {orderData.rightLens.cylinder || '-'} Axe {orderData.rightLens.axis || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">OS:</span>
                      <span>Sph {orderData.leftLens.sphere || '-'} Cyl {orderData.leftLens.cylinder || '-'} Axe {orderData.leftLens.axis || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">PD:</span>
                      <span>{orderData.measurements.pd} mm</span>
                    </div>
                  </div>
                </div>

                {/* Frame Summary */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Monture</h3>
                  {orderData.frame ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">{orderData.frame.brand} {orderData.frame.model}</p>
                      <p className="text-gray-500">{orderData.frame.color} - {orderData.frame.size}</p>
                      <p className="text-purple-600 font-medium">{formatCurrency(orderData.frame.price)}</p>
                    </div>
                  ) : (
                    <p className="text-red-500">Aucune monture selectionnee</p>
                  )}
                </div>
              </div>

              {/* Lenses & Options */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Verres & Options</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Type: {orderData.lensType.design === 'progressive' ? 'Progressif' : orderData.lensType.design === 'bifocal' ? 'Bifocal' : 'Unifocal'}</span>
                    <span>{orderData.lensType.material}</span>
                  </div>
                  {orderData.lensOptions.antiReflective.selected && (
                    <div className="flex justify-between text-gray-600">
                      <span>+ Anti-Reflet</span>
                      <span>{formatCurrency(15000)}</span>
                    </div>
                  )}
                  {orderData.lensOptions.photochromic.selected && (
                    <div className="flex justify-between text-gray-600">
                      <span>+ Photochromique</span>
                      <span>{formatCurrency(25000)}</span>
                    </div>
                  )}
                  {orderData.lensOptions.blueLight.selected && (
                    <div className="flex justify-between text-gray-600">
                      <span>+ Filtre Lumiere Bleue</span>
                      <span>{formatCurrency(10000)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Total</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Sous-total</span>
                    <span>{formatCurrency(orderData.pricing.subtotal)}</span>
                  </div>
                  {orderData.pricing.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Remise</span>
                      <span>- {formatCurrency(orderData.pricing.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(orderData.pricing.finalTotal)}</span>
                  </div>

                  {/* Convention Split */}
                  {conventionInfo?.hasConvention && conventionInfo?.opticalCovered && (
                    <>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Part Convention ({conventionInfo.coveragePercentage}%)</span>
                          <span>{formatCurrency(orderData.pricing.companyPortion ||
                            Math.round((orderData.pricing.finalTotal || 0) * conventionInfo.coveragePercentage / 100))}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold text-purple-600 mt-1">
                          <span>Part Patient ({100 - conventionInfo.coveragePercentage}%)</span>
                          <span>{formatCurrency(orderData.pricing.patientPortion ||
                            Math.round((orderData.pricing.finalTotal || 0) * (100 - conventionInfo.coveragePercentage) / 100))}</span>
                        </div>
                      </div>
                      <div className="mt-2 p-2 bg-green-100 rounded text-sm text-green-700">
                        Facturation: {conventionInfo.company?.name}
                        {conventionInfo.employeeId && ` | Matricule: ${conventionInfo.employeeId}`}
                      </div>
                      {conventionInfo.requiresApproval && (
                        <div className="p-2 bg-orange-100 rounded text-sm text-orange-700">
                          Cette commande necessite une approbation prealable de la convention
                        </div>
                      )}
                    </>
                  )}

                  {/* Cash payment (no convention or optical not covered) */}
                  {(!conventionInfo?.hasConvention || !conventionInfo?.opticalCovered) && (
                    <div className="flex justify-between text-lg font-bold text-purple-600 border-t pt-2">
                      <span>A payer (Cash)</span>
                      <span>{formatCurrency(orderData.pricing.finalTotal)}</span>
                    </div>
                  )}

                  {conventionInfo?.hasConvention && !conventionInfo?.opticalCovered && (
                    <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                      Services optiques non couverts par {conventionInfo.company?.name}. Paiement cash requis.
                    </div>
                  )}
                </div>
              </div>

              {/* Availability Check */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Disponibilite</h3>
                  <button
                    onClick={checkAvailability}
                    disabled={checkingAvailability}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    {checkingAvailability ? 'Verification...' : 'Verifier'}
                  </button>
                </div>

                {availability && (
                  <div className="space-y-2">
                    {availability.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{item.description}</span>
                        {item.available ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="w-4 h-4" /> En stock
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-600">
                            <AlertCircle className="w-4 h-4" /> Commande externe
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {availability && !availability.allAvailable && (
                  <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-700">
                      Certains articles devront etre commandes chez un fournisseur externe.
                      Le delai de livraison sera plus long.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm p-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
            Precedent
          </button>

          <div className="flex items-center gap-3">
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                Suivant
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={submitForVerification}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                {saving ? 'Envoi...' : 'Soumettre pour Verification'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewSale;
