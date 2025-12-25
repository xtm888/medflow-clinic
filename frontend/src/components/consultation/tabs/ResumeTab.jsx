/**
 * ResumeTab - Color-coded consultation summary (matches StudioVision oph1.jpg)
 *
 * Layout:
 * - LEFT: Patient demographics + medical history
 * - CENTER: Color-coded sections (Réfraction=Pink, Tonométrie=Green, Pathologies=Yellow, Traitement=Blue)
 * - RIGHT: Consultation history table
 *
 * Features:
 * - ALD/CMU/Dossier Papier checkboxes
 * - "Nouvelle consultation" button
 * - Important notes highlighting
 */

import { useState } from 'react';
import {
  User,
  Phone,
  MapPin,
  AlertCircle,
  Calendar,
  Plus,
  FileText,
  Printer,
  History,
  Image,
  Volume2,
  Eye,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Import the rich visit history table
import VisitHistoryTable from '../VisitHistoryTable';
import CriticalAlertBanner from '../../patient/CriticalAlertBanner';

// Color-coded section component
function SummarySection({ title, color, children, className = '' }) {
  const colorStyles = {
    pink: 'bg-pink-100 border-pink-300 text-pink-900',
    green: 'bg-green-100 border-green-300 text-green-900',
    yellow: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    blue: 'bg-blue-100 border-blue-300 text-blue-900',
    purple: 'bg-purple-100 border-purple-300 text-purple-900'
  };

  return (
    <div className={`rounded-md border-2 p-3 ${colorStyles[color]} ${className}`}>
      <div className="font-bold text-sm mb-2 flex items-center gap-2">
        <span className="text-lg">»</span>
        {title}
      </div>
      <div className="text-sm space-y-1">
        {children}
      </div>
    </div>
  );
}

// Patient demographics panel (left side)
function PatientDemographicsPanel({ patient }) {
  const age = patient?.dateOfBirth
    ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-3">
      {/* Patient Name & Age */}
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-2xl font-bold text-gray-900">{patient?.lastName?.toUpperCase()}</h2>
        <div className="flex items-center gap-2">
          <span className="text-lg">{patient?.firstName}</span>
          {age && (
            <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-sm font-bold rounded">
              {age} Ans
            </span>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="text-sm space-y-1">
        {patient?.title && (
          <p className="text-gray-600">
            {patient.title} {patient.lastName} {patient.firstName}
          </p>
        )}
        {patient?.dateOfBirth && (
          <p className="text-gray-600">
            Né(e) le {format(new Date(patient.dateOfBirth), 'dd/MM/yyyy')}
          </p>
        )}
        {patient?.address && (
          <p className="flex items-start gap-1 text-gray-600">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            {typeof patient.address === 'object'
              ? [patient.address.street, patient.address.city, patient.address.country].filter(Boolean).join(', ')
              : patient.address}
          </p>
        )}
        {(patient?.phoneNumber || patient?.phone) && (
          <p className="flex items-center gap-1 text-gray-600">
            <Phone className="h-3 w-3" />
            Tél 1: {patient.phoneNumber || patient.phone}
          </p>
        )}
        {patient?.phone2 && (
          <p className="flex items-center gap-1 text-gray-600">
            <Phone className="h-3 w-3" />
            Tél 2: {patient.phone2}
          </p>
        )}
        {patient?.socialSecurityNumber && (
          <p className="text-gray-600">
            N° SS: {patient.socialSecurityNumber}
          </p>
        )}
        {(patient?.occupation || patient?.profession) && (
          <p className="flex items-center gap-1 text-gray-600">
            <Briefcase className="h-3 w-3 text-gray-400" />
            <span className="font-medium">Profession:</span> {patient.occupation || patient.profession}
          </p>
        )}
      </div>

      {/* Medical History */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        {patient?.medicalHistory && (
          <div className="text-sm">
            <span className="font-semibold text-gray-700">- Antcd: </span>
            <span className="text-gray-600">
              {typeof patient.medicalHistory === 'object'
                ? [
                    patient.medicalHistory.chronicConditions?.length > 0 && `Maladies: ${patient.medicalHistory.chronicConditions.join(', ')}`,
                    patient.medicalHistory.surgeries?.length > 0 && `Chirurgies: ${patient.medicalHistory.surgeries.join(', ')}`,
                    patient.medicalHistory.familyHistory?.length > 0 && `Fam: ${patient.medicalHistory.familyHistory.join(', ')}`
                  ].filter(Boolean).join(' | ') || 'ras'
                : patient.medicalHistory}
            </span>
          </div>
        )}
        {patient?.currentDiagnosis && (
          <div className="text-sm">
            <span className="font-semibold text-gray-700">- Diag: </span>
            <span className="text-gray-600">{patient.currentDiagnosis}</span>
          </div>
        )}
        {patient?.currentTreatment && (
          <div className="text-sm">
            <span className="font-semibold text-gray-700">- TT: </span>
            <span className="text-gray-600">{patient.currentTreatment}</span>
          </div>
        )}
        {patient?.allergies?.length > 0 ? (
          <div className="text-sm">
            <span className="font-semibold text-gray-700">- Allergies: </span>
            <span className="text-red-600 font-medium">
              {patient.allergies.map(a => typeof a === 'object' ? a.name || a.allergen : a).join(', ')}
            </span>
          </div>
        ) : (
          <div className="text-sm">
            <span className="font-semibold text-gray-700">- Allergies: </span>
            <span className="text-gray-600">ras</span>
          </div>
        )}
        {patient?.referringDoctor && (
          <div className="text-sm flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-blue-500" />
            <span className="font-semibold text-gray-700">Médecin Référent:</span>
            <span className="text-blue-600 font-medium">
              {patient.referringDoctor.startsWith('Dr') ? patient.referringDoctor : `Dr ${patient.referringDoctor}`}
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      {patient?.notes && (
        <div className="border-t border-gray-200 pt-3">
          <div className="text-sm font-semibold text-gray-700 mb-1">Remarques:</div>
          <p className="text-sm text-gray-600 italic">{patient.notes}</p>
        </div>
      )}

      {/* Critical Alerts Banner */}
      {(patient?.alerts?.length > 0 || patient?.allergies?.length > 0 || patient?.importantNotes) && (
        <div className="border-t border-gray-200 pt-3">
          <CriticalAlertBanner
            alerts={patient.alerts || []}
            allergies={patient.allergies || []}
            importantNotes={patient.importantNotes}
            canEdit={false}
            showAllCategories={true}
          />
        </div>
      )}
    </div>
  );
}

// Quick action buttons for history panel
function HistoryActionButtons({ onSchemaClick, onViewClick }) {
  return (
    <div className="border-t border-gray-300 bg-gray-50 px-2 py-2 flex flex-wrap gap-1">
      <button
        onClick={onSchemaClick}
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
      >
        <Image className="h-3 w-3" />
        Schéma
      </button>
      <button className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
        <Volume2 className="h-3 w-3" />
        Lettre/Son
      </button>
      <button
        onClick={onViewClick}
        className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1"
      >
        <Eye className="h-3 w-3" />
        Visualiser
      </button>
      <button className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Numérisation
      </button>
    </div>
  );
}

// Format refraction display
function formatRefraction(refraction, eye) {
  if (!refraction?.subjective?.[eye]) return null;
  const r = refraction.subjective[eye];
  const sph = r.sphere || 0;
  const cyl = r.cylinder || 0;
  const axis = r.axis || 0;
  const av = refraction.visualAcuity?.[eye]?.distance || '-';
  const add = r.addition || 0;
  const parinaud = refraction.visualAcuity?.[eye]?.near || '-';

  return `${eye.toUpperCase()}= ${sph >= 0 ? '+' : ''}${sph.toFixed(2)} (${cyl >= 0 ? '+' : ''}${cyl.toFixed(2)} à ${axis}°)= ${av}; Add ${add.toFixed(2)} =P ${parinaud}`;
}

export default function ResumeTab({
  patient,
  data,
  consultationHistory = [],
  onSelectConsultation,
  onNewConsultation,
  healthcareOptions = { ald: false, cmu: false, dossierPapier: false },
  onHealthcareOptionsChange
}) {
  const today = new Date();

  // Format IOP
  const formatIOP = (iop) => {
    if (!iop) return null;
    return `TOD=${iop.OD || '-'} mm Hg TOG=${iop.OS || '-'} mm Hg`;
  };

  return (
    <div className="p-4 bg-gray-100 min-h-full">
      {/* Main Grid: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* LEFT COLUMN: Patient Demographics */}
        <div className="lg:col-span-1">
          <PatientDemographicsPanel patient={patient} />
        </div>

        {/* CENTER COLUMN: Color-coded summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* Date Header */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-700">
              {format(today, "EEEE d MMMM yyyy", { locale: fr })}
            </h3>
          </div>

          {/* Réfraction Section (PINK) */}
          <SummarySection title="Réfraction" color="pink">
            <p><strong>Réfraction subjective :</strong></p>
            {data?.refraction ? (
              <>
                <p>{formatRefraction(data.refraction, 'OD') || 'OD= Non mesuré'}</p>
                <p>{formatRefraction(data.refraction, 'OS') || 'OG= Non mesuré'}</p>
              </>
            ) : (
              <p className="text-pink-600 italic">Non effectuée</p>
            )}
          </SummarySection>

          {/* Tonométrie Section (GREEN) */}
          <SummarySection title="Tonométrie" color="green">
            {data?.examination?.iop ? (
              <p>{formatIOP(data.examination.iop)}</p>
            ) : (
              <p className="text-green-600 italic">Non mesurée</p>
            )}
          </SummarySection>

          {/* Pathologies Section (YELLOW) */}
          <SummarySection title="Pathologies" color="yellow">
            {data?.diagnostic?.diagnoses?.length > 0 ? (
              <>
                {data.diagnostic.diagnoses.map((diag, idx) => (
                  <p key={idx}>
                    {diag.name || diag.label}
                    {diag.laterality && ` (${diag.laterality})`}
                  </p>
                ))}
                {data?.examination?.slitLamp && (
                  <p className="mt-2">
                    <strong>LAF:</strong> Segment antérieur = {
                      Object.values(data.examination.slitLamp).every(v => v === 'normal')
                        ? 'Normal O.D.G.'
                        : 'Voir détails'
                    }
                  </p>
                )}
                {data?.examination?.fundus && (
                  <p>
                    <strong>FOGD:</strong> = {
                      data.examination.fundus.OD?.findings === 'normal' &&
                      data.examination.fundus.OS?.findings === 'normal'
                        ? 'Normal O.D.G.'
                        : 'Voir détails'
                    }
                  </p>
                )}
              </>
            ) : (
              <p className="text-yellow-600 italic">Aucune pathologie enregistrée</p>
            )}
          </SummarySection>

          {/* Traitement Section (BLUE) */}
          <SummarySection title="Traitement" color="blue">
            {data?.prescription?.medications?.length > 0 ? (
              data.prescription.medications.map((med, idx) => (
                <p key={idx}>- {med.name || med.drug}: {med.posology || med.instructions}</p>
              ))
            ) : data?.prescription?.ordonnances?.[0]?.items?.length > 0 ? (
              data.prescription.ordonnances[0].items.map((item, idx) => (
                <p key={idx}>- {item}</p>
              ))
            ) : (
              <p className="text-blue-600 italic">Aucun traitement prescrit</p>
            )}
          </SummarySection>

          {/* Healthcare Options (ALD/CMU) */}
          <div className="flex items-center gap-4 justify-center text-sm">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={healthcareOptions.ald}
                onChange={(e) => onHealthcareOptionsChange?.({ ...healthcareOptions, ald: e.target.checked })}
                className="rounded"
              />
              ALD
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={healthcareOptions.cmu}
                onChange={(e) => onHealthcareOptionsChange?.({ ...healthcareOptions, cmu: e.target.checked })}
                className="rounded"
              />
              CMU
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={healthcareOptions.dossierPapier}
                onChange={(e) => onHealthcareOptionsChange?.({ ...healthcareOptions, dossierPapier: e.target.checked })}
                className="rounded"
              />
              Dossier Papier
            </label>
          </div>
        </div>

        {/* RIGHT COLUMN: Consultation History */}
        <div className="lg:col-span-1 space-y-4">
          {/* New Consultation Button */}
          <button
            onClick={onNewConsultation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md"
          >
            <Plus className="h-5 w-5" />
            Nouvelle consultation
          </button>

          {/* Rich Visit History Table */}
          <div className="space-y-0">
            <VisitHistoryTable
              visits={consultationHistory}
              onSelectVisit={onSelectConsultation}
              onViewImages={(visit) => console.log('View images for:', visit._id)}
              onViewDocuments={(visit) => console.log('View documents for:', visit._id)}
              maxRows={10}
            />
            <HistoryActionButtons
              onSchemaClick={() => console.log('Open schema tool')}
              onViewClick={() => console.log('View selected consultation')}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-6 flex flex-wrap gap-2 justify-center border-t border-gray-300 pt-4">
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <User className="h-4 w-4" />
          Nouveau patient
        </button>
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <Printer className="h-4 w-4" />
          Imprimer consultation
        </button>
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <Printer className="h-4 w-4" />
          Imprimer fiche
        </button>
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <History className="h-4 w-4" />
          Résumé autre patient
        </button>
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Agenda Jour
        </button>
        <button className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Agenda
        </button>
      </div>
    </div>
  );
}
