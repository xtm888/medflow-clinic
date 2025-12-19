/**
 * TwilioSection Component
 *
 * Twilio SMS/WhatsApp configuration (admin only).
 */

import { Loader2 } from 'lucide-react';

export default function TwilioSection({
  twilio,
  onTwilioChange,
  onSave,
  onTest,
  saving
}) {
  return (
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
            onChange={(e) => onTwilioChange({ ...twilio, accountSid: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
          <input
            type="password"
            className="input"
            placeholder="Entrez le nouveau token pour modifier"
            value={twilio.authToken}
            onChange={(e) => onTwilioChange({ ...twilio, authToken: e.target.value })}
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
              onChange={(e) => onTwilioChange({ ...twilio, smsNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
            <input
              type="tel"
              className="input"
              placeholder="+14155238886"
              value={twilio.whatsappNumber}
              onChange={(e) => onTwilioChange({ ...twilio, whatsappNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button onClick={onTest} disabled={saving} className="btn btn-secondary">
            Tester la connexion
          </button>
          <button onClick={onSave} disabled={saving} className="btn btn-primary">
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
  );
}
