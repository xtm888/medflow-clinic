import { User, Heart, Activity, Phone, Mail, MapPin, Droplets, AlertTriangle, FolderSync, Hash, Building2, BadgeCheck, Users } from 'lucide-react';
import CollapsibleSection from '../../../components/CollapsibleSection';

/**
 * PatientInfoSection - Personal, Medical, and Activity info in 3-column layout
 */
export default function PatientInfoSection({ patient, formatDate, calculateAge }) {
  if (!patient) return null;

  return (
    <CollapsibleSection
      title="Informations Patient"
      icon={User}
      iconColor="text-blue-600"
      gradient="from-blue-50 to-indigo-50"
      defaultExpanded={true}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-2 border-b border-gray-100">
            <User className="h-4 w-4 text-blue-500" />
            Personnel
          </h4>
          <dl className="space-y-2">
            <InfoItem label="Date de naissance" value={formatDate(patient.dateOfBirth)} />
            <InfoItem
              label="Téléphone"
              value={patient.phoneNumber || 'Non renseigné'}
              icon={Phone}
              isLink={patient.phoneNumber ? `tel:${patient.phoneNumber}` : null}
            />
            <InfoItem
              label="Email"
              value={patient.email || 'Non renseigné'}
              icon={Mail}
              isLink={patient.email ? `mailto:${patient.email}` : null}
            />
            <InfoItem
              label="Adresse"
              value={formatAddress(patient.address)}
              icon={MapPin}
            />
            {patient.emergencyContact && (
              <InfoItem
                label="Contact d'urgence"
                value={formatEmergencyContact(patient.emergencyContact)}
              />
            )}
          </dl>
        </div>

        {/* Medical Information */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-2 border-b border-gray-100">
            <Heart className="h-4 w-4 text-red-500" />
            Médical
          </h4>
          <dl className="space-y-2">
            <InfoItem
              label="Groupe sanguin"
              value={patient.bloodType || 'Non renseigné'}
              icon={Droplets}
              highlight={patient.bloodType}
            />
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Allergies</dt>
              <dd className="mt-1">
                {patient.allergies?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(patient.allergies) ? patient.allergies : [patient.allergies]).map((allergy, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-gray-600">Aucune allergie connue</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Antécédents</dt>
              <dd className="text-sm text-gray-900 mt-1">
                {patient.medicalHistory?.length > 0
                  ? (Array.isArray(patient.medicalHistory) ? patient.medicalHistory.join(', ') : patient.medicalHistory)
                  : 'Aucun antécédent'}
              </dd>
            </div>
            {patient.currentMedications?.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Traitements en cours</dt>
                <dd className="text-sm text-gray-900 mt-1">
                  {Array.isArray(patient.currentMedications)
                    ? patient.currentMedications.join(', ')
                    : patient.currentMedications}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Activity Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-2 border-b border-gray-100">
            <Activity className="h-4 w-4 text-green-500" />
            Activité
          </h4>
          <dl className="space-y-2">
            <InfoItem
              label="Dernière visite"
              value={patient.lastVisit ? formatDate(patient.lastVisit) : 'Aucune visite'}
            />
            <InfoItem
              label="Prochain RDV"
              value={patient.nextAppointment ? formatDate(patient.nextAppointment) : 'Aucun RDV'}
            />
            <InfoItem
              label="Date d'inscription"
              value={formatDate(patient.createdAt)}
            />
            {/* Convention / Entreprise - Most prominent */}
            {patient.convention?.company && (
              <div className="mt-3 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <dt className="text-xs font-semibold text-green-800 uppercase flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Convention
                </dt>
                <dd className="text-sm font-bold text-green-900 mt-1">
                  {patient.convention.company?.name || patient.convention.companyName || 'Entreprise'}
                </dd>
                {patient.convention.employeeId && (
                  <dd className="text-xs text-green-700 flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="h-3 w-3" />
                    Matricule: {patient.convention.employeeId}
                  </dd>
                )}
                {patient.convention.beneficiaryType && (
                  <dd className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" />
                    {patient.convention.beneficiaryType === 'employee' ? 'Employé(e)' :
                     patient.convention.beneficiaryType === 'spouse' ? 'Conjoint(e)' :
                     patient.convention.beneficiaryType === 'child' ? 'Enfant' : 'Personne à charge'}
                  </dd>
                )}
                {patient.convention.jobTitle && (
                  <dd className="text-xs text-green-600 mt-0.5">
                    {patient.convention.jobTitle}
                    {patient.convention.department && ` - ${patient.convention.department}`}
                  </dd>
                )}
                {patient.convention.status && (
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      patient.convention.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {patient.convention.status === 'active' ? 'Active' : patient.convention.status}
                    </span>
                  </dd>
                )}
                {patient.convention.company?.defaultCoverage?.percentage && (
                  <dd className="text-xs text-green-700 mt-1 font-medium">
                    Couverture: {patient.convention.company.defaultCoverage.percentage}%
                  </dd>
                )}
              </div>
            )}

            {/* Insurance - Secondary */}
            {patient.insurance && patient.insurance.provider && (
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <dt className="text-xs font-medium text-blue-700 uppercase">Assurance</dt>
                <dd className="text-sm font-medium text-blue-900 mt-0.5">
                  {patient.insurance.provider}
                </dd>
                {patient.insurance.policyNumber && (
                  <dd className="text-xs text-blue-600">
                    N° {patient.insurance.policyNumber}
                  </dd>
                )}
              </div>
            )}
            {/* Legacy System Integration Info */}
            {(patient.legacyId || patient.legacyPatientNumber || patient.folderIds?.length > 0) && (
              <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <dt className="text-xs font-medium text-amber-700 uppercase flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Données Legacy
                </dt>
                {patient.legacyId && (
                  <dd className="text-sm text-amber-900 mt-1">
                    <span className="text-xs text-amber-600">ID Legacy:</span> {patient.legacyId}
                  </dd>
                )}
                {patient.legacyPatientNumber && (
                  <dd className="text-sm text-amber-900 mt-0.5">
                    <span className="text-xs text-amber-600">N° Patient:</span> {patient.legacyPatientNumber}
                  </dd>
                )}
                {patient.folderIds?.length > 0 && (
                  <div className="mt-2">
                    <dt className="text-xs text-amber-600 flex items-center gap-1">
                      <FolderSync className="h-3 w-3" />
                      Dossiers liés ({patient.folderIds.length})
                    </dt>
                    <dd className="flex flex-wrap gap-1 mt-1">
                      {patient.folderIds.map((folder, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full"
                          title={folder.path || folder.folderId}
                        >
                          {folder.deviceType || 'device'}: {folder.folderId}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </div>
            )}
          </dl>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// Helper component for info items
function InfoItem({ label, value, icon: Icon, isLink, highlight }) {
  const content = (
    <dd className={`text-sm ${highlight ? 'font-semibold text-blue-600' : 'text-gray-900'} flex items-center gap-1`}>
      {Icon && <Icon className="h-3 w-3 text-gray-400" />}
      {value}
    </dd>
  );

  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt>
      {isLink ? (
        <a href={isLink} className="hover:text-blue-600 transition">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

// Helper functions
function formatAddress(address) {
  if (!address) return 'Non renseignée';
  if (typeof address === 'string') return address;
  return [address.street, address.city, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ') || 'Non renseignée';
}

function formatEmergencyContact(contact) {
  if (!contact) return null;
  if (typeof contact === 'string') return contact;
  return [contact.name, contact.relationship, contact.phone]
    .filter(Boolean)
    .join(' - ');
}
