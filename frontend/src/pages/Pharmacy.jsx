import { useState } from 'react';
import { Pill, AlertTriangle, Package, TrendingDown, Search, Plus, FileDown } from 'lucide-react';
import { medications } from '../data/mockData';

export default function Pharmacy() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const filteredMeds = medications.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         med.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || med.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const outOfStock = medications.filter(m => m.stock === 0).length;
  const lowStock = medications.filter(m => m.stock > 0 && m.stock < m.minimumStock).length;
  const expiringSoon = medications.filter(m =>
    m.batches?.some(b => b.daysUntilExpiry < 60)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion Pharmacie</h1>
          <p className="mt-1 text-sm text-gray-500">
            Suivi des stocks et gestion des médicaments
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-secondary flex items-center space-x-2">
            <FileDown className="h-5 w-5" />
            <span>Exporter</span>
          </button>
          <button className="btn btn-primary flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Nouveau médicament</span>
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock total</p>
              <p className="text-3xl font-bold text-gray-900">{medications.length}</p>
            </div>
            <Pill className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Rupture de stock</p>
              <p className="text-3xl font-bold text-red-900">{outOfStock}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Stock faible</p>
              <p className="text-3xl font-bold text-orange-900">{lowStock}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-orange-500" />
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Expiration {'<'} 60j</p>
              <p className="text-3xl font-bold text-yellow-900">{expiringSoon}</p>
            </div>
            <Package className="h-10 w-10 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou principe actif..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input w-full md:w-64"
          >
            <option value="all">Toutes les catégories</option>
            <option value="Analgésique">Analgésique</option>
            <option value="Antibiotique">Antibiotique</option>
            <option value="Bronchodilatateur">Bronchodilatateur</option>
            <option value="Hormones thyroïdiennes">Hormones thyroïdiennes</option>
          </select>
        </div>
      </div>

      {/* Medications List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredMeds.map((med) => (
          <div
            key={med.id}
            className={`card ${
              med.outOfStock ? 'bg-gray-50 opacity-75' :
              med.lowStock ? 'border-orange-300 bg-orange-50' :
              med.expiringSoon ? 'border-yellow-300 bg-yellow-50' :
              ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className={`text-lg font-semibold ${med.outOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
                    {med.name}
                  </h3>
                  <span className="badge badge-info">{med.category}</span>
                  {med.prescription && (
                    <span className="badge bg-purple-100 text-purple-800">Sur ordonnance</span>
                  )}
                  {med.outOfStock && (
                    <span className="badge badge-danger">Rupture</span>
                  )}
                  {med.lowStock && !med.outOfStock && (
                    <span className="badge badge-warning">Stock faible</span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Principe actif: {med.activeIngredient}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Stock actuel</p>
                    <p className={`text-2xl font-bold ${
                      med.stock === 0 ? 'text-red-600' :
                      med.stock < med.minimumStock ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {med.stock}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Stock minimum</p>
                    <p className="text-lg font-semibold text-gray-700">{med.minimumStock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Prix unitaire</p>
                    <p className="text-lg font-semibold text-gray-900">${med.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valeur stock</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${(med.stock * med.price).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Batches */}
                {med.batches.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">Lots disponibles:</p>
                    <div className="space-y-2">
                      {med.batches.map((batch, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-gray-900">
                              Lot {batch.batchNumber}
                            </span>
                            <span className="text-sm text-gray-600">
                              Quantité: {batch.quantity}
                            </span>
                            <span className={`text-sm ${
                              batch.daysUntilExpiry < 30 ? 'text-red-600 font-semibold' :
                              batch.daysUntilExpiry < 60 ? 'text-orange-600' :
                              'text-gray-600'
                            }`}>
                              Expire: {batch.expiryDate} ({batch.daysUntilExpiry}j)
                            </span>
                          </div>
                          {batch.daysUntilExpiry < 60 && (
                            <span className={`badge ${
                              batch.daysUntilExpiry < 30 ? 'badge-danger' : 'badge-warning'
                            }`}>
                              {batch.daysUntilExpiry < 30 ? 'Urgent' : 'Bientôt'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-2 ml-4">
                <button className="btn btn-primary text-sm px-4 py-2">
                  Modifier
                </button>
                {med.stock < med.minimumStock && (
                  <button className="btn btn-success text-sm px-4 py-2">
                    Commander
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
