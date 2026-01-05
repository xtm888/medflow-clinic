import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, Search, DollarSign, Clock, Tag,
  Loader2, AlertCircle, Settings, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import feeScheduleService from '../services/feeScheduleService';

/**
 * Services - Read-only catalog of medical services and pricing
 *
 * This page displays all available services for staff reference.
 * Admins can navigate to Settings > Tarifs for price management.
 */
export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Check if user can manage tarifs (admin, manager, accountant)
  const canManageTarifs = user?.role && ['admin', 'manager', 'accountant'].includes(user.role);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use feeScheduleService for consistency with TarifManagement
      // Use all=true to bypass pagination limit (frontend handles filtering)
      const data = await feeScheduleService.getFeeSchedules({ active: true, all: true });

      // Category mapping for display
      const categoryMap = {
        'consultation': 'Consultation',
        'examination': 'Examen',
        'procedure': 'Procédure',
        'imaging': 'Imagerie',
        'laboratory': 'Laboratoire',
        'therapy': 'Thérapie',
        'surgery': 'Chirurgie',
        'medication': 'Médicament',
        'optical': 'Optique',
        'device': 'Dispositif',
        'other': 'Autre'
      };

      // Transform to display format
      const serviceList = (Array.isArray(data) ? data : []).map(item => ({
        id: item._id || item.id,
        name: item.name || item.description || 'Service',
        category: item.displayCategory || categoryMap[item.category?.toLowerCase()] || item.category || 'Autre',
        price: item.price || item.fee || item.basePrice || 0,
        currency: item.currency || 'CDF',
        duration: item.duration || item.estimatedDuration || null,
        department: item.department || item.specialty || '',
        description: item.description || item.notes || '',
        code: item.code || item.procedureCode || '',
        taxable: item.taxable,
        insuranceClaimable: item.insuranceClaimable
      }));

      setServices(serviceList);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Erreur lors du chargement des services');
    } finally {
      setLoading(false);
    }
  };

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter dropdown
  const uniqueCategories = [...new Set(services.map(s => s.category))].sort();

  // Calculate stats
  const totalServices = services.length;
  const avgPrice = services.length > 0
    ? Math.round(services.reduce((sum, s) => sum + s.price, 0) / services.length)
    : 0;
  const categoriesCount = uniqueCategories.length;

  const getCategoryColor = (category) => {
    const colors = {
      'Consultation': 'bg-blue-100 text-blue-800',
      'Examen': 'bg-indigo-100 text-indigo-800',
      'Imagerie': 'bg-purple-100 text-purple-800',
      'Laboratoire': 'bg-green-100 text-green-800',
      'Procédure': 'bg-orange-100 text-orange-800',
      'Chirurgie': 'bg-red-100 text-red-800',
      'Thérapie': 'bg-teal-100 text-teal-800',
      'Médicament': 'bg-yellow-100 text-yellow-800',
      'Optique': 'bg-pink-100 text-pink-800',
      'Dispositif': 'bg-cyan-100 text-cyan-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatPrice = (price, currency = 'CDF') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price) + ' ' + currency;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Chargement des services...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catalogue des Services</h1>
          <p className="mt-1 text-sm text-gray-500">
            Consultez les services médicaux disponibles et leurs tarifs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchServices}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Actualiser"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          {/* Admin link to Tarif Management */}
          {canManageTarifs && (
            <Link
              to="/settings"
              state={{ section: 'tarifs' }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Gérer les tarifs</span>
            </Link>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center text-red-700">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
          <button
            onClick={fetchServices}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Total Services</p>
              <p className="text-3xl font-bold">{totalServices}</p>
            </div>
            <Stethoscope className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100">Prix moyen</p>
              <p className="text-3xl font-bold">{formatPrice(avgPrice)}</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Catégories</p>
              <p className="text-3xl font-bold">{categoriesCount}</p>
            </div>
            <Tag className="h-10 w-10 text-purple-200" />
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
              placeholder="Rechercher par nom, code ou département..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
          >
            <option value="all">Toutes les catégories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="text-sm text-gray-500 whitespace-nowrap">
            {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <div className="card text-center py-12">
          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">Aucun service trouvé</p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-primary-600 hover:text-primary-700 text-sm"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="card hover:shadow-lg transition-shadow border border-gray-200"
            >
              {/* Header */}
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
                    {service.name}
                  </h3>
                  <span className={`badge ${getCategoryColor(service.category)} flex-shrink-0`}>
                    {service.category}
                  </span>
                </div>
                {service.code && (
                  <p className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block">
                    {service.code}
                  </p>
                )}
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Price - Main highlight */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-700 font-medium">Prix</span>
                  <span className="text-xl font-bold text-green-700">
                    {formatPrice(service.price, service.currency)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {service.duration && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{service.duration} min</span>
                  </div>
                )}
                {service.department && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Stethoscope className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{service.department}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                {service.insuranceClaimable && (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                    Remboursable
                  </span>
                )}
                {service.taxable && (
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                    Taxable
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin notice for non-admins */}
      {!canManageTarifs && services.length > 0 && (
        <div className="text-center text-sm text-gray-500 py-4">
          <p>
            Pour modifier les tarifs, contactez un administrateur ou accédez aux
            <span className="font-medium"> Paramètres &gt; Tarifs</span>
          </p>
        </div>
      )}
    </div>
  );
}
