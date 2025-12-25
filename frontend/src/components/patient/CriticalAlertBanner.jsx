/**
 * CriticalAlertBanner - Prominent red highlighted critical notes
 *
 * Displays important patient alerts like:
 * - Drug allergies
 * - Surgery alerts
 * - Payment issues
 * - Critical medical history
 * - Custom important notes
 *
 * Styled like "En rouge stabilo" - bold red highlighting for immediate attention
 */

import { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  X,
  Plus,
  Edit2,
  Trash2,
  Pill,
  CreditCard,
  Heart,
  Activity,
  Save,
  ShieldAlert
} from 'lucide-react';

// Alert categories with their icons and colors
const ALERT_CATEGORIES = {
  allergy: {
    label: 'Allergie',
    icon: Pill,
    bgColor: 'bg-red-600',
    textColor: 'text-white',
    borderColor: 'border-red-700'
  },
  surgery: {
    label: 'Chirurgie',
    icon: Activity,
    bgColor: 'bg-orange-600',
    textColor: 'text-white',
    borderColor: 'border-orange-700'
  },
  medical: {
    label: 'Médical',
    icon: Heart,
    bgColor: 'bg-red-500',
    textColor: 'text-white',
    borderColor: 'border-red-600'
  },
  payment: {
    label: 'Paiement',
    icon: CreditCard,
    bgColor: 'bg-amber-600',
    textColor: 'text-white',
    borderColor: 'border-amber-700'
  },
  important: {
    label: 'Important',
    icon: AlertTriangle,
    bgColor: 'bg-red-700',
    textColor: 'text-white',
    borderColor: 'border-red-800'
  }
};

/**
 * Single Alert Item
 */
function AlertItem({ alert, category, onEdit, onDelete, compact = false }) {
  const categoryConfig = ALERT_CATEGORIES[category] || ALERT_CATEGORIES.important;
  const Icon = categoryConfig.icon;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${categoryConfig.bgColor} ${categoryConfig.textColor} text-xs font-medium`}>
        <Icon className="w-3 h-3" />
        <span>{alert.text || alert}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${categoryConfig.bgColor} ${categoryConfig.textColor} ${categoryConfig.borderColor} border-2`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm uppercase tracking-wide">
          {categoryConfig.label}
        </div>
        <div className="text-sm mt-1">
          {alert.text || alert}
        </div>
        {alert.addedAt && (
          <div className="text-xs opacity-75 mt-1">
            Ajouté le {new Date(alert.addedAt).toLocaleDateString('fr-FR')}
            {alert.addedBy && ` par ${alert.addedBy}`}
          </div>
        )}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(alert)}
              className="p-1.5 rounded hover:bg-white/20 transition"
              title="Modifier"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(alert)}
              className="p-1.5 rounded hover:bg-white/20 transition"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Alert Editor Modal
 */
function AlertEditor({ alert, onSave, onCancel }) {
  const [text, setText] = useState(alert?.text || '');
  const [category, setCategory] = useState(alert?.category || 'important');

  const handleSave = () => {
    if (text.trim()) {
      onSave({
        ...alert,
        text: text.trim(),
        category,
        addedAt: alert?.addedAt || new Date().toISOString()
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-red-600 text-white rounded-t-lg">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {alert ? 'Modifier l\'alerte' : 'Nouvelle alerte'}
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ALERT_CATEGORIES).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                      category === key
                        ? `${config.bgColor} ${config.textColor} border-transparent`
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alert Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message d'alerte
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Entrez le message d'alerte..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Critical Alert Banner Component
 */
export default function CriticalAlertBanner({
  alerts = [],
  allergies = [],
  importantNotes = '',
  onAddAlert,
  onEditAlert,
  onDeleteAlert,
  canEdit = true,
  compact = false,
  showAllCategories = true
}) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [expanded, setExpanded] = useState(true);

  // Combine all alerts from different sources
  const allAlerts = [
    // Explicit alerts
    ...alerts.map(a => typeof a === 'string' ? { text: a, category: 'important' } : a),
    // Allergies
    ...allergies.map(a => ({
      text: typeof a === 'object' ? (a.name || a.allergen) : a,
      category: 'allergy',
      severity: a.severity
    })),
    // Important notes
    ...(importantNotes ? [{ text: importantNotes, category: 'important' }] : [])
  ].filter(a => a.text);

  // Group by category if showing all categories
  const groupedAlerts = showAllCategories
    ? allAlerts.reduce((acc, alert) => {
        const cat = alert.category || 'important';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(alert);
        return acc;
      }, {})
    : { all: allAlerts };

  const hasAlerts = allAlerts.length > 0;

  const handleEdit = (alert) => {
    setEditingAlert(alert);
    setShowEditor(true);
  };

  const handleSave = (alert) => {
    if (editingAlert) {
      onEditAlert?.(alert);
    } else {
      onAddAlert?.(alert);
    }
    setShowEditor(false);
    setEditingAlert(null);
  };

  // Compact view - just badges
  if (compact && hasAlerts) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {allAlerts.slice(0, 3).map((alert, idx) => (
          <AlertItem
            key={idx}
            alert={alert}
            category={alert.category}
            compact
          />
        ))}
        {allAlerts.length > 3 && (
          <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
            +{allAlerts.length - 3}
          </span>
        )}
      </div>
    );
  }

  // No alerts and no edit capability
  if (!hasAlerts && !canEdit) return null;

  return (
    <div className={`rounded-lg overflow-hidden ${hasAlerts ? 'border-2 border-red-500' : 'border border-dashed border-gray-300'}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-2 cursor-pointer ${
          hasAlerts ? 'bg-red-600 text-white' : 'bg-gray-50 text-gray-600'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert className="w-5 h-5" />
          <span>
            {hasAlerts
              ? `⚠️ ALERTES CRITIQUES (${allAlerts.length})`
              : 'Aucune alerte'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingAlert(null);
                setShowEditor(true);
              }}
              className={`p-1.5 rounded transition ${
                hasAlerts ? 'hover:bg-white/20' : 'hover:bg-gray-200'
              }`}
              title="Ajouter une alerte"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <span className={`text-xs ${hasAlerts ? 'opacity-75' : 'text-gray-400'}`}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Content */}
      {expanded && hasAlerts && (
        <div className="p-3 bg-red-50 space-y-3">
          {showAllCategories ? (
            // Grouped by category
            Object.entries(groupedAlerts).map(([category, categoryAlerts]) => (
              <div key={category} className="space-y-2">
                {categoryAlerts.map((alert, idx) => (
                  <AlertItem
                    key={idx}
                    alert={alert}
                    category={category}
                    onEdit={canEdit ? handleEdit : null}
                    onDelete={canEdit ? onDeleteAlert : null}
                  />
                ))}
              </div>
            ))
          ) : (
            // Flat list
            allAlerts.map((alert, idx) => (
              <AlertItem
                key={idx}
                alert={alert}
                category={alert.category}
                onEdit={canEdit ? handleEdit : null}
                onDelete={canEdit ? onDeleteAlert : null}
              />
            ))
          )}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <AlertEditor
          alert={editingAlert}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingAlert(null);
          }}
        />
      )}
    </div>
  );
}

// Export sub-components and utilities
export { AlertItem, AlertEditor, ALERT_CATEGORIES };
