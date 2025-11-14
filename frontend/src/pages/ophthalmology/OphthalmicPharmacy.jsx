import { useState } from 'react';
import { Search, AlertTriangle, Package, Eye, Calendar, Filter } from 'lucide-react';
import { ophthalmicMedications } from '../../data/ophthalmologyData';

export default function OphthalmicPharmacy() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);

  const categories = [
    'all',
    'Prostaglandin Analog',
    'Bêta-bloquant',
    'Corticostéroïde',
    'Antibiotique',
    'Lubrifiant',
    'Mydriatique',
    'Anesthésique',
    'Combinaison Anti-glaucome'
  ];

  // Filter medications
  const filteredMedications = ophthalmicMedications.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          med.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          med.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || med.category === selectedCategory;
    const matchesStock = !showOnlyLowStock || (med.currentStock < med.minStock);

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate days until expiry
  const daysUntilExpiry = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get stock status
  const getStockStatus = (med) => {
    if (med.currentStock === 0) return { status: 'out', label: 'Rupture', color: 'red' };
    if (med.currentStock < med.minStock) return { status: 'low', label: 'Stock Bas', color: 'orange' };
    return { status: 'ok', label: 'En Stock', color: 'green' };
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Eye className="w-6 h-6 mr-3 text-blue-600" />
          Pharmacie Ophtalmologique
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Gestion des médicaments et produits oculaires
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un médicament..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes catégories</option>
            {categories.slice(1).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
              showOnlyLowStock ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Stock Bas
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Médicaments</p>
              <p className="text-2xl font-bold">{ophthalmicMedications.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Stock Total</p>
              <p className="text-2xl font-bold">
                {ophthalmicMedications.reduce((sum, med) => sum + med.currentStock, 0)}
              </p>
            </div>
            <Eye className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Stock Bas</p>
              <p className="text-2xl font-bold text-orange-600">
                {ophthalmicMedications.filter(med => med.currentStock < med.minStock).length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Expire &lt; 30j</p>
              <p className="text-2xl font-bold text-red-600">
                {ophthalmicMedications.filter(med =>
                  med.batches?.some(batch => daysUntilExpiry(batch.expiry) < 30)
                ).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Medication Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMedications.map(med => {
          const stockStatus = getStockStatus(med);
          const nearestExpiry = med.batches?.reduce((nearest, batch) => {
            const days = daysUntilExpiry(batch.expiry);
            return days < nearest ? days : nearest;
          }, Infinity) || Infinity;

          return (
            <div
              key={med.id}
              className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer ${
                stockStatus.status === 'out' ? 'opacity-60' : ''
              }`}
              onClick={() => setSelectedMedication(med)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{med.name}</h3>
                    <p className="text-sm text-gray-500">{med.brand}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${stockStatus.color}-100 text-${stockStatus.color}-700`}>
                    {stockStatus.label}
                  </span>
                </div>

                <div className="mb-3">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {med.category}
                  </span>
                  <span className="inline-block ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {med.form}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stock:</span>
                    <span className="font-medium">
                      {med.currentStock} / {med.minStock} min
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prix:</span>
                    <span className="font-medium">${med.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dosage:</span>
                    <span className="font-medium text-xs">{med.dosage}</span>
                  </div>
                </div>

                {/* Expiry Warning */}
                {nearestExpiry < 60 && (
                  <div className={`mt-3 p-2 rounded text-xs ${
                    nearestExpiry < 30 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Expire dans {nearestExpiry} jours
                  </div>
                )}

                {/* Special Warnings */}
                {med.preservativeFree && (
                  <div className="mt-2 text-xs text-green-600">
                    ✓ Sans conservateur
                  </div>
                )}
                {med.shelfLifeOpened && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                    <AlertTriangle className="w-3 h-3 inline mr-1 text-yellow-600" />
                    Jeter {med.shelfLifeOpened} après ouverture
                  </div>
                )}
                {med.storageTemp && (
                  <div className="mt-2 text-xs text-gray-600">
                    Conservation: {med.storageTemp}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Medication Detail Modal */}
      {selectedMedication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedMedication.name}</h2>
                  <p className="text-gray-500">{selectedMedication.brand}</p>
                </div>
                <button
                  onClick={() => setSelectedMedication(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Catégorie</p>
                  <p className="font-medium">{selectedMedication.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Forme</p>
                  <p className="font-medium">{selectedMedication.form}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Flacon</p>
                  <p className="font-medium">{selectedMedication.bottleSize}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Prix</p>
                  <p className="font-medium">${selectedMedication.price}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Posologie</p>
                <p className="font-medium bg-blue-50 p-2 rounded">{selectedMedication.dosage}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Indication</p>
                <p className="font-medium">{selectedMedication.indication}</p>
              </div>

              {selectedMedication.contraindications?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Contre-indications</p>
                  <div className="bg-red-50 p-3 rounded">
                    {selectedMedication.contraindications.map((ci, idx) => (
                      <div key={idx} className="text-red-700 text-sm">
                        • {ci}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMedication.warnings?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Précautions</p>
                  <div className="bg-yellow-50 p-3 rounded">
                    {selectedMedication.warnings.map((warning, idx) => (
                      <div key={idx} className="text-yellow-700 text-sm">
                        • {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Information */}
              {selectedMedication.batches?.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Lots en Stock</p>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Lot</th>
                        <th className="px-3 py-2 text-center">Quantité</th>
                        <th className="px-3 py-2 text-center">Expiration</th>
                        <th className="px-3 py-2 text-center">Jours Restants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMedication.batches.map(batch => {
                        const days = daysUntilExpiry(batch.expiry);
                        return (
                          <tr key={batch.lot} className="border-b">
                            <td className="px-3 py-2">{batch.lot}</td>
                            <td className="px-3 py-2 text-center">{batch.quantity}</td>
                            <td className="px-3 py-2 text-center">
                              {new Date(batch.expiry).toLocaleDateString('fr-FR')}
                            </td>
                            <td className={`px-3 py-2 text-center font-medium ${
                              days < 30 ? 'text-red-600' :
                              days < 60 ? 'text-orange-600' :
                              'text-green-600'
                            }`}>
                              {days} jours
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Prescrire
                </button>
                <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Commander
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}