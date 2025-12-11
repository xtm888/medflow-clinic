/**
 * ApprovalWarningBanner Component
 * Displays warnings about délibérations (prior authorizations) required for procedures
 * Used in consultation workflows to alert clinicians before ordering procedures
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Building2,
  X,
  AlertCircle,
  Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import { createApprovalRequest } from '../services/approvalWarningService';

/**
 * Main banner component showing approval warnings
 */
export default function ApprovalWarningBanner({
  warnings,
  company,
  patient,
  onRequestApproval,
  onDismiss,
  showRequestButton = true,
  compact = false
}) {
  const [expanded, setExpanded] = useState(!compact);
  const [requesting, setRequesting] = useState({});

  const { excluded = [], blocking = [], warning = [], info = [], package: packageDeals = [] } = warnings || {};
  const hasExcludedServices = excluded.length > 0;
  const hasBlockingWarnings = blocking.length > 0;
  const hasPendingWarnings = warning.length > 0;
  const hasApproved = info.length > 0;
  const hasPackageDeals = packageDeals.length > 0;

  // Don't render if no warnings
  if (excluded.length === 0 && blocking.length === 0 && warning.length === 0 && info.length === 0 && packageDeals.length === 0) {
    return null;
  }

  const handleRequestApproval = async (act) => {
    if (!patient?._id || !company?._id) {
      toast.error('Impossible de soumettre la demande - données manquantes');
      return;
    }

    setRequesting(prev => ({ ...prev, [act.actCode]: true }));

    try {
      await createApprovalRequest({
        patient: patient._id,
        company: company._id,
        actCode: act.actCode,
        actName: act.actName,
        medicalJustification: {
          diagnosis: 'Consultation en cours',
          clinicalNotes: 'Demande soumise depuis le workflow de consultation',
          urgency: 'routine'
        }
      });

      toast.success(`Demande d'approbation soumise pour "${act.actName}"`);

      if (onRequestApproval) {
        onRequestApproval(act);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Erreur lors de la soumission';
      toast.error(message);
    } finally {
      setRequesting(prev => ({ ...prev, [act.actCode]: false }));
    }
  };

  return (
    <div className={`rounded-lg border-2 overflow-hidden ${
      hasExcludedServices
        ? 'border-gray-400 bg-gradient-to-r from-gray-50 to-slate-50'
        : hasBlockingWarnings
        ? 'border-red-300 bg-gradient-to-r from-red-50 to-orange-50'
        : hasPendingWarnings
        ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50'
        : 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50'
    }`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-3 flex items-center justify-between ${
          hasExcludedServices
            ? 'bg-gray-200 hover:bg-gray-300'
            : hasBlockingWarnings
            ? 'bg-red-100 hover:bg-red-200'
            : hasPendingWarnings
            ? 'bg-yellow-100 hover:bg-yellow-200'
            : 'bg-green-100 hover:bg-green-200'
        } transition-colors`}
      >
        <div className="flex items-center gap-3">
          {hasExcludedServices ? (
            <X className="h-5 w-5 text-gray-700" />
          ) : hasBlockingWarnings ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : hasPendingWarnings ? (
            <Clock className="h-5 w-5 text-yellow-600" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          <div className="text-left">
            <h4 className={`font-bold ${
              hasExcludedServices ? 'text-gray-800' : hasBlockingWarnings ? 'text-red-800' : hasPendingWarnings ? 'text-yellow-800' : 'text-green-800'
            }`}>
              {hasExcludedServices
                ? `${excluded.length} Service(s) non couvert(s)`
                : hasBlockingWarnings
                ? `${blocking.length} Délibération(s) requise(s)`
                : hasPendingWarnings
                ? `${warning.length} Approbation(s) en attente`
                : `${info.length} Approbation(s) validée(s)`
              }
            </h4>
            {company && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {company.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDismiss && !hasBlockingWarnings && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
              className="p-1 hover:bg-white/50 rounded"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Excluded Services - Not Covered */}
          {excluded.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <X className="h-4 w-4" />
                Services non couverts par la convention
              </h5>
              <div className="space-y-2">
                {excluded.map((act) => (
                  <div
                    key={act.actCode}
                    className="p-3 rounded-lg border bg-gray-100 border-gray-300 text-gray-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <X className="h-4 w-4 text-gray-600" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{act.actName}</p>
                        <p className="text-xs opacity-80">{act.detail}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded font-medium">
                      Patient 100%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocking Warnings - Needs Approval */}
          {blocking.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Actes nécessitant une approbation préalable
              </h5>
              <div className="space-y-2">
                {blocking.map((act) => (
                  <WarningItem
                    key={act.actCode}
                    act={act}
                    severity="blocking"
                    showRequestButton={showRequestButton}
                    isRequesting={requesting[act.actCode]}
                    onRequestApproval={() => handleRequestApproval(act)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Warnings */}
          {warning.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Approbations en attente de réponse
              </h5>
              <div className="space-y-2">
                {warning.map((act) => (
                  <WarningItem
                    key={act.actCode}
                    act={act}
                    severity="warning"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Approved */}
          {info.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Actes déjà approuvés
              </h5>
              <div className="space-y-2">
                {info.map((act) => (
                  <WarningItem
                    key={act.actCode}
                    act={act}
                    severity="info"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Info Message */}
          {hasBlockingWarnings && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-red-200">
              <p className="text-sm text-red-800">
                <strong>Important:</strong> Sans délibération, ces actes seront facturés à 100% au patient.
                L'entreprise ne remboursera pas les frais non approuvés préalablement.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual warning item
 */
function WarningItem({ act, severity, showRequestButton, isRequesting, onRequestApproval }) {
  const severityStyles = {
    blocking: 'bg-red-100 border-red-200 text-red-800',
    warning: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    info: 'bg-green-100 border-green-200 text-green-800'
  };

  const iconByType = {
    blocking: <AlertTriangle className="h-4 w-4 text-red-500" />,
    warning: <Clock className="h-4 w-4 text-yellow-500" />,
    info: <CheckCircle className="h-4 w-4 text-green-500" />
  };

  return (
    <div className={`p-3 rounded-lg border ${severityStyles[severity]} flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 flex-1">
        {iconByType[severity]}
        <div className="flex-1">
          <p className="font-medium text-sm">{act.actName}</p>
          <p className="text-xs opacity-80">{act.detail}</p>
          {act.reason && severity === 'blocking' && (
            <p className="text-xs mt-1 italic">
              <Info className="h-3 w-3 inline mr-1" />
              {act.reason}
            </p>
          )}
          {act.remainingQuantity !== undefined && severity === 'info' && (
            <p className="text-xs mt-1">
              Quantité restante: {act.remainingQuantity}
            </p>
          )}
        </div>
      </div>

      {severity === 'blocking' && showRequestButton && (
        <button
          onClick={onRequestApproval}
          disabled={isRequesting}
          className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-700 border border-red-300 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {isRequesting ? (
            <>
              <div className="h-4 w-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Demander
            </>
          )}
        </button>
      )}

      {severity === 'warning' && act.approvalId && (
        <span className="text-xs bg-yellow-200 px-2 py-1 rounded font-mono">
          {act.approvalId}
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline warning for use in forms
 */
export function ApprovalWarningInline({ actCode, actName, requiresApproval, approvalStatus, reason }) {
  if (!requiresApproval) return null;

  if (approvalStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
        <CheckCircle className="h-3 w-3" />
        Approuvé
      </span>
    );
  }

  if (approvalStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
        <Clock className="h-3 w-3" />
        En attente
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs" title={reason}>
      <AlertTriangle className="h-3 w-3" />
      Délibération requise
    </span>
  );
}

/**
 * Hook for managing approval warnings in a component
 */
export function useApprovalWarnings() {
  const [warnings, setWarnings] = useState({
    blocking: [],
    warning: [],
    info: []
  });
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);

  const checkWarnings = async (patientId, actCodes) => {
    if (!patientId || !actCodes?.length) {
      setWarnings({ blocking: [], warning: [], info: [] });
      return;
    }

    setLoading(true);
    try {
      const { checkApprovalRequirements, categorizeWarnings, generateWarningMessages } = await import('../services/approvalWarningService');

      const result = await checkApprovalRequirements(patientId, actCodes);

      if (result.hasConvention && result.company) {
        setCompany(result.company);
        const categorized = categorizeWarnings(result);
        const messages = generateWarningMessages(categorized, result.company.name);
        setWarnings(messages);
      } else {
        setCompany(null);
        setWarnings({ blocking: [], warning: [], info: [] });
      }
    } catch (error) {
      console.error('Error checking approval warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasBlockingWarnings = warnings.blocking.length > 0;
  const hasPendingWarnings = warnings.warning.length > 0;
  const totalWarnings = warnings.blocking.length + warnings.warning.length;

  return {
    warnings,
    company,
    loading,
    checkWarnings,
    hasBlockingWarnings,
    hasPendingWarnings,
    totalWarnings
  };
}
