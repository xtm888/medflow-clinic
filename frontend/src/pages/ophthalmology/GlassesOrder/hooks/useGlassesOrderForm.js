/**
 * useGlassesOrderForm Hook
 *
 * Manages form state and handlers for glasses/contact lens ordering.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ophthalmologyService from '../../../../services/ophthalmologyService';
import glassesOrderService from '../../../../services/glassesOrderService';
import { useApprovalWarnings } from '../../../../components/ApprovalWarningBanner';
import {
  getDefaultFormState,
  getDefaultItem,
  getEmptyItem,
  COATING_OPTIONS,
  buildOpticalActCodes,
  calculateOrderTotal,
  buildOrderData
} from '../constants';

export default function useGlassesOrderForm() {
  const { examId } = useParams();
  const navigate = useNavigate();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [exam, setExam] = useState(null);
  const [patient, setPatient] = useState(null);

  // Form state
  const [formState, setFormState] = useState(getDefaultFormState());

  // Approval warnings
  const {
    warnings,
    company,
    loading: warningsLoading,
    checkWarnings,
    hasBlockingWarnings
  } = useApprovalWarnings();

  // Fetch exam data on mount
  useEffect(() => {
    fetchExamData();
  }, [examId]);

  // Build act codes for approval check
  const opticalActCodes = useMemo(() => {
    return buildOpticalActCodes(formState);
  }, [formState.orderType, formState.lensType, formState.coatings, formState.selectedFrame]);

  // Check approval warnings when patient or order changes
  useEffect(() => {
    if (patient?._id && opticalActCodes.length > 0) {
      checkWarnings(patient._id, opticalActCodes);
    }
  }, [patient?._id, opticalActCodes.length]);

  // Calculate total
  const orderTotal = useMemo(() => {
    return calculateOrderTotal(formState);
  }, [formState]);

  // Calculate convention coverage
  const conventionCoverage = useMemo(() => {
    if (!company) return null;

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
      coveragePercentage = company.defaultCoverage?.percentage ?? 100;
    }

    const companyPays = Math.round(orderTotal * coveragePercentage / 100);
    const patientPays = orderTotal - companyPays;

    return {
      hasConvention: true,
      companyName: company.name,
      coveragePercentage,
      opticalNotCovered,
      companyPays,
      patientPays
    };
  }, [company, orderTotal]);

  const fetchExamData = async () => {
    try {
      setLoading(true);
      const response = await ophthalmologyService.getExam(examId);
      const examData = response.data || response;
      setExam(examData);
      setPatient(examData.patient);

      // Initialize items with base lens price
      setFormState(prev => ({
        ...prev,
        items: [getDefaultItem()]
      }));
    } catch (err) {
      toast.error('Erreur lors du chargement de l\'examen');
      console.error('Error fetching exam:', err);
    } finally {
      setLoading(false);
    }
  };

  // Form field updaters
  const updateField = (field, value) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleCoatingChange = (coatingValue) => {
    setFormState(prev => ({
      ...prev,
      coatings: prev.coatings.includes(coatingValue)
        ? prev.coatings.filter(c => c !== coatingValue)
        : [...prev.coatings, coatingValue]
    }));
  };

  const addItem = () => {
    setFormState(prev => ({
      ...prev,
      items: [...prev.items, getEmptyItem()]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormState(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;

      // Recalculate total
      if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
        const qty = newItems[index].quantity || 1;
        const price = newItems[index].unitPrice || 0;
        const discount = newItems[index].discount || 0;
        newItems[index].total = (qty * price) - discount;
      }

      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index) => {
    if (formState.items.length > 1) {
      setFormState(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const updateNotes = (field, value) => {
    setFormState(prev => ({
      ...prev,
      notes: { ...prev.notes, [field]: value }
    }));
  };

  const updateContactLensQuantity = (eye, value) => {
    setFormState(prev => ({
      ...prev,
      contactLensQuantity: {
        ...prev.contactLensQuantity,
        [eye]: parseInt(value) || 1
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!exam) {
      toast.error('Données d\'examen manquantes');
      return;
    }

    // Validate inventory selection
    if (formState.orderType !== 'contact-lenses' &&
        formState.selectedFrame &&
        formState.selectedFrame.available < 1) {
      toast.error('La monture sélectionnée n\'est plus en stock');
      return;
    }

    try {
      setSaving(true);

      const orderData = buildOrderData(formState, examId, exam, COATING_OPTIONS);
      await glassesOrderService.createOrder(orderData);

      toast.success('Commande créée avec succès!');

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

  return {
    // Navigation
    examId,
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
    warningsLoading,
    hasBlockingWarnings,

    // Convention
    conventionCoverage,

    // Total
    orderTotal,

    // Submit
    handleSubmit
  };
}
