import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Lock, Database, Palette, Globe, Check, AlertCircle, Loader2, DollarSign, Plus, Trash2, Edit2, X, Calendar, Server, Shield, UserPlus, Tag } from 'lucide-react';
import CalendarIntegration from '../components/settings/CalendarIntegration';
import LISIntegration from '../components/settings/LISIntegration';
import RolePermissionsManager from '../components/settings/RolePermissionsManager';
import ReferrerManagement from '../components/settings/ReferrerManagement';
import TarifManagement from '../components/settings/TarifManagement';
import { useAuth } from '../contexts/AuthContext';
import settingsService from '../services/settingsService';
import billingService from '../services/billingService';
import { toast } from 'react-toastify';
import ConfirmationModal from '../components/ConfirmationModal';

export default function Settings() {
  // Get user from auth context
  const { user } = useAuth();

  const showSuccess = (msg) => toast.success(msg);
  const showError = (msg) => toast.error(msg);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    specialization: ''
  });

  // Clinic state
  const [clinic, setClinic] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  // Notifications state
  const [notifications, setNotifications] = useState({
    appointmentReminders: true,
    stockAlerts: true,
    financialReports: false,
    followUpReminders: false
  });

  // Twilio state
  const [twilio, setTwilio] = useState({
    accountSid: '',
    authToken: '',
    smsNumber: '',
    whatsappNumber: ''
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Tax configuration state
  const [taxes, setTaxes] = useState([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [taxForm, setTaxForm] = useState({
    name: '',
    code: '',
    rate: '',
    type: 'percentage',
    applicableCategories: ['all'],
    description: '',
    active: true
  });

  // User role check
  const isAdmin = user?.role === 'admin';
  const canManageBilling = ['admin', 'accountant'].includes(user?.role); // ADDED: Accountants can manage billing settings

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [profileRes, settingsRes] = await Promise.all([
        settingsService.getProfile(),
        settingsService.getSettings()
      ]);

      if (profileRes.data) {
        setProfile({
          firstName: profileRes.data.firstName || '',
          lastName: profileRes.data.lastName || '',
          email: profileRes.data.email || '',
          phoneNumber: profileRes.data.phoneNumber || '',
          specialization: profileRes.data.specialization || ''
        });
      }

      if (settingsRes.data) {
        setClinic(settingsRes.data.clinic || {});
        setNotifications(settingsRes.data.notifications || {});
        setTwilio({
          accountSid: settingsRes.data.twilio?.accountSid || '',
          authToken: settingsRes.data.twilio?.authToken || '',
          smsNumber: settingsRes.data.twilio?.smsNumber || '',
          whatsappNumber: settingsRes.data.twilio?.whatsappNumber || ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await settingsService.updateProfile(profile);
      toast.success('Profil mis à jour avec succès');

      // Update localStorage with user from auth context (already available at component level)
      localStorage.setItem('user', JSON.stringify({
        ...user,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email
      }));
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClinic = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ clinic });
      toast.success('Informations de la clinique mises à jour');
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ notifications });
      toast.success('Préférences de notification mises à jour');
    } catch (error) {
      console.error('Error saving notifications:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.updateTwilioSettings(twilio);
      toast.success('Configuration Twilio mise à jour');
    } catch (error) {
      console.error('Error saving Twilio settings:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.testTwilioConnection();
      toast.success('Connexion Twilio réussie');
    } catch (error) {
      console.error('Error testing Twilio:', error);
      toast.error(error.response?.data?.error || 'Erreur de connexion Twilio');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      setSaving(true);
      await settingsService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success('Mot de passe modifié avec succès');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setSaving(false);
    }
  };

  // Tax configuration handlers
  const fetchTaxes = async () => {
    try {
      setTaxesLoading(true);
      const response = await billingService.getTaxRates({ active: 'all' });
      setTaxes(response.data || []);
    } catch (error) {
      console.error('Error fetching taxes:', error);
      toast.error('Erreur lors du chargement des taux de taxe');
    } finally {
      setTaxesLoading(false);
    }
  };

  const handleOpenTaxModal = (tax = null) => {
    if (tax) {
      setEditingTax(tax);
      setTaxForm({
        name: tax.name || '',
        code: tax.code || '',
        rate: tax.rate?.toString() || '',
        type: tax.type || 'percentage',
        applicableCategories: tax.applicableCategories || ['all'],
        description: tax.description || '',
        active: tax.active !== false
      });
    } else {
      setEditingTax(null);
      setTaxForm({
        name: '',
        code: '',
        rate: '',
        type: 'percentage',
        applicableCategories: ['all'],
        description: '',
        active: true
      });
    }
    setShowTaxModal(true);
  };

  const handleCloseTaxModal = () => {
    setShowTaxModal(false);
    setEditingTax(null);
    setTaxForm({
      name: '',
      code: '',
      rate: '',
      type: 'percentage',
      applicableCategories: ['all'],
      description: '',
      active: true
    });
  };

  const handleSaveTax = async () => {
    if (!taxForm.name || !taxForm.code || !taxForm.rate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setSaving(true);
      const taxData = {
        ...taxForm,
        rate: parseFloat(taxForm.rate)
      };

      if (editingTax) {
        await billingService.updateTaxRate(editingTax._id, taxData);
        toast.success('Taux de taxe mis à jour');
      } else {
        await billingService.createTaxRate(taxData);
        toast.success('Taux de taxe créé');
      }

      handleCloseTaxModal();
      fetchTaxes();
    } catch (error) {
      console.error('Error saving tax:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTax = (taxId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Désactiver ce taux de taxe?',
      message: 'Êtes-vous sûr de vouloir désactiver ce taux de taxe? Les factures existantes ne seront pas affectées.',
      type: 'warning',
      onConfirm: async () => {
        try {
          await billingService.deleteTaxRate(taxId);
          toast.success('Taux de taxe désactivé');
          fetchTaxes();
        } catch (error) {
          console.error('Error deleting tax:', error);
          toast.error('Erreur lors de la désactivation');
        }
      }
    });
  };

  const tabs = [
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'calendar', icon: Calendar, label: 'Calendrier' },
    { id: 'security', icon: Lock, label: 'Sécurité' },
    ...(canManageBilling ? [
      { id: 'billing', icon: DollarSign, label: 'Facturation' },
      { id: 'tarifs', icon: Tag, label: 'Tarifs' },
      { id: 'referrers', icon: UserPlus, label: 'Référents' }
    ] : []),
    ...(isAdmin ? [
      { id: 'clinic', icon: Database, label: 'Clinique' },
      { id: 'permissions', icon: Shield, label: 'Permissions' },
      { id: 'twilio', icon: Globe, label: 'Twilio' },
      { id: 'lis', icon: Server, label: 'LIS/HL7' }
    ] : [])
  ];

  // Fetch taxes when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing' && taxes.length === 0 && canManageBilling) {
      fetchTaxes();
    }
  }, [activeTab, canManageBilling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration du système et préférences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations du profil</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                    {profile.firstName?.charAt(0) || 'U'}{profile.lastName?.charAt(0) || ''}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="profile-photo"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('La taille du fichier ne doit pas dépasser 2MB');
                            return;
                          }
                          try {
                            const formData = new FormData();
                            formData.append('photo', file);
                            await settingsService.uploadProfilePhoto(formData);
                            toast.success('Photo de profil mise à jour');
                          } catch (err) {
                            toast.error('Erreur lors du téléchargement de la photo');
                          }
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('profile-photo').click()}
                      className="btn btn-secondary text-sm"
                    >
                      Changer la photo
                    </button>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG. Max 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input
                      type="text"
                      className="input"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      type="text"
                      className="input"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="input"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      className="input"
                      value={profile.phoneNumber}
                      onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
                    <input
                      type="text"
                      className="input"
                      value={profile.specialization}
                      onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sauvegarde...
                      </>
                    ) : (
                      'Enregistrer les modifications'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Clinic Settings (Admin only) */}
          {activeTab === 'clinic' && isAdmin && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations de la clinique</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la clinique</label>
                  <input
                    type="text"
                    className="input"
                    value={clinic.name || ''}
                    onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <input
                    type="text"
                    className="input"
                    value={clinic.address || ''}
                    onChange={(e) => setClinic({ ...clinic, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                      type="tel"
                      className="input"
                      value={clinic.phone || ''}
                      onChange={(e) => setClinic({ ...clinic, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      className="input"
                      value={clinic.email || ''}
                      onChange={(e) => setClinic({ ...clinic, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleSaveClinic}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sauvegarde...
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notification Preferences */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Préférences de notification</h2>
              <div className="space-y-4">
                {[
                  { key: 'appointmentReminders', label: 'Rappels de rendez-vous', description: 'Envoyer des rappels automatiques aux patients' },
                  { key: 'stockAlerts', label: 'Alertes de stock', description: 'Recevoir des alertes pour les stocks faibles' },
                  { key: 'financialReports', label: 'Notifications financières', description: 'Rapports quotidiens de revenus' },
                  { key: 'followUpReminders', label: 'Rappels de suivi', description: 'Notifications pour les revisites patients' }
                ].map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{pref.label}</p>
                      <p className="text-sm text-gray-600">{pref.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notifications[pref.key] || false}
                        onChange={(e) => setNotifications({ ...notifications, [pref.key]: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sauvegarde...
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calendar Integration */}
          {activeTab === 'calendar' && (
            <div className="card">
              <CalendarIntegration />
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Changer le mot de passe</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    className="input"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !passwordData.currentPassword || !passwordData.newPassword}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Modification...
                      </>
                    ) : (
                      'Changer le mot de passe'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Twilio Configuration (Admin only) */}
          {activeTab === 'twilio' && isAdmin && (
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuration Twilio (SMS/WhatsApp)</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilio.accountSid}
                    onChange={(e) => setTwilio({ ...twilio, accountSid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Entrez le nouveau token pour modifier"
                    value={twilio.authToken}
                    onChange={(e) => setTwilio({ ...twilio, authToken: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro SMS</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+1234567890"
                      value={twilio.smsNumber}
                      onChange={(e) => setTwilio({ ...twilio, smsNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+14155238886"
                      value={twilio.whatsappNumber}
                      onChange={(e) => setTwilio({ ...twilio, whatsappNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={handleTestTwilio}
                    disabled={saving}
                    className="btn btn-secondary"
                  >
                    Tester la connexion
                  </button>
                  <button
                    onClick={handleSaveTwilio}
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sauvegarde...
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LIS/HL7 Integration (Admin only) */}
          {activeTab === 'lis' && isAdmin && (
            <div className="card">
              <LISIntegration />
            </div>
          )}

          {/* Role Permissions (Admin only) */}
          {activeTab === 'permissions' && isAdmin && (
            <div className="card">
              <RolePermissionsManager />
            </div>
          )}

          {/* Billing/Tax Configuration (Admin & Accountant) */}
          {activeTab === 'billing' && canManageBilling && (
            <div className="space-y-6">
              {/* Tax Rates Configuration */}
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Taux de Taxe</h2>
                    <p className="text-sm text-gray-500">Configurez les taux de taxe appliqués aux factures</p>
                  </div>
                  <button
                    onClick={() => handleOpenTaxModal()}
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {taxesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    <span className="ml-2 text-gray-600">Chargement...</span>
                  </div>
                ) : taxes.length > 0 ? (
                  <div className="space-y-3">
                    {taxes.map((tax) => (
                      <div
                        key={tax._id}
                        className={`p-4 rounded-lg border ${
                          tax.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`w-3 h-3 rounded-full ${tax.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <div>
                              <p className="font-semibold text-gray-900">{tax.name}</p>
                              <p className="text-sm text-gray-500">Code: {tax.code}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-primary-600">
                                {tax.rate}{tax.type === 'percentage' ? '%' : ' CDF'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {tax.applicableCategories?.includes('all') ? 'Toutes catégories' : tax.applicableCategories?.join(', ')}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleOpenTaxModal(tax)}
                                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {tax.active && (
                                <button
                                  onClick={() => handleDeleteTax(tax._id)}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Désactiver"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {tax.description && (
                          <p className="mt-2 text-sm text-gray-600 border-t pt-2">{tax.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p>Aucun taux de taxe configuré</p>
                    <p className="text-sm">Cliquez sur "Ajouter" pour créer un taux de taxe</p>
                  </div>
                )}
              </div>

              {/* Info Card */}
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">À propos de la configuration des taxes</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Les taxes actives sont automatiquement appliquées aux nouvelles factures</li>
                      <li>Vous pouvez configurer des taxes en pourcentage ou en montant fixe</li>
                      <li>Les catégories permettent d'appliquer des taxes spécifiques à certains types de services</li>
                      <li>La désactivation d'une taxe n'affecte pas les factures existantes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tarifs Management (Admin & Accountant) */}
          {activeTab === 'tarifs' && canManageBilling && (
            <div className="card">
              <TarifManagement />
            </div>
          )}

          {/* Referrers Management (Admin & Accountant) */}
          {activeTab === 'referrers' && canManageBilling && (
            <div className="card">
              <ReferrerManagement />
            </div>
          )}
        </div>
      </div>

      {/* Tax Modal */}
      {showTaxModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTax ? 'Modifier le taux de taxe' : 'Ajouter un taux de taxe'}
                </h2>
                <button onClick={handleCloseTaxModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ex: TVA"
                  value={taxForm.name}
                  onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ex: VAT"
                  value={taxForm.code}
                  onChange={(e) => setTaxForm({ ...taxForm, code: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taux *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="ex: 18"
                    value={taxForm.rate}
                    onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    className="input"
                    value={taxForm.type}
                    onChange={(e) => setTaxForm({ ...taxForm, type: e.target.value })}
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (CDF)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégories applicables</label>
                <select
                  className="input"
                  value={taxForm.applicableCategories[0] || 'all'}
                  onChange={(e) => setTaxForm({ ...taxForm, applicableCategories: [e.target.value] })}
                >
                  <option value="all">Toutes les catégories</option>
                  <option value="consultation">Consultation</option>
                  <option value="procedure">Procédure</option>
                  <option value="imaging">Imagerie</option>
                  <option value="laboratory">Laboratoire</option>
                  <option value="medication">Médicaments</option>
                  <option value="surgery">Chirurgie</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input"
                  rows="2"
                  placeholder="Description optionnelle..."
                  value={taxForm.description}
                  onChange={(e) => setTaxForm({ ...taxForm, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tax-active"
                  checked={taxForm.active}
                  onChange={(e) => setTaxForm({ ...taxForm, active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="tax-active" className="text-sm text-gray-700">
                  Taxe active
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCloseTaxModal}
                className="btn btn-secondary"
                disabled={saving}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveTax}
                disabled={saving || !taxForm.name || !taxForm.code || !taxForm.rate}
                className="btn btn-primary"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sauvegarde...
                  </>
                ) : (
                  editingTax ? 'Mettre à jour' : 'Créer'
                )}
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
  );
}
