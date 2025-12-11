import { useState, useEffect } from 'react';
import {
  Server, Plus, Edit2, Trash2, TestTube, Power, PowerOff,
  RefreshCw, Check, X, AlertCircle, Activity, Clock, ArrowUpDown,
  ChevronDown, ChevronRight, Eye, FileText, Settings2, Wifi, WifiOff,
  Database, Code, BarChart3
} from 'lucide-react';
import lisService from '../../services/lisService';
import { toast } from 'react-toastify';
import ConfirmationModal from '../ConfirmationModal';

export default function LISIntegration() {
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showMappingsModal, setShowMappingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'statistics'
  const [testing, setTesting] = useState(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const data = await lisService.getIntegrations();
      setIntegrations(data);
    } catch (error) {
      toast.error('Erreur lors du chargement des integrations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (integration) => {
    setTesting(integration._id);
    try {
      await lisService.testConnection(integration._id);
      toast.success('Connexion reussie!');
      fetchIntegrations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Echec de la connexion');
    } finally {
      setTesting(null);
    }
  };

  const handleToggleStatus = async (integration) => {
    try {
      if (integration.status === 'active') {
        await lisService.deactivateIntegration(integration._id);
        toast.info('Integration desactivee');
      } else {
        await lisService.activateIntegration(integration._id);
        toast.success('Integration activee');
      }
      fetchIntegrations();
    } catch (error) {
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleDelete = (integration) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer cette intégration?',
      message: `Êtes-vous sûr de vouloir supprimer l'intégration "${integration.name}"? Cette action est irréversible.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await lisService.deleteIntegration(integration._id);
          toast.success('Integration supprimée');
          fetchIntegrations();
        } catch (error) {
          toast.error('Erreur lors de la suppression');
        }
      }
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'hl7-mllp':
        return <Server className="h-5 w-5 text-purple-500" />;
      case 'hl7-http':
        return <Wifi className="h-5 w-5 text-blue-500" />;
      case 'fhir-rest':
        return <Database className="h-5 w-5 text-green-500" />;
      case 'file-based':
        return <FileText className="h-5 w-5 text-orange-500" />;
      default:
        return <Code className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'hl7-mllp': 'HL7 MLLP',
      'hl7-http': 'HL7 HTTP',
      'fhir-rest': 'FHIR REST',
      'file-based': 'Fichiers',
      'custom-api': 'API Custom'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      testing: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    const labels = {
      active: 'Actif',
      inactive: 'Inactif',
      testing: 'Test',
      error: 'Erreur'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Integration LIS/HL7</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configurez les connexions avec les systemes de laboratoire externes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nouvelle integration
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Activity className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Standards supportes</h4>
            <p className="text-sm text-blue-700 mt-1">
              HL7 v2.x (ORM, ORU, ADT, ACK) via MLLP ou HTTP, FHIR R4 (Patient, DiagnosticReport, Observation, ServiceRequest)
            </p>
          </div>
        </div>
      </div>

      {/* Integrations List */}
      {integrations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Server className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune integration configuree</h3>
          <p className="text-gray-500 mb-4">
            Ajoutez une integration pour connecter votre systeme de laboratoire externe
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Creer une integration
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration._id}
              integration={integration}
              testing={testing === integration._id}
              onTest={() => handleTestConnection(integration)}
              onToggle={() => handleToggleStatus(integration)}
              onEdit={() => {
                setSelectedIntegration(integration);
                setShowEditModal(true);
              }}
              onDelete={() => handleDelete(integration)}
              onViewMessages={() => {
                setSelectedIntegration(integration);
                setShowMessagesModal(true);
              }}
              onViewMappings={() => {
                setSelectedIntegration(integration);
                setShowMappingsModal(true);
              }}
              getTypeIcon={getTypeIcon}
              getTypeLabel={getTypeLabel}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <IntegrationModal
          integration={showEditModal ? selectedIntegration : null}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedIntegration(null);
          }}
          onSave={async (data) => {
            try {
              if (showEditModal) {
                await lisService.updateIntegration(selectedIntegration._id, data);
                toast.success('Integration mise a jour');
              } else {
                await lisService.createIntegration(data);
                toast.success('Integration creee');
              }
              setShowCreateModal(false);
              setShowEditModal(false);
              setSelectedIntegration(null);
              fetchIntegrations();
            } catch (error) {
              toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
            }
          }}
        />
      )}

      {/* Messages Modal */}
      {showMessagesModal && selectedIntegration && (
        <MessagesModal
          integration={selectedIntegration}
          onClose={() => {
            setShowMessagesModal(false);
            setSelectedIntegration(null);
          }}
        />
      )}

      {/* Mappings Modal */}
      {showMappingsModal && selectedIntegration && (
        <MappingsModal
          integration={selectedIntegration}
          onClose={() => {
            setShowMappingsModal(false);
            setSelectedIntegration(null);
          }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}

// Integration Card Component
function IntegrationCard({
  integration,
  testing,
  onTest,
  onToggle,
  onEdit,
  onDelete,
  onViewMessages,
  onViewMappings,
  getTypeIcon,
  getTypeLabel,
  getStatusBadge
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>

            <div className="p-2 bg-gray-100 rounded-lg">
              {getTypeIcon(integration.type)}
            </div>

            <div>
              <h3 className="font-medium text-gray-900">{integration.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">{getTypeLabel(integration.type)}</span>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">{integration.displayUrl}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {getStatusBadge(integration.status)}

            <div className="flex items-center gap-1">
              <button
                onClick={onTest}
                disabled={testing}
                className="p-2 text-gray-400 hover:text-purple-600 disabled:opacity-50"
                title="Tester la connexion"
              >
                {testing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={onToggle}
                className={`p-2 ${integration.status === 'active' ? 'text-green-600 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                title={integration.status === 'active' ? 'Desactiver' : 'Activer'}
              >
                {integration.status === 'active' ? (
                  <Power className="h-4 w-4" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
              </button>

              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-blue-600"
                title="Modifier"
              >
                <Edit2 className="h-4 w-4" />
              </button>

              <button
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-600"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{integration.syncState?.messagesReceived || 0}</p>
              <p className="text-xs text-gray-500">Messages recus</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{integration.syncState?.messagesSent || 0}</p>
              <p className="text-xs text-gray-500">Messages envoyes</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-red-600">{integration.syncState?.messagesErrored || 0}</p>
              <p className="text-xs text-gray-500">Erreurs</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {integration.syncState?.lastSyncAt
                  ? new Date(integration.syncState.lastSyncAt).toLocaleString('fr-FR')
                  : 'Jamais'}
              </p>
              <p className="text-xs text-gray-500">Derniere synchro</p>
            </div>
          </div>

          {integration.syncState?.lastError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Derniere erreur:</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{integration.syncState.lastError}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onViewMessages}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              Voir les messages
            </button>
            <button
              onClick={onViewMappings}
              className="btn btn-sm btn-secondary flex items-center gap-1"
            >
              <ArrowUpDown className="h-4 w-4" />
              Mappings de codes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Integration Create/Edit Modal
function IntegrationModal({ integration, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: integration?.name || '',
    description: integration?.description || '',
    type: integration?.type || 'hl7-mllp',
    hl7Settings: {
      version: integration?.hl7Settings?.version || '2.5.1',
      sendingApplication: integration?.hl7Settings?.sendingApplication || 'MEDFLOW',
      sendingFacility: integration?.hl7Settings?.sendingFacility || 'CLINIC',
      receivingApplication: integration?.hl7Settings?.receivingApplication || '',
      receivingFacility: integration?.hl7Settings?.receivingFacility || '',
      requireAck: integration?.hl7Settings?.requireAck !== false
    },
    fhirSettings: {
      version: integration?.fhirSettings?.version || 'R4',
      baseUrl: integration?.fhirSettings?.baseUrl || ''
    },
    connection: {
      host: integration?.connection?.host || '',
      port: integration?.connection?.port || 2575,
      baseUrl: integration?.connection?.baseUrl || '',
      authType: integration?.connection?.authType || 'none',
      useTLS: integration?.connection?.useTLS || false,
      connectionTimeout: integration?.connection?.connectionTimeout || 10000,
      requestTimeout: integration?.connection?.requestTimeout || 30000
    },
    credentials: {
      username: '',
      password: '',
      apiKey: '',
      token: ''
    },
    autoImport: {
      enabled: integration?.autoImport?.enabled !== false,
      createPatients: integration?.autoImport?.createPatients || false,
      autoCompleteOrders: integration?.autoImport?.autoCompleteOrders !== false
    }
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {integration ? 'Modifier l\'integration' : 'Nouvelle integration LIS'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section Tabs */}
          <div className="flex border-b">
            {['general', 'connection', 'settings'].map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeSection === section
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {section === 'general' && 'General'}
                {section === 'connection' && 'Connexion'}
                {section === 'settings' && 'Parametres'}
              </button>
            ))}
          </div>

          {/* General Section */}
          {activeSection === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de l'integration *
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Laboratoire Central"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="input"
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description optionnelle..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type d'integration *
                </label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="hl7-mllp">HL7 v2.x via MLLP (TCP)</option>
                  <option value="hl7-http">HL7 v2.x via HTTP</option>
                  <option value="fhir-rest">FHIR REST API</option>
                  <option value="file-based">Echange de fichiers</option>
                  <option value="custom-api">API personnalisee</option>
                </select>
              </div>

              {formData.type.startsWith('hl7') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Version HL7
                    </label>
                    <select
                      className="input"
                      value={formData.hl7Settings.version}
                      onChange={(e) => setFormData({
                        ...formData,
                        hl7Settings: { ...formData.hl7Settings, version: e.target.value }
                      })}
                    >
                      <option value="2.3">v2.3</option>
                      <option value="2.3.1">v2.3.1</option>
                      <option value="2.4">v2.4</option>
                      <option value="2.5">v2.5</option>
                      <option value="2.5.1">v2.5.1</option>
                      <option value="2.6">v2.6</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.type === 'fhir-rest' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version FHIR
                  </label>
                  <select
                    className="input"
                    value={formData.fhirSettings.version}
                    onChange={(e) => setFormData({
                      ...formData,
                      fhirSettings: { ...formData.fhirSettings, version: e.target.value }
                    })}
                  >
                    <option value="DSTU2">DSTU2</option>
                    <option value="STU3">STU3</option>
                    <option value="R4">R4</option>
                    <option value="R4B">R4B</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Connection Section */}
          {activeSection === 'connection' && (
            <div className="space-y-4">
              {formData.type === 'hl7-mllp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hote *
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.connection.host}
                        onChange={(e) => setFormData({
                          ...formData,
                          connection: { ...formData.connection, host: e.target.value }
                        })}
                        placeholder="192.168.1.100 ou lis.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port *
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={formData.connection.port}
                        onChange={(e) => setFormData({
                          ...formData,
                          connection: { ...formData.connection, port: parseInt(e.target.value) }
                        })}
                        placeholder="2575"
                      />
                    </div>
                  </div>
                </>
              )}

              {(formData.type === 'hl7-http' || formData.type === 'fhir-rest' || formData.type === 'custom-api') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de base *
                  </label>
                  <input
                    type="url"
                    className="input"
                    value={formData.connection.baseUrl}
                    onChange={(e) => setFormData({
                      ...formData,
                      connection: { ...formData.connection, baseUrl: e.target.value }
                    })}
                    placeholder="https://lis.example.com/api"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Authentification
                </label>
                <select
                  className="input"
                  value={formData.connection.authType}
                  onChange={(e) => setFormData({
                    ...formData,
                    connection: { ...formData.connection, authType: e.target.value }
                  })}
                >
                  <option value="none">Aucune</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api-key">API Key</option>
                  <option value="oauth2">OAuth 2.0</option>
                </select>
              </div>

              {formData.connection.authType === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom d'utilisateur
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.credentials.username}
                      onChange={(e) => setFormData({
                        ...formData,
                        credentials: { ...formData.credentials, username: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={formData.credentials.password}
                      onChange={(e) => setFormData({
                        ...formData,
                        credentials: { ...formData.credentials, password: e.target.value }
                      })}
                    />
                  </div>
                </div>
              )}

              {formData.connection.authType === 'api-key' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={formData.credentials.apiKey}
                    onChange={(e) => setFormData({
                      ...formData,
                      credentials: { ...formData.credentials, apiKey: e.target.value }
                    })}
                    placeholder="Votre cle API"
                  />
                </div>
              )}

              {formData.connection.authType === 'bearer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={formData.credentials.token}
                    onChange={(e) => setFormData({
                      ...formData,
                      credentials: { ...formData.credentials, token: e.target.value }
                    })}
                    placeholder="Bearer token"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.connection.useTLS}
                    onChange={(e) => setFormData({
                      ...formData,
                      connection: { ...formData.connection, useTLS: e.target.checked }
                    })}
                    className="rounded text-purple-600"
                  />
                  <span className="text-sm text-gray-700">Utiliser TLS/SSL</span>
                </label>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              {formData.type.startsWith('hl7') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Application emettrice
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.hl7Settings.sendingApplication}
                        onChange={(e) => setFormData({
                          ...formData,
                          hl7Settings: { ...formData.hl7Settings, sendingApplication: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Etablissement emetteur
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.hl7Settings.sendingFacility}
                        onChange={(e) => setFormData({
                          ...formData,
                          hl7Settings: { ...formData.hl7Settings, sendingFacility: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Application receptrice
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.hl7Settings.receivingApplication}
                        onChange={(e) => setFormData({
                          ...formData,
                          hl7Settings: { ...formData.hl7Settings, receivingApplication: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Etablissement recepteur
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.hl7Settings.receivingFacility}
                        onChange={(e) => setFormData({
                          ...formData,
                          hl7Settings: { ...formData.hl7Settings, receivingFacility: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Import automatique</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoImport.enabled}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoImport: { ...formData.autoImport, enabled: e.target.checked }
                      })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Activer l'import automatique des resultats</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoImport.createPatients}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoImport: { ...formData.autoImport, createPatients: e.target.checked }
                      })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Creer automatiquement les patients inconnus</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoImport.autoCompleteOrders}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoImport: { ...formData.autoImport, autoCompleteOrders: e.target.checked }
                      })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Completer automatiquement les commandes</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement...' : (integration ? 'Mettre a jour' : 'Creer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Messages Modal Component
function MessagesModal({ integration, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    direction: '',
    status: '',
    limit: 50
  });
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, [filters]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const result = await lisService.getMessages(integration._id, filters);
      setMessages(result.logs || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des messages');
    } finally {
      setLoading(false);
    }
  };

  const handleReprocess = async (messageId) => {
    try {
      await lisService.reprocessMessage(messageId);
      toast.success('Message retraite');
      fetchMessages();
    } catch (error) {
      toast.error('Erreur lors du retraitement');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processed':
      case 'acknowledged':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
      case 'rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Messages - {integration.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b flex gap-4">
          <select
            className="input input-sm"
            value={filters.direction}
            onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
          >
            <option value="">Toutes directions</option>
            <option value="inbound">Entrant</option>
            <option value="outbound">Sortant</option>
          </select>
          <select
            className="input input-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Tous statuts</option>
            <option value="processed">Traite</option>
            <option value="error">Erreur</option>
            <option value="processing">En cours</option>
          </select>
          <button onClick={fetchMessages} className="btn btn-sm btn-secondary">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucun message trouve
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Direction</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.map((msg) => (
                  <tr key={msg._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(msg.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        msg.direction === 'inbound'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {msg.direction === 'inbound' ? 'Entrant' : 'Sortant'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                      {msg.messageType || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 font-mono">
                      {msg.messageId?.substring(0, 12) || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(msg.status)}
                        <span className="text-sm">{msg.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedMessage(msg)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Voir details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {msg.status === 'error' && msg.direction === 'inbound' && (
                          <button
                            onClick={() => handleReprocess(msg._id)}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Retraiter"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">Detail du message</h3>
                <button onClick={() => setSelectedMessage(null)}>
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Message brut</h4>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
                    {selectedMessage.rawMessage}
                  </pre>
                </div>
                {selectedMessage.responseMessage && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Reponse</h4>
                    <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                      {selectedMessage.responseMessage}
                    </pre>
                  </div>
                )}
                {selectedMessage.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-800 mb-1">Erreur</h4>
                    <p className="text-sm text-red-600">{selectedMessage.error.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mappings Modal Component
function MappingsModal({ integration, onClose }) {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMapping, setEditingMapping] = useState(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  useEffect(() => {
    fetchMappings();
  }, []);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const data = await lisService.getMappings(integration._id);
      setMappings(data);
    } catch (error) {
      toast.error('Erreur lors du chargement des mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (mapping) => {
    try {
      await lisService.saveMapping(integration._id, mapping);
      toast.success('Mapping sauvegarde');
      setEditingMapping(null);
      fetchMappings();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = (mappingId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Supprimer ce mapping?',
      message: 'Êtes-vous sûr de vouloir supprimer ce mapping? Cette action est irréversible.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await lisService.deleteMapping(mappingId);
          toast.success('Mapping supprimé');
          fetchMappings();
        } catch (error) {
          toast.error('Erreur lors de la suppression');
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Mappings de codes - {integration.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Associez vos codes de tests internes aux codes du LIS externe
          </p>
          <button
            onClick={() => setEditingMapping({
              internalCode: '',
              internalName: '',
              externalCode: '',
              externalName: '',
              codingSystem: 'L'
            })}
            className="btn btn-sm btn-primary"
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucun mapping configure
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code interne</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nom</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code externe</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Systeme</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mappings.map((mapping) => (
                  <tr key={mapping._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono">{mapping.internalCode}</td>
                    <td className="px-4 py-2 text-sm">{mapping.internalName}</td>
                    <td className="px-4 py-2 text-sm font-mono">{mapping.externalCode}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{mapping.codingSystem}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingMapping(mapping)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping._id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Mapping Modal */}
        {editingMapping && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-4">
                {editingMapping._id ? 'Modifier le mapping' : 'Nouveau mapping'}
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code interne *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editingMapping.internalCode}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        internalCode: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom interne
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editingMapping.internalName}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        internalName: e.target.value
                      })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code externe *
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={editingMapping.externalCode}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        externalCode: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Systeme de codage
                    </label>
                    <select
                      className="input"
                      value={editingMapping.codingSystem}
                      onChange={(e) => setEditingMapping({
                        ...editingMapping,
                        codingSystem: e.target.value
                      })}
                    >
                      <option value="L">Local</option>
                      <option value="LN">LOINC</option>
                      <option value="I10">ICD-10</option>
                      <option value="SCT">SNOMED CT</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingMapping(null)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSave(editingMapping)}
                  className="btn btn-primary"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
        />
      </div>
    </div>
  );
}
