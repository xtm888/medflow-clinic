import { useState } from 'react';
import { Stethoscope, Plus, Search, Edit2, Trash2, DollarSign, Clock, Tag } from 'lucide-react';
import { services } from '../data/mockData';

export default function Services() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [serviceForm, setServiceForm] = useState({
    name: '',
    category: 'Consultation',
    price: '',
    duration: '',
    department: '',
    description: '',
    code: ''
  });

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate stats
  const totalServices = services.length;
  const avgPrice = (services.reduce((sum, s) => sum + s.price, 0) / services.length).toFixed(2);
  const categories = [...new Set(services.map(s => s.category))].length;
  const totalRevenuePotential = services.reduce((sum, s) => sum + s.price, 0).toFixed(2);

  const openNewServiceModal = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      category: 'Consultation',
      price: '',
      duration: '',
      department: '',
      description: '',
      code: ''
    });
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString(),
      department: service.department,
      description: service.description || '',
      code: service.code || ''
    });
    setShowServiceModal(true);
  };

  const handleSaveService = () => {
    // This would send to backend
    console.log(editingService ? 'Updating service:' : 'Creating service:', serviceForm);
    setShowServiceModal(false);
  };

  const handleDeleteService = (serviceId) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) {
      console.log('Deleting service:', serviceId);
      // This would send to backend
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Consultation': 'bg-blue-100 text-blue-800',
      'Imagerie': 'bg-purple-100 text-purple-800',
      'Laboratoire': 'bg-green-100 text-green-800',
      'Procédure': 'bg-orange-100 text-orange-800',
      'Urgence': 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services & Tarifs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestion du catalogue de services médicaux et tarification
          </p>
        </div>
        <button
          onClick={openNewServiceModal}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau service</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <p className="text-3xl font-bold">${avgPrice}</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Catégories</p>
              <p className="text-3xl font-bold">{categories}</p>
            </div>
            <Tag className="h-10 w-10 text-purple-200" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">Revenu potentiel</p>
              <p className="text-2xl font-bold">${totalRevenuePotential}</p>
            </div>
            <DollarSign className="h-10 w-10 text-orange-200" />
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
              placeholder="Rechercher un service..."
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
            <option value="Consultation">Consultation</option>
            <option value="Imagerie">Imagerie</option>
            <option value="Laboratoire">Laboratoire</option>
            <option value="Procédure">Procédure</option>
            <option value="Urgence">Urgence</option>
          </select>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredServices.map((service) => (
          <div key={service.id} className="card hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
                  <span className={`badge ${getCategoryColor(service.category)}`}>
                    {service.category}
                  </span>
                </div>
                {service.description && (
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                )}
              </div>

              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => openEditServiceModal(service)}
                  className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded transition"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-200">
              <div>
                <div className="flex items-center space-x-2 text-gray-500 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <p className="text-xs">Prix</p>
                </div>
                <p className="text-2xl font-bold text-green-600">${service.price.toFixed(2)}</p>
              </div>

              <div>
                <div className="flex items-center space-x-2 text-gray-500 mb-1">
                  <Clock className="h-4 w-4" />
                  <p className="text-xs">Durée</p>
                </div>
                <p className="text-lg font-semibold text-gray-900">{service.duration} min</p>
              </div>

              <div>
                <div className="flex items-center space-x-2 text-gray-500 mb-1">
                  <Stethoscope className="h-4 w-4" />
                  <p className="text-xs">Département</p>
                </div>
                <p className="text-sm font-medium text-gray-700 truncate">{service.department}</p>
              </div>
            </div>

            {service.code && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Code: <span className="font-mono font-semibold text-gray-700">{service.code}</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="card text-center py-12">
          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Aucun service trouvé</p>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingService ? 'Modifier le service' : 'Nouveau service'}
              </h2>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du service *
                  </label>
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                    className="input"
                    placeholder="Ex: Consultation générale"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catégorie *
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({...serviceForm, category: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Imagerie">Imagerie</option>
                    <option value="Laboratoire">Laboratoire</option>
                    <option value="Procédure">Procédure</option>
                    <option value="Urgence">Urgence</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code (optionnel)
                  </label>
                  <input
                    type="text"
                    value={serviceForm.code}
                    onChange={(e) => setServiceForm({...serviceForm, code: e.target.value})}
                    className="input"
                    placeholder="Ex: CONS-GEN-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({...serviceForm, price: e.target.value})}
                    className="input"
                    placeholder="50.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durée (minutes) *
                  </label>
                  <input
                    type="number"
                    value={serviceForm.duration}
                    onChange={(e) => setServiceForm({...serviceForm, duration: e.target.value})}
                    className="input"
                    placeholder="30"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Département *
                  </label>
                  <input
                    type="text"
                    value={serviceForm.department}
                    onChange={(e) => setServiceForm({...serviceForm, department: e.target.value})}
                    className="input"
                    placeholder="Ex: Médecine Générale"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optionnel)
                  </label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                    className="input"
                    rows="3"
                    placeholder="Description détaillée du service..."
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowServiceModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveService}
                className="btn btn-primary"
              >
                {editingService ? 'Mettre à jour' : 'Créer le service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
