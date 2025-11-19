import React from 'react';
import { AlertCircle, AlertTriangle, XCircle, X, CheckCircle } from 'lucide-react';

/**
 * PrescriptionWarningModal - Display critical safety warnings
 *
 * Shows allergy warnings, drug interactions, contraindications, etc.
 * Requires explicit confirmation before proceeding with risky prescriptions
 */
const PrescriptionWarningModal = ({
  warning,
  onConfirm,
  onCancel,
  patientName,
  drugName
}) => {
  // Determine severity styling
  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50',
          border: 'border-red-500',
          icon: XCircle,
          iconColor: 'text-red-600',
          iconBg: 'bg-red-100',
          title: 'text-red-900',
          text: 'text-red-800',
          button: 'bg-red-600 hover:bg-red-700',
          badge: 'bg-red-100 text-red-800 border-red-300'
        };
      case 'high':
      case 'major':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-500',
          icon: AlertTriangle,
          iconColor: 'text-orange-600',
          iconBg: 'bg-orange-100',
          title: 'text-orange-900',
          text: 'text-orange-800',
          button: 'bg-orange-600 hover:bg-orange-700',
          badge: 'bg-orange-100 text-orange-800 border-orange-300'
        };
      case 'medium':
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-500',
          icon: AlertCircle,
          iconColor: 'text-yellow-600',
          iconBg: 'bg-yellow-100',
          title: 'text-yellow-900',
          text: 'text-yellow-800',
          button: 'bg-yellow-600 hover:bg-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-300'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-500',
          icon: AlertCircle,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
          title: 'text-blue-900',
          text: 'text-blue-800',
          button: 'bg-blue-600 hover:bg-blue-700',
          badge: 'bg-blue-100 text-blue-800 border-blue-300'
        };
    }
  };

  const config = getSeverityConfig(warning.severity);
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-xl max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${config.bg} border-b-4 ${config.border} px-8 py-6`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className={`${config.iconBg} p-3 rounded-full`}>
                <Icon className={`h-8 w-8 ${config.iconColor}`} />
              </div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold ${config.title} mb-1`}>
                  {warning.title}
                </h2>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${config.badge}`}>
                  {warning.severity === 'critical' ? 'CRITIQUE' :
                   warning.severity === 'high' || warning.severity === 'major' ? 'MAJEUR' :
                   warning.severity === 'medium' || warning.severity === 'warning' ? 'AVERTISSEMENT' :
                   'INFORMATION'}
                </span>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="ml-4 text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-full"
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Patient & Drug Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Patient */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                Patient
              </p>
              <p className="text-lg font-bold text-blue-900">{patientName}</p>
            </div>

            {/* Drug */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                Médicament
              </p>
              <p className="text-lg font-bold text-purple-900">{drugName}</p>
            </div>
          </div>

          {/* Warning Message */}
          <div className={`${config.bg} border-2 ${config.border} rounded-lg p-6`}>
            <p className={`text-lg font-bold ${config.title} mb-3 flex items-center gap-2`}>
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
              {warning.message}
            </p>
            {warning.details && (
              <p className={`text-base ${config.text} leading-relaxed whitespace-pre-line`}>
                {warning.details}
              </p>
            )}
          </div>

          {/* Specific Information */}
          {warning.allergen && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">
                🚨 Allergène identifié
              </p>
              <p className="text-lg font-bold text-red-700">{warning.allergen}</p>
              {warning.reaction && (
                <p className="text-sm text-red-600 mt-1">
                  Réaction connue: {warning.reaction}
                </p>
              )}
            </div>
          )}

          {/* Drug Interactions */}
          {warning.interactions && warning.interactions.length > 0 && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-orange-900 mb-3">
                ⚠️ Interactions médicamenteuses détectées
              </p>
              <div className="space-y-2">
                {warning.interactions.slice(0, 3).map((interaction, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-orange-200">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-gray-900">{interaction.drug}</p>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        interaction.severity === 'contraindicated' ? 'bg-red-100 text-red-700' :
                        interaction.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {interaction.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{interaction.effect}</p>
                    {interaction.management && (
                      <p className="text-sm text-gray-600 mt-1 italic">
                        → {interaction.management}
                      </p>
                    )}
                  </div>
                ))}
                {warning.interactions.length > 3 && (
                  <p className="text-sm text-orange-700 font-medium text-center">
                    + {warning.interactions.length - 3} autre(s) interaction(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Contraindications */}
          {warning.contraindications && warning.contraindications.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">
                🛑 Contre-indications
              </p>
              <ul className="list-disc list-inside space-y-1">
                {warning.contraindications.map((contraindication, idx) => (
                  <li key={idx} className="text-sm text-red-700 font-medium">
                    {contraindication}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {warning.recommendations && warning.recommendations.length > 0 && (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Recommandations
              </p>
              <ul className="space-y-2">
                {warning.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">•</span>
                    <span className="text-sm text-green-800 flex-1">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical Warning Box */}
          {(warning.severity === 'critical' || warning.severity === 'high') && (
            <div className="bg-gray-900 text-white rounded-lg p-4 border-4 border-yellow-400">
              <p className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ATTENTION REQUISE
              </p>
              <p className="text-sm">
                Cette prescription présente des risques importants pour la sécurité du patient.
                Assurez-vous d'avoir évalué toutes les alternatives et que les bénéfices
                l'emportent sur les risques avant de confirmer.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 bg-gray-200 text-gray-800 rounded-lg font-semibold text-lg hover:bg-gray-300 transition shadow-md hover:shadow-lg"
          >
            ← Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-4 text-white rounded-lg font-bold text-lg transition shadow-md hover:shadow-lg ${config.button}`}
          >
            {warning.severity === 'critical' ? 'Confirmer malgré le risque' : 'Confirmer quand même'} →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionWarningModal;
