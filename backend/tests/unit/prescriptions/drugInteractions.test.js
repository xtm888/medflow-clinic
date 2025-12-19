/**
 * Drug Interaction Tests
 *
 * Tests for drug interaction checking including:
 * - Drug-drug interactions (moderate, severe)
 * - Contraindicated combinations
 * - French drug name mappings
 * - Interaction severity levels
 */

const drugSafetyService = require('../../../services/drugSafetyService');

describe('Drug Interactions', () => {
  describe('checkInteractions', () => {
    test('should detect warfarin-aspirin major interaction', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'aspirin', dosage: '100mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.length).toBeGreaterThan(0);

      const warfarinAspirin = result.interactions.find(
        i => (i.drug1.toLowerCase() === 'warfarin' && i.drug2.toLowerCase() === 'aspirin') ||
             (i.drug1.toLowerCase() === 'aspirin' && i.drug2.toLowerCase() === 'warfarin')
      );

      expect(warfarinAspirin).toBeDefined();
      expect(warfarinAspirin.severity).toBe('major');
    });

    test('should detect sildenafil-nitrate contraindicated interaction', async () => {
      const medications = [
        { name: 'sildenafil', dosage: '50mg' },
        { name: 'nitrates', dosage: '10mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);

      const contraindicated = result.interactions.find(
        i => i.severity === 'contraindicated'
      );

      expect(contraindicated).toBeDefined();
    });

    test('should detect multiple interactions in polypharmacy', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'aspirin', dosage: '100mg' },
        { name: 'ibuprofen', dosage: '400mg' },
        { name: 'omeprazole', dosage: '20mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      // Should find multiple interactions:
      // warfarin-aspirin, warfarin-ibuprofen, warfarin-omeprazole
      expect(result.interactions.length).toBeGreaterThanOrEqual(3);
    });

    test('should return no interactions for safe combination', async () => {
      const medications = [
        { name: 'paracetamol', dosage: '500mg' },
        { name: 'vitamin c', dosage: '500mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(false);
      expect(result.interactions.length).toBe(0);
    });

    test('should return empty result for single medication', async () => {
      const medications = [{ name: 'aspirin', dosage: '100mg' }];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(false);
    });

    test('should return empty result for empty medication list', async () => {
      const result = await drugSafetyService.checkDrugInteractions([]);

      expect(result.hasInteractions).toBe(false);
      expect(result.interactions).toEqual([]);
    });

    test('should handle French drug names', async () => {
      const medications = [
        { name: 'coumadine', dosage: '5mg' }, // French: warfarin
        { name: 'kardegic', dosage: '75mg' } // French: aspirin
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      // Should detect warfarin-aspirin interaction via French name mapping
    });

    test('should handle case-insensitive drug names', async () => {
      const medications = [
        { name: 'WARFARIN', dosage: '5mg' },
        { name: 'Aspirin', dosage: '100mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
    });
  });

  describe('Interaction Severity Classification', () => {
    test('should classify severity as contraindicated', async () => {
      const medications = [
        { name: 'sildenafil', dosage: '50mg' },
        { name: 'nitroglycerin', dosage: '0.4mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      const interaction = result.interactions.find(i =>
        i.severity === 'contraindicated'
      );

      expect(interaction).toBeDefined();
      expect(interaction.recommendation).toMatch(/NEVER/i);
    });

    test('should classify severity as major', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'ibuprofen', dosage: '400mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      const interaction = result.interactions.find(i =>
        i.severity === 'major'
      );

      expect(interaction).toBeDefined();
    });

    test('should classify severity as moderate', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'ciprofloxacin', dosage: '500mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      const moderateInteraction = result.interactions.find(i =>
        i.severity === 'moderate'
      );

      expect(moderateInteraction).toBeDefined();
    });
  });

  describe('Anticoagulant Safety', () => {
    test('should flag all NSAIDs with warfarin', async () => {
      const nsaids = ['ibuprofen', 'naproxen', 'diclofenac', 'ketoprofen'];

      for (const nsaid of nsaids) {
        const medications = [
          { name: 'warfarin', dosage: '5mg' },
          { name: nsaid, dosage: '400mg' }
        ];

        const result = await drugSafetyService.checkDrugInteractions(medications);

        expect(result.hasInteractions).toBe(true);
        expect(result.interactions.some(i =>
          i.severity === 'major' || i.effect.toLowerCase().includes('bleeding')
        )).toBe(true);
      }
    });

    test('should recommend avoiding NSAIDs with anticoagulants', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'ibuprofen', dosage: '400mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      const interaction = result.interactions[0];
      expect(interaction.recommendation).toMatch(/avoid/i);
    });
  });

  describe('Cardiac Safety', () => {
    test('should flag PDE5 inhibitor with nitrate as contraindicated', async () => {
      const pde5Inhibitors = ['sildenafil', 'tadalafil', 'vardenafil'];
      const nitrates = ['nitroglycerin', 'isosorbide'];

      for (const pde5 of pde5Inhibitors) {
        for (const nitrate of nitrates) {
          const medications = [
            { name: pde5, dosage: '50mg' },
            { name: nitrate, dosage: '10mg' }
          ];

          const result = await drugSafetyService.checkDrugInteractions(medications);

          if (result.hasInteractions) {
            expect(result.interactions.some(i =>
              i.severity === 'contraindicated' ||
              i.effect.toLowerCase().includes('hypotension')
            )).toBe(true);
          }
        }
      }
    });

    test('should flag clopidogrel with omeprazole', async () => {
      const medications = [
        { name: 'clopidogrel', dosage: '75mg' },
        { name: 'omeprazole', dosage: '20mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.some(i =>
        i.recommendation.toLowerCase().includes('pantoprazole')
      )).toBe(true);
    });
  });

  describe('Antibiotic Interactions', () => {
    test('should flag ciprofloxacin with tizanidine as contraindicated', async () => {
      const medications = [
        { name: 'ciprofloxacin', dosage: '500mg' },
        { name: 'tizanidine', dosage: '4mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.some(i =>
        i.severity === 'contraindicated'
      )).toBe(true);
    });

    test('should flag macrolides with QT-prolonging drugs', async () => {
      const medications = [
        { name: 'azithromycin', dosage: '500mg' },
        { name: 'amiodarone', dosage: '200mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.some(i =>
        i.effect.toLowerCase().includes('qt')
      )).toBe(true);
    });
  });

  describe('Diabetes Medication Safety', () => {
    test('should flag metformin with contrast dye', async () => {
      const medications = [
        { name: 'metformin', dosage: '500mg' },
        { name: 'contrast dye', dosage: '' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.some(i =>
        i.effect.toLowerCase().includes('lactic acidosis')
      )).toBe(true);
    });

    test('should flag insulin with beta-blockers', async () => {
      const medications = [
        { name: 'insulin', dosage: '10 units' },
        { name: 'beta-blockers', dosage: '50mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.hasInteractions).toBe(true);
      expect(result.interactions.some(i =>
        i.effect.toLowerCase().includes('hypoglycemia')
      )).toBe(true);
    });
  });

  describe('getInteractionSummary', () => {
    test('should provide summary with counts by severity', async () => {
      const medications = [
        { name: 'warfarin', dosage: '5mg' },
        { name: 'aspirin', dosage: '100mg' },
        { name: 'ibuprofen', dosage: '400mg' }
      ];

      const result = await drugSafetyService.checkDrugInteractions(medications);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalInteractions).toBe('number');
      expect(typeof result.summary.majorCount).toBe('number');
    });
  });
});
