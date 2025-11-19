import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/apiConfig';
import {
  ArrowLeft,
  Plus,
  Hospital,
  Beaker,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Printer,
  X
} from 'lucide-react';

const PharmacyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [medication, setMedication] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [batchDialog, setBatchDialog] = useState(false);
  const [dispenseDialog, setDispenseDialog] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [batchData, setBatchData] = useState({
    lotNumber: '',
    batchNumber: '',
    quantity: 0,
    manufactureDate: '',
    expirationDate: '',
    supplier: {
      name: '',
      contact: '',
      reference: ''
    },
    cost: {
      unitCost: 0,
      totalCost: 0
    }
  });

  const [dispenseData, setDispenseData] = useState({
    patient: '',
    quantity: 1,
    lotNumber: '',
    notes: ''
  });

  useEffect(() => {
    fetchMedication();
    fetchPatients();
  }, [id]);

  const fetchMedication = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/pharmacy/inventory/${id}`);
      setMedication(response.data);
      setLoading(false);
    } catch (err) {
      setError('Erreur lors du chargement du médicament');
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients', { params: { limit: 100 } });
      setPatients(response.data.data || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const handleAddBatch = async () => {
    try {
      await api.post(`/api/pharmacy/inventory/${id}/batch`, batchData);
      setBatchDialog(false);
      fetchMedication();
      setBatchData({
        lotNumber: '',
        batchNumber: '',
        quantity: 0,
        manufactureDate: '',
        expirationDate: '',
        supplier: { name: '', contact: '', reference: '' },
        cost: { unitCost: 0, totalCost: 0 }
      });
    } catch (err) {
      setError('Erreur lors de l\'ajout du lot');
    }
  };

  const handleDispense = async () => {
    try {
      await api.post(`/api/pharmacy/inventory/${id}/dispense`, {
        ...dispenseData,
        patient: selectedPatient?._id
      });
      setDispenseDialog(false);
      fetchMedication();
      setDispenseData({ patient: '', quantity: 1, lotNumber: '', notes: '' });
      setSelectedPatient(null);
    } catch (err) {
      setError('Erreur lors de la distribution');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'in-stock': 'badge-success',
      'low-stock': 'badge-warning',
      'out-of-stock': 'badge-danger',
      'overstocked': 'badge-info'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'in-stock': 'En stock',
      'low-stock': 'Stock faible',
      'out-of-stock': 'Rupture',
      'overstocked': 'Surstock'
    };
    return labels[status] || status;
  };

  const getDaysToExpiry = (expirationDate) => {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diff = expiry - now;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Medication Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
          <Hospital className="h-5 w-5 mr-2" />
          Informations sur le médicament
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Nom générique</p>
            <p className="text-lg font-semibold text-gray-900">{medication.medication?.genericName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Nom de marque</p>
            <p className="text-base text-gray-900">{medication.medication?.brandName || 'N/A'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Formulation</p>
              <p className="text-base text-gray-900">{medication.medication?.formulation}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Voie</p>
              <p className="text-base text-gray-900">{medication.medication?.route}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Dosage</p>
              <p className="text-base text-gray-900">{medication.medication?.strength || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Catégorie</p>
              <span className="badge badge-info">{medication.category}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center mb-4">
          <Beaker className="h-5 w-5 mr-2" />
          Informations sur le stock
        </h3>
        <hr className="mb-4 border-gray-200" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Stock actuel</p>
              <p className={`text-4xl font-bold mt-2 ${
                medication.inventory?.currentStock === 0 ? 'text-red-600' :
                medication.inventory?.currentStock <= medication.inventory?.minimumStock ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {medication.inventory?.currentStock || 0}
              </p>
              <p className="text-xs text-gray-500">{medication.inventory?.unit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Statut</p>
              <span className={`badge ${getStatusColor(medication.inventory?.status)} mt-2 inline-block`}>
                {getStatusLabel(medication.inventory?.status)}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Seuil minimum</p>
              <p className="text-lg font-semibold text-gray-900">{medication.inventory?.minimumStock}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Point de commande</p>
              <p className="text-lg font-semibold text-gray-900">{medication.inventory?.reorderPoint}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Stock maximum</p>
              <p className="text-lg font-semibold text-gray-900">{medication.inventory?.maximumStock || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Information */}
      {medication.storage && (
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">
            Conditions de stockage
          </h3>
          <hr className="mb-4 border-gray-200" />
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Température</p>
              <p className="text-base text-gray-900">
                {medication.storage.temperature} ({medication.storage.temperatureRange || 'N/A'})
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Protection lumière</p>
                <span className={`badge ${medication.storage.lightProtection ? 'badge-warning' : 'bg-gray-100 text-gray-800'}`}>
                  {medication.storage.lightProtection ? 'Oui' : 'Non'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Durée de conservation</p>
                <p className="text-base text-gray-900">{medication.storage.shelfLife || 'N/A'}</p>
              </div>
            </div>
            {medication.storage.specialInstructions && (
              <div>
                <p className="text-sm text-gray-500">Instructions spéciales</p>
                <p className="text-base text-gray-900">{medication.storage.specialInstructions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Information */}
      {medication.pricing && (
        <div className="card">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">
            Informations tarifaires
          </h3>
          <hr className="mb-4 border-gray-200" />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Prix d'achat</p>
                <p className="text-lg font-semibold text-gray-900">
                  {medication.pricing.costPrice
                    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
                        .format(medication.pricing.costPrice)
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Prix de vente</p>
                <p className="text-lg font-semibold text-gray-900">
                  {medication.pricing.sellingPrice
                    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
                        .format(medication.pricing.sellingPrice)
                    : 'N/A'}
                </p>
              </div>
            </div>
            {medication.pricing.margin && (
              <div>
                <p className="text-sm text-gray-500">Marge</p>
                <p className="text-base text-gray-900">{medication.pricing.margin}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      {medication.location && (
        <div className="card col-span-full">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">
            Emplacement
          </h3>
          <hr className="mb-4 border-gray-200" />
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Pharmacie</p>
              <p className="text-base text-gray-900">{medication.location.pharmacy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Section</p>
              <p className="text-base text-gray-900">{medication.location.section || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Étagère</p>
              <p className="text-base text-gray-900">{medication.location.shelf || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Bac</p>
              <p className="text-base text-gray-900">{medication.location.bin || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderBatches = () => (
    <div className="card p-0">
      <div className="p-6 flex justify-between items-center border-b border-gray-200">
        <h3 className="text-lg font-semibold text-primary-600">
          Lots en stock
        </h3>
        <button
          onClick={() => setBatchDialog(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Ajouter un lot</span>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro de lot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date de fabrication</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date d'expiration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jours restants</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coût unitaire</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {medication.batches && medication.batches.length > 0 ? (
              medication.batches.map((batch) => {
                const daysToExpiry = getDaysToExpiry(batch.expirationDate);
                return (
                  <tr
                    key={batch._id}
                    className={
                      batch.status === 'expired' ? 'bg-red-50' :
                      daysToExpiry <= 30 ? 'bg-orange-50' :
                      ''
                    }
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{batch.lotNumber}</p>
                      {batch.batchNumber && (
                        <p className="text-xs text-gray-500">Batch: {batch.batchNumber}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{batch.quantity}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {batch.manufactureDate
                        ? new Date(batch.manufactureDate).toLocaleDateString('fr-FR')
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm ${
                        daysToExpiry <= 30 ? 'text-red-600 font-semibold' :
                        daysToExpiry <= 90 ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {new Date(batch.expirationDate).toLocaleDateString('fr-FR')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm ${
                        daysToExpiry <= 0 ? 'text-red-600 font-semibold' :
                        daysToExpiry <= 30 ? 'text-yellow-600' :
                        'text-gray-900'
                      }`}>
                        {daysToExpiry} jours
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{batch.supplier?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {batch.cost?.unitCost
                        ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
                            .format(batch.cost.unitCost)
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${batch.status === 'active' ? 'badge-success' : 'bg-gray-100 text-gray-800'}`}>
                        {batch.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  Aucun lot en stock
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="card p-0">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-primary-600 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Historique des transactions
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effectué par</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde avant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde après</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {medication.transactions && medication.transactions.length > 0 ? (
              medication.transactions.slice(0, 20).map((transaction, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge bg-gray-100 text-gray-800">{transaction.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${
                      ['received', 'returned'].includes(transaction.type) ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {['received', 'returned'].includes(transaction.type) ? '+' : '-'}
                      {transaction.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{transaction.lotNumber || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {transaction.performedBy?.firstName || 'N/A'} {transaction.performedBy?.lastName || ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{transaction.balanceBefore}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{transaction.balanceAfter}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{transaction.notes || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  Aucune transaction enregistrée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !medication) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Médicament non trouvé'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/pharmacy')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {medication.medication?.genericName}
            </h1>
            <p className="text-sm text-gray-500">
              {medication.medication?.brandName || 'Nom de marque non spécifié'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDispenseDialog(true)}
            disabled={medication.inventory?.currentStock === 0}
            className="btn btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Hospital className="h-5 w-5" />
            <span>Distribuer</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Printer className="h-5 w-5" />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {medication.alerts && medication.alerts.filter(a => !a.resolved).length > 0 && (
        <div className="space-y-2">
          {medication.alerts.filter(a => !a.resolved).map((alert, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 p-4 rounded-lg border ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                alert.severity === 'warning' ? 'bg-orange-50 border-orange-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
                alert.severity === 'critical' ? 'text-red-600' :
                alert.severity === 'warning' ? 'text-orange-600' :
                'text-blue-600'
              }`} />
              <p className={`text-sm ${
                alert.severity === 'critical' ? 'text-red-800' :
                alert.severity === 'warning' ? 'text-orange-800' :
                'text-blue-800'
              }`}>
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="card p-0">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setTabValue(0)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 0
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => setTabValue(1)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 1
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Lots
            </button>
            <button
              onClick={() => setTabValue(2)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                tabValue === 2
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Transactions
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {tabValue === 0 && renderOverview()}
      {tabValue === 1 && renderBatches()}
      {tabValue === 2 && renderTransactions()}

      {/* Add Batch Dialog */}
      {batchDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Ajouter un nouveau lot</h2>
              <button
                onClick={() => setBatchDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot *</label>
                  <input
                    type="text"
                    className="input"
                    value={batchData.lotNumber}
                    onChange={(e) => setBatchData({ ...batchData, lotNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de batch</label>
                  <input
                    type="text"
                    className="input"
                    value={batchData.batchNumber}
                    onChange={(e) => setBatchData({ ...batchData, batchNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                  <input
                    type="number"
                    className="input"
                    value={batchData.quantity}
                    onChange={(e) => setBatchData({ ...batchData, quantity: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fabrication</label>
                  <input
                    type="date"
                    className="input"
                    value={batchData.manufactureDate}
                    onChange={(e) => setBatchData({ ...batchData, manufactureDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration *</label>
                  <input
                    type="date"
                    className="input"
                    value={batchData.expirationDate}
                    onChange={(e) => setBatchData({ ...batchData, expirationDate: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                  <input
                    type="text"
                    className="input"
                    value={batchData.supplier.name}
                    onChange={(e) => setBatchData({
                      ...batchData,
                      supplier: { ...batchData.supplier, name: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coût unitaire (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={batchData.cost.unitCost}
                    onChange={(e) => {
                      const unitCost = parseFloat(e.target.value) || 0;
                      setBatchData({
                        ...batchData,
                        cost: {
                          unitCost,
                          totalCost: unitCost * batchData.quantity
                        }
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coût total (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={batchData.cost.totalCost}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setBatchDialog(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleAddBatch}
                className="btn btn-primary"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Dialog */}
      {dispenseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">Distribuer le médicament</h2>
              <button
                onClick={() => setDispenseDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  className="input"
                  value={selectedPatient?._id || ''}
                  onChange={(e) => {
                    const patient = patients.find(p => p._id === e.target.value);
                    setSelectedPatient(patient);
                  }}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                <input
                  type="number"
                  className="input"
                  value={dispenseData.quantity}
                  onChange={(e) => setDispenseData({ ...dispenseData, quantity: parseInt(e.target.value) || 1 })}
                  min="1"
                  max={medication.inventory?.currentStock}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de lot (optionnel)</label>
                <select
                  className="input"
                  value={dispenseData.lotNumber}
                  onChange={(e) => setDispenseData({ ...dispenseData, lotNumber: e.target.value })}
                >
                  <option value="">Auto (FIFO)</option>
                  {medication.batches
                    ?.filter(b => b.status === 'active' && b.quantity > 0)
                    .map(batch => (
                      <option key={batch.lotNumber} value={batch.lotNumber}>
                        {batch.lotNumber} - {batch.quantity} unités disponibles
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="input"
                  rows="3"
                  value={dispenseData.notes}
                  onChange={(e) => setDispenseData({ ...dispenseData, notes: e.target.value })}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
                Stock actuel: {medication.inventory?.currentStock} {medication.inventory?.unit}
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setDispenseDialog(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleDispense}
                className="btn btn-primary"
                disabled={!selectedPatient || dispenseData.quantity <= 0}
              >
                Distribuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyDetail;
