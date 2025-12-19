/**
 * PrescriptionModule Component
 *
 * Tabbed module for glasses and medication prescriptions.
 * Enhanced with StudioVision components: FavoriteMedicationsBar, TreatmentProtocolSelector, DrugInteractionPanel
 */

import { useState } from 'react';
import { Glasses, Pill, AlertTriangle } from 'lucide-react';
import FavoriteMedicationsBar from '../../../../../../components/prescription/FavoriteMedicationsBar';
import TreatmentProtocolSelector from '../../../../../../components/prescription/TreatmentProtocolSelector';
import DrugInteractionPanel from '../../../../../../components/prescription/DrugInteractionPanel';
import {
  OPHTHALMIC_CATEGORIES,
  OPHTHALMIC_ROUTES,
  TAPERING_CATEGORIES,
  TAPERING_TEMPLATES,
  MEDICATION_ROUTES,
  generateSphereOptions,
  generateCylinderOptions,
  ADDITION_OPTIONS,
  getRouteLabel
} from '../constants';

const sphereOptions = generateSphereOptions();
const cylinderOptions = generateCylinderOptions();

export default function PrescriptionModule({
  data,
  onChange,
  refractionData,
  commonMedications = [],
  loadingMedications = false,
  diagnoses = [],
  patientId = null,
  patientAllergies = []
}) {
  const [activeTab, setActiveTab] = useState('glasses');
  const [selectedMedCategory, setSelectedMedCategory] = useState('all');
  const [selectedEye, setSelectedEye] = useState('OU');
  const [selectedRoute, setSelectedRoute] = useState('oral');
  const [selectedTapering, setSelectedTapering] = useState('none');

  const prescriptionData = data || {
    type: 'glasses',
    glasses: {
      OD: { sphere: '', cylinder: '', axis: '', add: '' },
      OS: { sphere: '', cylinder: '', axis: '', add: '' },
      pd: { distance: '', near: '' }
    },
    medications: [],
    recommendations: ''
  };

  // Get unique medication categories
  const medicationCategories = ['all', ...new Set(commonMedications.map(med => med.category).filter(Boolean))];

  // Filter medications by selected category
  const filteredMedications = selectedMedCategory === 'all'
    ? commonMedications
    : commonMedications.filter(med => med.category === selectedMedCategory);

  // Copy from subjective refraction
  const copyFromRefraction = () => {
    if (!refractionData?.subjective) return;
    const newData = { ...prescriptionData };
    ['OD', 'OS'].forEach(eye => {
      newData.glasses[eye] = {
        sphere: refractionData.subjective[eye]?.sphere || '',
        cylinder: refractionData.subjective[eye]?.cylinder || '',
        axis: refractionData.subjective[eye]?.axis || '',
        add: refractionData.subjective[eye]?.add || ''
      };
    });
    if (refractionData.subjective.pd) {
      newData.glasses.pd = refractionData.subjective.pd;
    }
    onChange?.(newData);
  };

  const addMedication = (med) => {
    const newData = { ...prescriptionData };
    const isOphthalmic = OPHTHALMIC_CATEGORIES.includes(med.category) || OPHTHALMIC_CATEGORIES.includes(selectedMedCategory);
    const route = isOphthalmic ? 'ophthalmic' : selectedRoute;
    const needsEyeSelection = OPHTHALMIC_ROUTES.includes(route);
    const needsTapering = TAPERING_CATEGORIES.includes(med.category) || TAPERING_CATEGORIES.includes(selectedMedCategory);

    const taperingTemplate = TAPERING_TEMPLATES.find(t => t.id === selectedTapering);

    const newMed = {
      ...med,
      id: Date.now(),
      route,
      ...(needsEyeSelection && { applicationLocation: { eye: selectedEye } }),
      ...(needsTapering && taperingTemplate?.schedule && {
        taperingSchedule: taperingTemplate.schedule,
        taperingName: taperingTemplate.name
      })
    };

    newData.medications = [...(newData.medications || []), newMed];
    onChange?.(newData);
  };

  const removeMedication = (id) => {
    const newData = { ...prescriptionData };
    newData.medications = newData.medications.filter(m => m.id !== id);
    onChange?.(newData);
  };

  const updateGlasses = (eye, field, value) => {
    const newData = { ...prescriptionData };
    newData.glasses[eye][field] = value;
    onChange?.(newData);
  };

  const updatePD = (field, value) => {
    const newData = { ...prescriptionData };
    newData.glasses.pd = { ...newData.glasses.pd, [field]: value };
    onChange?.(newData);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
        <div className="flex px-4">
          <button
            onClick={() => setActiveTab('glasses')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'glasses'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Glasses className="h-4 w-4" />
            Lunettes
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'medications'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Pill className="h-4 w-4" />
            Médicaments
            {prescriptionData.medications?.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                {prescriptionData.medications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'glasses' && (
          <GlassesTab
            prescriptionData={prescriptionData}
            refractionData={refractionData}
            sphereOptions={sphereOptions}
            cylinderOptions={cylinderOptions}
            updateGlasses={updateGlasses}
            updatePD={updatePD}
            copyFromRefraction={copyFromRefraction}
          />
        )}

        {activeTab === 'medications' && (
          <div className="space-y-4">
            {/* StudioVision Quick Access: Favorites Bar */}
            <FavoriteMedicationsBar
              onMedicationAdd={addMedication}
              compact={true}
            />

            {/* StudioVision: Treatment Protocol Selector (2-click prescriptions) */}
            {diagnoses.length > 0 && (
              <TreatmentProtocolSelector
                diagnoses={diagnoses}
                onProtocolApply={(medications) => {
                  const newData = { ...prescriptionData };
                  const enhancedMeds = medications.map(med => ({
                    ...med,
                    id: Date.now() + Math.random(),
                    route: OPHTHALMIC_CATEGORIES.includes(med.category) ? 'ophthalmic' : 'oral'
                  }));
                  newData.medications = [...(newData.medications || []), ...enhancedMeds];
                  onChange?.(newData);
                }}
                collapsed={true}
              />
            )}

            {/* StudioVision: Drug Interaction Panel (real-time safety) */}
            {prescriptionData.medications?.length > 0 && (
              <DrugInteractionPanel
                medications={prescriptionData.medications}
                patientId={patientId}
                patientAllergies={patientAllergies}
                compact={true}
              />
            )}

            {/* Original Medications Tab */}
            <MedicationsTab
              prescriptionData={prescriptionData}
              filteredMedications={filteredMedications}
              loadingMedications={loadingMedications}
              medicationCategories={medicationCategories}
              selectedMedCategory={selectedMedCategory}
              setSelectedMedCategory={setSelectedMedCategory}
              selectedEye={selectedEye}
              setSelectedEye={setSelectedEye}
              selectedRoute={selectedRoute}
              setSelectedRoute={setSelectedRoute}
              selectedTapering={selectedTapering}
              setSelectedTapering={setSelectedTapering}
              addMedication={addMedication}
              removeMedication={removeMedication}
            />
          </div>
        )}

        {/* Recommendations */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="text-xs text-gray-500 font-medium">Recommandations / Notes</label>
          <textarea
            value={prescriptionData.recommendations || ''}
            onChange={(e) => onChange?.({ ...prescriptionData, recommendations: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg resize-none"
            rows={2}
            placeholder="Instructions particulières, RDV de suivi..."
          />
        </div>
      </div>
    </div>
  );
}

// Glasses Tab Sub-component
function GlassesTab({
  prescriptionData,
  refractionData,
  sphereOptions,
  cylinderOptions,
  updateGlasses,
  updatePD,
  copyFromRefraction
}) {
  return (
    <div className="space-y-4">
      {refractionData?.subjective && (
        <button
          onClick={copyFromRefraction}
          className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
        >
          <Glasses className="h-4 w-4" />
          Copier depuis réfraction subjective
        </button>
      )}

      <div className="grid grid-cols-2 gap-4">
        {['OD', 'OS'].map(eye => (
          <div key={eye} className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-semibold text-purple-600 mb-3">{eye}</div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-gray-500">Sphère</label>
                <select
                  value={prescriptionData.glasses?.[eye]?.sphere || ''}
                  onChange={(e) => updateGlasses(eye, 'sphere', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="">--</option>
                  {sphereOptions.map(opt => (
                    <option key={opt} value={opt}>{opt > 0 ? `+${opt}` : opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Cylindre</label>
                <select
                  value={prescriptionData.glasses?.[eye]?.cylinder || ''}
                  onChange={(e) => updateGlasses(eye, 'cylinder', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="">--</option>
                  {cylinderOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Axe</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={prescriptionData.glasses?.[eye]?.axis || ''}
                  onChange={(e) => updateGlasses(eye, 'axis', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                  placeholder="°"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Addition</label>
                <select
                  value={prescriptionData.glasses?.[eye]?.add || ''}
                  onChange={(e) => updateGlasses(eye, 'add', e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="">--</option>
                  {ADDITION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-gray-500">EP Distance</label>
          <input
            type="number"
            value={prescriptionData.glasses?.pd?.distance || ''}
            onChange={(e) => updatePD('distance', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="63"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">EP Près</label>
          <input
            type="number"
            value={prescriptionData.glasses?.pd?.near || ''}
            onChange={(e) => updatePD('near', e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="60"
          />
        </div>
      </div>
    </div>
  );
}

// Medications Tab Sub-component
function MedicationsTab({
  prescriptionData,
  filteredMedications,
  loadingMedications,
  medicationCategories,
  selectedMedCategory,
  setSelectedMedCategory,
  selectedEye,
  setSelectedEye,
  selectedRoute,
  setSelectedRoute,
  selectedTapering,
  setSelectedTapering,
  addMedication,
  removeMedication
}) {
  const showEyeSelector = OPHTHALMIC_CATEGORIES.includes(selectedMedCategory) ||
    OPHTHALMIC_ROUTES.includes(selectedRoute);
  const showTaperingSelector = TAPERING_CATEGORIES.includes(selectedMedCategory);
  const showRouteSelector = !OPHTHALMIC_CATEGORIES.includes(selectedMedCategory);

  return (
    <div className="space-y-4">
      {/* Selected medications */}
      {prescriptionData.medications?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Médicaments prescrits</h4>
          {prescriptionData.medications.map(med => (
            <MedicationCard key={med.id} med={med} onRemove={() => removeMedication(med.id)} />
          ))}
        </div>
      )}

      {/* Common medications */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Médicaments courants</h4>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          {medicationCategories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedMedCategory(category)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                selectedMedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'Tous' : category}
            </button>
          ))}
        </div>

        {/* Eye selection */}
        {showEyeSelector && (
          <EyeSelector selectedEye={selectedEye} setSelectedEye={setSelectedEye} />
        )}

        {/* Tapering selection */}
        {showTaperingSelector && (
          <TaperingSelector selectedTapering={selectedTapering} setSelectedTapering={setSelectedTapering} />
        )}

        {/* Route selection */}
        {showRouteSelector && (
          <RouteSelector
            selectedRoute={selectedRoute}
            setSelectedRoute={setSelectedRoute}
            setSelectedEye={setSelectedEye}
          />
        )}

        {/* Medications grid */}
        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {loadingMedications ? (
            <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
              Chargement des médicaments...
            </div>
          ) : filteredMedications.length === 0 ? (
            <div className="col-span-2 text-center py-4 text-gray-500 text-sm">
              Aucun médicament dans cette catégorie
            </div>
          ) : (
            filteredMedications.map(med => (
              <button
                key={med.name}
                onClick={() => addMedication(med)}
                disabled={prescriptionData.medications?.find(m => m.name === med.name)}
                className="text-left p-2 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <div className="text-sm font-medium text-gray-900">{med.name}</div>
                {med.dose && <div className="text-xs text-gray-500">{med.dose}</div>}
                <div className="text-xs text-indigo-600 font-medium mt-1">{med.category}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Medication Card
function MedicationCard({ med, onRemove }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{med.name}</span>
            {med.route && (
              <span className={`px-2 py-0.5 text-xs rounded ${
                med.route === 'oral' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-700'
              }`}>
                {getRouteLabel(med.route)}
              </span>
            )}
            {med.applicationLocation?.eye && (
              <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                {med.applicationLocation.eye}
              </span>
            )}
            {med.taperingName && (
              <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                ↘ {med.taperingName}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">{med.dose}</div>
        </div>
        <button onClick={onRemove} className="text-red-500 hover:text-red-700 ml-2">
          &times;
        </button>
      </div>
      {med.taperingSchedule && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-amber-700 font-medium mb-1">Schéma de dégression:</div>
          <div className="flex flex-wrap gap-1">
            {med.taperingSchedule.map((step, idx) => (
              <span key={idx} className="px-2 py-0.5 text-xs bg-amber-50 text-amber-600 rounded">
                J{step.days}: {step.frequency}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Eye Selector
function EyeSelector({ selectedEye, setSelectedEye }) {
  return (
    <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg">
      <span className="text-xs text-blue-700 font-medium">Œil:</span>
      {['OD', 'OS', 'OU'].map(eye => (
        <button
          key={eye}
          onClick={() => setSelectedEye(eye)}
          className={`px-3 py-1 text-xs rounded-full transition ${
            selectedEye === eye
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {eye === 'OD' ? 'OD (Droit)' : eye === 'OS' ? 'OS (Gauche)' : 'OU (Les deux)'}
        </button>
      ))}
    </div>
  );
}

// Tapering Selector
function TaperingSelector({ selectedTapering, setSelectedTapering }) {
  return (
    <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg flex-wrap">
      <span className="text-xs text-amber-700 font-medium">Dégression:</span>
      {TAPERING_TEMPLATES.map(template => (
        <button
          key={template.id}
          onClick={() => setSelectedTapering(template.id)}
          className={`px-3 py-1 text-xs rounded-full transition ${
            selectedTapering === template.id
              ? 'bg-amber-600 text-white'
              : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-100'
          }`}
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}

// Route Selector
function RouteSelector({ selectedRoute, setSelectedRoute, setSelectedEye }) {
  return (
    <div className="flex items-center gap-2 mb-3 p-2 bg-purple-50 rounded-lg flex-wrap">
      <span className="text-xs text-purple-700 font-medium">Voie:</span>
      {MEDICATION_ROUTES.slice(0, 6).map(route => (
        <button
          key={route.value}
          onClick={() => {
            setSelectedRoute(route.value);
            if (OPHTHALMIC_ROUTES.includes(route.value)) {
              setSelectedEye('OU');
            }
          }}
          className={`px-3 py-1 text-xs rounded-full transition ${
            selectedRoute === route.value
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-100'
          }`}
        >
          {route.labelFr}
        </button>
      ))}
      <select
        value={selectedRoute}
        onChange={(e) => {
          setSelectedRoute(e.target.value);
          if (OPHTHALMIC_ROUTES.includes(e.target.value)) {
            setSelectedEye('OU');
          }
        }}
        className="px-2 py-1 text-xs border border-purple-200 rounded-lg bg-white text-purple-700"
      >
        {MEDICATION_ROUTES.map(route => (
          <option key={route.value} value={route.value}>{route.labelFr}</option>
        ))}
      </select>
    </div>
  );
}
