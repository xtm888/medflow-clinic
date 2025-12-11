import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/apiConfig';
import FaceVerification from '../components/biometric/FaceVerification';
import { useAuth } from '../contexts/AuthContext';
import OfflineWarningBanner from '../components/OfflineWarningBanner';
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Minus
} from 'lucide-react';

const IVTInjectionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patientId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Face verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPassed, setVerificationPassed] = useState(false);

  const steps = ['Informations de base', 'Évaluation pré-injection', 'Procédure', 'Suivi'];

  const [formData, setFormData] = useState({
    patient: '',
    eye: '',
    injectionDate: new Date().toISOString().split('T')[0],
    indication: '',
    medication: {
      type: '',
      name: '',
      dose: '',
      batchNumber: '',
      expirationDate: ''
    },
    series: {
      protocol: '',
      seriesNumber: 1,
      injectionNumberInSeries: 1,
      totalPlannedInjections: ''
    },
    preInjection: {
      visualAcuity: {
        method: 'Snellen',
        value: '',
        logMAR: ''
      },
      iop: '',
      oct: {
        performed: false,
        cmt: '',
        findings: ''
      },
      clinicalFindings: '',
      contraindications: []
    },
    procedure: {
      anesthesia: {
        type: '',
        agent: '',
        application: ''
      },
      preparation: {
        antiseptic: 'Betadine',
        draping: true,
        speculum: true
      },
      injection: {
        site: '',
        quadrant: '',
        distanceFromLimbus: '3.5-4.0',
        needleGauge: '30',
        technique: 'Standard transconjunctival'
      },
      postInjection: {
        iop: '',
        perfusion: true,
        complications: []
      }
    },
    complications: [],
    followUp: {
      nextVisitDate: '',
      nextInjectionPlanned: false,
      nextInjectionDate: '',
      instructions: ''
    },
    notes: '',
    status: 'planned'
  });

  // Anti-VEGF medications
  const antiVEGFMedications = [
    { type: 'anti-VEGF', name: 'Avastin', genericName: 'Bevacizumab', dose: '1.25mg/0.05ml' },
    { type: 'anti-VEGF', name: 'Lucentis', genericName: 'Ranibizumab', dose: '0.5mg/0.05ml' },
    { type: 'anti-VEGF', name: 'Eylea', genericName: 'Aflibercept', dose: '2mg/0.05ml' },
    { type: 'anti-VEGF', name: 'Beovu', genericName: 'Brolucizumab', dose: '6mg/0.05ml' },
    { type: 'anti-VEGF', name: 'Vabysmo', genericName: 'Faricimab', dose: '6mg/0.05ml' }
  ];

  // Steroid medications
  const steroidMedications = [
    { type: 'steroid', name: 'Ozurdex', genericName: 'Dexamethasone implant', dose: '0.7mg' },
    { type: 'steroid', name: 'Iluvien', genericName: 'Fluocinolone acetonide', dose: '0.19mg' },
    { type: 'steroid', name: 'Triamcinolone', genericName: 'Triamcinolone acetonide', dose: '4mg/0.1ml' }
  ];

  const allMedications = [...antiVEGFMedications, ...steroidMedications];

  // Indications
  const indications = [
    { value: 'wet-amd', label: 'DMLA humide (Wet AMD)' },
    { value: 'dme', label: 'Œdème maculaire diabétique (DME)' },
    { value: 'brvo', label: 'Occlusion de branche veineuse rétinienne (BRVO)' },
    { value: 'crvo', label: 'Occlusion de la veine centrale rétinienne (CRVO)' },
    { value: 'cnv', label: 'Néovascularisation choroïdienne (CNV)' },
    { value: 'dmo', label: 'Œdème maculaire (DMO)' },
    { value: 'pdr', label: 'Rétinopathie diabétique proliférante (PDR)' },
    { value: 'other', label: 'Autre' }
  ];

  // Protocols
  const protocols = [
    { value: 'loading', label: 'Phase de charge (Loading)' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'prn', label: 'PRN (Pro Re Nata)' },
    { value: 'treat-and-extend', label: 'Treat and Extend' }
  ];

  // Anesthesia types
  const anesthesiaTypes = [
    { value: 'topical-drops', label: 'Gouttes topiques' },
    { value: 'topical-gel', label: 'Gel topique' },
    { value: 'subconjunctival', label: 'Sous-conjonctivale' },
    { value: 'peribulbar', label: 'Péribulbaire' }
  ];

  // Injection sites
  const injectionSites = [
    { value: 'inferotemporal', label: 'Inféro-temporal' },
    { value: 'superotemporal', label: 'Supéro-temporal' },
    { value: 'inferonasal', label: 'Inféro-nasal' },
    { value: 'superonasal', label: 'Supéro-nasal' }
  ];

  // Possible complications
  const possibleComplications = [
    'Hémorragie sous-conjonctivale',
    'Hémorragie du vitré',
    'Décollement de rétine',
    'Endophtalmie',
    'Hypertonie oculaire',
    'Cataracte',
    'Inflammation intraoculaire',
    'Déchirure rétinienne',
    'Autre'
  ];

  useEffect(() => {
    fetchPatients();
    if (id) {
      fetchInjection();
    }
  }, [id]);

  // Pre-select patient from URL params
  useEffect(() => {
    if (patientIdParam && patients.length > 0 && !selectedPatient) {
      const patient = patients.find(p => p._id === patientIdParam || p.id === patientIdParam);
      if (patient) {
        setSelectedPatient(patient);
        setFormData(prev => ({
          ...prev,
          patient: patient._id || patient.id
        }));
      }
    }
  }, [patientIdParam, patients]);

  // Face verification check when patient is selected
  useEffect(() => {
    if (!selectedPatient) return;

    const isDoctorRole = user?.role === 'doctor' || user?.role === 'ophthalmologist' || user?.role === 'admin';

    if (isDoctorRole && selectedPatient?.biometric?.faceEncoding) {
      const sessionKey = `faceVerified_${selectedPatient._id || selectedPatient.id}`;
      const alreadyVerified = sessionStorage.getItem(sessionKey);

      if (alreadyVerified === 'true') {
        setVerificationPassed(true);
      } else {
        setShowVerification(true);
        setVerificationPassed(false);
      }
    } else {
      // Skip verification if not doctor role or patient has no biometric
      setVerificationPassed(true);
    }
  }, [selectedPatient, user]);

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients', {
        params: { limit: 100 }
      });
      setPatients(response.data.data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const fetchInjection = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/ivt/${id}`);
      const injection = response.data;

      // Populate form with existing data
      setFormData({
        ...formData,
        ...injection,
        injectionDate: injection.injectionDate?.split('T')[0] || formData.injectionDate
      });

      setSelectedPatient(injection.patient);
      setLoading(false);
    } catch (err) {
      setError('Erreur lors du chargement de l\'injection');
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedChange = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleMedicationSelect = (medicationName) => {
    const medication = allMedications.find(m => m.name === medicationName);
    if (medication) {
      setFormData(prev => ({
        ...prev,
        medication: {
          ...prev.medication,
          type: medication.type,
          name: medication.name,
          dose: medication.dose
        }
      }));
    }
  };

  const handlePatientSelect = (patientId) => {
    const patient = patients.find(p => p._id === patientId);
    setSelectedPatient(patient);
    if (patient) {
      setFormData(prev => ({
        ...prev,
        patient: patient._id
      }));
    }
  };

  const handleComplicationToggle = (complication) => {
    setFormData(prev => {
      const complications = prev.complications || [];
      const exists = complications.find(c => c.type === complication);

      if (exists) {
        return {
          ...prev,
          complications: complications.filter(c => c.type !== complication)
        };
      } else {
        return {
          ...prev,
          complications: [...complications, { type: complication, severity: 'mild', notes: '' }]
        };
      }
    });
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateForm = () => {
    if (!formData.patient) {
      setError('Veuillez sélectionner un patient');
      return false;
    }
    if (!formData.eye) {
      setError('Veuillez sélectionner un œil');
      return false;
    }
    if (!formData.indication) {
      setError('Veuillez sélectionner une indication');
      return false;
    }
    if (!formData.medication.name) {
      setError('Veuillez sélectionner un médicament');
      return false;
    }
    return true;
  };

  const handleSubmit = async (completeInjection = false) => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const submitData = {
        ...formData,
        status: completeInjection ? 'completed' : 'planned'
      };

      let response;
      if (id) {
        response = await api.put(`/ivt/${id}`, submitData);
      } else {
        response = await api.post('/ivt', submitData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate(`/ivt/${response.data._id || response.data.id}`);
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderPreInjection();
      case 2:
        return renderProcedure();
      case 3:
        return renderFollowUp();
      default:
        return null;
    }
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Informations de base
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
          <select
            className="input"
            value={formData.patient}
            onChange={(e) => handlePatientSelect(e.target.value)}
          >
            <option value="">Sélectionner un patient</option>
            {patients.map(patient => (
              <option key={patient._id} value={patient._id}>
                {patient.firstName} {patient.lastName} - {patient.patientId || patient._id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Œil *</label>
          <select
            className="input"
            value={formData.eye}
            onChange={(e) => handleInputChange('eye', e.target.value)}
          >
            <option value="">Sélectionner</option>
            <option value="OD">OD (Œil droit)</option>
            <option value="OS">OS (Œil gauche)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date d'injection</label>
          <input
            type="date"
            className="input"
            value={formData.injectionDate}
            onChange={(e) => handleInputChange('injectionDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Indication *</label>
          <select
            className="input"
            value={formData.indication}
            onChange={(e) => handleInputChange('indication', e.target.value)}
          >
            <option value="">Sélectionner</option>
            {indications.map(ind => (
              <option key={ind.value} value={ind.value}>
                {ind.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Médicament *</label>
          <select
            className="input"
            value={formData.medication.name}
            onChange={(e) => handleMedicationSelect(e.target.value)}
          >
            <option value="">Sélectionner</option>
            <optgroup label="Anti-VEGF">
              {antiVEGFMedications.map(med => (
                <option key={med.name} value={med.name}>
                  {med.name} ({med.genericName}) - {med.dose}
                </option>
              ))}
            </optgroup>
            <optgroup label="Corticostéroïdes">
              {steroidMedications.map(med => (
                <option key={med.name} value={med.name}>
                  {med.name} ({med.genericName}) - {med.dose}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {formData.medication.name && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot</label>
              <input
                type="text"
                className="input"
                value={formData.medication.batchNumber}
                onChange={(e) => handleNestedChange('medication.batchNumber', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration</label>
              <input
                type="date"
                className="input"
                value={formData.medication.expirationDate}
                onChange={(e) => handleNestedChange('medication.expirationDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dose</label>
              <input
                type="text"
                className="input"
                value={formData.medication.dose}
                onChange={(e) => handleNestedChange('medication.dose', e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <hr className="my-6 border-gray-200" />

      <h3 className="text-lg font-semibold text-gray-900">
        Informations sur la série
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Protocole</label>
          <select
            className="input"
            value={formData.series.protocol}
            onChange={(e) => handleNestedChange('series.protocol', e.target.value)}
          >
            <option value="">Sélectionner</option>
            {protocols.map(protocol => (
              <option key={protocol.value} value={protocol.value}>
                {protocol.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de série</label>
          <input
            type="number"
            className="input"
            min="1"
            value={formData.series.seriesNumber}
            onChange={(e) => handleNestedChange('series.seriesNumber', parseInt(e.target.value) || 1)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Injection n° dans la série</label>
          <input
            type="number"
            className="input"
            min="1"
            value={formData.series.injectionNumberInSeries}
            onChange={(e) => handleNestedChange('series.injectionNumberInSeries', parseInt(e.target.value) || 1)}
          />
        </div>

        {formData.series.protocol === 'loading' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total d'injections prévues</label>
            <input
              type="number"
              className="input"
              min="1"
              value={formData.series.totalPlannedInjections}
              onChange={(e) => handleNestedChange('series.totalPlannedInjections', parseInt(e.target.value) || '')}
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderPreInjection = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Évaluation pré-injection
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Méthode AV</label>
          <select
            className="input"
            value={formData.preInjection.visualAcuity.method}
            onChange={(e) => handleNestedChange('preInjection.visualAcuity.method', e.target.value)}
          >
            <option value="Snellen">Snellen</option>
            <option value="ETDRS">ETDRS</option>
            <option value="LogMAR">LogMAR</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Acuité visuelle</label>
          <input
            type="text"
            className="input"
            placeholder="Ex: 20/40, 0.5, 0.3"
            value={formData.preInjection.visualAcuity.value}
            onChange={(e) => handleNestedChange('preInjection.visualAcuity.value', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PIO pré-injection (mmHg)</label>
          <input
            type="number"
            className="input"
            placeholder="mmHg"
            value={formData.preInjection.iop}
            onChange={(e) => handleNestedChange('preInjection.iop', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={formData.preInjection.oct.performed}
            onChange={(e) => handleNestedChange('preInjection.oct.performed', e.target.checked)}
          />
          <span className="ml-2 text-sm font-medium text-gray-700">OCT réalisée</span>
        </label>
      </div>

      {formData.preInjection.oct.performed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CMT (Épaisseur maculaire centrale) μm</label>
            <input
              type="number"
              className="input"
              placeholder="μm"
              value={formData.preInjection.oct.cmt}
              onChange={(e) => handleNestedChange('preInjection.oct.cmt', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Résultats OCT</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Fluide sous-rétinien, œdème..."
              value={formData.preInjection.oct.findings}
              onChange={(e) => handleNestedChange('preInjection.oct.findings', e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observations cliniques</label>
        <textarea
          className="input"
          rows="4"
          placeholder="Examens du fond d'œil, état de la rétine, etc."
          value={formData.preInjection.clinicalFindings}
          onChange={(e) => handleNestedChange('preInjection.clinicalFindings', e.target.value)}
        />
      </div>
    </div>
  );

  const renderProcedure = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Détails de la procédure
      </h3>

      <h4 className="text-md font-semibold text-primary-600">Anesthésie</h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type d'anesthésie</label>
          <select
            className="input"
            value={formData.procedure.anesthesia.type}
            onChange={(e) => handleNestedChange('procedure.anesthesia.type', e.target.value)}
          >
            <option value="">Sélectionner</option>
            {anesthesiaTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent anesthésique</label>
          <input
            type="text"
            className="input"
            placeholder="Ex: Oxybuprocaïne, Lidocaïne"
            value={formData.procedure.anesthesia.agent}
            onChange={(e) => handleNestedChange('procedure.anesthesia.agent', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Application</label>
          <input
            type="text"
            className="input"
            placeholder="Ex: 3 gouttes, 5 minutes"
            value={formData.procedure.anesthesia.application}
            onChange={(e) => handleNestedChange('procedure.anesthesia.application', e.target.value)}
          />
        </div>
      </div>

      <h4 className="text-md font-semibold text-primary-600">Préparation</h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Antiseptique</label>
          <input
            type="text"
            className="input"
            value={formData.procedure.preparation.antiseptic}
            onChange={(e) => handleNestedChange('procedure.preparation.antiseptic', e.target.value)}
          />
        </div>

        <div className="flex items-center h-full pt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.procedure.preparation.draping}
              onChange={(e) => handleNestedChange('procedure.preparation.draping', e.target.checked)}
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Champ stérile</span>
          </label>
        </div>

        <div className="flex items-center h-full pt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.procedure.preparation.speculum}
              onChange={(e) => handleNestedChange('procedure.preparation.speculum', e.target.checked)}
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Blépharostat</span>
          </label>
        </div>
      </div>

      <h4 className="text-md font-semibold text-primary-600">Injection</h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site d'injection</label>
          <select
            className="input"
            value={formData.procedure.injection.site}
            onChange={(e) => handleNestedChange('procedure.injection.site', e.target.value)}
          >
            <option value="">Sélectionner</option>
            {injectionSites.map(site => (
              <option key={site.value} value={site.value}>
                {site.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distance du limbe (mm)</label>
          <input
            type="text"
            className="input"
            value={formData.procedure.injection.distanceFromLimbus}
            onChange={(e) => handleNestedChange('procedure.injection.distanceFromLimbus', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Calibre de l'aiguille (G)</label>
          <input
            type="text"
            className="input"
            value={formData.procedure.injection.needleGauge}
            onChange={(e) => handleNestedChange('procedure.injection.needleGauge', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Technique</label>
        <input
          type="text"
          className="input"
          value={formData.procedure.injection.technique}
          onChange={(e) => handleNestedChange('procedure.injection.technique', e.target.value)}
        />
      </div>

      <h4 className="text-md font-semibold text-primary-600">Post-injection</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PIO post-injection (mmHg)</label>
          <input
            type="number"
            className="input"
            placeholder="mmHg"
            value={formData.procedure.postInjection.iop}
            onChange={(e) => handleNestedChange('procedure.postInjection.iop', e.target.value)}
          />
        </div>

        <div className="flex items-center h-full pt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.procedure.postInjection.perfusion}
              onChange={(e) => handleNestedChange('procedure.postInjection.perfusion', e.target.checked)}
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Perfusion rétinienne vérifiée</span>
          </label>
        </div>
      </div>

      <h4 className="text-md font-semibold text-red-600">Complications</h4>

      <div className="flex flex-wrap gap-2">
        {possibleComplications.map(complication => {
          const isSelected = formData.complications?.some(c => c.type === complication);
          return (
            <button
              key={complication}
              type="button"
              onClick={() => handleComplicationToggle(complication)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-red-100 text-red-800 border-2 border-red-600'
                  : 'bg-gray-100 text-gray-800 border-2 border-gray-300 hover:border-gray-400'
              }`}
            >
              {complication}
            </button>
          );
        })}
      </div>

      {formData.complications?.length > 0 && (
        <div className="space-y-4">
          {formData.complications.map((complication, index) => (
            <div key={index} className="p-4 border-2 border-red-600 rounded-lg bg-red-50">
              <p className="text-sm font-semibold text-red-800 mb-2">{complication.type}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
                  <select
                    className="input"
                    value={complication.severity || 'mild'}
                    onChange={(e) => {
                      const newComplications = [...formData.complications];
                      newComplications[index].severity = e.target.value;
                      handleInputChange('complications', newComplications);
                    }}
                  >
                    <option value="mild">Légère</option>
                    <option value="moderate">Modérée</option>
                    <option value="severe">Sévère</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    className="input"
                    value={complication.notes || ''}
                    onChange={(e) => {
                      const newComplications = [...formData.complications];
                      newComplications[index].notes = e.target.value;
                      handleInputChange('complications', newComplications);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFollowUp = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Suivi et instructions
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prochaine visite</label>
          <input
            type="date"
            className="input"
            value={formData.followUp.nextVisitDate}
            onChange={(e) => handleNestedChange('followUp.nextVisitDate', e.target.value)}
          />
        </div>

        <div className="flex items-center h-full pt-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.followUp.nextInjectionPlanned}
              onChange={(e) => handleNestedChange('followUp.nextInjectionPlanned', e.target.checked)}
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Prochaine injection planifiée</span>
          </label>
        </div>

        {formData.followUp.nextInjectionPlanned && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de la prochaine injection</label>
            <input
              type="date"
              className="input"
              value={formData.followUp.nextInjectionDate}
              onChange={(e) => handleNestedChange('followUp.nextInjectionDate', e.target.value)}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions post-injection</label>
        <textarea
          className="input"
          rows="6"
          placeholder="Instructions pour le patient: gouttes antibiotiques, précautions, signes d'alerte..."
          value={formData.followUp.instructions}
          onChange={(e) => handleNestedChange('followUp.instructions', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes additionnelles</label>
        <textarea
          className="input"
          rows="4"
          value={formData.notes}
          onChange={(e) => handleInputChange('notes', e.target.value)}
        />
      </div>
    </div>
  );

  // Show face verification modal
  if (showVerification && selectedPatient) {
    return (
      <FaceVerification
        patient={selectedPatient}
        onVerified={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${selectedPatient._id || selectedPatient.id}`, 'true');
        }}
        onSkip={() => {
          setShowVerification(false);
          setVerificationPassed(true);
          sessionStorage.setItem(`faceVerified_${selectedPatient._id || selectedPatient.id}`, 'true');
        }}
        onCancel={() => navigate(-1)}
        allowSkip={user?.role === 'admin'}
      />
    );
  }

  // Block content until verification passed (if patient selected and verification required)
  if (selectedPatient && !verificationPassed) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <button
          onClick={() => navigate('/ivt')}
          className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {id ? 'Modifier l\'injection IVT' : 'Nouvelle injection IVT'}
        </h1>
      </div>

      <OfflineWarningBanner isCritical={true} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Injection enregistrée avec succès!
        </div>
      )}

      <div className="card">
        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    index <= activeStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <p className={`text-xs mt-2 text-center ${
                    index <= activeStep ? 'text-primary-600 font-semibold' : 'text-gray-500'
                  }`}>
                    {label}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 ${
                    index < activeStep ? 'bg-primary-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent(activeStep)}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={activeStep === 0}
            className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Précédent
          </button>

          <div className="flex space-x-3">
            {activeStep === steps.length - 1 ? (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                  className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  <span>Enregistrer comme brouillon</span>
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  className="btn btn-primary flex items-center space-x-2 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                  <span>Finaliser l'injection</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleNext}
                className="btn btn-primary"
              >
                Suivant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IVTInjectionForm;
