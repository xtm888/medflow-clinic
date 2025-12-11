import React, { useState, useEffect } from 'react';
import {
  X, Download, Check, AlertCircle, Database, Users, Calendar,
  Package, Eye, Glasses, Beaker, FileText, Building, Clock,
  CheckCircle, XCircle, Loader
} from 'lucide-react';
import { useClinic } from '../contexts/ClinicContext';
import patientService from '../services/patientService';
import visitService from '../services/visitService';
import databaseService from '../services/database';
import { frameInventoryService, contactLensInventoryService } from '../services/inventory/index';
import pharmacyInventoryService from '../services/pharmacyInventoryService';
import orthopticService from '../services/orthopticService';
import glassesOrderService from '../services/glassesOrderService';
import treatmentProtocolService from '../services/treatmentProtocolService';
import labQCService from '../services/labQCService';
import { preCachePatientApprovals } from '../services/approvalService';
import stockReconciliationService from '../services/stockReconciliationService';
import clinicSyncService from '../services/clinicSyncService';
// Phase 3.2: Additional services
import surgeryService from '../services/surgeryService';
import ivtVialService from '../services/ivtVialService';
import labOrderService from '../services/labOrderService';

/**
 * Enhanced Prepare for Offline Modal
 * Pre-caches data for all offline-capable services
 */
export default function PrepareOfflineModal({ isOpen, onClose }) {
  const { selectedClinic, selectedClinicId, selectedClinicName } = useClinic();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [storageStats, setStorageStats] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState(['essential']);

  // Load storage stats on open
  useEffect(() => {
    if (isOpen && selectedClinicId) {
      loadStorageStats();
    }
  }, [isOpen, selectedClinicId]);

  const loadStorageStats = async () => {
    try {
      const stats = await clinicSyncService.getClinicStorageStats(selectedClinicId);
      setStorageStats(stats);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    }
  };

  if (!isOpen) return null;

  // Cache categories with role-based options
  const cacheCategories = [
    {
      id: 'essential',
      label: 'Essentiel',
      description: 'Patients et visites du jour',
      icon: Users,
      options: [
        {
          id: 'patients',
          label: 'Patients récents',
          description: 'Les 100 derniers patients',
          icon: Users,
          action: () => patientService.preCachePatients({ limit: 100 })
        },
        {
          id: 'visits',
          label: "Visites d'aujourd'hui",
          description: 'Toutes les visites du jour',
          icon: Calendar,
          action: () => visitService.preCacheTodaysVisits()
        }
      ]
    },
    {
      id: 'clinical',
      label: 'Clinique',
      description: 'Protocoles et examens',
      icon: FileText,
      options: [
        {
          id: 'protocols',
          label: 'Protocoles de traitement',
          description: 'Protocoles populaires et favoris',
          icon: FileText,
          action: () => treatmentProtocolService.preCacheForShift()
        },
        {
          id: 'orthoptic',
          label: 'Examens orthoptiques',
          description: 'Données orthoptiques récentes',
          icon: Eye,
          action: () => orthopticService.preCachePatientData(selectedClinicId)
        },
        {
          id: 'approvals',
          label: 'Approbations',
          description: 'Approbations en attente',
          icon: CheckCircle,
          action: () => preCachePatientApprovals(selectedClinicId)
        }
      ]
    },
    {
      id: 'optical',
      label: 'Optique',
      description: 'Inventaire lunettes et lentilles',
      icon: Glasses,
      options: [
        {
          id: 'frames',
          label: 'Montures',
          description: 'Inventaire des montures',
          icon: Glasses,
          action: () => frameInventoryService.preCacheForShift(selectedClinicId)
        },
        {
          id: 'contactLenses',
          label: 'Lentilles de contact',
          description: 'Inventaire des lentilles',
          icon: Eye,
          action: () => contactLensInventoryService.preCacheForShift(selectedClinicId)
        },
        {
          id: 'glassesOrders',
          label: 'Commandes de lunettes',
          description: 'Commandes en cours',
          icon: Package,
          action: () => glassesOrderService.preCacheForShift()
        }
      ]
    },
    {
      id: 'pharmacy',
      label: 'Pharmacie',
      description: 'Inventaire médicaments',
      icon: Package,
      options: [
        {
          id: 'pharmacy',
          label: 'Inventaire pharmacie',
          description: 'Médicaments et stock',
          icon: Package,
          action: () => pharmacyInventoryService.preCacheForShift()
        },
        {
          id: 'reconciliation',
          label: 'Réconciliations',
          description: 'Réconciliations en cours',
          icon: CheckCircle,
          action: () => stockReconciliationService.preCacheActiveReconciliations()
        }
      ]
    },
    {
      id: 'laboratory',
      label: 'Laboratoire',
      description: 'QC et résultats',
      icon: Beaker,
      options: [
        {
          id: 'labQC',
          label: 'Contrôle qualité',
          description: 'Règles et échecs QC',
          icon: Beaker,
          action: () => labQCService.preCacheForShift()
        },
        {
          id: 'labOrders',
          label: 'Commandes labo',
          description: 'Commandes en attente et du jour',
          icon: FileText,
          action: () => labOrderService.preCacheForShift()
        }
      ]
    },
    {
      id: 'surgery',
      label: 'Chirurgie',
      description: 'Bloc opératoire et IVT',
      icon: Eye,
      options: [
        {
          id: 'surgeries',
          label: 'Chirurgies du jour',
          description: 'Cas programmés et en attente',
          icon: Calendar,
          action: () => surgeryService.preCacheForShift()
        },
        {
          id: 'ivtVials',
          label: 'Flacons IVT',
          description: 'Flacons actifs et disponibles',
          icon: Beaker,
          action: () => ivtVialService.preCacheForShift()
        }
      ]
    }
  ];

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleStartCache = async () => {
    if (!navigator.onLine) {
      setError('Vous devez être en ligne pour préparer les données hors ligne.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress({});
    setResults(null);

    const newResults = {};
    const selectedOptions = cacheCategories
      .filter(cat => selectedCategories.includes(cat.id))
      .flatMap(cat => cat.options);

    // Set active clinic for sync
    if (selectedClinicId) {
      clinicSyncService.setActiveClinic(selectedClinicId);
    }

    for (const option of selectedOptions) {
      setProgress(prev => ({ ...prev, [option.id]: 'loading' }));

      try {
        const result = await option.action();
        newResults[option.id] = {
          success: true,
          cached: result?.cached || result?.length || 0,
          details: result
        };
        setProgress(prev => ({ ...prev, [option.id]: 'done' }));
      } catch (err) {
        console.error(`Cache failed for ${option.id}:`, err);
        newResults[option.id] = {
          success: false,
          cached: 0,
          error: err.message
        };
        setProgress(prev => ({ ...prev, [option.id]: 'error' }));
      }
    }

    // Get final stats
    try {
      const stats = await databaseService.getStats();
      newResults.stats = stats;
      await loadStorageStats();
    } catch (err) {
      console.error('Failed to get stats:', err);
    }

    // Update last sync time
    if (selectedClinicId) {
      clinicSyncService.setLastSyncTime(selectedClinicId);
    }

    setResults(newResults);
    setIsLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'loading':
        return <Loader className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const totalCached = results
    ? Object.values(results)
        .filter(r => r && typeof r === 'object' && 'cached' in r)
        .reduce((sum, r) => sum + (r.cached || 0), 0)
    : 0;

  const successCount = results
    ? Object.values(results).filter(r => r?.success).length
    : 0;

  const errorCount = results
    ? Object.values(results).filter(r => r && !r.success && r.error).length
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">Préparer le mode hors ligne</h2>
              {selectedClinicName && (
                <p className="text-blue-100 text-sm flex items-center">
                  <Building className="h-4 w-4 mr-1" />
                  {selectedClinicName}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-grow">
          <p className="text-gray-600 mb-4">
            Téléchargez les données nécessaires pour travailler sans connexion internet.
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Storage Stats */}
          {storageStats && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Données en cache:</span>
                <span className="font-medium text-gray-900">{storageStats.totalRecords} éléments</span>
              </div>
            </div>
          )}

          {/* Category Selection */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Sélectionnez les catégories à télécharger:</p>
            <div className="flex flex-wrap gap-2">
              {cacheCategories.map(cat => {
                const Icon = cat.icon;
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    disabled={isLoading}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cache Options by Category */}
          <div className="space-y-4">
            {cacheCategories
              .filter(cat => selectedCategories.includes(cat.id))
              .map(category => (
                <div key={category.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="flex items-center space-x-2">
                      <category.icon className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-700">{category.label}</span>
                      <span className="text-xs text-gray-500">- {category.description}</span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {category.options.map(option => {
                      const Icon = option.icon;
                      const status = progress[option.id];
                      const result = results?.[option.id];

                      return (
                        <div
                          key={option.id}
                          className={`p-4 ${
                            status === 'done' ? 'bg-green-50' :
                            status === 'error' ? 'bg-red-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-5 w-5 text-gray-600" />
                              <div>
                                <p className="font-medium text-gray-900">{option.label}</p>
                                <p className="text-sm text-gray-500">{option.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {result && result.success && (
                                <span className="text-sm font-medium text-green-700">
                                  {result.cached} mis en cache
                                </span>
                              )}
                              {getStatusIcon(status)}
                            </div>
                          </div>
                          {result?.error && (
                            <p className="mt-2 text-sm text-red-600">{result.error}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {/* Results Summary */}
          {results && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-blue-900">Résumé:</span>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-green-700">{successCount} réussi</span>
                  {errorCount > 0 && (
                    <span className="text-red-700">{errorCount} échoué</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Total mis en cache:</span>
                <span className="text-lg font-bold text-blue-900">{totalCached} éléments</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t flex-shrink-0">
          <div className="text-sm text-gray-500">
            {isLoading && (
              <span className="flex items-center">
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Téléchargement en cours...
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handleStartCache}
              disabled={isLoading || !navigator.onLine || selectedCategories.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>En cours...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Démarrer ({selectedCategories.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
