/**
 * EditableHistorySidebar
 *
 * Collapsible sidebar for viewing and editing patient medical/ocular history
 * during ophthalmology consultations. Persists across workflow steps.
 */

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Eye,
  Users,
  AlertTriangle,
  Pill,
  Briefcase,
  Plus,
  X,
  Edit2,
  Check,
  Loader2,
  Save,
  Clock
} from 'lucide-react';
import { useHistory } from '../../../contexts/HistoryContext';

// Section components
function CollapsibleSection({ title, icon: Icon, count, children, defaultOpen = false, color = 'blue' }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 transition-colors`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colorClasses[color]?.split(' ')[1] || 'text-gray-600'}`} />
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {count > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${colorClasses[color]}`}>
              {count}
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Editable item component
function EditableItem({ item, onEdit, onRemove, renderDisplay, renderEdit, editMode, setEditMode }) {
  const isEditing = editMode === item._id;

  if (isEditing) {
    return (
      <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
        {renderEdit(item, (updates) => {
          onEdit(updates);
          setEditMode(null);
        })}
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => setEditMode(null)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors">
      <div className="flex-1 text-sm">
        {renderDisplay(item)}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditMode(item._id)}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="Modifier"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={() => onRemove()}
          className="p-1 text-gray-400 hover:text-red-600"
          title="Supprimer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// Quick add input
function QuickAddInput({ placeholder, onAdd }) {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
      >
        <Plus className="h-3 w-3" />
        Ajouter
      </button>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        placeholder={placeholder}
        className="flex-1 text-xs px-2 py-1 border rounded focus:ring-1 focus:ring-blue-500"
        autoFocus
      />
      <button
        onClick={handleAdd}
        className="p-1 text-green-600 hover:text-green-800"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={() => { setIsAdding(false); setValue(''); }}
        className="p-1 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Main sidebar component
export default function EditableHistorySidebar({ isCollapsed, onToggle }) {
  const {
    history,
    loading,
    error,
    isDirty,
    isSaving,
    lastSaved,
    addMedicalCondition,
    updateMedicalCondition,
    removeMedicalCondition,
    addOcularCondition,
    updateOcularCondition,
    removeOcularCondition,
    addFamilyHistory,
    updateFamilyHistory,
    removeFamilyHistory,
    addAllergy,
    updateAllergy,
    removeAllergy,
    addMedication,
    updateMedication,
    removeMedication,
    updateSocialHistory,
    saveHistory
  } = useHistory();

  const [editMode, setEditMode] = useState(null);

  if (isCollapsed) {
    return (
      <div className="w-10 bg-white border-l border-gray-200 flex flex-col items-center py-4 gap-3">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Ouvrir l'historique"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Section indicators */}
        <div className="flex flex-col gap-2 mt-4">
          {history.medicalHistory?.length > 0 && (
            <div className="relative" title={`${history.medicalHistory.length} conditions médicales`}>
              <Heart className="h-4 w-4 text-red-500" />
              <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                {history.medicalHistory.length}
              </span>
            </div>
          )}
          {history.ocularHistory?.length > 0 && (
            <div className="relative" title={`${history.ocularHistory.length} conditions oculaires`}>
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="absolute -top-1 -right-1 text-[10px] bg-blue-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                {history.ocularHistory.length}
              </span>
            </div>
          )}
          {history.allergies?.length > 0 && (
            <div className="relative" title={`${history.allergies.length} allergies`}>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="absolute -top-1 -right-1 text-[10px] bg-orange-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                {history.allergies.length}
              </span>
            </div>
          )}
          {history.medications?.length > 0 && (
            <div className="relative" title={`${history.medications.length} médicaments`}>
              <Pill className="h-4 w-4 text-green-500" />
              <span className="absolute -top-1 -right-1 text-[10px] bg-green-500 text-white rounded-full w-3 h-3 flex items-center justify-center">
                {history.medications.length}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <h3 className="font-medium text-gray-800 text-sm">Historique Patient</h3>
        <div className="flex items-center gap-2">
          {isDirty && !isSaving && (
            <button
              onClick={() => saveHistory()}
              className="p-1 text-blue-600 hover:text-blue-800"
              title="Sauvegarder"
            >
              <Save className="h-4 w-4" />
            </button>
          )}
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          <button
            onClick={onToggle}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      {lastSaved && (
        <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-b flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-50 text-red-700 text-xs border-b border-red-200">
          {error}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Medical History */}
        <CollapsibleSection
          title="Antécédents Médicaux"
          icon={Heart}
          count={history.medicalHistory?.length || 0}
          color="red"
          defaultOpen
        >
          <div className="space-y-2">
            {history.medicalHistory?.map((item, idx) => (
              <EditableItem
                key={item._id || idx}
                item={item}
                editMode={editMode}
                setEditMode={setEditMode}
                onEdit={(updates) => updateMedicalCondition(idx, updates)}
                onRemove={() => removeMedicalCondition(idx)}
                renderDisplay={(item) => (
                  <div>
                    <div className="font-medium text-gray-800">{item.condition}</div>
                    {item.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.status === 'active' ? 'bg-green-100 text-green-700' :
                        item.status === 'resolved' ? 'bg-gray-100 text-gray-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.status === 'active' ? 'Actif' : item.status === 'resolved' ? 'Résolu' : item.status}
                      </span>
                    )}
                  </div>
                )}
                renderEdit={(item, onSave) => (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={item.condition}
                      className="w-full text-xs px-2 py-1 border rounded"
                      onBlur={(e) => onSave({ condition: e.target.value })}
                    />
                    <select
                      defaultValue={item.status}
                      onChange={(e) => onSave({ status: e.target.value })}
                      className="w-full text-xs px-2 py-1 border rounded"
                    >
                      <option value="active">Actif</option>
                      <option value="controlled">Contrôlé</option>
                      <option value="resolved">Résolu</option>
                    </select>
                  </div>
                )}
              />
            ))}
            <QuickAddInput
              placeholder="Nouvelle condition..."
              onAdd={(condition) => addMedicalCondition({ condition })}
            />
          </div>
        </CollapsibleSection>

        {/* Ocular History */}
        <CollapsibleSection
          title="Antécédents Oculaires"
          icon={Eye}
          count={history.ocularHistory?.length || 0}
          color="blue"
          defaultOpen
        >
          <div className="space-y-2">
            {history.ocularHistory?.map((item, idx) => (
              <EditableItem
                key={item._id || idx}
                item={item}
                editMode={editMode}
                setEditMode={setEditMode}
                onEdit={(updates) => updateOcularCondition(idx, updates)}
                onRemove={() => removeOcularCondition(idx)}
                renderDisplay={(item) => (
                  <div>
                    <div className="font-medium text-gray-800">{item.condition}</div>
                    <div className="flex gap-2 mt-1">
                      {item.eye && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          {item.eye}
                        </span>
                      )}
                      {item.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.status === 'active' ? 'Actif' : 'Inactif'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                renderEdit={(item, onSave) => (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={item.condition}
                      className="w-full text-xs px-2 py-1 border rounded"
                      onBlur={(e) => onSave({ condition: e.target.value })}
                    />
                    <select
                      defaultValue={item.eye || ''}
                      onChange={(e) => onSave({ eye: e.target.value })}
                      className="w-full text-xs px-2 py-1 border rounded"
                    >
                      <option value="">Sélectionner œil</option>
                      <option value="OD">OD (Droit)</option>
                      <option value="OS">OS (Gauche)</option>
                      <option value="OU">OU (Les deux)</option>
                    </select>
                  </div>
                )}
              />
            ))}
            <QuickAddInput
              placeholder="Nouvelle condition oculaire..."
              onAdd={(condition) => addOcularCondition({ condition })}
            />
          </div>
        </CollapsibleSection>

        {/* Allergies */}
        <CollapsibleSection
          title="Allergies"
          icon={AlertTriangle}
          count={history.allergies?.length || 0}
          color="orange"
        >
          <div className="space-y-2">
            {history.allergies?.length === 0 && (
              <p className="text-xs text-gray-500 italic">Aucune allergie connue</p>
            )}
            {history.allergies?.map((item, idx) => (
              <EditableItem
                key={item._id || idx}
                item={item}
                editMode={editMode}
                setEditMode={setEditMode}
                onEdit={(updates) => updateAllergy(idx, updates)}
                onRemove={() => removeAllergy(idx)}
                renderDisplay={(item) => (
                  <div>
                    <div className="font-medium text-gray-800">{item.allergen || item.name}</div>
                    {item.severity && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.severity === 'severe' ? 'bg-red-100 text-red-700' :
                        item.severity === 'moderate' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.severity === 'severe' ? 'Sévère' :
                         item.severity === 'moderate' ? 'Modérée' : 'Légère'}
                      </span>
                    )}
                    {item.reaction && (
                      <p className="text-xs text-gray-500 mt-1">{item.reaction}</p>
                    )}
                  </div>
                )}
                renderEdit={(item, onSave) => (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={item.allergen || item.name}
                      className="w-full text-xs px-2 py-1 border rounded"
                      placeholder="Allergène"
                      onBlur={(e) => onSave({ allergen: e.target.value })}
                    />
                    <select
                      defaultValue={item.severity || 'moderate'}
                      onChange={(e) => onSave({ severity: e.target.value })}
                      className="w-full text-xs px-2 py-1 border rounded"
                    >
                      <option value="mild">Légère</option>
                      <option value="moderate">Modérée</option>
                      <option value="severe">Sévère</option>
                    </select>
                    <input
                      type="text"
                      defaultValue={item.reaction}
                      className="w-full text-xs px-2 py-1 border rounded"
                      placeholder="Réaction"
                      onBlur={(e) => onSave({ reaction: e.target.value })}
                    />
                  </div>
                )}
              />
            ))}
            <QuickAddInput
              placeholder="Nouvelle allergie..."
              onAdd={(allergen) => addAllergy({ allergen })}
            />
          </div>
        </CollapsibleSection>

        {/* Medications */}
        <CollapsibleSection
          title="Médicaments"
          icon={Pill}
          count={history.medications?.length || 0}
          color="green"
        >
          <div className="space-y-2">
            {history.medications?.map((item, idx) => (
              <EditableItem
                key={item._id || idx}
                item={item}
                editMode={editMode}
                setEditMode={setEditMode}
                onEdit={(updates) => updateMedication(idx, updates)}
                onRemove={() => removeMedication(idx)}
                renderDisplay={(item) => (
                  <div>
                    <div className="font-medium text-gray-800">{item.name || item.medication}</div>
                    <div className="text-xs text-gray-500">
                      {item.dose && <span>{item.dose}</span>}
                      {item.frequency && <span> - {item.frequency}</span>}
                    </div>
                    {item.forEyes && item.eye && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                        {item.eye}
                      </span>
                    )}
                  </div>
                )}
                renderEdit={(item, onSave) => (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={item.name || item.medication}
                      className="w-full text-xs px-2 py-1 border rounded"
                      placeholder="Nom du médicament"
                      onBlur={(e) => onSave({ name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        defaultValue={item.dose}
                        className="text-xs px-2 py-1 border rounded"
                        placeholder="Dose"
                        onBlur={(e) => onSave({ dose: e.target.value })}
                      />
                      <input
                        type="text"
                        defaultValue={item.frequency}
                        className="text-xs px-2 py-1 border rounded"
                        placeholder="Fréquence"
                        onBlur={(e) => onSave({ frequency: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              />
            ))}
            <QuickAddInput
              placeholder="Nouveau médicament..."
              onAdd={(name) => addMedication({ name })}
            />
          </div>
        </CollapsibleSection>

        {/* Family History */}
        <CollapsibleSection
          title="Antécédents Familiaux"
          icon={Users}
          count={history.familyHistory?.length || 0}
          color="purple"
        >
          <div className="space-y-2">
            {history.familyHistory?.map((item, idx) => (
              <EditableItem
                key={item._id || idx}
                item={item}
                editMode={editMode}
                setEditMode={setEditMode}
                onEdit={(updates) => updateFamilyHistory(idx, updates)}
                onRemove={() => removeFamilyHistory(idx)}
                renderDisplay={(item) => (
                  <div>
                    <div className="font-medium text-gray-800">{item.condition}</div>
                    <div className="flex gap-2 mt-1">
                      {item.relation && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          {item.relation}
                        </span>
                      )}
                      {item.isOcularCondition && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          Oculaire
                        </span>
                      )}
                    </div>
                  </div>
                )}
                renderEdit={(item, onSave) => (
                  <div className="space-y-2">
                    <input
                      type="text"
                      defaultValue={item.condition}
                      className="w-full text-xs px-2 py-1 border rounded"
                      placeholder="Condition"
                      onBlur={(e) => onSave({ condition: e.target.value })}
                    />
                    <select
                      defaultValue={item.relation || ''}
                      onChange={(e) => onSave({ relation: e.target.value })}
                      className="w-full text-xs px-2 py-1 border rounded"
                    >
                      <option value="">Relation</option>
                      <option value="mother">Mère</option>
                      <option value="father">Père</option>
                      <option value="sibling">Frère/Sœur</option>
                      <option value="grandparent">Grand-parent</option>
                      <option value="aunt_uncle">Oncle/Tante</option>
                    </select>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        defaultChecked={item.isOcularCondition}
                        onChange={(e) => onSave({ isOcularCondition: e.target.checked })}
                      />
                      Condition oculaire
                    </label>
                  </div>
                )}
              />
            ))}
            <QuickAddInput
              placeholder="Nouvelle condition familiale..."
              onAdd={(condition) => addFamilyHistory({ condition })}
            />
          </div>
        </CollapsibleSection>

        {/* Social History */}
        <CollapsibleSection
          title="Histoire Sociale"
          icon={Briefcase}
          count={0}
          color="gray"
        >
          <div className="space-y-3">
            {/* Occupation */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Profession</label>
              <input
                type="text"
                value={history.socialHistory?.occupation || ''}
                onChange={(e) => updateSocialHistory({ occupation: e.target.value })}
                className="w-full text-xs px-2 py-1 border rounded"
                placeholder="Ex: Informaticien"
              />
            </div>

            {/* Smoking */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tabac</label>
              <select
                value={history.socialHistory?.smoking?.status || 'unknown'}
                onChange={(e) => updateSocialHistory({
                  smoking: { ...history.socialHistory?.smoking, status: e.target.value }
                })}
                className="w-full text-xs px-2 py-1 border rounded"
              >
                <option value="unknown">Non renseigné</option>
                <option value="never">Jamais fumé</option>
                <option value="former">Ancien fumeur</option>
                <option value="current">Fumeur actuel</option>
              </select>
            </div>

            {/* VDU Usage */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Temps d'écran (h/jour)</label>
              <input
                type="number"
                value={history.socialHistory?.vduUsage?.hoursPerDay || ''}
                onChange={(e) => updateSocialHistory({
                  vduUsage: { ...history.socialHistory?.vduUsage, hoursPerDay: parseInt(e.target.value) || null }
                })}
                className="w-full text-xs px-2 py-1 border rounded"
                placeholder="Heures par jour"
                min="0"
                max="24"
              />
            </div>

            {/* UV Exposure */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Exposition UV</label>
              <select
                value={history.socialHistory?.uvExposure?.level || 'moderate'}
                onChange={(e) => updateSocialHistory({
                  uvExposure: { ...history.socialHistory?.uvExposure, level: e.target.value }
                })}
                className="w-full text-xs px-2 py-1 border rounded"
              >
                <option value="low">Faible</option>
                <option value="moderate">Modérée</option>
                <option value="high">Élevée</option>
              </select>
              <label className="flex items-center gap-2 text-xs mt-1">
                <input
                  type="checkbox"
                  checked={history.socialHistory?.uvExposure?.usesProtection || false}
                  onChange={(e) => updateSocialHistory({
                    uvExposure: { ...history.socialHistory?.uvExposure, usesProtection: e.target.checked }
                  })}
                />
                Utilise une protection UV
              </label>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
