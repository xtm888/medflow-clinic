/**
 * NewSale Component
 *
 * Main optical shop sale wizard - refactored into modular components.
 *
 * Structure:
 * - constants.js: All pricing/configuration data
 * - hooks/usePricing.js: Pricing calculation logic
 * - hooks/useFrameSearch.js: Frame search with debouncing
 * - components/SaleHeader.jsx: Header with patient info
 * - components/StepIndicator.jsx: Step progress
 * - components/steps/*: Individual step components
 * - components/NavigationButtons.jsx: Navigation controls
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import opticalShopService from '../../../services/opticalShopService';
import patientService from '../../../services/patientService';
import tryOnPhotoService from '../../../services/tryOnPhotoService';

import { DEFAULT_ORDER_DATA, STEPS } from './constants';
import { usePricing, useFrameSearch } from './hooks';
import {
  SaleHeader,
  StepIndicator,
  NavigationButtons,
  PrescriptionStep,
  FrameStep,
  LensesStep,
  OptionsStep,
  SummaryStep
} from './components';

export default function NewSale() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  // Core state
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Patient & Prescription data
  const [patient, setPatient] = useState(null);
  const [prescriptionData, setPrescriptionData] = useState(null);
  const [conventionInfo, setConventionInfo] = useState(null);

  // Order data
  const [orderId, setOrderId] = useState(null);
  const [orderData, setOrderData] = useState(DEFAULT_ORDER_DATA);

  // Availability check
  const [availability, setAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Try-on photos
  const [tryOnPhotos, setTryOnPhotos] = useState([]);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Hooks
  const { calculatePricing } = usePricing(orderData, setOrderData, conventionInfo);
  const frameSearch = useFrameSearch();

  // Load patient data on mount
  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  // Load try-on photos when order exists
  useEffect(() => {
    if (!orderId) return;

    const loadPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const result = await tryOnPhotoService.getPhotos(orderId);
        // Handle various API response formats defensively
        const photos = Array.isArray(result?.data?.data)
          ? result.data.data
          : Array.isArray(result?.data)
          ? result.data
          : [];
        setTryOnPhotos(photos);
      } catch (error) {
        console.error('Failed to load try-on photos:', error);
        setTryOnPhotos([]);
      } finally {
        setLoadingPhotos(false);
      }
    };
    loadPhotos();
  }, [orderId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);

      // Load patient info
      const patientRes = await patientService.getPatient(patientId);
      setPatient(patientRes.data || patientRes);

      // Load convention info
      try {
        const conventionRes = await opticalShopService.getPatientConventionInfo(patientId);
        if (conventionRes.success) {
          setConventionInfo(conventionRes.data);
        }
      } catch (convError) {
        console.warn('Could not load convention info:', convError);
      }

      // Load prescription
      try {
        const prescriptionRes = await opticalShopService.getPatientPrescription(patientId);
        if (prescriptionRes.success) {
          setPrescriptionData(prescriptionRes.data);
          const { rightLens, leftLens } = extractPrescriptionValues(prescriptionRes.data);

          setOrderData(prev => ({
            ...prev,
            rightLens,
            leftLens
          }));

          await startSaleWithPrescription(prescriptionRes.data, rightLens, leftLens);
        }
      } catch (prescriptionError) {
        console.warn('No prescription found for patient:', prescriptionError);
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

  const extractPrescriptionValues = (presData) => {
    const exam = presData?.exam;
    const prescription = presData?.prescription;

    let rightLens = { sphere: '', cylinder: '', axis: '', add: '' };
    let leftLens = { sphere: '', cylinder: '', axis: '', add: '' };

    if (exam?.refraction?.finalPrescription?.OD || exam?.refraction?.finalPrescription?.OS) {
      const fp = exam.refraction.finalPrescription;
      rightLens = {
        sphere: fp.OD?.sphere ?? '',
        cylinder: fp.OD?.cylinder ?? '',
        axis: fp.OD?.axis ?? '',
        add: fp.OD?.add ?? fp.add ?? ''
      };
      leftLens = {
        sphere: fp.OS?.sphere ?? '',
        cylinder: fp.OS?.cylinder ?? '',
        axis: fp.OS?.axis ?? '',
        add: fp.OS?.add ?? fp.add ?? ''
      };
    } else if (exam?.refraction?.subjective?.OD || exam?.refraction?.subjective?.OS) {
      const subjective = exam.refraction.subjective;
      rightLens = {
        sphere: subjective.OD?.sphere ?? '',
        cylinder: subjective.OD?.cylinder ?? '',
        axis: subjective.OD?.axis ?? '',
        add: subjective.OD?.add ?? subjective.add ?? ''
      };
      leftLens = {
        sphere: subjective.OS?.sphere ?? '',
        cylinder: subjective.OS?.cylinder ?? '',
        axis: subjective.OS?.axis ?? '',
        add: subjective.OS?.add ?? subjective.add ?? ''
      };
    } else if (prescription?.glasses) {
      rightLens = prescription.glasses.rightEye || {};
      leftLens = prescription.glasses.leftEye || {};
    }

    return { rightLens, leftLens };
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

  const submitForVerification = async () => {
    if (!orderId) return;

    // Validation
    if (!orderData.frame) {
      toast.error('Veuillez selectionner une monture');
      return;
    }
    if (!orderData.measurements?.pd) {
      toast.error("Veuillez entrer l'ecart pupillaire (PD)");
      return;
    }

    try {
      setSaving(true);
      await opticalShopService.updateSale(orderId, orderData);

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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <PrescriptionStep
            orderData={orderData}
            setOrderData={setOrderData}
            prescriptionData={prescriptionData}
          />
        );
      case 1:
        return (
          <FrameStep
            orderData={orderData}
            setOrderData={setOrderData}
            onCalculatePricing={calculatePricing}
            orderId={orderId}
            tryOnPhotos={tryOnPhotos}
            setTryOnPhotos={setTryOnPhotos}
            showPhotoCapture={showPhotoCapture}
            setShowPhotoCapture={setShowPhotoCapture}
            loadingPhotos={loadingPhotos}
            {...frameSearch}
          />
        );
      case 2:
        return (
          <LensesStep
            orderData={orderData}
            setOrderData={setOrderData}
            onCalculatePricing={calculatePricing}
          />
        );
      case 3:
        return (
          <OptionsStep
            orderData={orderData}
            setOrderData={setOrderData}
            onCalculatePricing={calculatePricing}
          />
        );
      case 4:
        return (
          <SummaryStep
            patient={patient}
            orderData={orderData}
            conventionInfo={conventionInfo}
            availability={availability}
            checkingAvailability={checkingAvailability}
            onCheckAvailability={checkAvailability}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <SaleHeader
          patient={patient}
          conventionInfo={conventionInfo}
          onClose={() => navigate('/optical-shop')}
        />

        <StepIndicator
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          {renderStep()}
        </div>

        <NavigationButtons
          currentStep={currentStep}
          onPrevious={prevStep}
          onNext={nextStep}
          onSubmit={submitForVerification}
          saving={saving}
        />
      </div>
    </div>
  );
}
