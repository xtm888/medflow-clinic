import { useState, useEffect, useMemo } from 'react';
import { Stethoscope, FlaskConical, Scan, Plus, X, Search, Star, AlertCircle, Scissors } from 'lucide-react';
import feeScheduleService from '../../../../services/feeScheduleService';
import ApprovalWarningBanner, { ApprovalWarningInline, useApprovalWarnings } from '../../../../components/ApprovalWarningBanner';

/**
 * DiagnosticPanel - Consolidated diagnostic workup module
 * Tabs: Diagnosis | Procedures | Laboratory
 */
export default function DiagnosticPanel({ data, onChange, patient }) {
  const [activeTab, setActiveTab] = useState('diagnosis');
  const [searchQuery, setSearchQuery] = useState('');
  const [commonProcedures, setCommonProcedures] = useState([]);
  const [commonLabTests, setCommonLabTests] = useState([]);
  const [surgeryActs, setSurgeryActs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize data structure
  const diagnosticData = data || {
    diagnoses: [],
    procedures: [],
    laboratory: [],
    surgery: []
  };

  // Approval warnings hook
  const { warnings, company, loading: warningsLoading, checkWarnings, hasBlockingWarnings } = useApprovalWarnings();

  // Collect all act codes from procedures, laboratory, and surgery
  const allActCodes = useMemo(() => {
    const codes = [];
    diagnosticData.procedures?.forEach(p => {
      if (p.code) codes.push(p.code);
    });
    diagnosticData.laboratory?.forEach(l => {
      if (l.code) codes.push(l.code);
    });
    diagnosticData.surgery?.forEach(s => {
      if (s.code) codes.push(s.code);
    });
    return codes;
  }, [diagnosticData.procedures, diagnosticData.laboratory, diagnosticData.surgery]);

  // Check approval warnings when patient or acts change
  useEffect(() => {
    if (patient?._id && allActCodes.length > 0) {
      checkWarnings(patient._id, allActCodes);
    }
  }, [patient?._id, allActCodes.length]);

  // Build approval status map for inline display
  const approvalStatusMap = useMemo(() => {
    const map = {};
    warnings.blocking.forEach(w => {
      map[w.actCode] = { requiresApproval: true, status: 'needs_approval', reason: w.reason };
    });
    warnings.warning.forEach(w => {
      map[w.actCode] = { requiresApproval: true, status: 'pending' };
    });
    warnings.info.forEach(w => {
      map[w.actCode] = { requiresApproval: true, status: 'approved' };
    });
    return map;
  }, [warnings]);

  // Fetch procedures, lab tests, and surgery acts from fee schedule
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [exams, labs, surgeries] = await Promise.all([
          feeScheduleService.getImagingExams(),
          feeScheduleService.getLabTests(),
          feeScheduleService.getSurgeryActs()
        ]);

        // Transform fee schedule data to component format
        setCommonProcedures(exams.map(exam => ({
          code: exam.code,
          name: exam.name,
          category: exam.displayCategory || exam.category,
          urgency: 'routine', // Default urgency
          price: exam.price
        })));

        setCommonLabTests(labs.map(lab => ({
          code: lab.code,
          name: lab.name,
          category: lab.displayCategory || lab.category,
          urgency: 'routine', // Default urgency
          price: lab.price
        })));

        setSurgeryActs(surgeries.map(surg => ({
          code: surg.code,
          name: surg.name || surg.nameFr,
          category: surg.displayCategory || 'Chirurgie',
          price: surg.price
        })));
      } catch (error) {
        console.error('Error fetching fee schedules:', error);
        // Fallback to empty arrays on error
        setCommonProcedures([]);
        setCommonLabTests([]);
        setSurgeryActs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Common ophthalmology diagnoses (ICD-10) - keep hardcoded for now
  const commonDiagnoses = [
    { code: 'H40.11', name: 'Glaucome primitif à angle ouvert', category: 'Glaucoma' },
    { code: 'H40.20', name: 'Glaucome par fermeture de l\'angle', category: 'Glaucoma' },
    { code: 'H25.9', name: 'Cataracte sénile', category: 'Cataract' },
    { code: 'H25.11', name: 'Cataracte nucléaire', category: 'Cataract' },
    { code: 'H35.30', name: 'DMLA non précisée', category: 'Retina' },
    { code: 'H35.31', name: 'DMLA sèche', category: 'Retina' },
    { code: 'H35.32', name: 'DMLA humide', category: 'Retina' },
    { code: 'E11.311', name: 'Rétinopathie diabétique', category: 'Retina' },
    { code: 'H52.1', name: 'Myopie', category: 'Refraction' },
    { code: 'H52.0', name: 'Hypermétropie', category: 'Refraction' },
    { code: 'H52.2', name: 'Astigmatisme', category: 'Refraction' },
    { code: 'H52.4', name: 'Presbytie', category: 'Refraction' },
    { code: 'H10.9', name: 'Conjonctivite', category: 'External' },
    { code: 'H16.0', name: 'Kératite', category: 'Cornea' },
    { code: 'H04.12', name: 'Sécheresse oculaire', category: 'External' },
    { code: 'H50.0', name: 'Strabisme convergent', category: 'Strabismus' },
    { code: 'H50.1', name: 'Strabisme divergent', category: 'Strabismus' },
    { code: 'H53.00', name: 'Amblyopie', category: 'Pediatric' }
  ];

  // Filter items by search
  const filterItems = (items) => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  };

  // Add diagnosis
  const addDiagnosis = (diagnosis) => {
    const newData = { ...diagnosticData };
    if (!newData.diagnoses.find(d => d.code === diagnosis.code)) {
      newData.diagnoses.push({
        ...diagnosis,
        isPrimary: newData.diagnoses.length === 0,
        addedAt: new Date().toISOString()
      });
      onChange?.(newData);
    }
    setSearchQuery('');
  };

  // Remove diagnosis
  const removeDiagnosis = (code) => {
    const newData = { ...diagnosticData };
    newData.diagnoses = newData.diagnoses.filter(d => d.code !== code);
    // Make first remaining diagnosis primary if we removed the primary
    if (newData.diagnoses.length > 0 && !newData.diagnoses.find(d => d.isPrimary)) {
      newData.diagnoses[0].isPrimary = true;
    }
    onChange?.(newData);
  };

  // Toggle primary diagnosis
  const togglePrimary = (code) => {
    const newData = { ...diagnosticData };
    newData.diagnoses = newData.diagnoses.map(d => ({
      ...d,
      isPrimary: d.code === code
    }));
    onChange?.(newData);
  };

  // Add procedure
  const addProcedure = (procedure) => {
    const newData = { ...diagnosticData };
    if (!newData.procedures.find(p => p.code === procedure.code)) {
      newData.procedures.push({
        ...procedure,
        laterality: 'OU',
        addedAt: new Date().toISOString()
      });
      onChange?.(newData);
    }
    setSearchQuery('');
  };

  // Remove procedure
  const removeProcedure = (code) => {
    const newData = { ...diagnosticData };
    newData.procedures = newData.procedures.filter(p => p.code !== code);
    onChange?.(newData);
  };

  // Update procedure laterality
  const updateProcedureLaterality = (code, laterality) => {
    const newData = { ...diagnosticData };
    newData.procedures = newData.procedures.map(p =>
      p.code === code ? { ...p, laterality } : p
    );
    onChange?.(newData);
  };

  // Add lab test
  const addLabTest = (test) => {
    const newData = { ...diagnosticData };
    if (!newData.laboratory.find(l => l.code === test.code)) {
      newData.laboratory.push({
        ...test,
        addedAt: new Date().toISOString()
      });
      onChange?.(newData);
    }
    setSearchQuery('');
  };

  // Remove lab test
  const removeLabTest = (code) => {
    const newData = { ...diagnosticData };
    newData.laboratory = newData.laboratory.filter(l => l.code !== code);
    onChange?.(newData);
  };

  // Add surgery act
  const addSurgeryAct = (surgery) => {
    const newData = { ...diagnosticData };
    if (!newData.surgery) newData.surgery = [];
    if (!newData.surgery.find(s => s.code === surgery.code)) {
      newData.surgery.push({
        ...surgery,
        laterality: 'OD', // Default to OD for surgery
        addedAt: new Date().toISOString()
      });
      onChange?.(newData);
    }
    setSearchQuery('');
  };

  // Remove surgery act
  const removeSurgeryAct = (code) => {
    const newData = { ...diagnosticData };
    newData.surgery = (newData.surgery || []).filter(s => s.code !== code);
    onChange?.(newData);
  };

  // Update surgery laterality
  const updateSurgeryLaterality = (code, laterality) => {
    const newData = { ...diagnosticData };
    newData.surgery = (newData.surgery || []).map(s =>
      s.code === code ? { ...s, laterality } : s
    );
    onChange?.(newData);
  };

  const tabs = [
    { id: 'diagnosis', label: 'Diagnostic', icon: Stethoscope, count: diagnosticData.diagnoses.length },
    { id: 'procedures', label: 'Examens', icon: Scan, count: diagnosticData.procedures.length },
    { id: 'surgery', label: 'Chirurgie', icon: Scissors, count: (diagnosticData.surgery || []).length },
    { id: 'laboratory', label: 'Laboratoire', icon: FlaskConical, count: diagnosticData.laboratory.length }
  ];

  // Quick diagnosis chips - Most common diagnoses for one-click access
  const quickDiagnoses = [
    { code: 'H52.1', name: 'Myopie', shortName: 'Myopie', category: 'Refraction' },
    { code: 'H52.0', name: 'Hypermétropie', shortName: 'Hypermétropie', category: 'Refraction' },
    { code: 'H52.2', name: 'Astigmatisme', shortName: 'Astigmatisme', category: 'Refraction' },
    { code: 'H52.4', name: 'Presbytie', shortName: 'Presbytie', category: 'Refraction' },
    { code: 'H40.11', name: 'Glaucome primitif à angle ouvert', shortName: 'Glaucome', category: 'Glaucoma' },
    { code: 'H25.9', name: 'Cataracte sénile', shortName: 'Cataracte', category: 'Cataract' },
    { code: 'H10.9', name: 'Conjonctivite', shortName: 'Conjonctivite', category: 'External' },
    { code: 'H04.12', name: 'Sécheresse oculaire', shortName: 'Œil sec', category: 'External' }
  ];

  // Check if a quick diagnosis is already selected
  const isQuickDiagnosisSelected = (code) => {
    return diagnosticData.diagnoses.some(d => d.code === code);
  };

  // Toggle a quick diagnosis (add or remove)
  const toggleQuickDiagnosis = (diagnosis) => {
    if (isQuickDiagnosisSelected(diagnosis.code)) {
      removeDiagnosis(diagnosis.code);
    } else {
      addDiagnosis(diagnosis);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header with Tabs */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-200">
        <div className="px-4 py-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-orange-600" />
            Diagnostic & Examens Complémentaires
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'diagnosis' ? 'Rechercher un diagnostic (CIM-10)...' :
              activeTab === 'procedures' ? 'Rechercher un examen...' :
              'Rechercher un test laboratoire...'
            }
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Quick Diagnosis Chips - One-click access to common diagnoses */}
      {activeTab === 'diagnosis' && (
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700 uppercase">Diagnostics rapides</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickDiagnoses.map(dx => (
              <button
                key={dx.code}
                onClick={() => toggleQuickDiagnosis(dx)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                  isQuickDiagnosisSelected(dx.code)
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                }`}
                title={`${dx.name} (${dx.code})`}
              >
                {isQuickDiagnosisSelected(dx.code) && (
                  <span className="mr-1">✓</span>
                )}
                {dx.shortName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Approval Warnings Banner */}
      {(warnings.blocking.length > 0 || warnings.warning.length > 0 || warnings.info.length > 0) && (
        <div className="mx-4 mt-4">
          <ApprovalWarningBanner
            warnings={warnings}
            company={company}
            patient={patient}
            showRequestButton={true}
            compact={true}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">

        {/* Diagnosis Tab */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-4">
            {/* Selected Diagnoses */}
            {diagnosticData.diagnoses.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Diagnostics sélectionnés</h4>
                {diagnosticData.diagnoses.map(dx => (
                  <div
                    key={dx.code}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      dx.isPrimary ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePrimary(dx.code)}
                        className={`p-1 rounded ${dx.isPrimary ? 'text-orange-500' : 'text-gray-300 hover:text-orange-400'}`}
                        title={dx.isPrimary ? 'Diagnostic principal' : 'Définir comme principal'}
                      >
                        <Star className={`h-4 w-4 ${dx.isPrimary ? 'fill-current' : ''}`} />
                      </button>
                      <div>
                        <div className="font-medium text-gray-900">{dx.name}</div>
                        <div className="text-xs text-gray-500">{dx.code} • {dx.category}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeDiagnosis(dx.code)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Available Diagnoses */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Diagnostics fréquents</h4>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filterItems(commonDiagnoses).map(dx => (
                  <button
                    key={dx.code}
                    onClick={() => addDiagnosis(dx)}
                    disabled={diagnosticData.diagnoses.find(d => d.code === dx.code)}
                    className={`text-left p-2 rounded-lg border transition ${
                      diagnosticData.diagnoses.find(d => d.code === dx.code)
                        ? 'border-green-300 bg-green-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 truncate">{dx.name}</div>
                    <div className="text-xs text-gray-500">{dx.code}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Procedures Tab */}
        {activeTab === 'procedures' && (
          <div className="space-y-4">
            {/* Selected Procedures */}
            {diagnosticData.procedures.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Examens demandés</h4>
                {diagnosticData.procedures.map(proc => {
                  const approvalInfo = approvalStatusMap[proc.code];
                  return (
                    <div
                      key={proc.code}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {proc.name}
                          {approvalInfo && (
                            <ApprovalWarningInline
                              actCode={proc.code}
                              actName={proc.name}
                              requiresApproval={approvalInfo.requiresApproval}
                              approvalStatus={approvalInfo.status}
                              reason={approvalInfo.reason}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{proc.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={proc.laterality || 'OU'}
                          onChange={(e) => updateProcedureLaterality(proc.code, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                        >
                          <option value="OD">OD</option>
                          <option value="OS">OS</option>
                          <option value="OU">OU</option>
                        </select>
                        <button
                          onClick={() => removeProcedure(proc.code)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available Procedures */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Examens disponibles</h4>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filterItems(commonProcedures).map(proc => (
                  <button
                    key={proc.code}
                    onClick={() => addProcedure(proc)}
                    disabled={diagnosticData.procedures.find(p => p.code === proc.code)}
                    className={`text-left p-2 rounded-lg border transition ${
                      diagnosticData.procedures.find(p => p.code === proc.code)
                        ? 'border-green-300 bg-green-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{proc.name}</div>
                    <div className="text-xs text-gray-500">{proc.category}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Surgery Tab */}
        {activeTab === 'surgery' && (
          <div className="space-y-4">
            {/* Selected Surgery Acts */}
            {(diagnosticData.surgery || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Actes chirurgicaux programmés</h4>
                {(diagnosticData.surgery || []).map(surg => {
                  const approvalInfo = approvalStatusMap[surg.code];
                  return (
                    <div
                      key={surg.code}
                      className="flex items-center justify-between p-3 rounded-lg border border-purple-200 bg-purple-50"
                    >
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {surg.name}
                          {approvalInfo && (
                            <ApprovalWarningInline
                              actCode={surg.code}
                              actName={surg.name}
                              requiresApproval={approvalInfo.requiresApproval}
                              approvalStatus={approvalInfo.status}
                              reason={approvalInfo.reason}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{surg.category}</div>
                        {surg.price && (
                          <div className="text-xs text-purple-600 font-medium mt-1">
                            {surg.price.toLocaleString()} CDF
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={surg.laterality || 'OD'}
                          onChange={(e) => updateSurgeryLaterality(surg.code, e.target.value)}
                          className="px-2 py-1 text-xs border border-purple-300 rounded bg-white"
                        >
                          <option value="OD">OD (Droit)</option>
                          <option value="OS">OS (Gauche)</option>
                          <option value="OU">OU (Bilatéral)</option>
                        </select>
                        <button
                          onClick={() => removeSurgeryAct(surg.code)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available Surgery Acts */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Actes chirurgicaux disponibles</h4>
              {loading ? (
                <div className="text-center py-4 text-gray-500 text-sm">Chargement...</div>
              ) : surgeryActs.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Aucun acte chirurgical configuré. Vérifiez les tarifs (catégorie: surgery).
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {filterItems(surgeryActs).map(surg => (
                    <button
                      key={surg.code}
                      onClick={() => addSurgeryAct(surg)}
                      disabled={(diagnosticData.surgery || []).find(s => s.code === surg.code)}
                      className={`text-left p-2 rounded-lg border transition ${
                        (diagnosticData.surgery || []).find(s => s.code === surg.code)
                          ? 'border-green-300 bg-green-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{surg.name}</div>
                      <div className="text-xs text-gray-500">{surg.category}</div>
                      {surg.price && (
                        <div className="text-xs text-purple-600 font-medium">{surg.price.toLocaleString()} CDF</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Laboratory Tab */}
        {activeTab === 'laboratory' && (
          <div className="space-y-4">
            {/* Selected Lab Tests */}
            {diagnosticData.laboratory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Analyses demandées</h4>
                {diagnosticData.laboratory.map(test => {
                  const approvalInfo = approvalStatusMap[test.code];
                  return (
                    <div
                      key={test.code}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {test.name}
                          {approvalInfo && (
                            <ApprovalWarningInline
                              actCode={test.code}
                              actName={test.name}
                              requiresApproval={approvalInfo.requiresApproval}
                              approvalStatus={approvalInfo.status}
                              reason={approvalInfo.reason}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{test.category}</div>
                      </div>
                      <button
                        onClick={() => removeLabTest(test.code)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available Lab Tests */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Analyses disponibles</h4>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filterItems(commonLabTests).map(test => (
                  <button
                    key={test.code}
                    onClick={() => addLabTest(test)}
                    disabled={diagnosticData.laboratory.find(l => l.code === test.code)}
                    className={`text-left p-2 rounded-lg border transition ${
                      diagnosticData.laboratory.find(l => l.code === test.code)
                        ? 'border-green-300 bg-green-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">{test.name}</div>
                    <div className="text-xs text-gray-500">{test.category}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {(diagnosticData.diagnoses.length > 0 || diagnosticData.procedures.length > 0 || (diagnosticData.surgery || []).length > 0 || diagnosticData.laboratory.length > 0) && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center gap-4 text-xs text-gray-600">
            {diagnosticData.diagnoses.length > 0 && (
              <span className="flex items-center gap-1">
                <Stethoscope className="h-3 w-3" />
                {diagnosticData.diagnoses.length} Dx
              </span>
            )}
            {diagnosticData.procedures.length > 0 && (
              <span className="flex items-center gap-1">
                <Scan className="h-3 w-3" />
                {diagnosticData.procedures.length} Examens
              </span>
            )}
            {(diagnosticData.surgery || []).length > 0 && (
              <span className="flex items-center gap-1 text-purple-600">
                <Scissors className="h-3 w-3" />
                {diagnosticData.surgery.length} Chirurgie
              </span>
            )}
            {diagnosticData.laboratory.length > 0 && (
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3 w-3" />
                {diagnosticData.laboratory.length} Labo
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
