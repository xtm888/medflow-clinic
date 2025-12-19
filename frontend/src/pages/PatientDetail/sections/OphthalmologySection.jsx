import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Activity, Glasses, Clock, FileSignature, AlertTriangle, Check, Loader2, Circle } from 'lucide-react';

// IOP threshold for abnormal values (mmHg)
const IOP_ABNORMAL_THRESHOLD = 21;
import CollapsibleSection, { SectionEmptyState, SectionActionButton } from '../../../components/CollapsibleSection';
import api from '../../../services/apiConfig';
import patientService from '../../../services/patientService';
import visitService from '../../../services/visitService';
import { toast } from 'react-toastify';

/**
 * OphthalmologySection - Latest refraction, IOP, exam counts, IVT history
 */
export default function OphthalmologySection({ patient, patientId, canCreateExam, canSign = true, forceExpand = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [ivtHistory, setIvtHistory] = useState([]);
  const [latestData, setLatestData] = useState(null);
  const [unsignedVisits, setUnsignedVisits] = useState([]);
  const [signingId, setSigningId] = useState(null);

  const loadData = async (force = false) => {
    if (!force && (exams.length > 0 || ivtHistory.length > 0)) return;

    setLoading(true);
    try {
      // Load visits/exams
      const [visitsRes, ivtRes] = await Promise.all([
        patientService.getPatientVisits(patientId).catch(() => ({ data: [] })),
        api.get(`/ivt/patient/${patientId}/history`).catch(() => ({ data: { data: [] } }))
      ]);

      // Ensure data is always an array
      const visitsData = Array.isArray(visitsRes.data) ? visitsRes.data : (visitsRes.data?.data || []);
      const ivtData = Array.isArray(ivtRes.data?.data) ? ivtRes.data.data : [];

      setExams(Array.isArray(visitsData) ? visitsData : []);
      setIvtHistory(Array.isArray(ivtData) ? ivtData : []);

      // Filter unsigned visits (include visits without signatureStatus or with unsigned/pending)
      const unsigned = visitsData.filter(v =>
        !v.signatureStatus ||
        v.signatureStatus === 'unsigned' ||
        v.signatureStatus === 'pending'
      );
      console.log('Visits loaded:', visitsData.length, 'Unsigned:', unsigned.length);
      setUnsignedVisits(unsigned);

      // Extract latest measurements from exams
      // OphthalmologyExam has nested structure: refraction.finalPrescription, refraction.subjective

      // Find latest refraction (prefer finalPrescription, fallback to subjective)
      const latestRefraction = visitsData.find(e =>
        e.refraction?.finalPrescription?.OD ||
        e.refraction?.finalPrescription?.OS ||
        e.refraction?.subjective?.OD ||
        e.refraction?.subjective?.OS ||
        e.type === 'refraction'
      );

      // Find latest IOP (may be from any exam type)
      const latestIOP = visitsData.find(e => e.iop?.OD?.value || e.iop?.OS?.value || e.intraocularPressure);

      // Find latest keratometry
      const latestKerato = visitsData.find(e => e.keratometry?.OD || e.keratometry?.OS);

      // Find latest current correction (glasses/contacts)
      const latestCorrection = visitsData.find(e => e.currentCorrection?.glasses || e.currentCorrection?.contacts);

      // Extract the nested refraction data (finalPrescription or subjective)
      const extractedRefraction = latestRefraction?.refraction?.finalPrescription ||
                                   latestRefraction?.refraction?.subjective ||
                                   latestRefraction?.refraction ||
                                   null;

      // Helper to get date from a record (visit or exam)
      const getRecordDate = (record) =>
        record?.date || record?.visitDate || record?.createdAt || record?.updatedAt;

      setLatestData({
        refraction: extractedRefraction,
        refractionDate: getRecordDate(latestRefraction),
        iop: latestIOP?.iop || latestIOP?.intraocularPressure || null,
        iopDate: getRecordDate(latestIOP),
        keratometry: latestKerato?.keratometry || null,
        keratometryDate: getRecordDate(latestKerato),
        currentCorrection: latestCorrection?.currentCorrection || null,
        correctionDate: getRecordDate(latestCorrection)
      });
    } catch (err) {
      console.error('Error loading ophthalmology data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sign a visit
  const handleSignVisit = async (visitId) => {
    setSigningId(visitId);
    try {
      await visitService.signVisit(visitId);
      toast.success('Visite signée avec succès');
      // Remove from unsigned list
      setUnsignedVisits(prev => prev.filter(v => v._id !== visitId));
      // Update exam list
      setExams(prev => prev.map(e =>
        e._id === visitId ? { ...e, signatureStatus: 'signed' } : e
      ));
    } catch (err) {
      console.error('Error signing visit:', err);
      toast.error(err.response?.data?.error || 'Erreur lors de la signature');
    } finally {
      setSigningId(null);
    }
  };

  // Sign all unsigned visits
  const handleSignAll = async () => {
    if (unsignedVisits.length === 0) return;

    setSigningId('all');
    try {
      for (const visit of unsignedVisits) {
        await visitService.signVisit(visit._id);
      }
      toast.success(`${unsignedVisits.length} visite(s) signée(s)`);
      setUnsignedVisits([]);
      // Update all exams
      setExams(prev => prev.map(e => ({ ...e, signatureStatus: 'signed' })));
    } catch (err) {
      console.error('Error signing visits:', err);
      toast.error('Erreur lors de la signature');
      // Reload to get current state
      loadData(true);
    } finally {
      setSigningId(null);
    }
  };

  // Auto-load data when patientId changes or on mount
  useEffect(() => {
    if (patientId) {
      loadData(true); // Force reload when patient changes
    }
  }, [patientId]);

  // Format refraction for display
  const formatRefraction = (eye, data) => {
    if (!data?.[eye]) return '--';
    const r = data[eye];
    if (!r.sphere && r.sphere !== 0) return '--';
    const sphere = r.sphere > 0 ? `+${r.sphere}` : r.sphere;
    const cyl = r.cylinder ? ` ${r.cylinder}` : '';
    const axis = r.axis ? ` x ${r.axis}°` : '';
    return `${sphere}${cyl}${axis}`;
  };

  // Check if IOP is abnormal (> 21 mmHg) - handle string values
  const isIOPAbnormal = (value) => {
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue > IOP_ABNORMAL_THRESHOLD;
  };

  // Format keratometry for display
  const formatKeratometry = (eye, data) => {
    if (!data?.[eye]) return null;
    const k = data[eye];
    return {
      k1: k.k1?.power ? `${k.k1.power.toFixed(2)} D @ ${k.k1.axis}°` : null,
      k2: k.k2?.power ? `${k.k2.power.toFixed(2)} D @ ${k.k2.axis}°` : null,
      avg: k.average ? `${k.average.toFixed(2)} D` : null,
      cyl: k.cylinder ? `${k.cylinder.toFixed(2)} D` : null
    };
  };

  // Format current correction for display
  const formatCorrection = (eye, data) => {
    if (!data?.glasses?.[eye]) return '--';
    const g = data.glasses[eye];
    if (!g.sphere && g.sphere !== 0) return '--';
    const sphere = g.sphere > 0 ? `+${g.sphere}` : g.sphere;
    const cyl = g.cylinder ? ` ${g.cylinder}` : '';
    const axis = g.axis ? ` x ${g.axis}°` : '';
    const add = g.add ? ` Add +${g.add}` : '';
    return `${sphere}${cyl}${axis}${add}`;
  };

  // Count by type (with safety checks)
  const refractionCount = Array.isArray(exams) ? exams.filter(e => e.type === 'refraction').length : 0;
  const otherExamCount = Array.isArray(exams) ? exams.filter(e => !['refraction', 'ivt'].includes(e.type)).length : 0;
  const ivtCount = Array.isArray(ivtHistory) ? ivtHistory.length : 0;

  return (
    <CollapsibleSection
      title="Ophtalmologie"
      icon={Eye}
      iconColor="text-purple-600"
      gradient="from-purple-50 to-pink-50"
      defaultExpanded={true}
      onExpand={loadData}
      loading={loading}
      badge={
        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
          {(Array.isArray(exams) ? exams.length : 0) + (Array.isArray(ivtHistory) ? ivtHistory.length : 0)} examens
        </span>
      }
      headerExtra={
        latestData?.iop && (
          <span className="flex items-center gap-1">
            PIO:
            <span className={isIOPAbnormal(latestData.iop.OD?.value) ? 'text-red-600 font-bold' : ''}>
              OD {latestData.iop.OD?.value || '--'}
            </span>
            /
            <span className={isIOPAbnormal(latestData.iop.OS?.value) ? 'text-red-600 font-bold' : ''}>
              OS {latestData.iop.OS?.value || '--'}
            </span>
            mmHg
            {(isIOPAbnormal(latestData.iop.OD?.value) || isIOPAbnormal(latestData.iop.OS?.value)) && (
              <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
            )}
          </span>
        )
      }
      actions={
        canCreateExam && (
          <SectionActionButton
            icon={Plus}
            onClick={() => navigate(`/ophthalmology/studio/${patientId}`)}
            variant="primary"
          >
            Consultation
          </SectionActionButton>
        )
      }
    >
      {/* Always show unsigned visits first if there are any */}
      {unsignedVisits.length > 0 && canSign && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h4 className="font-semibold text-amber-900">
                {unsignedVisits.length} note(s) non signée(s)
              </h4>
            </div>
            <button
              onClick={handleSignAll}
              disabled={signingId === 'all'}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition"
            >
              {signingId === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSignature className="h-4 w-4" />
              )}
              Tout signer
            </button>
          </div>

          <div className="space-y-2">
            {unsignedVisits.slice(0, 5).map(visit => (
              <div
                key={visit._id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <FileSignature className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {visit.visitType === 'ophthalmology' ? 'Consultation ophtalmologique' :
                       visit.visitType === 'refraction' ? 'Réfraction' :
                       visit.visitType || 'Visite'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {visit.visitId} • {new Date(visit.visitDate || visit.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    {visit.chiefComplaint?.complaint && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate max-w-xs">
                        {visit.chiefComplaint.complaint}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSignVisit(visit._id)}
                  disabled={signingId === visit._id}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition"
                >
                  {signingId === visit._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Signer
                </button>
              </div>
            ))}

            {unsignedVisits.length > 5 && (
              <p className="text-sm text-center text-amber-700 pt-2">
                + {unsignedVisits.length - 5} autre(s) note(s) non signée(s)
              </p>
            )}
          </div>
        </div>
      )}

      {(!Array.isArray(exams) || exams.length === 0) && (!Array.isArray(ivtHistory) || ivtHistory.length === 0) && unsignedVisits.length === 0 ? (
        <SectionEmptyState
          icon={Eye}
          message="Aucun examen ophtalmologique enregistré"
          action={
            canCreateExam && (
              <SectionActionButton
                icon={Plus}
                onClick={() => navigate(`/ophthalmology/studio/${patientId}`)}
              >
                Nouvelle consultation
              </SectionActionButton>
            )
          }
        />
      ) : (exams.length > 0 || ivtHistory.length > 0) ? (
        <div className="space-y-4">
          {/* Latest Refraction & IOP */}
          {latestData && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-purple-900 flex items-center gap-2">
                  <Glasses className="h-4 w-4" />
                  Dernière Réfraction
                </h4>
                <span className="text-xs text-purple-600">
                  {new Date(latestData.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">OD (Œil droit)</span>
                  <p className="text-lg font-mono font-semibold text-gray-900">
                    {formatRefraction('OD', latestData.refraction)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">OS (Œil gauche)</span>
                  <p className="text-lg font-mono font-semibold text-gray-900">
                    {formatRefraction('OS', latestData.refraction)}
                  </p>
                </div>
              </div>
              {latestData.iop && (
                <div className="mt-3 pt-3 border-t border-purple-100 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500">PIO OD</span>
                    <p className={`text-lg font-semibold flex items-center gap-1 ${
                      isIOPAbnormal(latestData.iop.OD?.value) ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {latestData.iop.OD?.value || '--'}
                      <span className="text-sm font-normal text-gray-500">mmHg</span>
                      {isIOPAbnormal(latestData.iop.OD?.value) && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">PIO OS</span>
                    <p className={`text-lg font-semibold flex items-center gap-1 ${
                      isIOPAbnormal(latestData.iop.OS?.value) ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {latestData.iop.OS?.value || '--'}
                      <span className="text-sm font-normal text-gray-500">mmHg</span>
                      {isIOPAbnormal(latestData.iop.OS?.value) && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keratometry Box - only show if there are actual K values */}
          {latestData?.keratometry && (
            (latestData.keratometry.OD?.k1?.power || latestData.keratometry.OS?.k1?.power)
          ) && (
            <div className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-cyan-900 flex items-center gap-2">
                  <Circle className="h-4 w-4" />
                  Kératométrie
                </h4>
                {latestData.keratometryDate && (
                  <span className="text-xs text-cyan-600">
                    {new Date(latestData.keratometryDate).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* OD Keratometry */}
                <div>
                  <span className="text-xs text-gray-500 font-medium">OD (Œil droit)</span>
                  {formatKeratometry('OD', latestData.keratometry) ? (
                    <div className="mt-1 space-y-0.5">
                      {formatKeratometry('OD', latestData.keratometry).k1 && (
                        <p className="text-sm font-mono text-gray-900">
                          K1: {formatKeratometry('OD', latestData.keratometry).k1}
                        </p>
                      )}
                      {formatKeratometry('OD', latestData.keratometry).k2 && (
                        <p className="text-sm font-mono text-gray-900">
                          K2: {formatKeratometry('OD', latestData.keratometry).k2}
                        </p>
                      )}
                      {formatKeratometry('OD', latestData.keratometry).avg && (
                        <p className="text-sm font-mono text-cyan-700 font-semibold">
                          Moy: {formatKeratometry('OD', latestData.keratometry).avg}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">--</p>
                  )}
                </div>
                {/* OS Keratometry */}
                <div>
                  <span className="text-xs text-gray-500 font-medium">OS (Œil gauche)</span>
                  {formatKeratometry('OS', latestData.keratometry) ? (
                    <div className="mt-1 space-y-0.5">
                      {formatKeratometry('OS', latestData.keratometry).k1 && (
                        <p className="text-sm font-mono text-gray-900">
                          K1: {formatKeratometry('OS', latestData.keratometry).k1}
                        </p>
                      )}
                      {formatKeratometry('OS', latestData.keratometry).k2 && (
                        <p className="text-sm font-mono text-gray-900">
                          K2: {formatKeratometry('OS', latestData.keratometry).k2}
                        </p>
                      )}
                      {formatKeratometry('OS', latestData.keratometry).avg && (
                        <p className="text-sm font-mono text-cyan-700 font-semibold">
                          Moy: {formatKeratometry('OS', latestData.keratometry).avg}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">--</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Current Correction (Glasses) Box */}
          {latestData?.currentCorrection?.glasses && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                  <Glasses className="h-4 w-4" />
                  Correction Actuelle
                </h4>
                {latestData.correctionDate && (
                  <span className="text-xs text-amber-600">
                    {new Date(latestData.correctionDate).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">OD (Œil droit)</span>
                  <p className="text-lg font-mono font-semibold text-gray-900">
                    {formatCorrection('OD', latestData.currentCorrection)}
                  </p>
                  {latestData.currentCorrection.glasses?.OD?.va && (
                    <p className="text-xs text-amber-600">
                      AV: {latestData.currentCorrection.glasses.OD.va}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-gray-500">OS (Œil gauche)</span>
                  <p className="text-lg font-mono font-semibold text-gray-900">
                    {formatCorrection('OS', latestData.currentCorrection)}
                  </p>
                  {latestData.currentCorrection.glasses?.OS?.va && (
                    <p className="text-xs text-amber-600">
                      AV: {latestData.currentCorrection.glasses.OS.va}
                    </p>
                  )}
                </div>
              </div>
              {latestData.currentCorrection.glasses?.age && (
                <p className="mt-2 text-xs text-gray-500">
                  Âge des lunettes: {latestData.currentCorrection.glasses.age}
                </p>
              )}
            </div>
          )}

          {/* Exam Type Cards */}
          <div className="grid grid-cols-3 gap-3">
            <ExamTypeCard
              title="Réfractions"
              count={refractionCount}
              color="blue"
              icon={Glasses}
              onClick={() => navigate(`/ophthalmology/studio/${patientId}`)}
              actionLabel="+ Nouvelle"
            />
            <ExamTypeCard
              title="IVT"
              count={ivtCount}
              color="purple"
              icon={Activity}
              onClick={() => navigate(`/ivt/new?patientId=${patientId}`)}
              actionLabel="+ Programmer"
            />
            <ExamTypeCard
              title="Autres"
              count={otherExamCount}
              color="green"
              icon={Eye}
              onClick={() => navigate(`/ophthalmology/exam/new?patientId=${patientId}&type=other`)}
              actionLabel="+ Ajouter"
            />
          </div>

          {/* Recent IVT History */}
          {ivtHistory.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                Dernières IVT
              </h4>
              <div className="space-y-2">
                {ivtHistory.slice(0, 3).map((ivt) => (
                  <div
                    key={ivt._id}
                    onClick={() => navigate(`/ivt/${ivt._id}`)}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${
                        ivt.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <Activity className={`h-4 w-4 ${
                          ivt.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {ivt.medication?.name || ivt.medication || 'IVT'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ivt.eye === 'left' ? 'OS' : ivt.eye === 'right' ? 'OD' : ivt.eye} •
                          {new Date(ivt.scheduledDate || ivt.performedAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      ivt.status === 'completed' ? 'bg-green-100 text-green-700' :
                      ivt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ivt.status === 'completed' ? 'Effectuée' :
                       ivt.status === 'scheduled' ? 'Planifiée' : ivt.status}
                    </span>
                  </div>
                ))}
              </div>
              {ivtHistory.length > 3 && (
                <button
                  onClick={() => navigate(`/ivt?patientId=${patientId}`)}
                  className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                >
                  Voir les {ivtHistory.length} injections →
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

// Exam type summary card
function ExamTypeCard({ title, count, color, icon: Icon, onClick, actionLabel }) {
  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:bg-blue-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'hover:bg-purple-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', hover: 'hover:bg-green-100' }
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`${c.bg} rounded-lg p-3 ${c.hover} transition cursor-pointer`} onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <Icon className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
      <button className={`mt-1 text-xs ${c.text} hover:underline`}>
        {actionLabel}
      </button>
    </div>
  );
}
