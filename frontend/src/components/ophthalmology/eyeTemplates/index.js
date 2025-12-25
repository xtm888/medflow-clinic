export { default as AnteriorSegment } from './AnteriorSegment';
export { default as Fundus } from './Fundus';
export { default as ExternalEye } from './ExternalEye';
export { default as CrossSection } from './CrossSection';

export const templates = [
  { id: 'anterior', name: 'Segment Antérieur', component: 'AnteriorSegment' },
  { id: 'fundus', name: 'Fond d\'Oeil', component: 'Fundus' },
  { id: 'external', name: 'Oeil Externe', component: 'ExternalEye' },
  { id: 'crossSection', name: 'Coupe Transversale', component: 'CrossSection' },
];
