import { Barcode } from 'lucide-react';
import CollapsibleSection from '../../../components/CollapsibleSection';
import SpecimenTracking from '../../../components/laboratory/SpecimenTracking';

/**
 * LabSpecimensSection - Specimen tracking wrapper
 */
export default function LabSpecimensSection({ patients }) {
  return (
    <CollapsibleSection
      title="Suivi des Échantillons"
      icon={Barcode}
      iconColor="text-indigo-600"
      gradient="from-indigo-50 to-violet-50"
      defaultExpanded={false}
      badge={
        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
          Traçabilité
        </span>
      }
    >
      <SpecimenTracking patients={patients} />
    </CollapsibleSection>
  );
}
