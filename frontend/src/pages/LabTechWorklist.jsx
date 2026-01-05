import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import laboratoryService from '../services/laboratoryService';
import { rejectAndReschedule, REJECTION_REASONS } from '../services/labOrderService';
import OfflineWarningBanner from '../components/OfflineWarningBanner';
import {
  Search,
  FlaskConical,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  User,
  Calendar,
  FileText,
  PlayCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Printer,
  Barcode,
  TestTube,
  Ban,
  DollarSign
} from 'lucide-react';

const LabTechWorklist = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  });
  const [filters, setFilters] = useState({
    status: 'pending',
    priority: 'all',
    search: '',
    category: 'all'
  });
  const [selectedTest, setSelectedTest] = useState(null);
  const [resultDialog, setResultDialog] = useState(false);
  const [resultForm, setResultForm] = useState({
    results: '',
    componentResults: [],
    notes: '',
    specimenQuality: 'acceptable'
  });
  const [expandedTest, setExpandedTest] = useState(null);
  const [categories, setCategories] = useState([]);

  // Rejection modal state
  const [rejectionDialog, setRejectionDialog] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionForm, setRejectionForm] = useState({
    reason: '',
    reasonDetails: ''
  });
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchTests();
    fetchCategories();
  }, [filters]);

  const fetchTests = async () => {
    try {
      setLoading(true);

      let response;
      if (filters.status === 'pending' || filters.status === 'received') {
        response = await laboratoryService.getPending({
          priority: filters.priority !== 'all' ? filters.priority : undefined,
          search: filters.search || undefined,
          category: filters.category !== 'all' ? filters.category : undefined
        });
      } else if (filters.status === 'completed') {
        response = await laboratoryService.getCompleted({
          limit: 50,
          search: filters.search || undefined,
          category: filters.category !== 'all' ? filters.category : undefined
        });
      } else {
        response = await laboratoryService.getPending();
      }

      // Safely extract array data from various possible response shapes
      let testsData = [];
      if (Array.isArray(response)) {
        testsData = response;
      } else if (response && Array.isArray(response.data)) {
        testsData = response.data;
      } else if (response && response.data && Array.isArray(response.data.tests)) {
        // Handle paginated response { data: { tests: [], pagination: {} } }
        testsData = response.data.tests;
      }
      setTests(testsData);

      // Calculate stats
      const pending = testsData.filter(t => t.status === 'pending' || t.status === 'ordered').length;
      const inProgress = testsData.filter(t => t.status === 'received' || t.status === 'in-progress').length;
      const completed = testsData.filter(t => t.status === 'completed').length;
      const urgent = testsData.filter(t => t.priority === 'urgent' || t.priority === 'stat').length;

      setStats({ pending, inProgress, completed, urgent });
    } catch (error) {
      console.error('Error fetching tests:', error);
      toast.error('Erreur lors du chargement des tests');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await laboratoryService.getTemplates();
      // Safely extract templates array
      let templates = [];
      if (Array.isArray(response)) {
        templates = response;
      } else if (response && Array.isArray(response.data)) {
        templates = response.data;
      }
      const uniqueCategories = [...new Set(templates.map(t => t.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleReceiveSpecimen = async (test) => {
    try {
      await laboratoryService.updateStatus(test._id, 'received');
      toast.success('Spécimen reçu');
      fetchTests();
    } catch (error) {
      console.error('Error receiving specimen:', error);
      toast.error('Erreur lors de la réception');
    }
  };

  const handleStartProcessing = async (test) => {
    try {
      await laboratoryService.updateStatus(test._id, 'in-progress');
      toast.success('Test en cours de traitement');
      fetchTests();
    } catch (error) {
      console.error('Error starting processing:', error);
      toast.error('Erreur lors du démarrage');
    }
  };

  const openResultDialog = (test) => {
    setSelectedTest(test);
    setResultForm({
      results: '',
      componentResults: test.tests?.map(t => ({
        testId: t.templateId || t._id,
        name: t.name,
        value: '',
        unit: t.unit || '',
        referenceRange: t.referenceRange || '',
        flag: 'normal'
      })) || [],
      notes: '',
      specimenQuality: 'acceptable'
    });
    setResultDialog(true);
  };

  const handleSaveResults = async () => {
    if (!selectedTest) return;

    try {
      const resultData = {
        results: resultForm.results,
        componentResults: resultForm.componentResults,
        notes: resultForm.notes,
        specimenQuality: resultForm.specimenQuality,
        completedBy: user._id,
        completedAt: new Date()
      };

      await laboratoryService.saveResults(selectedTest._id, resultData);
      toast.success('Résultats enregistrés');
      setResultDialog(false);
      setSelectedTest(null);
      fetchTests();
    } catch (error) {
      console.error('Error saving results:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  // Open rejection modal
  const openRejectionDialog = (test) => {
    setRejectionTarget(test);
    setRejectionForm({ reason: '', reasonDetails: '' });
    setRejectionDialog(true);
  };

  // Handle rejection with automatic 25% penalty
  const handleRejectSpecimen = async () => {
    if (!rejectionTarget || !rejectionForm.reason) {
      toast.error('Veuillez sélectionner un motif de rejet');
      return;
    }

    setRejecting(true);
    try {
      const result = await rejectAndReschedule(rejectionTarget._id, {
        reason: rejectionForm.reason,
        reasonDetails: rejectionForm.reasonDetails
      });

      // Show success with penalty info
      const penaltyAmount = result.data?.penaltyAmount || 0;
      toast.success(
        <div>
          <p className="font-bold">Patient rejeté</p>
          <p className="text-sm">Pénalité: {penaltyAmount.toLocaleString()} CDF</p>
          <p className="text-sm text-yellow-600">→ Patient doit aller à la réception</p>
        </div>,
        { autoClose: 5000 }
      );

      setRejectionDialog(false);
      setRejectionTarget(null);
      fetchTests();
    } catch (error) {
      console.error('Error rejecting specimen:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du rejet');
    } finally {
      setRejecting(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'En attente', icon: Clock },
      ordered: { color: 'bg-yellow-100 text-yellow-800', label: 'Commandé', icon: Clock },
      received: { color: 'bg-blue-100 text-blue-800', label: 'Reçu', icon: TestTube },
      'in-progress': { color: 'bg-purple-100 text-purple-800', label: 'En cours', icon: PlayCircle },
      completed: { color: 'bg-green-100 text-green-800', label: 'Terminé', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejeté', icon: XCircle }
    };

    const statusConfig = config[status] || config.pending;
    const Icon = statusConfig.icon;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {statusConfig.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'urgent' || priority === 'stat') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {priority === 'stat' ? 'STAT' : 'Urgent'}
        </span>
      );
    }
    return null;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateComponentResult = (index, field, value) => {
    setResultForm(prev => ({
      ...prev,
      componentResults: prev.componentResults.map((comp, i) =>
        i === index ? { ...comp, [field]: value } : comp
      )
    }));
  };

  return (
    <div className="space-y-6">
      {/* Offline Warning - Lab results require online for patient safety */}
      <OfflineWarningBanner
        message="La saisie et vérification des résultats de laboratoire nécessitent une connexion internet pour la sécurité du patient."
        isCritical={true}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <FlaskConical className="h-8 w-8 mr-3 text-primary-600" />
            Liste de Travail Laboratoire
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion des prélèvements et saisie des résultats
          </p>
        </div>
        <button
          onClick={fetchTests}
          className="btn btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          onClick={() => setFilters(f => ({ ...f, status: 'pending' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, status: 'received' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'received' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En cours</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </div>
            <TestTube className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, status: 'completed' }))}
          className={`card cursor-pointer transition-all ${filters.status === 'completed' ? 'ring-2 ring-green-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Terminés</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div
          onClick={() => setFilters(f => ({ ...f, priority: 'urgent' }))}
          className={`card cursor-pointer transition-all bg-red-50 ${filters.priority === 'urgent' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgents</p>
              <p className="text-2xl font-bold text-red-600">{stats.urgent}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher patient, code-barres, test..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="input pl-10"
            />
          </div>
          <select
            value={filters.category}
            onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
            className="input w-48"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
            className="input w-36"
          >
            <option value="all">Toutes priorités</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
            <option value="routine">Routine</option>
          </select>
        </div>
      </div>

      {/* Tests List */}
      <div className="card p-0">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Chargement...</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun test dans la liste de travail</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {tests.map((test) => (
              <div
                key={test._id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {test.orderNumber || `LAB-${test._id?.slice(-6)}`}
                      </span>
                      {getStatusBadge(test.status)}
                      {getPriorityBadge(test.priority)}
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span>
                          {test.patient?.firstName} {test.patient?.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span>Dr. {test.orderedBy?.lastName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(test.createdAt)}</span>
                      </div>
                    </div>

                    {/* Test details */}
                    <button
                      onClick={() => setExpandedTest(
                        expandedTest === test._id ? null : test._id
                      )}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
                    >
                      {expandedTest === test._id ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Masquer les tests
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Voir les tests ({test.tests?.length || 1})
                        </>
                      )}
                    </button>

                    {expandedTest === test._id && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        {test.tests?.map((t, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                            <div>
                              <p className="font-medium text-gray-900">{t.name}</p>
                              <p className="text-sm text-gray-500">{t.code} - {t.category}</p>
                            </div>
                            {t.result && (
                              <span className="text-sm font-medium text-green-600">{t.result}</span>
                            )}
                          </div>
                        )) || (
                          <div className="py-2">
                            <p className="font-medium text-gray-900">{test.testName}</p>
                            <p className="text-sm text-gray-500">{test.testCode}</p>
                          </div>
                        )}

                        {test.clinicalIndication && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Indication:</span> {test.clinicalIndication}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    {(test.status === 'pending' || test.status === 'ordered') && (
                      <>
                        <button
                          onClick={() => handleReceiveSpecimen(test)}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                        >
                          <TestTube className="h-4 w-4" />
                          Réception
                        </button>
                        <button
                          onClick={() => openRejectionDialog(test)}
                          className="btn btn-danger btn-sm flex items-center gap-1"
                          title="Rejeter le patient (pénalité 25%)"
                        >
                          <Ban className="h-4 w-4" />
                          Rejeter
                        </button>
                      </>
                    )}

                    {test.status === 'received' && (
                      <button
                        onClick={() => handleStartProcessing(test)}
                        className="btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Démarrer
                      </button>
                    )}

                    {(test.status === 'received' || test.status === 'in-progress') && (
                      <button
                        onClick={() => openResultDialog(test)}
                        className="btn btn-success btn-sm flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Résultats
                      </button>
                    )}

                    {test.status === 'completed' && (
                      <button
                        onClick={() => window.print()}
                        className="btn btn-secondary btn-sm"
                        title="Imprimer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result Entry Dialog */}
      {resultDialog && selectedTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Saisie des Résultats</h2>
              <button
                onClick={() => { setResultDialog(false); setSelectedTest(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Patient</h3>
                <p className="text-gray-700">
                  {selectedTest.patient?.firstName} {selectedTest.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  ID: {selectedTest.patient?.patientId}
                </p>
              </div>

              {/* Specimen Quality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qualité du spécimen
                </label>
                <select
                  value={resultForm.specimenQuality}
                  onChange={(e) => setResultForm(f => ({ ...f, specimenQuality: e.target.value }))}
                  className="input"
                >
                  <option value="acceptable">Acceptable</option>
                  <option value="suboptimal">Suboptimal</option>
                  <option value="hemolyzed">Hémolysé</option>
                  <option value="lipemic">Lipémique</option>
                  <option value="icteric">Ictérique</option>
                </select>
              </div>

              {/* Component Results */}
              {resultForm.componentResults.length > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Résultats par test</h3>
                  <div className="space-y-4">
                    {resultForm.componentResults.map((comp, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <p className="font-medium text-gray-900 mb-2">{comp.name}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Valeur</label>
                            <input
                              type="text"
                              value={comp.value}
                              onChange={(e) => updateComponentResult(idx, 'value', e.target.value)}
                              className="input"
                              placeholder="Résultat"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Unité</label>
                            <input
                              type="text"
                              value={comp.unit}
                              onChange={(e) => updateComponentResult(idx, 'unit', e.target.value)}
                              className="input"
                              placeholder="Unité"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Flag</label>
                            <select
                              value={comp.flag}
                              onChange={(e) => updateComponentResult(idx, 'flag', e.target.value)}
                              className="input"
                            >
                              <option value="normal">Normal</option>
                              <option value="low">Bas</option>
                              <option value="high">Élevé</option>
                              <option value="critical-low">Critique Bas</option>
                              <option value="critical-high">Critique Élevé</option>
                            </select>
                          </div>
                        </div>
                        {comp.referenceRange && (
                          <p className="text-sm text-gray-500 mt-2">
                            Ref: {comp.referenceRange}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Résultats
                  </label>
                  <textarea
                    value={resultForm.results}
                    onChange={(e) => setResultForm(f => ({ ...f, results: e.target.value }))}
                    className="input"
                    rows="4"
                    placeholder="Saisir les résultats..."
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes / Commentaires
                </label>
                <textarea
                  value={resultForm.notes}
                  onChange={(e) => setResultForm(f => ({ ...f, notes: e.target.value }))}
                  className="input"
                  rows="2"
                  placeholder="Commentaires techniques..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => { setResultDialog(false); setSelectedTest(null); }}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveResults}
                className="btn btn-success flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Enregistrer & Compléter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectionDialog && rejectionTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="px-6 py-4 border-b bg-red-50">
              <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
                <Ban className="h-6 w-6" />
                Rejeter le Patient
              </h2>
              <p className="text-sm text-red-600 mt-1">
                Une pénalité de 25% sera automatiquement appliquée
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">
                  {rejectionTarget.patient?.firstName} {rejectionTarget.patient?.lastName}
                </p>
                <p className="text-sm text-gray-500">
                  {rejectionTarget.orderNumber || `LAB-${rejectionTarget._id?.slice(-6)}`}
                </p>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motif du rejet *
                </label>
                <select
                  value={rejectionForm.reason}
                  onChange={(e) => setRejectionForm(f => ({ ...f, reason: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un motif...</option>
                  {REJECTION_REASONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Détails supplémentaires
                </label>
                <textarea
                  value={rejectionForm.reasonDetails}
                  onChange={(e) => setRejectionForm(f => ({ ...f, reasonDetails: e.target.value }))}
                  className="input"
                  rows="2"
                  placeholder="Informations complémentaires..."
                />
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Pénalité automatique</p>
                    <p className="text-sm text-yellow-700">
                      25% du montant des analyses sera facturé au patient.
                      Le patient devra se rendre à la réception pour payer la pénalité
                      et reprogrammer ses examens.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setRejectionDialog(false); setRejectionTarget(null); }}
                className="btn btn-secondary"
                disabled={rejecting}
              >
                Annuler
              </button>
              <button
                onClick={handleRejectSpecimen}
                className="btn btn-danger flex items-center gap-2"
                disabled={rejecting || !rejectionForm.reason}
              >
                {rejecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" />
                    Confirmer le Rejet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabTechWorklist;
