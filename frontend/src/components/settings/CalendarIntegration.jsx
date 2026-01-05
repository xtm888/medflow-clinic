import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Calendar,
  Link,
  Unlink,
  RefreshCw,
  Settings,
  Check,
  X,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';

/**
 * Calendar Integration Settings Component
 * Allows users to connect and configure Google Calendar and Microsoft Outlook
 */
export default function CalendarIntegration() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  // Fetch integrations on mount
  useEffect(() => {
    fetchIntegrations();

    // Check URL params for connection result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected) {
      toast.success(`${connected === 'google' ? 'Google Calendar' : 'Outlook'} connecté avec succès!`);
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
      fetchIntegrations();
    }

    if (error) {
      toast.error(`Erreur de connexion: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/integrations', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Safely extract array from various API response formats
        const rawIntegrations = data?.data ?? data ?? [];
        setIntegrations(Array.isArray(rawIntegrations) ? rawIntegrations : []);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error('Échec du chargement des intégrations');
    } finally {
      setLoading(false);
    }
  };

  // Connect to Google Calendar
  const connectGoogle = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/google/auth', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.data.authUrl;
      }
    } catch (error) {
      toast.error('Échec de la connexion à Google Calendar');
    }
  };

  // Connect to Outlook
  const connectOutlook = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/outlook/auth', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.data.authUrl;
      }
    } catch (error) {
      toast.error('Échec de la connexion à Outlook');
    }
  };

  // Disconnect integration
  const disconnectIntegration = (provider) => {
    setConfirmModal({
      isOpen: true,
      title: 'Déconnecter le calendrier?',
      message: `Êtes-vous sûr de vouloir déconnecter ${provider === 'google' ? 'Google Calendar' : 'Outlook'}? Les événements synchronisés seront conservés mais la synchronisation s'arrêtera.`,
      type: 'warning',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/calendar/integrations/${provider}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.ok) {
            toast.success('Calendrier déconnecté');
            fetchIntegrations();
          }
        } catch (error) {
          toast.error('Échec de la déconnexion');
        }
      }
    });
  };

  // Trigger manual sync
  const triggerSync = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Safely extract array from various API response formats
        const rawResults = data?.data ?? data ?? [];
        const results = Array.isArray(rawResults) ? rawResults : [];

        results.forEach(result => {
          if (result.success) {
            toast.success(
              `${result.provider === 'google' ? 'Google' : 'Outlook'}: ` +
              `${result.stats?.created || 0} créés, ${result.stats?.updated || 0} mis à jour`
            );
          } else {
            toast.error(`${result.provider}: ${result.error}`);
          }
        });

        fetchIntegrations();
      }
    } catch (error) {
      toast.error('Échec de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  // Update sync settings
  const updateSettings = async (provider, settings) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/calendar/integrations/${provider}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Paramètres mis à jour');
        fetchIntegrations();
      }
    } catch (error) {
      toast.error('Échec de la mise à jour');
    }
  };

  const getIntegration = (provider) => integrations.find(i => i.provider === provider);
  const googleIntegration = getIntegration('google');
  const outlookIntegration = getIntegration('outlook');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Intégration Calendrier</h3>
          <p className="text-sm text-gray-500">
            Synchronisez vos rendez-vous avec Google Calendar ou Microsoft Outlook
          </p>
        </div>
        {integrations.length > 0 && (
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="btn btn-primary flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Synchronisation...' : 'Synchroniser'}</span>
          </button>
        )}
      </div>

      {/* Google Calendar Card */}
      <div className="border rounded-lg overflow-hidden">
        <div
          className={`p-4 flex items-center justify-between cursor-pointer ${
            googleIntegration ? 'bg-green-50' : 'bg-gray-50'
          }`}
          onClick={() => setExpandedProvider(expandedProvider === 'google' ? null : 'google')}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-lg shadow flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Google Calendar</h4>
              {googleIntegration ? (
                <div className="flex items-center space-x-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">Connecté</span>
                  <span className="text-gray-500">• {googleIntegration.email}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Non connecté</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {googleIntegration ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); disconnectIntegration('google'); }}
                  className="btn btn-secondary text-sm flex items-center space-x-1"
                >
                  <Unlink className="h-4 w-4" />
                  <span>Déconnecter</span>
                </button>
                {expandedProvider === 'google' ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); connectGoogle(); }}
                className="btn btn-primary text-sm flex items-center space-x-1"
              >
                <Link className="h-4 w-4" />
                <span>Connecter</span>
              </button>
            )}
          </div>
        </div>

        {/* Google Settings Expanded */}
        {expandedProvider === 'google' && googleIntegration && (
          <IntegrationSettings
            integration={googleIntegration}
            onUpdate={(settings) => updateSettings('google', settings)}
          />
        )}
      </div>

      {/* Outlook Calendar Card */}
      <div className="border rounded-lg overflow-hidden">
        <div
          className={`p-4 flex items-center justify-between cursor-pointer ${
            outlookIntegration ? 'bg-green-50' : 'bg-gray-50'
          }`}
          onClick={() => setExpandedProvider(expandedProvider === 'outlook' ? null : 'outlook')}
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-lg shadow flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8">
                <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.583-.16.159-.354.239-.582.239h-9.922L24 7.387zm-14.666 12.018c.24.002.443-.087.612-.264.168-.178.253-.39.253-.635V5.494c0-.245-.085-.457-.253-.635-.17-.178-.373-.267-.612-.265H.917c-.238-.002-.442.087-.61.265-.169.178-.254.39-.254.635v13.012c0 .245.085.457.254.635.168.177.372.266.61.264h8.417z"/>
                <path fill="#0364B8" d="M24 7.387l-10.667 8.3v-4.48L24 4.52v2.867z"/>
                <path fill="#0078D4" d="M13.333 11.207L24 4.52c0-.23-.08-.423-.238-.582-.159-.159-.352-.238-.582-.238H9.333l4 7.507z"/>
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Microsoft Outlook</h4>
              {outlookIntegration ? (
                <div className="flex items-center space-x-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-600">Connecté</span>
                  <span className="text-gray-500">• {outlookIntegration.email}</span>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Non connecté</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {outlookIntegration ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); disconnectIntegration('outlook'); }}
                  className="btn btn-secondary text-sm flex items-center space-x-1"
                >
                  <Unlink className="h-4 w-4" />
                  <span>Déconnecter</span>
                </button>
                {expandedProvider === 'outlook' ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); connectOutlook(); }}
                className="btn btn-primary text-sm flex items-center space-x-1"
              >
                <Link className="h-4 w-4" />
                <span>Connecter</span>
              </button>
            )}
          </div>
        </div>

        {/* Outlook Settings Expanded */}
        {expandedProvider === 'outlook' && outlookIntegration && (
          <IntegrationSettings
            integration={outlookIntegration}
            onUpdate={(settings) => updateSettings('outlook', settings)}
          />
        )}
      </div>

      {/* Sync Status */}
      {integrations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Synchronisation Automatique</h4>
              <p className="text-sm text-blue-700 mt-1">
                Les rendez-vous sont automatiquement synchronisés toutes les 15 minutes.
                Vous pouvez également déclencher une synchronisation manuelle à tout moment.
              </p>
              {integrations[0]?.syncState?.lastSyncAt && (
                <p className="text-xs text-blue-600 mt-2">
                  Dernière sync: {new Date(integrations[0].syncState.lastSyncAt).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900">Confidentialité</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Par défaut, les noms des patients ne sont pas inclus dans les événements du calendrier externe
              pour des raisons de confidentialité. Vous pouvez modifier ce paramètre dans les options avancées.
            </p>
          </div>
        </div>
      </div>

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

/**
 * Integration Settings Sub-component
 */
function IntegrationSettings({ integration, onUpdate }) {
  const [settings, setSettings] = useState({
    syncSettings: {
      enabled: integration.syncSettings?.enabled ?? true,
      syncInterval: integration.syncSettings?.syncInterval ?? 15,
      includePatientNames: integration.syncSettings?.includePatientNames ?? false,
      includeDetails: integration.syncSettings?.includeDetails ?? false,
      syncReminders: integration.syncSettings?.syncReminders ?? true,
      eventPrefix: integration.syncSettings?.eventPrefix ?? '[MedFlow]'
    },
    defaultCalendarId: integration.defaultCalendar || ''
  });

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      syncSettings: {
        ...prev.syncSettings,
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    onUpdate(settings);
  };

  return (
    <div className="border-t bg-white p-4 space-y-4">
      <h5 className="font-medium text-gray-900 flex items-center">
        <Settings className="h-4 w-4 mr-2" />
        Paramètres de synchronisation
      </h5>

      {/* Sync Enabled */}
      <div className="flex items-center justify-between">
        <div>
          <label className="font-medium text-gray-700">Synchronisation active</label>
          <p className="text-sm text-gray-500">Activer la synchronisation automatique</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.syncSettings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Sync Interval */}
      <div>
        <label className="font-medium text-gray-700">Intervalle de synchronisation</label>
        <select
          value={settings.syncSettings.syncInterval}
          onChange={(e) => handleChange('syncInterval', parseInt(e.target.value))}
          className="mt-1 block w-full input"
        >
          <option value={5}>Toutes les 5 minutes</option>
          <option value={15}>Toutes les 15 minutes</option>
          <option value={30}>Toutes les 30 minutes</option>
          <option value={60}>Toutes les heures</option>
        </select>
      </div>

      {/* Default Calendar */}
      {integration.calendars?.length > 0 && (
        <div>
          <label className="font-medium text-gray-700">Calendrier par défaut</label>
          <select
            value={settings.defaultCalendarId}
            onChange={(e) => setSettings(prev => ({ ...prev, defaultCalendarId: e.target.value }))}
            className="mt-1 block w-full input"
          >
            {integration.calendars.map(cal => (
              <option key={cal.calendarId} value={cal.calendarId}>
                {cal.name} {cal.primary && '(Principal)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Event Prefix */}
      <div>
        <label className="font-medium text-gray-700">Préfixe des événements</label>
        <input
          type="text"
          value={settings.syncSettings.eventPrefix}
          onChange={(e) => handleChange('eventPrefix', e.target.value)}
          className="mt-1 block w-full input"
          placeholder="[MedFlow]"
        />
        <p className="text-xs text-gray-500 mt-1">Préfixe ajouté au titre des événements synchronisés</p>
      </div>

      {/* Privacy Options */}
      <div className="border-t pt-4 space-y-3">
        <h6 className="font-medium text-gray-700">Options de confidentialité</h6>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-gray-700">Inclure les noms des patients</label>
            <p className="text-xs text-gray-500">Affiche les noms des patients dans le calendrier externe</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.syncSettings.includePatientNames}
              onChange={(e) => handleChange('includePatientNames', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-gray-700">Inclure les détails du RDV</label>
            <p className="text-xs text-gray-500">Inclut la raison et les notes dans la description</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.syncSettings.includeDetails}
              onChange={(e) => handleChange('includeDetails', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-gray-700">Synchroniser les rappels</label>
            <p className="text-xs text-gray-500">Crée des rappels dans le calendrier externe</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.syncSettings.syncReminders}
              onChange={(e) => handleChange('syncReminders', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <button onClick={handleSave} className="btn btn-primary">
          Enregistrer les paramètres
        </button>
      </div>
    </div>
  );
}
