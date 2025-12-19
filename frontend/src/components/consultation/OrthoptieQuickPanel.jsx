/**
 * OrthoptieQuickPanel - Simplified orthoptic assessment panel for StudioVision
 *
 * Matches StudioVision design with purple color theme.
 * Provides quick access to essential orthoptic tests:
 * - Cover Test (distance + near)
 * - Near Point of Convergence (PPC)
 * - Stereopsis (Wirt + Lang tests)
 *
 * Links to full OrthopticExamForm for comprehensive assessment.
 */

import { useState, useEffect } from 'react';
import {
  Eye,
  ArrowRight,
  Check,
  ChevronRight,
  Target,
  Glasses,
  Loader2
} from 'lucide-react';

// Cover test deviation options (French)
const DEVIATION_OPTIONS = [
  { value: 'ortho', label: 'Ortho' },
  { value: 'eso', label: 'Ésophorie' },
  { value: 'exo', label: 'Exophorie' },
  { value: 'hyper', label: 'Hyperphorie' },
  { value: 'hypo', label: 'Hypophorie' },
  { value: 'eso-tropie', label: 'Ésotropie' },
  { value: 'exo-tropie', label: 'Exotropie' }
];

// PPC quality options
const PPC_QUALITY_OPTIONS = [
  { value: 'bon', label: 'Bon' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'faible', label: 'Faible' }
];

// Stereopsis conclusion options
const CONCLUSION_OPTIONS = [
  { value: 'normal', label: 'Vision binoculaire normale' },
  { value: 'phorie-compensee', label: 'Phorie compensée' },
  { value: 'phorie-decompensee', label: 'Phorie décompensée' },
  { value: 'tropie', label: 'Tropie' },
  { value: 'insuffisance-convergence', label: 'Insuffisance de convergence' },
  { value: 'autre', label: 'Autre' }
];

// Wirt test circle values (arc seconds)
const WIRT_CIRCLES = [
  { value: '800', label: '800"' },
  { value: '400', label: '400"' },
  { value: '200', label: '200"' },
  { value: '140', label: '140"' },
  { value: '100', label: '100"' },
  { value: '80', label: '80"' },
  { value: '60', label: '60"' },
  { value: '50', label: '50"' },
  { value: '40', label: '40"' }
];

// Default empty data structure
const defaultOrthoptieData = {
  coverTest: {
    distance: { deviation: 'ortho', measurement: '' },
    near: { deviation: 'ortho', measurement: '' }
  },
  ppc: {
    breakPoint: '',
    recoveryPoint: '',
    quality: 'bon'
  },
  stereopsis: {
    wirt: {
      fly: false,
      animals: false,
      circles: '40'
    },
    lang: {
      cat: false,
      star: false,
      car: false
    }
  },
  conclusion: '',
  notes: ''
};

/**
 * Styles for the purple StudioVision Orthoptie theme
 */
const styles = {
  container: 'bg-purple-50 border border-purple-200 rounded-lg overflow-hidden',
  header: 'bg-purple-600 text-white px-4 py-2 flex items-center justify-between',
  headerTitle: 'flex items-center gap-2 font-semibold',
  headerIcon: 'h-5 w-5',
  fullExamButton: 'flex items-center gap-1 text-sm bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded transition-colors',
  content: 'p-4',
  section: 'bg-white border border-purple-100 rounded-lg p-3 mb-3',
  sectionTitle: 'text-sm font-semibold text-purple-700 mb-2 flex items-center gap-1',
  row: 'flex items-center gap-3 mb-2',
  label: 'text-sm text-gray-600 w-20 flex-shrink-0',
  input: 'border border-gray-300 rounded px-2 py-1 text-sm w-16 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none',
  select: 'border border-gray-300 rounded px-2 py-1 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none',
  checkbox: 'h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500',
  checkboxLabel: 'text-sm text-gray-700 ml-1',
  prismUnit: 'text-xs text-gray-500 ml-1',
  cmUnit: 'text-xs text-gray-500 ml-1',
  footer: 'flex items-center gap-4 mt-3 pt-3 border-t border-purple-100',
  conclusionSelect: 'flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none',
  notesInput: 'flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none',
  stereopsisResult: 'text-xs text-purple-600 font-medium ml-2'
};

export default function OrthoptieQuickPanel({
  patientId,
  visitId,
  value = defaultOrthoptieData,
  onChange,
  onOpenFullExam,
  loading = false,
  className = ''
}) {
  // Merge provided value with defaults to ensure all fields exist
  const data = {
    ...defaultOrthoptieData,
    ...value,
    coverTest: { ...defaultOrthoptieData.coverTest, ...value?.coverTest },
    ppc: { ...defaultOrthoptieData.ppc, ...value?.ppc },
    stereopsis: {
      ...defaultOrthoptieData.stereopsis,
      ...value?.stereopsis,
      wirt: { ...defaultOrthoptieData.stereopsis.wirt, ...value?.stereopsis?.wirt },
      lang: { ...defaultOrthoptieData.stereopsis.lang, ...value?.stereopsis?.lang }
    }
  };

  // Update handler that merges changes
  const handleChange = (path, newValue) => {
    const pathParts = path.split('.');
    const updatedData = { ...data };

    let current = updatedData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current[pathParts[i]] = { ...current[pathParts[i]] };
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = newValue;

    onChange?.(updatedData);
  };

  // Calculate stereopsis result in arc seconds
  const getStereopsisResult = () => {
    const results = [];

    // Wirt test result
    if (data.stereopsis.wirt.circles) {
      results.push(`Wirt: ${data.stereopsis.wirt.circles}"arc`);
    }

    // Lang test result (approximate values)
    const langPassed = [
      data.stereopsis.lang.cat,
      data.stereopsis.lang.star,
      data.stereopsis.lang.car
    ].filter(Boolean).length;

    if (langPassed > 0) {
      const langValue = langPassed === 3 ? '550' : langPassed === 2 ? '600' : '1200';
      results.push(`Lang: ${langValue}"arc`);
    }

    return results.join(' | ');
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Glasses className={styles.headerIcon} />
            ORTHOPTIE
          </div>
        </div>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Glasses className={styles.headerIcon} />
          ORTHOPTIE
        </div>
        {onOpenFullExam && (
          <button
            onClick={onOpenFullExam}
            className={styles.fullExamButton}
            title="Ouvrir le bilan orthoptique complet"
          >
            Bilan complet
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {/* Cover Test Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Target className="h-4 w-4" />
            COVER TEST
          </div>

          {/* Distance */}
          <div className={styles.row}>
            <span className={styles.label}>Distance:</span>
            <select
              value={data.coverTest.distance.deviation}
              onChange={(e) => handleChange('coverTest.distance.deviation', e.target.value)}
              className={styles.select}
            >
              {DEVIATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={data.coverTest.distance.measurement}
              onChange={(e) => handleChange('coverTest.distance.measurement', e.target.value)}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.prismUnit}>Δ</span>
          </div>

          {/* Near */}
          <div className={styles.row}>
            <span className={styles.label}>Près:</span>
            <select
              value={data.coverTest.near.deviation}
              onChange={(e) => handleChange('coverTest.near.deviation', e.target.value)}
              className={styles.select}
            >
              {DEVIATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={data.coverTest.near.measurement}
              onChange={(e) => handleChange('coverTest.near.measurement', e.target.value)}
              placeholder="0"
              className={styles.input}
            />
            <span className={styles.prismUnit}>Δ</span>
          </div>
        </div>

        {/* PPC Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Eye className="h-4 w-4" />
            PPC (Point Proximal de Convergence)
          </div>

          <div className="flex flex-wrap gap-4">
            <div className={styles.row}>
              <span className={styles.label}>Rupture:</span>
              <input
                type="text"
                value={data.ppc.breakPoint}
                onChange={(e) => handleChange('ppc.breakPoint', e.target.value)}
                placeholder="5"
                className={styles.input}
              />
              <span className={styles.cmUnit}>cm</span>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Récupér.:</span>
              <input
                type="text"
                value={data.ppc.recoveryPoint}
                onChange={(e) => handleChange('ppc.recoveryPoint', e.target.value)}
                placeholder="8"
                className={styles.input}
              />
              <span className={styles.cmUnit}>cm</span>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Qualité:</span>
              <select
                value={data.ppc.quality}
                onChange={(e) => handleChange('ppc.quality', e.target.value)}
                className={styles.select}
              >
                {PPC_QUALITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stereopsis Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Glasses className="h-4 w-4" />
            STÉRÉOSCOPIE
            {getStereopsisResult() && (
              <span className={styles.stereopsisResult}>
                → {getStereopsisResult()}
              </span>
            )}
          </div>

          {/* Wirt Test */}
          <div className="mb-3">
            <span className="text-xs font-medium text-gray-500 block mb-1">Test de Wirt:</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.stereopsis.wirt.fly}
                  onChange={(e) => handleChange('stereopsis.wirt.fly', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Mouche</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.stereopsis.wirt.animals}
                  onChange={(e) => handleChange('stereopsis.wirt.animals', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Animaux</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">Cercles:</span>
                <select
                  value={data.stereopsis.wirt.circles}
                  onChange={(e) => handleChange('stereopsis.wirt.circles', e.target.value)}
                  className={styles.select}
                >
                  {WIRT_CIRCLES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lang Test */}
          <div>
            <span className="text-xs font-medium text-gray-500 block mb-1">Test de Lang:</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.stereopsis.lang.cat}
                  onChange={(e) => handleChange('stereopsis.lang.cat', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Chat</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.stereopsis.lang.star}
                  onChange={(e) => handleChange('stereopsis.lang.star', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Étoile</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={data.stereopsis.lang.car}
                  onChange={(e) => handleChange('stereopsis.lang.car', e.target.checked)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>Voiture</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer with Conclusion and Notes */}
        <div className={styles.footer}>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-gray-600 flex-shrink-0">Conclusion:</span>
            <select
              value={data.conclusion}
              onChange={(e) => handleChange('conclusion', e.target.value)}
              className={styles.conclusionSelect}
            >
              <option value="">-- Sélectionner --</option>
              {CONCLUSION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-gray-600 flex-shrink-0">Notes:</span>
            <input
              type="text"
              value={data.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Observations..."
              className={styles.notesInput}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Named export for the data structure
export { defaultOrthoptieData };
