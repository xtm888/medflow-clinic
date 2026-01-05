import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import orthopticService from '../services/orthopticService';
import patientService from '../services/patientService';
import OfflineWarningBanner from '../components/OfflineWarningBanner';
import {
  visualAcuityScales,
  motilityLevels,
  extraocularMuscles,
  specialSyndromes,
  wirtTestCircles,
  langTestLevels,
  coverTestDeviations,
  worthTestResults,
  bagoliniResults,
  convergenceQuality,
  convergenceEase,
  fusionQuality,
  stereopsisQuality,
  functionalSigns,
  treatmentTypes,
  treatmentPlans,
  diagnosisConclusionTypes,
  examTypes,
  examStatuses
} from '../data/orthopticData';

const OrthopticExamForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [activeTab, setActiveTab] = useState('visualAcuity');

  const [formData, setFormData] = useState({
    patient: '',
    examType: 'initial',
    sessionInfo: {
      sessionNumber: 1,
      totalSessions: null,
      treatmentPlan: ''
    },
    visualAcuity: {
      distance: {
        OD: { withoutCorrection: '', withCorrection: '', scale: 'dixiemes' },
        OS: { withoutCorrection: '', withCorrection: '', scale: 'dixiemes' },
        OU: { withoutCorrection: '', withCorrection: '', scale: 'dixiemes' }
      },
      near: {
        OD: { withoutCorrection: '', withCorrection: '', scale: 'parinaud' },
        OS: { withoutCorrection: '', withCorrection: '', scale: 'parinaud' },
        OU: { withoutCorrection: '', withCorrection: '', scale: 'parinaud' }
      }
    },
    motility: {
      OD: {
        droitExterne: 'Normal',
        droitInterne: 'Normal',
        droitSuperieur: 'Normal',
        droitInferieur: 'Normal',
        grandOblique: 'Normal',
        petitOblique: 'Normal'
      },
      OS: {
        droitExterne: 'Normal',
        droitInterne: 'Normal',
        droitSuperieur: 'Normal',
        droitInferieur: 'Normal',
        grandOblique: 'Normal',
        petitOblique: 'Normal'
      },
      versions: '',
      ductions: '',
      specialSyndromes: [],
      notes: ''
    },
    coverTest: {
      distance: {
        uncover: '',
        alternating: '',
        measurement: '',
        notes: ''
      },
      near: {
        uncover: '',
        alternating: '',
        measurement: '',
        notes: ''
      }
    },
    nearPointConvergence: {
      break: null,
      recovery: null,
      ease: '',
      quality: ''
    },
    vergences: {
      convergence: { C: null, Cprime: null },
      divergence: { D: null, Dprime: null },
      notes: ''
    },
    stereopsis: {
      wirtTest: {
        fly: false,
        animals: '',
        circles: '',
        secondsOfArc: null
      },
      langTest: {
        chat: false,
        etoile: false,
        voiture: false,
        level: '',
        secondsOfArc: null
      }
    },
    worthTest: {
      distance: { result: '', description: '' },
      near: { result: '', description: '' }
    },
    bagoliniTest: {
      withCorrection: { result: '', description: '' },
      withoutCorrection: { result: '', description: '' }
    },
    functionalSigns: {
      cephalees: false,
      diplopie: false,
      fatigue: false,
      brulures: false,
      flou: false,
      photophobie: false,
      douleurOculaire: false,
      vertiges: false,
      nausees: false,
      asthenopie: false
    },
    treatment: {
      prescribed: false,
      type: '',
      frequency: '',
      duration: '',
      exercises: [],
      prisms: {
        prescribed: false,
        OD: { horizontal: null, vertical: null, base: '' },
        OS: { horizontal: null, vertical: null, base: '' }
      },
      occlusion: {
        prescribed: false,
        eye: '',
        duration: '',
        schedule: ''
      }
    },
    conclusion: {
      type: '',
      customText: '',
      recommendations: [],
      followUpRequired: false,
      followUpTiming: ''
    },
    notes: ''
  });

  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    if (isEditing) {
      fetchExam();
    }
  }, [id]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [searchTerm]);

  const fetchExam = async () => {
    try {
      setLoading(true);
      const response = await orthopticService.getExam(id);
      if (response.success) {
        setFormData(response.data);
        setSelectedPatient(response.data.patient);
      }
    } catch (error) {
      console.error('Error fetching exam:', error);
      toast.error('Erreur lors du chargement de l\'examen');
    } finally {
      setLoading(false);
    }
  };

  const searchPatients = async () => {
    try {
      const response = await patientService.getPatients({ search: searchTerm, limit: 10 });
      // Safely extract array from various API response formats
      const rawPatients = response?.data?.data ?? response?.data ?? [];
      setPatients(Array.isArray(rawPatients) ? rawPatients : []);
    } catch (error) {
      console.error('Error searching patients:', error);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, patient: patient._id }));
    setShowPatientSearch(false);
    setSearchTerm('');
    setPatients([]);
  };

  const handleInputChange = (path, value) => {
    setFormData(prev => {
      const keys = path.split('.');
      const newData = { ...prev };
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSubmit = async (e, status = 'in-progress') => {
    e.preventDefault();

    if (!formData.patient) {
      toast.error('Veuillez sélectionner un patient');
      return;
    }

    try {
      setSaving(true);
      const submitData = { ...formData, status };

      let response;
      if (isEditing) {
        response = await orthopticService.updateExam(id, submitData);
      } else {
        response = await orthopticService.createExam(submitData);
      }

      if (response.success) {
        toast.success(isEditing ? 'Examen mis à jour' : 'Examen créé');
        if (status === 'completed') {
          navigate('/orthoptic');
        } else if (!isEditing) {
          navigate(`/orthoptic/${response.data._id}`);
        }
      }
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    try {
      setSaving(true);
      const response = await orthopticService.signExam(id);
      if (response.success) {
        toast.success('Examen signé');
        fetchExam();
      }
    } catch (error) {
      console.error('Error signing exam:', error);
      toast.error('Erreur lors de la signature');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'visualAcuity', label: 'Acuité Visuelle' },
    { id: 'motility', label: 'Motilité' },
    { id: 'coverTest', label: 'Cover Test' },
    { id: 'convergence', label: 'Convergence' },
    { id: 'stereopsis', label: 'Stéréopsie' },
    { id: 'sensory', label: 'Tests Sensoriels' },
    { id: 'symptoms', label: 'Signes Fonctionnels' },
    { id: 'treatment', label: 'Traitement' },
    { id: 'conclusion', label: 'Conclusion' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Modifier l\'examen orthoptique' : 'Nouvel examen orthoptique'}
          </h1>
          {selectedPatient && (
            <p className="text-gray-600 mt-1">
              Patient: {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.patientId})
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/orthoptic')}
          className="text-gray-600 hover:text-gray-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <OfflineWarningBanner isCritical={true} />

      <form onSubmit={(e) => handleSubmit(e, 'in-progress')}>
        {/* Patient Selection */}
        {!isEditing && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowPatientSearch(true);
                }}
                onFocus={() => setShowPatientSearch(true)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showPatientSearch && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                    >
                      <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                      <div className="text-sm text-gray-500">{patient.patientId}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Exam Type & Session Info */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type d'examen</label>
              <select
                value={formData.examType}
                onChange={(e) => handleInputChange('examType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {examTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N° de séance</label>
              <input
                type="number"
                min="1"
                value={formData.sessionInfo.sessionNumber || ''}
                onChange={(e) => handleInputChange('sessionInfo.sessionNumber', parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total séances</label>
              <input
                type="number"
                min="1"
                value={formData.sessionInfo.totalSessions || ''}
                onChange={(e) => handleInputChange('sessionInfo.totalSessions', parseInt(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan de traitement</label>
              <select
                value={formData.sessionInfo.treatmentPlan}
                onChange={(e) => handleInputChange('sessionInfo.treatmentPlan', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner...</option>
                {treatmentPlans.map((plan) => (
                  <option key={plan.value} value={plan.value}>{plan.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Visual Acuity Tab */}
            {activeTab === 'visualAcuity' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Acuité Visuelle de Loin</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['OD', 'OS', 'OU'].map((eye) => (
                    <div key={eye} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">{eye === 'OD' ? 'Œil Droit (OD)' : eye === 'OS' ? 'Œil Gauche (OS)' : 'Binoculaire (OU)'}</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600">Sans correction</label>
                          <select
                            value={formData.visualAcuity.distance[eye].withoutCorrection}
                            onChange={(e) => handleInputChange(`visualAcuity.distance.${eye}.withoutCorrection`, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">--</option>
                            {visualAcuityScales.dixiemes.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Avec correction</label>
                          <select
                            value={formData.visualAcuity.distance[eye].withCorrection}
                            onChange={(e) => handleInputChange(`visualAcuity.distance.${eye}.withCorrection`, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">--</option>
                            {visualAcuityScales.dixiemes.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-medium text-gray-900 mb-4 mt-8">Acuité Visuelle de Près (Parinaud)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['OD', 'OS', 'OU'].map((eye) => (
                    <div key={eye} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">{eye === 'OD' ? 'Œil Droit (OD)' : eye === 'OS' ? 'Œil Gauche (OS)' : 'Binoculaire (OU)'}</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-gray-600">Sans correction</label>
                          <select
                            value={formData.visualAcuity.near[eye].withoutCorrection}
                            onChange={(e) => handleInputChange(`visualAcuity.near.${eye}.withoutCorrection`, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">--</option>
                            {visualAcuityScales.parinaud.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Avec correction</label>
                          <select
                            value={formData.visualAcuity.near[eye].withCorrection}
                            onChange={(e) => handleInputChange(`visualAcuity.near.${eye}.withCorrection`, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">--</option>
                            {visualAcuityScales.parinaud.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Motility Tab */}
            {activeTab === 'motility' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['OD', 'OS'].map((eye) => (
                    <div key={eye} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">{eye === 'OD' ? 'Œil Droit (OD)' : 'Œil Gauche (OS)'}</h4>
                      <div className="space-y-3">
                        {extraocularMuscles[eye].map((muscle) => (
                          <div key={muscle.id} className="flex items-center justify-between">
                            <label className="text-sm text-gray-700">{muscle.label}</label>
                            <select
                              value={formData.motility[eye][muscle.id]}
                              onChange={(e) => handleInputChange(`motility.${eye}.${muscle.id}`, e.target.value)}
                              className="w-40 px-2 py-1 border border-gray-300 rounded-md text-sm"
                            >
                              {motilityLevels.map((level) => (
                                <option key={level} value={level}>{level}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Versions</label>
                    <textarea
                      value={formData.motility.versions}
                      onChange={(e) => handleInputChange('motility.versions', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ductions</label>
                    <textarea
                      value={formData.motility.ductions}
                      onChange={(e) => handleInputChange('motility.ductions', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Syndromes spéciaux</label>
                  <div className="flex flex-wrap gap-2">
                    {specialSyndromes.map((syndrome) => (
                      <label key={syndrome} className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.motility.specialSyndromes.includes(syndrome)}
                          onChange={(e) => {
                            const newSyndromes = e.target.checked
                              ? [...formData.motility.specialSyndromes, syndrome]
                              : formData.motility.specialSyndromes.filter(s => s !== syndrome);
                            handleInputChange('motility.specialSyndromes', newSyndromes);
                          }}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="text-sm">{syndrome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cover Test Tab */}
            {activeTab === 'coverTest' && (
              <div className="space-y-6">
                {['distance', 'near'].map((dist) => (
                  <div key={dist} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">{dist === 'distance' ? 'Vision de Loin' : 'Vision de Près'}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Uncover Test</label>
                        <select
                          value={formData.coverTest[dist].uncover}
                          onChange={(e) => handleInputChange(`coverTest.${dist}.uncover`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {coverTestDeviations.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Cover alternant</label>
                        <select
                          value={formData.coverTest[dist].alternating}
                          onChange={(e) => handleInputChange(`coverTest.${dist}.alternating`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {coverTestDeviations.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Mesure (dioptries)</label>
                        <input
                          type="text"
                          value={formData.coverTest[dist].measurement}
                          onChange={(e) => handleInputChange(`coverTest.${dist}.measurement`, e.target.value)}
                          placeholder="ex: 10∆"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Notes</label>
                        <input
                          type="text"
                          value={formData.coverTest[dist].notes}
                          onChange={(e) => handleInputChange(`coverTest.${dist}.notes`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Convergence Tab */}
            {activeTab === 'convergence' && (
              <div className="space-y-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Point Proximal de Convergence (PPC)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Rupture (cm)</label>
                      <input
                        type="number"
                        value={formData.nearPointConvergence.break || ''}
                        onChange={(e) => handleInputChange('nearPointConvergence.break', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Récupération (cm)</label>
                      <input
                        type="number"
                        value={formData.nearPointConvergence.recovery || ''}
                        onChange={(e) => handleInputChange('nearPointConvergence.recovery', parseFloat(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Facilité</label>
                      <select
                        value={formData.nearPointConvergence.ease}
                        onChange={(e) => handleInputChange('nearPointConvergence.ease', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">--</option>
                        {convergenceEase.map((e) => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Qualité</label>
                      <select
                        value={formData.nearPointConvergence.quality}
                        onChange={(e) => handleInputChange('nearPointConvergence.quality', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">--</option>
                        {convergenceQuality.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Vergences</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Convergence</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">C</label>
                          <input
                            type="number"
                            value={formData.vergences.convergence.C || ''}
                            onChange={(e) => handleInputChange('vergences.convergence.C', parseFloat(e.target.value) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">C'</label>
                          <input
                            type="number"
                            value={formData.vergences.convergence.Cprime || ''}
                            onChange={(e) => handleInputChange('vergences.convergence.Cprime', parseFloat(e.target.value) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Divergence</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">D</label>
                          <input
                            type="number"
                            value={formData.vergences.divergence.D || ''}
                            onChange={(e) => handleInputChange('vergences.divergence.D', parseFloat(e.target.value) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">D'</label>
                          <input
                            type="number"
                            value={formData.vergences.divergence.Dprime || ''}
                            onChange={(e) => handleInputChange('vergences.divergence.Dprime', parseFloat(e.target.value) || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stereopsis Tab */}
            {activeTab === 'stereopsis' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Test de Wirt</h4>
                    <div className="space-y-3">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.stereopsis.wirtTest.fly}
                          onChange={(e) => handleInputChange('stereopsis.wirtTest.fly', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="text-sm">Mouche (3000")</span>
                      </label>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Animaux</label>
                        <select
                          value={formData.stereopsis.wirtTest.animals}
                          onChange={(e) => handleInputChange('stereopsis.wirtTest.animals', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          <option value="all_correct">Tous corrects</option>
                          <option value="partial">Partiel</option>
                          <option value="none">Aucun</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Cercles (meilleur niveau)</label>
                        <select
                          value={formData.stereopsis.wirtTest.circles}
                          onChange={(e) => handleInputChange('stereopsis.wirtTest.circles', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {wirtTestCircles.map((c) => (
                            <option key={c} value={c}>{c}"</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Test de Lang</h4>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.stereopsis.langTest.chat}
                            onChange={(e) => handleInputChange('stereopsis.langTest.chat', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          <span className="text-sm">Chat</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.stereopsis.langTest.etoile}
                            onChange={(e) => handleInputChange('stereopsis.langTest.etoile', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          <span className="text-sm">Étoile</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.stereopsis.langTest.voiture}
                            onChange={(e) => handleInputChange('stereopsis.langTest.voiture', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 mr-2"
                          />
                          <span className="text-sm">Voiture</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Niveau</label>
                        <select
                          value={formData.stereopsis.langTest.level}
                          onChange={(e) => handleInputChange('stereopsis.langTest.level', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {langTestLevels.map((l) => (
                            <option key={l} value={l}>{l}"</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sensory Tests Tab */}
            {activeTab === 'sensory' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Worth Test */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Test de Worth</h4>
                    {['distance', 'near'].map((dist) => (
                      <div key={dist} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">{dist === 'distance' ? 'Vision de Loin' : 'Vision de Près'}</h5>
                        <select
                          value={formData.worthTest[dist].result}
                          onChange={(e) => handleInputChange(`worthTest.${dist}.result`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {worthTestResults.map((r) => (
                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Bagolini Test */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Test de Bagolini</h4>
                    {['withCorrection', 'withoutCorrection'].map((cond) => (
                      <div key={cond} className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">{cond === 'withCorrection' ? 'Avec correction' : 'Sans correction'}</h5>
                        <select
                          value={formData.bagoliniTest[cond].result}
                          onChange={(e) => handleInputChange(`bagoliniTest.${cond}.result`, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">--</option>
                          {bagoliniResults.map((r) => (
                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Functional Signs Tab */}
            {activeTab === 'symptoms' && (
              <div className="space-y-4">
                <h4 className="font-medium mb-4">Signes Fonctionnels</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {functionalSigns.map((sign) => (
                    <label key={sign.id} className="inline-flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.functionalSigns[sign.id]}
                        onChange={(e) => handleInputChange(`functionalSigns.${sign.id}`, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 mr-2"
                      />
                      <span className="text-sm">{sign.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Treatment Tab */}
            {activeTab === 'treatment' && (
              <div className="space-y-6">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.treatment.prescribed}
                    onChange={(e) => handleInputChange('treatment.prescribed', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 mr-2"
                  />
                  <span className="font-medium">Traitement prescrit</span>
                </label>

                {formData.treatment.prescribed && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type de traitement</label>
                        <select
                          value={formData.treatment.type}
                          onChange={(e) => handleInputChange('treatment.type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Sélectionner...</option>
                          {treatmentTypes.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
                        <input
                          type="text"
                          value={formData.treatment.frequency}
                          onChange={(e) => handleInputChange('treatment.frequency', e.target.value)}
                          placeholder="ex: 2 fois par semaine"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Durée</label>
                        <input
                          type="text"
                          value={formData.treatment.duration}
                          onChange={(e) => handleInputChange('treatment.duration', e.target.value)}
                          placeholder="ex: 12 semaines"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    {/* Prisms */}
                    <div className="border rounded-lg p-4">
                      <label className="inline-flex items-center mb-3">
                        <input
                          type="checkbox"
                          checked={formData.treatment.prisms.prescribed}
                          onChange={(e) => handleInputChange('treatment.prisms.prescribed', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="font-medium">Prismes prescrits</span>
                      </label>
                    </div>

                    {/* Occlusion */}
                    <div className="border rounded-lg p-4">
                      <label className="inline-flex items-center mb-3">
                        <input
                          type="checkbox"
                          checked={formData.treatment.occlusion.prescribed}
                          onChange={(e) => handleInputChange('treatment.occlusion.prescribed', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 mr-2"
                        />
                        <span className="font-medium">Occlusion prescrite</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conclusion Tab */}
            {activeTab === 'conclusion' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
                  <select
                    value={formData.conclusion.type}
                    onChange={(e) => handleInputChange('conclusion.type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Sélectionner...</option>
                    {diagnosisConclusionTypes.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {formData.conclusion.type === 'Custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic personnalisé</label>
                    <textarea
                      value={formData.conclusion.customText}
                      onChange={(e) => handleInputChange('conclusion.customText', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows="3"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.conclusion.followUpRequired}
                      onChange={(e) => handleInputChange('conclusion.followUpRequired', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span>Suivi nécessaire</span>
                  </label>
                  {formData.conclusion.followUpRequired && (
                    <input
                      type="text"
                      value={formData.conclusion.followUpTiming}
                      onChange={(e) => handleInputChange('conclusion.followUpTiming', e.target.value)}
                      placeholder="ex: 6 semaines"
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows="4"
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-4">
          <button
            type="button"
            onClick={() => navigate('/orthoptic')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer brouillon'}
            </button>

            <button
              type="button"
              onClick={(e) => handleSubmit(e, 'completed')}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Terminer l'examen
            </button>

            {isEditing && formData.status === 'completed' && (user?.role === 'admin' || user?.role === 'ophthalmologist' || user?.role === 'orthoptist') && (
              <button
                type="button"
                onClick={handleSign}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Signer
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default OrthopticExamForm;
