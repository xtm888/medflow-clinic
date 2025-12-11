/**
 * MedicationEntryForm - Enhanced medication entry with route, location, and tapering
 * Used in PrescriptionStep for detailed medication prescriptions
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Eye, Pill, Clock, ChevronDown, ChevronUp, Check, X, AlertTriangle,
  Plus, Minus, Calendar, Info
} from 'lucide-react';
import {
  ADMINISTRATION_ROUTES,
  ROUTE_CATEGORIES,
  EYE_OPTIONS,
  EYE_AREA_OPTIONS,
  FREQUENCY_OPTIONS,
  TAPERING_TEMPLATES,
  getSuggestedTaperingTemplates,
  calculateTaperingDates,
  requiresTapering,
  routeRequiresEye,
  formatTaperingSchedule
} from '../data/medicationRoutes';

export default function MedicationEntryForm({
  medication,
  onUpdate,
  onRemove,
  readOnly = false,
  showTapering = true,
  compact = false
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTaperingBuilder, setShowTaperingBuilder] = useState(false);
  const [suggestedTemplates, setSuggestedTemplates] = useState([]);

  // Check if medication needs tapering
  useEffect(() => {
    if (medication?.name || medication?.genericName) {
      const name = medication.name || medication.genericName;
      const templates = getSuggestedTaperingTemplates(name);
      setSuggestedTemplates(templates);

      // Auto-show tapering if drug typically requires it
      if (templates.length > 0 && !medication.tapering?.enabled) {
        setShowTaperingBuilder(requiresTapering(name));
      }
    }
  }, [medication?.name, medication?.genericName]);

  // Check if current route requires eye selection
  const needsEyeSelection = useMemo(() => {
    return routeRequiresEye(medication?.route);
  }, [medication?.route]);

  // Handle field update
  const handleFieldChange = (field, value) => {
    onUpdate({
      ...medication,
      [field]: value
    });
  };

  // Handle nested field update
  const handleNestedChange = (parent, field, value) => {
    onUpdate({
      ...medication,
      [parent]: {
        ...medication[parent],
        [field]: value
      }
    });
  };

  // Apply tapering template
  const applyTaperingTemplate = (templateId) => {
    const template = TAPERING_TEMPLATES[templateId];
    if (!template) return;

    const scheduleWithDates = calculateTaperingDates(template);

    onUpdate({
      ...medication,
      tapering: {
        enabled: true,
        reason: template.indication,
        template: templateId,
        schedule: scheduleWithDates,
        totalDurationDays: template.totalDurationDays
      }
    });
    setShowTaperingBuilder(true);
  };

  // Toggle tapering
  const toggleTapering = () => {
    onUpdate({
      ...medication,
      tapering: {
        ...medication.tapering,
        enabled: !medication.tapering?.enabled
      }
    });
    if (!medication.tapering?.enabled) {
      setShowTaperingBuilder(true);
    }
  };

  // Add tapering step
  const addTaperingStep = () => {
    const currentSchedule = medication.tapering?.schedule || [];
    const lastStep = currentSchedule[currentSchedule.length - 1];
    const newStepNumber = currentSchedule.length + 1;

    const newStep = {
      stepNumber: newStepNumber,
      dose: lastStep?.dose || { amount: 1, unit: 'goutte' },
      frequency: lastStep ? FREQUENCY_OPTIONS.find(f => f.times < (lastStep.frequencyTimes || 4))?.value || '1x/jour' : '4x/jour',
      frequencyTimes: lastStep ? Math.max(1, (lastStep.frequencyTimes || 4) - 1) : 4,
      durationDays: 7,
      instructions: `Étape ${newStepNumber}`
    };

    onUpdate({
      ...medication,
      tapering: {
        ...medication.tapering,
        schedule: [...currentSchedule, newStep]
      }
    });
  };

  // Remove tapering step
  const removeTaperingStep = (index) => {
    const newSchedule = medication.tapering?.schedule.filter((_, i) => i !== index) || [];
    onUpdate({
      ...medication,
      tapering: {
        ...medication.tapering,
        schedule: newSchedule.map((step, i) => ({ ...step, stepNumber: i + 1 }))
      }
    });
  };

  // Update tapering step
  const updateTaperingStep = (index, field, value) => {
    const newSchedule = [...(medication.tapering?.schedule || [])];
    newSchedule[index] = {
      ...newSchedule[index],
      [field]: value
    };

    // If frequency changed, update frequencyTimes
    if (field === 'frequency') {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === value);
      newSchedule[index].frequencyTimes = freqOption?.times || 1;
    }

    // Recalculate total duration
    const totalDays = newSchedule.reduce((sum, step) => sum + (step.durationDays || 0), 0);

    onUpdate({
      ...medication,
      tapering: {
        ...medication.tapering,
        schedule: newSchedule,
        totalDurationDays: totalDays
      }
    });
  };

  if (compact) {
    // Compact view for lists
    return (
      <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
        <div className="flex-1">
          <div className="font-medium">{medication.name || medication.genericName}</div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            {medication.route && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                {ADMINISTRATION_ROUTES.find(r => r.value === medication.route)?.labelShort || medication.route}
              </span>
            )}
            {medication.applicationLocation?.eye && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                {medication.applicationLocation.eye}
              </span>
            )}
            {medication.tapering?.enabled && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                Dégression
              </span>
            )}
            {medication.dosage?.frequency && (
              <span>{medication.dosage.frequency}</span>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => onRemove(medication)}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Pill className="w-5 h-5 text-blue-600" />
          <div>
            <div className="font-medium">{medication.name || medication.genericName || 'Nouveau médicament'}</div>
            {medication.genericName && medication.name !== medication.genericName && (
              <div className="text-xs text-gray-500">{medication.genericName}</div>
            )}
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={() => onRemove(medication)}
            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Row 1: Route and Eye Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Administration Route */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voie d'administration
            </label>
            <select
              value={medication.route || 'oral'}
              onChange={(e) => handleFieldChange('route', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ROUTE_CATEGORIES.map(cat => (
                <optgroup key={cat.value} label={`${cat.icon} ${cat.label}`}>
                  {ADMINISTRATION_ROUTES.filter(r => r.category === cat.value).map(route => (
                    <option key={route.value} value={route.value}>
                      {route.icon} {route.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Eye Selection (conditional) */}
          {needsEyeSelection && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Eye className="w-4 h-4 inline mr-1" />
                Œil à traiter
              </label>
              <div className="flex gap-2">
                {EYE_OPTIONS.map(eye => (
                  <button
                    key={eye.value}
                    onClick={() => handleNestedChange('applicationLocation', 'eye', eye.value)}
                    disabled={readOnly}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium transition-all ${
                      medication.applicationLocation?.eye === eye.value
                        ? `border-${eye.color}-500 bg-${eye.color}-50 text-${eye.color}-700`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{
                      borderColor: medication.applicationLocation?.eye === eye.value
                        ? (eye.value === 'OD' ? '#3b82f6' : eye.value === 'OS' ? '#22c55e' : '#a855f7')
                        : undefined,
                      backgroundColor: medication.applicationLocation?.eye === eye.value
                        ? (eye.value === 'OD' ? '#eff6ff' : eye.value === 'OS' ? '#f0fdf4' : '#faf5ff')
                        : undefined
                    }}
                  >
                    {eye.value}
                  </button>
                ))}
              </div>
              {!medication.applicationLocation?.eye && (
                <p className="mt-1 text-xs text-amber-600 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Sélection de l'œil requise
                </p>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Dosage */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dose</label>
            <input
              type="number"
              value={medication.dosage?.amount || ''}
              onChange={(e) => handleNestedChange('dosage', 'amount', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
            <select
              value={medication.dosage?.unit || 'goutte'}
              onChange={(e) => handleNestedChange('dosage', 'unit', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="goutte">goutte(s)</option>
              <option value="mg">mg</option>
              <option value="ml">ml</option>
              <option value="comprimé">comprimé(s)</option>
              <option value="gélule">gélule(s)</option>
              <option value="application">application(s)</option>
              <option value="puff">bouffée(s)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
            <select
              value={medication.dosage?.frequency || ''}
              onChange={(e) => handleNestedChange('dosage', 'frequency', e.target.value)}
              disabled={readOnly || medication.tapering?.enabled}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                medication.tapering?.enabled ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Sélectionner...</option>
              {FREQUENCY_OPTIONS.filter(f => f.times >= 1).map(freq => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
            {medication.tapering?.enabled && (
              <p className="text-xs text-amber-600 mt-1">Géré par la dégression</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée (jours)</label>
            <input
              type="number"
              value={medication.tapering?.enabled ? medication.tapering.totalDurationDays : (medication.dosage?.duration?.value || '')}
              onChange={(e) => {
                if (!medication.tapering?.enabled) {
                  handleNestedChange('dosage', 'duration', { value: parseInt(e.target.value) || 0, unit: 'days' });
                }
              }}
              disabled={readOnly || medication.tapering?.enabled}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
                medication.tapering?.enabled ? 'bg-gray-100' : ''
              }`}
              placeholder="7"
            />
          </div>
        </div>

        {/* Tapering Section */}
        {showTapering && (
          <div className="border-t pt-4">
            {/* Tapering Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTapering}
                  disabled={readOnly}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    medication.tapering?.enabled ? 'bg-amber-500' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    medication.tapering?.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="font-medium text-gray-700">
                  Dégression progressive
                </span>
                {requiresTapering(medication.name || medication.genericName || '') && !medication.tapering?.enabled && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    Recommandé
                  </span>
                )}
              </div>

              {medication.tapering?.enabled && (
                <button
                  onClick={() => setShowTaperingBuilder(!showTaperingBuilder)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {showTaperingBuilder ? 'Masquer' : 'Modifier'}
                  {showTaperingBuilder ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Suggested Templates */}
            {suggestedTemplates.length > 0 && !medication.tapering?.enabled && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  Protocoles de dégression suggérés :
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTaperingTemplate(template.id)}
                      disabled={readOnly}
                      className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                    >
                      {template.nameShort}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tapering Schedule Display/Builder */}
            {medication.tapering?.enabled && (
              <>
                {/* Quick Summary */}
                {!showTaperingBuilder && medication.tapering?.schedule?.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm font-medium text-amber-800 mb-1">
                      {medication.tapering.template
                        ? TAPERING_TEMPLATES[medication.tapering.template]?.name
                        : 'Dégression personnalisée'}
                    </div>
                    <div className="text-xs text-amber-700">
                      {formatTaperingSchedule(medication.tapering.schedule)}
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      Durée totale : {medication.tapering.totalDurationDays} jours
                    </div>
                  </div>
                )}

                {/* Tapering Builder */}
                {showTaperingBuilder && (
                  <div className="space-y-3">
                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Raison de la dégression
                      </label>
                      <input
                        type="text"
                        value={medication.tapering?.reason || ''}
                        onChange={(e) => handleNestedChange('tapering', 'reason', e.target.value)}
                        disabled={readOnly}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Sevrage corticoïde post-opératoire"
                      />
                    </div>

                    {/* Schedule Steps */}
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Étapes de dégression</div>
                      {medication.tapering?.schedule?.map((step, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className="w-8 h-8 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                            {step.stepNumber}
                          </span>
                          <select
                            value={step.frequency}
                            onChange={(e) => updateTaperingStep(index, 'frequency', e.target.value)}
                            disabled={readOnly}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
                          >
                            {FREQUENCY_OPTIONS.map(f => (
                              <option key={f.value} value={f.value}>{f.value}</option>
                            ))}
                          </select>
                          <span className="text-gray-500 text-sm">pendant</span>
                          <input
                            type="number"
                            value={step.durationDays}
                            onChange={(e) => updateTaperingStep(index, 'durationDays', parseInt(e.target.value) || 0)}
                            disabled={readOnly}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm text-center"
                            min="1"
                          />
                          <span className="text-gray-500 text-sm">jours</span>
                          {!readOnly && medication.tapering?.schedule?.length > 1 && (
                            <button
                              onClick={() => removeTaperingStep(index)}
                              className="p-1 text-red-500 hover:bg-red-100 rounded"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add Step Button */}
                      {!readOnly && (
                        <button
                          onClick={addTaperingStep}
                          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Ajouter une étape
                        </button>
                      )}
                    </div>

                    {/* Total Duration */}
                    <div className="flex items-center justify-between p-2 bg-amber-100 rounded-lg">
                      <span className="text-sm font-medium text-amber-800">Durée totale</span>
                      <span className="font-bold text-amber-900">
                        {medication.tapering?.totalDurationDays || 0} jours
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1"
        >
          {showAdvanced ? 'Masquer les options avancées' : 'Options avancées'}
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-3 pt-3 border-t">
            {/* Eye Area (for ophthalmic) */}
            {needsEyeSelection && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone oculaire spécifique
                </label>
                <select
                  value={medication.applicationLocation?.eyeArea || ''}
                  onChange={(e) => handleNestedChange('applicationLocation', 'eyeArea', e.target.value || null)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Non spécifié</option>
                  {EYE_AREA_OPTIONS.map(area => (
                    <option key={area.value} value={area.value}>
                      {area.label} - {area.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* With Food */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prise par rapport aux repas
              </label>
              <select
                value={medication.dosage?.withFood || 'anytime'}
                onChange={(e) => handleNestedChange('dosage', 'withFood', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="before">Avant les repas</option>
                <option value="with">Pendant les repas</option>
                <option value="after">Après les repas</option>
                <option value="empty-stomach">À jeun</option>
                <option value="anytime">Peu importe</option>
              </select>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions spéciales
              </label>
              <textarea
                value={medication.instructions || ''}
                onChange={(e) => handleFieldChange('instructions', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="2"
                placeholder="Ex: Bien agiter avant utilisation, Attendre 5 min entre les gouttes..."
              />
            </div>

            {/* Indication */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indication
              </label>
              <input
                type="text"
                value={medication.indication || ''}
                onChange={(e) => handleFieldChange('indication', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Ex: Prévention infection post-opératoire"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
