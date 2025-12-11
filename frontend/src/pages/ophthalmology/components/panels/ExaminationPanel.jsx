import { useState } from 'react';
import { Activity, Eye, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * ExaminationPanel - Consolidated 3-column examination module
 * Combines: IOP/Tonometry | Slit Lamp (Anterior) | Fundus (Posterior)
 */
export default function ExaminationPanel({ data, onChange, patient }) {
  const [activeEye, setActiveEye] = useState('OD');
  const [expandedSections, setExpandedSections] = useState({
    pupils: false,
    gonioscopy: false
  });

  // Initialize data structure
  const examData = data || {
    iop: {
      OD: { value: '', time: '', method: 'nct' },
      OS: { value: '', time: '', method: 'nct' },
      pachymetry: { OD: '', OS: '' }
    },
    slitLamp: {
      OD: { lids: 'normal', conjunctiva: 'normal', cornea: 'normal', ac: 'normal', iris: 'normal', lens: 'normal', notes: '' },
      OS: { lids: 'normal', conjunctiva: 'normal', cornea: 'normal', ac: 'normal', iris: 'normal', lens: 'normal', notes: '' }
    },
    fundus: {
      OD: { vitreous: 'normal', disc: 'normal', cdRatio: '', macula: 'normal', retina: 'normal', vessels: 'normal', notes: '' },
      OS: { vitreous: 'normal', disc: 'normal', cdRatio: '', macula: 'normal', retina: 'normal', vessels: 'normal', notes: '' }
    },
    pupils: {
      OD: { size: '', reaction: 'normal', shape: 'round' },
      OS: { size: '', reaction: 'normal', shape: 'round' },
      rapd: 'none'
    },
    gonioscopy: {
      OD: { superior: '', inferior: '', nasal: '', temporal: '' },
      OS: { superior: '', inferior: '', nasal: '', temporal: '' }
    }
  };

  // Update handler
  const updateField = (section, eye, field, value) => {
    const newData = { ...examData };
    if (!newData[section]) newData[section] = {};
    if (eye) {
      if (!newData[section][eye]) newData[section][eye] = {};
      newData[section][eye][field] = value;
    } else {
      newData[section][field] = value;
    }
    onChange?.(newData);
  };

  // IOP Alert threshold
  const getIOPAlert = (value) => {
    const v = parseFloat(value);
    if (!v) return null;
    if (v > 25) return 'danger';
    if (v > 21) return 'warning';
    return 'normal';
  };

  // Finding options
  const findingOptions = ['normal', 'abnormal', 'not examined'];
  const slitLampFindings = {
    lids: ['normal', 'blepharitis', 'chalazion', 'ptosis', 'ectropion', 'entropion', 'other'],
    conjunctiva: ['normal', 'injection', 'chemosis', 'papillae', 'follicles', 'pterygium', 'other'],
    cornea: ['normal', 'edema', 'opacity', 'ulcer', 'dystrophy', 'keratitis', 'arcus', 'other'],
    ac: ['normal', 'shallow', 'deep', 'cells', 'flare', 'hypopyon', 'hyphema'],
    iris: ['normal', 'synechiae', 'rubeosis', 'atrophy', 'heterochromia', 'other'],
    lens: ['normal', 'cataract NS', 'cataract cortical', 'cataract PSC', 'pseudophakia', 'aphakia', 'subluxated']
  };

  const fundusFindings = {
    vitreous: ['normal', 'cells', 'hemorrhage', 'detachment', 'floaters', 'other'],
    disc: ['normal', 'pallor', 'edema', 'cupping', 'drusen', 'tilted', 'other'],
    macula: ['normal', 'drusen', 'edema', 'hole', 'ERM', 'atrophy', 'CNVM', 'other'],
    retina: ['normal', 'hemorrhages', 'exudates', 'detachment', 'tear', 'lattice', 'other'],
    vessels: ['normal', 'attenuated', 'AV nicking', 'neovascularization', 'occlusion', 'other']
  };

  const iopMethods = [
    { value: 'nct', label: 'NCT (Air)' },
    { value: 'goldmann', label: 'Goldmann' },
    { value: 'tonopen', label: 'Tonopen' },
    { value: 'icare', label: 'iCare' }
  ];

  const gonioscopyGrades = ['0', 'SL', 'I', 'II', 'III', 'IV'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with Eye Selector */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-gray-900">Examen Clinique</h2>
          </div>

          {/* Eye Selector */}
          <div className="flex bg-white rounded-lg border border-gray-300 p-0.5">
            {['OD', 'OS', 'OU'].map(eye => (
              <button
                key={eye}
                onClick={() => setActiveEye(eye)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                  activeEye === eye
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {eye}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-3 divide-x divide-gray-200">

        {/* Column 1: IOP / Tonometry */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
            <Activity className="h-4 w-4 text-red-500" />
            Tonométrie (PIO)
          </h3>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => {
            const iopAlert = getIOPAlert(examData.iop?.[eye]?.value);
            return (
              <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
                {activeEye === 'OU' && (
                  <div className="text-xs font-medium text-green-600 mb-2">{eye}</div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500">PIO (mmHg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={examData.iop?.[eye]?.value || ''}
                        onChange={(e) => updateField('iop', eye, 'value', e.target.value)}
                        className={`w-full mt-1 px-3 py-2 text-lg font-bold border rounded-lg focus:ring-2 focus:ring-green-500 ${
                          iopAlert === 'danger' ? 'border-red-500 bg-red-50 text-red-700' :
                          iopAlert === 'warning' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' :
                          'border-gray-300'
                        }`}
                        placeholder="--"
                      />
                      {iopAlert && iopAlert !== 'normal' && (
                        <AlertTriangle className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${
                          iopAlert === 'danger' ? 'text-red-500' : 'text-yellow-500'
                        }`} />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Méthode</label>
                    <select
                      value={examData.iop?.[eye]?.method || 'nct'}
                      onChange={(e) => updateField('iop', eye, 'method', e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                    >
                      {iopMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Heure</label>
                    <input
                      type="time"
                      value={examData.iop?.[eye]?.time || ''}
                      onChange={(e) => updateField('iop', eye, 'time', e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Pachymétrie (µm)</label>
                    <input
                      type="number"
                      value={examData.iop?.pachymetry?.[eye] || ''}
                      onChange={(e) => {
                        const newData = { ...examData };
                        if (!newData.iop) newData.iop = {};
                        newData.iop.pachymetry = { ...newData.iop.pachymetry, [eye]: e.target.value };
                        onChange?.(newData);
                      }}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                      placeholder="550"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* IOP Reference */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Normal: 10-21 mmHg
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              Limite: 21-25 mmHg
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Élevée: &gt;25 mmHg
            </div>
          </div>
        </div>

        {/* Column 2: Slit Lamp (Anterior Segment) */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
            <Eye className="h-4 w-4 text-blue-500" />
            Lampe à Fente (Segment Antérieur)
          </h3>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => (
            <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
              {activeEye === 'OU' && (
                <div className="text-xs font-medium text-blue-600 mb-2">{eye}</div>
              )}

              <div className="space-y-2">
                {Object.entries(slitLampFindings).map(([field, options]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 capitalize">
                      {field === 'ac' ? 'Chambre Ant.' : field === 'lids' ? 'Paupières' : field}
                    </label>
                    <select
                      value={examData.slitLamp?.[eye]?.[field] || 'normal'}
                      onChange={(e) => updateField('slitLamp', eye, field, e.target.value)}
                      className={`w-full mt-1 px-2 py-1.5 text-sm border rounded-lg ${
                        examData.slitLamp?.[eye]?.[field] && examData.slitLamp?.[eye]?.[field] !== 'normal'
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-300'
                      }`}
                    >
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}

                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <textarea
                    value={examData.slitLamp?.[eye]?.notes || ''}
                    onChange={(e) => updateField('slitLamp', eye, 'notes', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg resize-none"
                    rows={2}
                    placeholder="Observations..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: Fundus (Posterior Segment) */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
            <Eye className="h-4 w-4 text-purple-500" />
            Fond d'Œil (Segment Postérieur)
          </h3>

          {(activeEye === 'OU' ? ['OD', 'OS'] : [activeEye]).map(eye => (
            <div key={eye} className={`${activeEye === 'OU' ? 'mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0' : ''}`}>
              {activeEye === 'OU' && (
                <div className="text-xs font-medium text-purple-600 mb-2">{eye}</div>
              )}

              <div className="space-y-2">
                {Object.entries(fundusFindings).map(([field, options]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 capitalize">
                      {field === 'disc' ? 'Papille' : field === 'vessels' ? 'Vaisseaux' : field}
                    </label>
                    <select
                      value={examData.fundus?.[eye]?.[field] || 'normal'}
                      onChange={(e) => updateField('fundus', eye, field, e.target.value)}
                      className={`w-full mt-1 px-2 py-1.5 text-sm border rounded-lg ${
                        examData.fundus?.[eye]?.[field] && examData.fundus?.[eye]?.[field] !== 'normal'
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-300'
                      }`}
                    >
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {/* C/D Ratio */}
                <div>
                  <label className="text-xs text-gray-500">Rapport C/D</label>
                  <select
                    value={examData.fundus?.[eye]?.cdRatio || ''}
                    onChange={(e) => updateField('fundus', eye, 'cdRatio', e.target.value)}
                    className={`w-full mt-1 px-2 py-1.5 text-sm border rounded-lg ${
                      parseFloat(examData.fundus?.[eye]?.cdRatio) >= 0.6 ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="">--</option>
                    {['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <textarea
                    value={examData.fundus?.[eye]?.notes || ''}
                    onChange={(e) => updateField('fundus', eye, 'notes', e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg resize-none"
                    rows={2}
                    placeholder="Observations..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="border-t border-gray-200">
        {/* Pupils */}
        <button
          onClick={() => setExpandedSections(s => ({ ...s, pupils: !s.pupils }))}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
        >
          <span>Pupilles & Réflexes</span>
          {expandedSections.pupils ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expandedSections.pupils && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4">
            {['OD', 'OS'].map(eye => (
              <div key={eye} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-700 mb-2">{eye}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Taille (mm)</label>
                    <input
                      type="number"
                      value={examData.pupils?.[eye]?.size || ''}
                      onChange={(e) => updateField('pupils', eye, 'size', e.target.value)}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Réaction</label>
                    <select
                      value={examData.pupils?.[eye]?.reaction || 'normal'}
                      onChange={(e) => updateField('pupils', eye, 'reaction', e.target.value)}
                      className="w-full mt-1 px-1 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="normal">Normal</option>
                      <option value="sluggish">Lent</option>
                      <option value="fixed">Fixe</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Forme</label>
                    <select
                      value={examData.pupils?.[eye]?.shape || 'round'}
                      onChange={(e) => updateField('pupils', eye, 'shape', e.target.value)}
                      className="w-full mt-1 px-1 py-1 text-sm border border-gray-300 rounded"
                    >
                      <option value="round">Ronde</option>
                      <option value="irregular">Irrégulière</option>
                      <option value="oval">Ovale</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs text-gray-500">RAPD (Marcus Gunn)</label>
              <select
                value={examData.pupils?.rapd || 'none'}
                onChange={(e) => {
                  const newData = { ...examData };
                  if (!newData.pupils) newData.pupils = {};
                  newData.pupils.rapd = e.target.value;
                  onChange?.(newData);
                }}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="none">Absent</option>
                <option value="OD">Présent OD</option>
                <option value="OS">Présent OS</option>
              </select>
            </div>
          </div>
        )}

        {/* Gonioscopy */}
        <button
          onClick={() => setExpandedSections(s => ({ ...s, gonioscopy: !s.gonioscopy }))}
          className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100"
        >
          <span>Gonioscopie</span>
          {expandedSections.gonioscopy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expandedSections.gonioscopy && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-4">
            {['OD', 'OS'].map(eye => (
              <div key={eye} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-700 mb-2">{eye} - Grades Shaffer</div>
                <div className="grid grid-cols-2 gap-2">
                  {['superior', 'inferior', 'nasal', 'temporal'].map(quadrant => (
                    <div key={quadrant}>
                      <label className="text-xs text-gray-500 capitalize">{quadrant}</label>
                      <select
                        value={examData.gonioscopy?.[eye]?.[quadrant] || ''}
                        onChange={(e) => updateField('gonioscopy', eye, quadrant, e.target.value)}
                        className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        <option value="">--</option>
                        {gonioscopyGrades.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
