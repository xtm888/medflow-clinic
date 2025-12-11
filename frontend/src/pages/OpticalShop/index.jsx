import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Glasses, Search, ClipboardCheck, Truck, TrendingUp,
  Plus, Clock, DollarSign, AlertCircle, CheckCircle,
  Users, Eye, Package, ArrowRight, RefreshCw, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import opticalShopService from '../../services/opticalShopService';
import { useAuth } from '../../contexts/AuthContext';

const OpticalShopDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const isTechnician = user?.role === 'technician' || user?.role === 'admin';
  const isOptician = user?.role === 'optician' || user?.role === 'receptionist' || user?.role === 'admin' || user?.role === 'ophthalmologist' || user?.role === 'manager';
  const searchContainerRef = useRef(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search as user types with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is too short, clear results
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        setShowResults(true);
        const response = await opticalShopService.searchPatients(searchQuery.trim());
        if (response.success) {
          setSearchResults(response.data || []);
        }
      } catch (error) {
        console.error('Error searching patients:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await opticalShopService.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(`/optical-shop/sale/${patient._id}`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: 'CDF',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
            <Glasses className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Boutique Optique</h1>
            <p className="text-gray-500">Vente de lunettes et verres correcteurs</p>
          </div>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Mes ventes aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.myStats?.todaySales || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {formatCurrency(stats?.myStats?.todayRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En attente verification</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats?.pendingVerification || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            A verifier par technicien
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Commandes externes</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats?.pendingExternalOrders || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            En attente de livraison
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Temps moyen</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.myStats?.avgDuration || 0} min
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Par consultation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Patient Search & New Sale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Search */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Nouvelle Vente
            </h2>

            {/* Live Search Input */}
            <div className="relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  placeholder="Tapez pour rechercher un patient (nom, telephone, dossier)..."
                  className="w-full pl-12 pr-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                )}
                {searching && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Live Search Results Dropdown */}
              {showResults && searchQuery.length >= 2 && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                  {searching ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Recherche en cours...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y">
                      {searchResults.map((patient) => (
                        <div
                          key={patient._id}
                          className="p-4 hover:bg-purple-50 cursor-pointer flex items-center justify-between transition-colors"
                          onClick={() => handleSelectPatient(patient)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">
                                {patient.firstName} {patient.lastName}
                              </p>
                              {patient.hasConvention && (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                  {patient.conventionCode || patient.conventionName}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              Dossier: {patient.fileNumber} | Tel: {patient.phone || 'N/A'}
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 text-purple-400 flex-shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Aucun patient trouve pour "{searchQuery}"</p>
                      <p className="text-sm text-gray-400 mt-1">Verifiez l'orthographe ou essayez un autre terme</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hint text */}
            <p className="text-sm text-gray-400 mt-2">
              Commencez a taper pour rechercher automatiquement
            </p>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Mes Commandes Recentes
            </h2>

            {stats?.recentOrders?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <div
                    key={order._id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigate(`/glasses-orders/${order._id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Glasses className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {order.patient?.firstName} {order.patient?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.orderNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(order.pricing?.finalTotal)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'pending_verification' ? 'bg-orange-100 text-orange-700' :
                        order.status === 'verified' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status === 'draft' ? 'Brouillon' :
                         order.status === 'pending_verification' ? 'En verification' :
                         order.status === 'verified' ? 'Verifie' :
                         order.status === 'confirmed' ? 'Confirme' :
                         order.status === 'delivered' ? 'Livre' :
                         order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Aucune commande recente
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Verification Queue */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Actions Rapides
            </h2>

            <div className="space-y-3">
              {isTechnician && (
                <button
                  onClick={() => navigate('/optical-shop/verification')}
                  className="w-full flex items-center gap-3 p-4 text-left bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <ClipboardCheck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Verification</p>
                    <p className="text-sm text-gray-500">
                      {stats?.pendingVerification || 0} en attente
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </button>
              )}

              <button
                onClick={() => navigate('/optical-shop/external-orders')}
                className="w-full flex items-center gap-3 p-4 text-left bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Truck className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Commandes Externes</p>
                  <p className="text-sm text-gray-500">
                    {stats?.pendingExternalOrders || 0} en cours
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/optical-shop/performance')}
                className="w-full flex items-center gap-3 p-4 text-left bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Performance</p>
                  <p className="text-sm text-gray-500">
                    Statistiques des opticiens
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </button>

              <button
                onClick={() => navigate('/glasses-orders')}
                className="w-full flex items-center gap-3 p-4 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Glasses className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Toutes les commandes</p>
                  <p className="text-sm text-gray-500">
                    Historique complet
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Verification Queue Preview (for technicians) */}
          {isTechnician && stats?.verificationQueue?.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  A Verifier
                </h2>
                <button
                  onClick={() => navigate('/optical-shop/verification')}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  Voir tout
                </button>
              </div>

              <div className="space-y-3">
                {stats.verificationQueue.slice(0, 3).map((order) => (
                  <div
                    key={order._id}
                    className="p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100"
                    onClick={() => navigate(`/optical-shop/verification/${order._id}`)}
                  >
                    <p className="font-medium text-gray-900">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Par: {order.opticalShop?.optician?.firstName} {order.opticalShop?.optician?.lastName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpticalShopDashboard;
