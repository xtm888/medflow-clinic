import { Settings as SettingsIcon, User, Bell, Lock, Database, Palette, Globe } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configuration du système et préférences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-0">
            <nav className="space-y-1">
              {[
                { icon: User, label: 'Profil', active: true },
                { icon: Bell, label: 'Notifications' },
                { icon: Lock, label: 'Sécurité' },
                { icon: Database, label: 'Données' },
                { icon: Palette, label: 'Apparence' },
                { icon: Globe, label: 'Langue & Région' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                    item.active
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations du profil</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                  DR
                </div>
                <div>
                  <button className="btn btn-secondary text-sm">Changer la photo</button>
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG. Max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input type="text" className="input" defaultValue="Dr. Admin" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input type="text" className="input" defaultValue="System" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="input" defaultValue="admin@clinic.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" className="input" defaultValue="+243 81 234 5678" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
                  <input type="text" className="input" defaultValue="Médecine générale" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button className="btn btn-primary">Enregistrer les modifications</button>
              </div>
            </div>
          </div>

          {/* Clinic Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Informations de la clinique</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la clinique</label>
                <input type="text" className="input" defaultValue="MedFlow Clinic" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input type="text" className="input" defaultValue="123 Rue de la Santé, 75013 Paris" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" className="input" defaultValue="+243 81 234 5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="input" defaultValue="contact@medflow-cd.com" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button className="btn btn-primary">Enregistrer</button>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Préférences de notification</h2>
            <div className="space-y-4">
              {[
                { label: 'Rappels de rendez-vous', description: 'Envoyer des rappels automatiques aux patients' },
                { label: 'Alertes de stock', description: 'Recevoir des alertes pour les stocks faibles' },
                { label: 'Notifications financières', description: 'Rapports quotidiens de revenus' },
                { label: 'Rappels de suivi', description: 'Notifications pour les revisites patients' },
              ].map((pref, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{pref.label}</p>
                    <p className="text-sm text-gray-600">{pref.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={idx < 2} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Twilio Configuration */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Configuration Twilio (SMS/WhatsApp)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                <input type="text" className="input" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                <input type="password" className="input" placeholder="••••••••••••••••" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro SMS</label>
                  <input type="tel" className="input" placeholder="+1234567890" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
                  <input type="tel" className="input" placeholder="+14155238886" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button className="btn btn-success">Tester la connexion</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
