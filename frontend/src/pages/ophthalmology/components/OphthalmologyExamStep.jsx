/**
 * OphthalmologyExamStep - Eye examination and pathology findings
 *
 * Documents:
 * - Anterior segment examination
 * - Posterior segment examination
 * - Intraocular pressure
 * - Gonioscopy (simple or enhanced)
 * - Pathology findings
 */

import { useState } from 'react';
import { Eye, AlertTriangle, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { GonioscopyPanel } from './gonioscopy';

// Common pathology findings for quick selection
const PATHOLOGY_OPTIONS = {
  anteriorSegment: {
    conjunctiva: ['Normal', 'Hyperhémie', 'Chémosis', 'Ptérygion', 'Pinguecula', 'Papilles', 'Follicules'],
    cornea: ['Transparente', 'Oedème', 'Ulcère', 'Kératite', 'Opacité', 'Néovascularisation', 'Arcus sénile'],
    chambreAnterieure: ['Calme', 'Tyndall +', 'Tyndall ++', 'Hypopion', 'Hyphéma', 'Étroite', 'Profonde'],
    iris: ['Normal', 'Synéchies', 'Rubeosis', 'Atrophie', 'Nodules', 'Hétérochromie'],
    cristallin: ['Transparent', 'Cataracte débutante', 'Cataracte modérée', 'Cataracte avancée', 'Aphaque', 'Pseudophaque', 'Subluxation']
  },
  posteriorSegment: {
    vitre: ['Clair', 'Hyalite', 'Hémorragie', 'Décollement postérieur', 'Corps flottants'],
    papille: ['Normale', 'Pâle', 'Excavation augmentée', 'Oedème papillaire', 'Atrophie', 'Drusen'],
    macula: ['Normale', 'Oedème', 'Drusen', 'Atrophie', 'Hémorragie', 'Membrane épirétinienne', 'Trou maculaire'],
    retine: ['Normale', 'Hémorragies', 'Exsudats', 'Microanévrysmes', 'Néovascularisation', 'Décollement', 'Déchirure'],
    vaisseaux: ['Normaux', 'Artériosclérose', 'Occlusion', 'Tortueux', 'Engainement']
  }
};

const GONIOSCOPY_GRADES = ['0', 'I', 'II', 'III', 'IV'];

export default function OphthalmologyExamStep({ data = {}, onChange, readOnly = false }) {
  const [expandedSections, setExpandedSections] = useState({
    anteriorOD: true,
    anteriorOS: true,
    posteriorOD: false,
    posteriorOS: false,
    iop: true,
    gonioscopy: false
  });
  const [useEnhancedGonioscopy, setUseEnhancedGonioscopy] = useState(
    data?.gonioscopy?.enhanced || false
  );

  const exam = {
    anteriorSegment: {
      OD: data?.anteriorSegment?.OD || {},
      OS: data?.anteriorSegment?.OS || {}
    },
    posteriorSegment: {
      OD: data?.posteriorSegment?.OD || {},
      OS: data?.posteriorSegment?.OS || {}
    },
    iop: {
      OD: data?.iop?.OD || '',
      OS: data?.iop?.OS || '',
      method: data?.iop?.method || 'applanation',
      time: data?.iop?.time || ''
    },
    gonioscopy: {
      OD: data?.gonioscopy?.OD || { superior: '', inferior: '', nasal: '', temporal: '' },
      OS: data?.gonioscopy?.OS || { superior: '', inferior: '', nasal: '', temporal: '' }
    },
    notes: data?.notes || ''
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Update a field in the exam data
  const updateField = (path, value) => {
    if (readOnly) return;

    const keys = path.split('.');
    const newData = JSON.parse(JSON.stringify(exam));
    let current = newData;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    onChange?.(newData);
  };

  // Render a finding selector
  const FindingSelector = ({ label, value, options, path }) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => updateField(path, e.target.value)}
        className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
        disabled={readOnly}
      >
        <option value="">Sélectionner...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  // Section header with expand/collapse
  const SectionHeader = ({ title, section, eye, hasAlert }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b"
    >
      <div className="flex items-center">
        <Eye className="h-4 w-4 mr-2 text-blue-600" />
        <span className="font-medium text-gray-900">{title}</span>
        {eye && <span className="ml-2 text-sm text-gray-500">({eye})</span>}
        {hasAlert && <AlertTriangle className="h-4 w-4 ml-2 text-orange-500" />}
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="h-4 w-4 text-gray-500" />
      ) : (
        <ChevronDown className="h-4 w-4 text-gray-500" />
      )}
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Examen Ophtalmologique</h3>

      {/* IOP Section */}
      <div className="border rounded-lg">
        <SectionHeader title="Pression Intraoculaire" section="iop" />
        {expandedSections.iop && (
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">OD (mmHg)</label>
                <input
                  type="number"
                  value={exam.iop.OD}
                  onChange={(e) => updateField('iop.OD', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="14"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">OS (mmHg)</label>
                <input
                  type="number"
                  value={exam.iop.OS}
                  onChange={(e) => updateField('iop.OS', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="15"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Méthode</label>
                <select
                  value={exam.iop.method}
                  onChange={(e) => updateField('iop.method', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={readOnly}
                >
                  <option value="applanation">Applanation</option>
                  <option value="air">Air pulsé</option>
                  <option value="tonopen">Tonopen</option>
                  <option value="icare">Icare</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
                <input
                  type="time"
                  value={exam.iop.time}
                  onChange={(e) => updateField('iop.time', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={readOnly}
                />
              </div>
            </div>
            {/* IOP Alert */}
            {(parseInt(exam.iop.OD) > 21 || parseInt(exam.iop.OS) > 21) && (
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-sm flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                PIO élevée détectée. Considérer un examen complémentaire.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anterior Segment - OD */}
      <div className="border rounded-lg">
        <SectionHeader
          title="Segment Antérieur"
          section="anteriorOD"
          eye="OD"
        />
        {expandedSections.anteriorOD && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <FindingSelector
              label="Conjonctive"
              value={exam.anteriorSegment.OD.conjunctiva}
              options={PATHOLOGY_OPTIONS.anteriorSegment.conjunctiva}
              path="anteriorSegment.OD.conjunctiva"
            />
            <FindingSelector
              label="Cornée"
              value={exam.anteriorSegment.OD.cornea}
              options={PATHOLOGY_OPTIONS.anteriorSegment.cornea}
              path="anteriorSegment.OD.cornea"
            />
            <FindingSelector
              label="Chambre Antérieure"
              value={exam.anteriorSegment.OD.chambreAnterieure}
              options={PATHOLOGY_OPTIONS.anteriorSegment.chambreAnterieure}
              path="anteriorSegment.OD.chambreAnterieure"
            />
            <FindingSelector
              label="Iris"
              value={exam.anteriorSegment.OD.iris}
              options={PATHOLOGY_OPTIONS.anteriorSegment.iris}
              path="anteriorSegment.OD.iris"
            />
            <FindingSelector
              label="Cristallin"
              value={exam.anteriorSegment.OD.cristallin}
              options={PATHOLOGY_OPTIONS.anteriorSegment.cristallin}
              path="anteriorSegment.OD.cristallin"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Autres</label>
              <input
                type="text"
                value={exam.anteriorSegment.OD.other || ''}
                onChange={(e) => updateField('anteriorSegment.OD.other', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Notes..."
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* Anterior Segment - OS */}
      <div className="border rounded-lg">
        <SectionHeader
          title="Segment Antérieur"
          section="anteriorOS"
          eye="OS"
        />
        {expandedSections.anteriorOS && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <FindingSelector
              label="Conjonctive"
              value={exam.anteriorSegment.OS.conjunctiva}
              options={PATHOLOGY_OPTIONS.anteriorSegment.conjunctiva}
              path="anteriorSegment.OS.conjunctiva"
            />
            <FindingSelector
              label="Cornée"
              value={exam.anteriorSegment.OS.cornea}
              options={PATHOLOGY_OPTIONS.anteriorSegment.cornea}
              path="anteriorSegment.OS.cornea"
            />
            <FindingSelector
              label="Chambre Antérieure"
              value={exam.anteriorSegment.OS.chambreAnterieure}
              options={PATHOLOGY_OPTIONS.anteriorSegment.chambreAnterieure}
              path="anteriorSegment.OS.chambreAnterieure"
            />
            <FindingSelector
              label="Iris"
              value={exam.anteriorSegment.OS.iris}
              options={PATHOLOGY_OPTIONS.anteriorSegment.iris}
              path="anteriorSegment.OS.iris"
            />
            <FindingSelector
              label="Cristallin"
              value={exam.anteriorSegment.OS.cristallin}
              options={PATHOLOGY_OPTIONS.anteriorSegment.cristallin}
              path="anteriorSegment.OS.cristallin"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Autres</label>
              <input
                type="text"
                value={exam.anteriorSegment.OS.other || ''}
                onChange={(e) => updateField('anteriorSegment.OS.other', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Notes..."
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* Posterior Segment - OD */}
      <div className="border rounded-lg">
        <SectionHeader
          title="Segment Postérieur"
          section="posteriorOD"
          eye="OD"
        />
        {expandedSections.posteriorOD && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <FindingSelector
              label="Vitré"
              value={exam.posteriorSegment.OD.vitre}
              options={PATHOLOGY_OPTIONS.posteriorSegment.vitre}
              path="posteriorSegment.OD.vitre"
            />
            <FindingSelector
              label="Papille"
              value={exam.posteriorSegment.OD.papille}
              options={PATHOLOGY_OPTIONS.posteriorSegment.papille}
              path="posteriorSegment.OD.papille"
            />
            <FindingSelector
              label="Macula"
              value={exam.posteriorSegment.OD.macula}
              options={PATHOLOGY_OPTIONS.posteriorSegment.macula}
              path="posteriorSegment.OD.macula"
            />
            <FindingSelector
              label="Rétine"
              value={exam.posteriorSegment.OD.retine}
              options={PATHOLOGY_OPTIONS.posteriorSegment.retine}
              path="posteriorSegment.OD.retine"
            />
            <FindingSelector
              label="Vaisseaux"
              value={exam.posteriorSegment.OD.vaisseaux}
              options={PATHOLOGY_OPTIONS.posteriorSegment.vaisseaux}
              path="posteriorSegment.OD.vaisseaux"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cup/Disc</label>
              <input
                type="text"
                value={exam.posteriorSegment.OD.cupDisc || ''}
                onChange={(e) => updateField('posteriorSegment.OD.cupDisc', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="0.3"
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* Posterior Segment - OS */}
      <div className="border rounded-lg">
        <SectionHeader
          title="Segment Postérieur"
          section="posteriorOS"
          eye="OS"
        />
        {expandedSections.posteriorOS && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <FindingSelector
              label="Vitré"
              value={exam.posteriorSegment.OS.vitre}
              options={PATHOLOGY_OPTIONS.posteriorSegment.vitre}
              path="posteriorSegment.OS.vitre"
            />
            <FindingSelector
              label="Papille"
              value={exam.posteriorSegment.OS.papille}
              options={PATHOLOGY_OPTIONS.posteriorSegment.papille}
              path="posteriorSegment.OS.papille"
            />
            <FindingSelector
              label="Macula"
              value={exam.posteriorSegment.OS.macula}
              options={PATHOLOGY_OPTIONS.posteriorSegment.macula}
              path="posteriorSegment.OS.macula"
            />
            <FindingSelector
              label="Rétine"
              value={exam.posteriorSegment.OS.retine}
              options={PATHOLOGY_OPTIONS.posteriorSegment.retine}
              path="posteriorSegment.OS.retine"
            />
            <FindingSelector
              label="Vaisseaux"
              value={exam.posteriorSegment.OS.vaisseaux}
              options={PATHOLOGY_OPTIONS.posteriorSegment.vaisseaux}
              path="posteriorSegment.OS.vaisseaux"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cup/Disc</label>
              <input
                type="text"
                value={exam.posteriorSegment.OS.cupDisc || ''}
                onChange={(e) => updateField('posteriorSegment.OS.cupDisc', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="0.3"
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>

      {/* Gonioscopy */}
      <div className="border rounded-lg">
        <SectionHeader title="Gonioscopie" section="gonioscopy" />
        {expandedSections.gonioscopy && (
          <div className="p-4">
            {/* Mode Toggle */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <span className="text-sm text-gray-600">Mode d'évaluation:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUseEnhancedGonioscopy(false);
                    updateField('gonioscopy.enhanced', false);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    !useEnhancedGonioscopy
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={readOnly}
                >
                  Simple
                </button>
                <button
                  onClick={() => {
                    setUseEnhancedGonioscopy(true);
                    updateField('gonioscopy.enhanced', true);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1 ${
                    useEnhancedGonioscopy
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={readOnly}
                >
                  <Settings className="h-4 w-4" />
                  Avancé
                </button>
              </div>
            </div>

            {useEnhancedGonioscopy ? (
              /* Enhanced Gonioscopy Panel */
              <GonioscopyPanel
                data={exam.gonioscopy}
                onChange={(gonioscopyData) => updateField('gonioscopy', { ...gonioscopyData, enhanced: true })}
                readOnly={readOnly}
              />
            ) : (
              /* Simple Gonioscopy */
              <div className="grid grid-cols-2 gap-6">
                {/* OD */}
                <div>
                  <h5 className="font-medium text-sm text-gray-700 mb-3">OD (Shaffer)</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {['superior', 'inferior', 'nasal', 'temporal'].map((quadrant) => (
                      <div key={quadrant}>
                        <label className="block text-xs text-gray-500 mb-1 capitalize">
                          {quadrant === 'superior' ? 'Supérieur' :
                           quadrant === 'inferior' ? 'Inférieur' :
                           quadrant === 'nasal' ? 'Nasal' : 'Temporal'}
                        </label>
                        <select
                          value={exam.gonioscopy.OD[quadrant] || ''}
                          onChange={(e) => updateField(`gonioscopy.OD.${quadrant}`, e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={readOnly}
                        >
                          <option value="">-</option>
                          {GONIOSCOPY_GRADES.map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                {/* OS */}
                <div>
                  <h5 className="font-medium text-sm text-gray-700 mb-3">OS (Shaffer)</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {['superior', 'inferior', 'nasal', 'temporal'].map((quadrant) => (
                      <div key={quadrant}>
                        <label className="block text-xs text-gray-500 mb-1 capitalize">
                          {quadrant === 'superior' ? 'Supérieur' :
                           quadrant === 'inferior' ? 'Inférieur' :
                           quadrant === 'nasal' ? 'Nasal' : 'Temporal'}
                        </label>
                        <select
                          value={exam.gonioscopy.OS[quadrant] || ''}
                          onChange={(e) => updateField(`gonioscopy.OS.${quadrant}`, e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
                          disabled={readOnly}
                        >
                          <option value="">-</option>
                          {GONIOSCOPY_GRADES.map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* General Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes Générales
        </label>
        <textarea
          value={exam.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Observations additionnelles..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
