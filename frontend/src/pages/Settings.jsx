import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Lock, Database, Palette, Globe, Check, AlertCircle, Loader2 } from 'lucide-react';
import settingsService from '../services/settingsService';
import { toast } from 'react-toastify';

export default function Settings() {
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

  // User role check
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchSettings();

    // Check if user is admin
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setIsAdmin(user.role === 'admin');
    } catch (err) {
      console.error('Error getting user role:', err);
    }
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
      showError('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await settingsService.updateProfile(profile);
      showSuccess('Profil mis à jour avec succès');

      // Update localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({
        ...user,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email
      }));
    } catch (error) {
      console.error('Error saving profile:', error);
      showError(error.response?.data?.error || 'Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClinic = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ clinic });
      showSuccess('Informations de la clinique mises à jour');
    } catch (error) {
      console.error('Error saving clinic settings:', error);
      showError(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({ notifications });
      showSuccess('Préférences de notification mises à jour');
    } catch (error) {
      console.error('Error saving notifications:', error);
      showError(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.updateTwilioSettings(twilio);
      showSuccess('Configuration Twilio mise à jour');
    } catch (error) {
      console.error('Error saving Twilio settings:', error);
      showError(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTwilio = async () => {
    try {
      setSaving(true);
      await settingsService.testTwilioConnection();
      showSuccess('Connexion Twilio réussie');
    } catch (error) {
      console.error('Error testing Twilio:', error);
      showError(error.response?.data?.error || 'Erreur de connexion Twilio');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    try {
      setSaving(true);
      await settingsService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      showSuccess('Mot de passe modifié avec succès');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      showError(error.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'security', icon: Lock, label: 'Sécurité' },
    ...(isAdmin ? [
      { id: 'clinic', icon: Database, label: 'Clinique' },
      { id: 'twilio', icon: Globe, label: 'Twilio' }
    ] : [])
  ];

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
                            showError('La taille du fichier ne doit pas dépasser 2MB');
                            return;
                          }
                          try {
                            const formData = new FormData();
                            formData.append('photo', file);
                            await settingsService.uploadProfilePhoto(formData);
                            showSuccess('Photo de profil mise à jour');
                          } catch (err) {
                            showError('Erreur lors du téléchargement de la photo');
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
        </div>
      </div>
    </div>
  );
}
