const mongoose = require('mongoose');
const CommentTemplate = require('../models/CommentTemplate');
require('dotenv').config();

const commentTemplates = [
  // Refraction Comments
  {
    category: 'refraction',
    title: 'Myopie légère',
    text: 'Myopie légère bilatérale. Correction optique recommandée pour la vision de loin, notamment pour la conduite et les activités nécessitant une vision nette à distance.',
    sortOrder: 1
  },
  {
    category: 'refraction',
    title: 'Myopie moyenne',
    text: 'Myopie moyenne bilatérale. Port de correction optique permanent recommandé pour améliorer le confort visuel au quotidien.',
    sortOrder: 2
  },
  {
    category: 'refraction',
    title: 'Myopie forte',
    text: 'Myopie forte bilatérale. Correction optique indispensable en permanence. Surveillance ophtalmologique régulière recommandée (fond d\'œil annuel).',
    sortOrder: 3
  },
  {
    category: 'refraction',
    title: 'Hypermétropie',
    text: 'Hypermétropie bilatérale. Correction optique recommandée pour réduire la fatigue visuelle, les maux de tête et améliorer le confort en vision de près.',
    sortOrder: 4
  },
  {
    category: 'refraction',
    title: 'Astigmatisme',
    text: 'Astigmatisme bilatéral. Correction optique recommandée pour améliorer la netteté visuelle et réduire les distorsions.',
    sortOrder: 5
  },
  {
    category: 'refraction',
    title: 'Presbytie débutante',
    text: 'Presbytie débutante. Addition de près recommandée pour la lecture et les travaux de près. Port progressif ou mi-distance selon les besoins.',
    sortOrder: 6
  },
  {
    category: 'refraction',
    title: 'Presbytie confirmée',
    text: 'Presbytie confirmée. Verres progressifs recommandés pour un confort visuel optimal à toutes distances.',
    sortOrder: 7
  },
  {
    category: 'refraction',
    title: 'Anisométropie',
    text: 'Anisométropie significative. Adaptation progressive recommandée. En cas de difficulté d\'adaptation aux lunettes, envisager les lentilles de contact.',
    sortOrder: 8
  },

  // Adaptation Comments
  {
    category: 'adaptation',
    title: 'Première correction',
    text: 'Première correction optique. Adaptation progressive recommandée : commencer par un port de quelques heures par jour puis augmenter progressivement.',
    sortOrder: 1
  },
  {
    category: 'adaptation',
    title: 'Changement important',
    text: 'Modification importante de la correction. Période d\'adaptation de quelques jours à quelques semaines attendue. Consulter en cas de gêne persistante.',
    sortOrder: 2
  },
  {
    category: 'adaptation',
    title: 'Premiers progressifs',
    text: 'Première prescription de verres progressifs. Période d\'adaptation normale de 2 à 3 semaines. Bien orienter le regard, pas la tête. Éviter de regarder vers le bas en marchant.',
    sortOrder: 3
  },
  {
    category: 'adaptation',
    title: 'Adaptation facile',
    text: 'Correction stable, adaptation immédiate attendue. Port permanent recommandé pour un confort visuel optimal.',
    sortOrder: 4
  },

  // Lens Type Comments
  {
    category: 'lens_type',
    title: 'Progressifs recommandés',
    text: 'Verres progressifs recommandés pour une vision nette à toutes distances sans avoir à changer de lunettes. Adaptation progressive sur 2-3 semaines.',
    sortOrder: 1
  },
  {
    category: 'lens_type',
    title: 'Deux paires',
    text: 'Deux paires de lunettes recommandées : une pour la vision de loin (conduite, télévision) et une pour la vision de près (lecture, ordinateur).',
    sortOrder: 2
  },
  {
    category: 'lens_type',
    title: 'Mi-distance',
    text: 'Verres mi-distance recommandés spécifiquement pour le travail sur ordinateur et la vision intermédiaire.',
    sortOrder: 3
  },
  {
    category: 'lens_type',
    title: 'Lentilles recommandées',
    text: 'Lentilles de contact recommandées comme alternative ou complément aux lunettes, notamment pour les activités sportives.',
    sortOrder: 4
  },
  {
    category: 'lens_type',
    title: 'Verres amincis',
    text: 'Verres amincis (haut indice) recommandés pour réduire l\'épaisseur et le poids des lunettes.',
    sortOrder: 5
  },
  {
    category: 'lens_type',
    title: 'Traitement anti-reflet',
    text: 'Traitement anti-reflet recommandé pour améliorer la transmission lumineuse et réduire la fatigue visuelle, notamment pour la conduite de nuit et le travail sur écran.',
    sortOrder: 6
  },
  {
    category: 'lens_type',
    title: 'Verres photochromiques',
    text: 'Verres photochromiques (teintés selon la luminosité) recommandés pour un confort optimal en intérieur et extérieur.',
    sortOrder: 7
  },

  // Keratometry Comments
  {
    category: 'keratometry',
    title: 'Cornée régulière',
    text: 'Kératométrie dans les normes. Cornée régulière sans astigmatisme cornéen significatif.',
    sortOrder: 1
  },
  {
    category: 'keratometry',
    title: 'Astigmatisme cornéen',
    text: 'Astigmatisme cornéen objectivé en kératométrie. Correction torique recommandée.',
    sortOrder: 2
  },
  {
    category: 'keratometry',
    title: 'Cornée plate',
    text: 'Cornée plate (K moyen < 42D). Adaptation lentilles de contact : courbe de base à ajuster.',
    sortOrder: 3
  },
  {
    category: 'keratometry',
    title: 'Cornée cambrée',
    text: 'Cornée cambrée (K moyen > 45D). Adaptation lentilles de contact : courbe de base à ajuster.',
    sortOrder: 4
  },

  // General Comments
  {
    category: 'general',
    title: 'Contrôle annuel',
    text: 'Contrôle ophtalmologique recommandé dans 12 mois pour surveillance de la réfraction.',
    sortOrder: 1
  },
  {
    category: 'general',
    title: 'Contrôle 6 mois',
    text: 'Contrôle ophtalmologique recommandé dans 6 mois pour réévaluation de la réfraction.',
    sortOrder: 2
  },
  {
    category: 'general',
    title: 'Protection solaire',
    text: 'Protection solaire recommandée : lunettes de soleil avec filtre UV ou verres photochromiques.',
    sortOrder: 3
  },
  {
    category: 'general',
    title: 'Hygiène visuelle écrans',
    text: 'Hygiène visuelle recommandée pour le travail sur écran : règle 20-20-20 (toutes les 20 minutes, regarder à 20 pieds pendant 20 secondes). Filtre lumière bleue possible.',
    sortOrder: 4
  },
  {
    category: 'general',
    title: 'Conduite nocturne',
    text: 'Difficultés en vision nocturne signalées. Traitement anti-reflet recommandé. Prudence lors de la conduite de nuit.',
    sortOrder: 5
  }
];

async function seedCommentTemplates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing templates
    await CommentTemplate.deleteMany({});
    console.log('🗑️  Cleared existing comment templates');

    // Insert new templates
    const inserted = await CommentTemplate.insertMany(commentTemplates);
    console.log(`✅ Inserted ${inserted.length} comment templates`);

    // Display summary by category
    const categories = await CommentTemplate.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Templates by category:');
    categories.forEach(cat => {
      console.log(`   ${cat._id}: ${cat.count} templates`);
    });

    console.log('\n✅ Comment templates seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding comment templates:', error);
    process.exit(1);
  }
}

seedCommentTemplates();
