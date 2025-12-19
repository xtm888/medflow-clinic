/**
 * ContactLensHistoryTab - Patient Contact Lens History
 *
 * StudioVision Parity: Tab 1 of Contact Lens Fitting workflow
 *
 * Features:
 * - New vs existing wearer toggle
 * - Wearing schedule and compliance rating
 * - Current lens parameters (OD/OS)
 * - Issues checklist with severity
 */

import { useCallback } from 'react';
import {
  User,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  Eye
} from 'lucide-react';

// Wearing schedule options
const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Quotidien', labelEn: 'Daily wear' },
  { value: 'extended', label: 'Port prolongé', labelEn: 'Extended wear' },
  { value: 'occasional', label: 'Occasionnel', labelEn: 'Occasional' },
  { value: 'ortho_k', label: 'Ortho-K (nuit)', labelEn: 'Ortho-K (overnight)' }
];

// Replacement frequency options
const FREQUENCY_OPTIONS = [
  { value: 'daily_disposable', label: 'Journalières', labelEn: 'Daily disposable' },
  { value: 'biweekly', label: 'Bi-hebdomadaires', labelEn: 'Biweekly' },
  { value: 'monthly', label: 'Mensuelles', labelEn: 'Monthly' },
  { value: 'quarterly', label: 'Trimestrielles', labelEn: 'Quarterly' },
  { value: 'annual', label: 'Annuelles', labelEn: 'Annual' }
];

// Current issues checklist
const ISSUE_OPTIONS = [
  { value: 'dryness', label: 'Sécheresse', labelEn: 'Dryness', icon: '💧' },
  { value: 'redness', label: 'Rougeur', labelEn: 'Redness', icon: '🔴' },
  { value: 'irritation', label: 'Irritation', labelEn: 'Irritation', icon: '😣' },
  { value: 'blurry_vision', label: 'Vision floue', labelEn: 'Blurry vision', icon: '👓' },
  { value: 'halos_glare', label: 'Halos/Éblouissement', labelEn: 'Halos/Glare', icon: '✨' },
  { value: 'difficult_insertion', label: 'Insertion difficile', labelEn: 'Difficult insertion', icon: '👆' },
  { value: 'difficult_removal', label: 'Retrait difficile', labelEn: 'Difficult removal', icon: '👇' },
  { value: 'discomfort_after_6hrs', label: 'Inconfort après 6h', labelEn: 'Discomfort after 6hrs', icon: '⏰' },
  { value: 'lens_decentration', label: 'Décentrement', labelEn: 'Lens decentration', icon: '🎯' },
  { value: 'none', label: 'Aucun problème', labelEn: 'No issues', icon: '✅' }
];

// Compliance star labels
const COMPLIANCE_LABELS = ['Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'];

export default function ContactLensHistoryTab({
  data = {},
  currentCorrection,
  onUpdate,
  readOnly = false
}) {
  // Update handler
  const handleUpdate = useCallback((field, value) => {
    if (readOnly) return;

    onUpdate(prev => ({
      ...prev,
      [field]: value
    }));
  }, [onUpdate, readOnly]);

  // Handle nested update
  const handleNestedUpdate = useCallback((parent, field, value) => {
    if (readOnly) return;

    onUpdate(prev => ({
      ...prev,
      [parent]: {
        ...(prev[parent] || {}),
        [field]: value
      }
    }));
  }, [onUpdate, readOnly]);

  // Handle current parameters update
  const handleParameterUpdate = useCallback((eye, field, value) => {
    if (readOnly) return;

    onUpdate(prev => ({
      ...prev,
      currentParameters: {
        ...(prev.currentParameters || {}),
        [eye]: {
          ...(prev.currentParameters?.[eye] || {}),
          [field]: value
        }
      }
    }));
  }, [onUpdate, readOnly]);

  // Handle issue toggle
  const handleIssueToggle = useCallback((issueValue, severity = 'mild') => {
    if (readOnly) return;

    onUpdate(prev => {
      const currentIssues = prev.currentIssues || [];
      const existingIndex = currentIssues.findIndex(i => i.type === issueValue);

      let newIssues;
      if (existingIndex >= 0) {
        // Remove if already selected
        newIssues = currentIssues.filter(i => i.type !== issueValue);
      } else {
        // Add new issue
        if (issueValue === 'none') {
          // If "none" selected, clear all others
          newIssues = [{ type: 'none', severity: 'mild' }];
        } else {
          // Remove "none" if adding other issues
          newIssues = [
            ...currentIssues.filter(i => i.type !== 'none'),
            { type: issueValue, severity }
          ];
        }
      }

      return { ...prev, currentIssues: newIssues };
    });
  }, [onUpdate, readOnly]);

  // Update issue severity
  const handleSeverityChange = useCallback((issueValue, severity) => {
    if (readOnly) return;

    onUpdate(prev => ({
      ...prev,
      currentIssues: (prev.currentIssues || []).map(i =>
        i.type === issueValue ? { ...i, severity } : i
      )
    }));
  }, [onUpdate, readOnly]);

  // Check if issue is selected
  const isIssueSelected = (issueValue) => {
    return (data.currentIssues || []).some(i => i.type === issueValue);
  };

  // Get issue severity
  const getIssueSeverity = (issueValue) => {
    const issue = (data.currentIssues || []).find(i => i.type === issueValue);
    return issue?.severity || 'mild';
  };

  return (
    <div className="space-y-6">
      {/* Wearer Status */}
      <div className="p-4 bg-blue-50 rounded-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-blue-700">
              Statut du patient
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Porteur de lentilles ?</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={data.isWearer || false}
                onChange={(e) => handleUpdate('isWearer', e.target.checked)}
                className="sr-only peer"
                disabled={readOnly}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={`px-3 py-1 rounded text-sm font-medium ${data.isWearer ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {data.isWearer ? 'OUI' : 'NON'}
            </span>
          </div>
        </div>
      </div>

      {/* Wearer Details - Only show if wearer */}
      {data.isWearer && (
        <>
          {/* Experience & Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Années de port</span>
                </span>
              </label>
              <input
                type="number"
                value={data.yearsWearing || ''}
                onChange={(e) => handleUpdate('yearsWearing', parseFloat(e.target.value))}
                placeholder="Ex: 5"
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mode de port</label>
              <select
                value={data.schedule || ''}
                onChange={(e) => handleUpdate('schedule', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Sélectionner...</option>
                {SCHEDULE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fréquence de remplacement</label>
              <select
                value={data.frequency || ''}
                onChange={(e) => handleUpdate('frequency', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Sélectionner...</option>
                {FREQUENCY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Brand */}
          <div>
            <label className="block text-sm font-medium mb-1">Marque actuelle</label>
            <input
              value={data.currentBrand || ''}
              onChange={(e) => handleUpdate('currentBrand', e.target.value)}
              placeholder="Ex: Acuvue Oasys, Air Optix, Biofinity..."
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {/* Compliance Rating */}
          <div className="p-4 bg-gray-50 rounded-md">
            <div>
              <label className="block text-sm font-medium mb-2">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>Compliance / Observance (1-5)</span>
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={data.compliance?.rating || 3}
                  onChange={(e) => handleNestedUpdate('compliance', 'rating', parseInt(e.target.value))}
                  disabled={readOnly}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <span className="text-lg font-bold w-8 text-center">{data.compliance?.rating || 3}</span>
              </div>
              <div className="flex justify-between mt-1">
                {[1, 2, 3, 4, 5].map(val => (
                  <span key={val} className="text-xs text-gray-500">{val}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {COMPLIANCE_LABELS[(data.compliance?.rating || 3) - 1]}
              </p>
              <input
                className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                value={data.compliance?.notes || ''}
                onChange={(e) => handleNestedUpdate('compliance', 'notes', e.target.value)}
                placeholder="Notes sur la compliance..."
                disabled={readOnly}
              />
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Current Parameters OD/OS */}
          <div>
            <h4 className="font-bold mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Paramètres actuels
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {['OD', 'OS'].map(eye => (
                <div key={eye} className={`p-3 rounded-md ${eye === 'OD' ? 'bg-green-50' : 'bg-blue-50'}`}>
                  <h5 className={`font-bold mb-2 ${eye === 'OD' ? 'text-green-700' : 'text-blue-700'}`}>
                    {eye} - {eye === 'OD' ? 'Droit' : 'Gauche'}
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Sphère</label>
                      <input
                        type="number"
                        step="0.25"
                        value={data.currentParameters?.[eye]?.sphere || ''}
                        onChange={(e) => handleParameterUpdate(eye, 'sphere', parseFloat(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Cylindre</label>
                      <input
                        type="number"
                        step="0.25"
                        value={data.currentParameters?.[eye]?.cylinder || ''}
                        onChange={(e) => handleParameterUpdate(eye, 'cylinder', parseFloat(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Axe</label>
                      <input
                        type="number"
                        value={data.currentParameters?.[eye]?.axis || ''}
                        onChange={(e) => handleParameterUpdate(eye, 'axis', parseInt(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">BC</label>
                      <input
                        type="number"
                        step="0.1"
                        value={data.currentParameters?.[eye]?.baseCurve || ''}
                        onChange={(e) => handleParameterUpdate(eye, 'baseCurve', parseFloat(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Diamètre</label>
                      <input
                        type="number"
                        step="0.1"
                        value={data.currentParameters?.[eye]?.diameter || ''}
                        onChange={(e) => handleParameterUpdate(eye, 'diameter', parseFloat(e.target.value))}
                        disabled={readOnly}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Current Issues Checklist */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="font-bold">Problèmes actuels</span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              Cochez tous les problèmes signalés par le patient
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ISSUE_OPTIONS.map(issue => {
                const isSelected = isIssueSelected(issue.value);
                const severity = getIssueSeverity(issue.value);

                return (
                  <div
                    key={issue.value}
                    className={`p-3 rounded-md border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? issue.value === 'none'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    } ${readOnly ? 'cursor-default' : ''}`}
                    onClick={() => !readOnly && handleIssueToggle(issue.value)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{issue.icon}</span>
                      <div>
                        <span className={`text-sm ${isSelected ? 'font-bold' : ''}`}>
                          {issue.label}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {issue.labelEn}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected && issue.value !== 'none' && (
                        <select
                          value={severity}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSeverityChange(issue.value, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={readOnly}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none"
                        >
                          <option value="mild">Léger</option>
                          <option value="moderate">Modéré</option>
                          <option value="severe">Sévère</option>
                        </select>
                      )}

                      {isSelected && (
                        <CheckCircle className={`w-5 h-5 ${issue.value === 'none' ? 'text-green-500' : 'text-orange-500'}`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* New Wearer Notice */}
      {!data.isWearer && (
        <div className="p-6 bg-blue-50 rounded-md text-center">
          <User className="w-10 h-10 text-blue-400 mx-auto mb-3" />
          <h4 className="font-bold text-blue-700 text-lg">
            Nouveau porteur de lentilles
          </h4>
          <p className="text-gray-600 mt-2">
            Ce patient n'a jamais porté de lentilles de contact.
            Passez à l'onglet "Paramètres" pour commencer l'adaptation.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Issues summary badge
 */
export function IssuesSummaryBadge({ issues = [] }) {
  if (issues.length === 0 || (issues.length === 1 && issues[0].type === 'none')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        <span>Aucun problème</span>
      </span>
    );
  }

  const severeCount = issues.filter(i => i.severity === 'severe').length;

  return (
    <div className="flex items-center gap-2">
      <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
        {issues.length} problème{issues.length > 1 ? 's' : ''}
      </span>
      {severeCount > 0 && (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          {severeCount} sévère{severeCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
