const mongoose = require('mongoose');

/**
 * UnitConversion Model
 * Handles conversion between SI and conventional units for laboratory tests
 * Based on standard conversion factors
 */

const unitConversionSchema = new mongoose.Schema({
  // Test identification
  testCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  analyte: {
    type: String,
    trim: true // e.g., "Glucose", "Creatinine", "Cholesterol"
  },

  // Primary unit (what the lab reports)
  primaryUnit: {
    type: String,
    required: true,
    trim: true
  },
  primaryUnitType: {
    type: String,
    enum: ['SI', 'conventional'],
    required: true
  },

  // Alternative units with conversion factors
  conversions: [{
    unit: {
      type: String,
      required: true,
      trim: true
    },
    unitType: {
      type: String,
      enum: ['SI', 'conventional'],
      required: true
    },
    // Conversion factor: primaryUnit × factor = alternativeUnit
    factor: {
      type: Number,
      required: true
    },
    // Reverse factor: alternativeUnit × reverseFactor = primaryUnit
    reverseFactor: {
      type: Number,
      required: true
    },
    // Decimal places for display
    decimalPlaces: {
      type: Number,
      default: 2
    }
  }],

  // Molecular weight (for molar conversions)
  molecularWeight: Number,

  // Category for grouping
  category: {
    type: String,
    enum: [
      'chemistry',
      'hematology',
      'coagulation',
      'urinalysis',
      'hormones',
      'lipids',
      'electrolytes',
      'enzymes',
      'proteins',
      'vitamins',
      'drugs',
      'tumor-markers',
      'other'
    ],
    index: true
  },

  // Notes
  notes: String,
  source: String, // Reference for conversion factors

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Soft delete support
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
unitConversionSchema.index({ testCode: 1 }, { unique: true });
unitConversionSchema.index({ analyte: 1 });
unitConversionSchema.index({ category: 1, isActive: 1 });

// Method to convert value
unitConversionSchema.methods.convert = function(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) {
    return { value, unit: toUnit };
  }

  // If converting from primary to alternative
  if (fromUnit === this.primaryUnit) {
    const conversion = this.conversions.find(c => c.unit === toUnit);
    if (conversion) {
      const convertedValue = value * conversion.factor;
      return {
        value: Number(convertedValue.toFixed(conversion.decimalPlaces)),
        unit: toUnit
      };
    }
  }

  // If converting from alternative to primary
  if (toUnit === this.primaryUnit) {
    const conversion = this.conversions.find(c => c.unit === fromUnit);
    if (conversion) {
      const convertedValue = value * conversion.reverseFactor;
      return {
        value: Number(convertedValue.toFixed(2)),
        unit: toUnit
      };
    }
  }

  // If converting between two alternatives, go through primary
  const fromConversion = this.conversions.find(c => c.unit === fromUnit);
  const toConversion = this.conversions.find(c => c.unit === toUnit);

  if (fromConversion && toConversion) {
    // First convert to primary
    const primaryValue = value * fromConversion.reverseFactor;
    // Then convert to target
    const convertedValue = primaryValue * toConversion.factor;
    return {
      value: Number(convertedValue.toFixed(toConversion.decimalPlaces)),
      unit: toUnit
    };
  }

  throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
};

// Method to get all available units
unitConversionSchema.methods.getAvailableUnits = function() {
  const units = [{ unit: this.primaryUnit, type: this.primaryUnitType }];
  this.conversions.forEach(c => {
    units.push({ unit: c.unit, type: c.unitType });
  });
  return units;
};

// Method to convert reference range
unitConversionSchema.methods.convertReferenceRange = function(range, fromUnit, toUnit) {
  if (fromUnit === toUnit) return range;

  const result = { ...range, unit: toUnit };

  if (range.min !== undefined) {
    result.min = this.convert(range.min, fromUnit, toUnit).value;
  }
  if (range.max !== undefined) {
    result.max = this.convert(range.max, fromUnit, toUnit).value;
  }
  if (range.criticalLow !== undefined) {
    result.criticalLow = this.convert(range.criticalLow, fromUnit, toUnit).value;
  }
  if (range.criticalHigh !== undefined) {
    result.criticalHigh = this.convert(range.criticalHigh, fromUnit, toUnit).value;
  }

  // Update text representation
  result.text = `${result.min} - ${result.max} ${toUnit}`;

  return result;
};

// Static to find conversion for a test
unitConversionSchema.statics.findForTest = function(testCode) {
  return this.findOne({ testCode: testCode.toUpperCase(), isActive: true });
};

// Static to convert a value
unitConversionSchema.statics.convertValue = async function(testCode, value, fromUnit, toUnit) {
  const conversion = await this.findForTest(testCode);
  if (!conversion) {
    throw new Error(`No conversion found for test ${testCode}`);
  }
  return conversion.convert(value, fromUnit, toUnit);
};

// Static to seed common conversions
unitConversionSchema.statics.seedCommonConversions = async function() {
  const commonConversions = [
    // Chemistry - Glucose
    {
      testCode: 'GLU',
      testName: 'Glucose',
      analyte: 'Glucose',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.0555,
        reverseFactor: 18.018,
        decimalPlaces: 1
      }],
      molecularWeight: 180.16,
      category: 'chemistry'
    },
    // Chemistry - Creatinine
    {
      testCode: 'CREA',
      testName: 'Créatinine',
      analyte: 'Creatinine',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µmol/L',
        unitType: 'SI',
        factor: 88.4,
        reverseFactor: 0.0113,
        decimalPlaces: 0
      }],
      molecularWeight: 113.12,
      category: 'chemistry'
    },
    // Lipids - Cholesterol
    {
      testCode: 'CHOL',
      testName: 'Cholestérol Total',
      analyte: 'Cholesterol',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.0259,
        reverseFactor: 38.67,
        decimalPlaces: 2
      }],
      molecularWeight: 386.65,
      category: 'lipids'
    },
    // Lipids - Triglycerides
    {
      testCode: 'TG',
      testName: 'Triglycérides',
      analyte: 'Triglycerides',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.0113,
        reverseFactor: 88.57,
        decimalPlaces: 2
      }],
      category: 'lipids'
    },
    // Lipids - HDL
    {
      testCode: 'HDL',
      testName: 'HDL Cholestérol',
      analyte: 'HDL Cholesterol',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.0259,
        reverseFactor: 38.67,
        decimalPlaces: 2
      }],
      category: 'lipids'
    },
    // Lipids - LDL
    {
      testCode: 'LDL',
      testName: 'LDL Cholestérol',
      analyte: 'LDL Cholesterol',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.0259,
        reverseFactor: 38.67,
        decimalPlaces: 2
      }],
      category: 'lipids'
    },
    // Chemistry - Urea/BUN
    {
      testCode: 'UREA',
      testName: 'Urée',
      analyte: 'Urea',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.357,
        reverseFactor: 2.801,
        decimalPlaces: 1
      }],
      molecularWeight: 60.06,
      category: 'chemistry'
    },
    // Chemistry - Uric Acid
    {
      testCode: 'UA',
      testName: 'Acide Urique',
      analyte: 'Uric Acid',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µmol/L',
        unitType: 'SI',
        factor: 59.48,
        reverseFactor: 0.0168,
        decimalPlaces: 0
      }],
      molecularWeight: 168.11,
      category: 'chemistry'
    },
    // Electrolytes - Sodium
    {
      testCode: 'NA',
      testName: 'Sodium',
      analyte: 'Sodium',
      primaryUnit: 'mEq/L',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 1,
        reverseFactor: 1,
        decimalPlaces: 0
      }],
      category: 'electrolytes'
    },
    // Electrolytes - Potassium
    {
      testCode: 'K',
      testName: 'Potassium',
      analyte: 'Potassium',
      primaryUnit: 'mEq/L',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 1,
        reverseFactor: 1,
        decimalPlaces: 1
      }],
      category: 'electrolytes'
    },
    // Electrolytes - Calcium
    {
      testCode: 'CA',
      testName: 'Calcium',
      analyte: 'Calcium',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.25,
        reverseFactor: 4.0,
        decimalPlaces: 2
      }],
      molecularWeight: 40.08,
      category: 'electrolytes'
    },
    // Hematology - Hemoglobin
    {
      testCode: 'HB',
      testName: 'Hémoglobine',
      analyte: 'Hemoglobin',
      primaryUnit: 'g/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'g/L',
        unitType: 'SI',
        factor: 10,
        reverseFactor: 0.1,
        decimalPlaces: 0
      }, {
        unit: 'mmol/L',
        unitType: 'SI',
        factor: 0.6206,
        reverseFactor: 1.611,
        decimalPlaces: 1
      }],
      category: 'hematology'
    },
    // Proteins - Albumin
    {
      testCode: 'ALB',
      testName: 'Albumine',
      analyte: 'Albumin',
      primaryUnit: 'g/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'g/L',
        unitType: 'SI',
        factor: 10,
        reverseFactor: 0.1,
        decimalPlaces: 0
      }],
      category: 'proteins'
    },
    // Proteins - Total Protein
    {
      testCode: 'TP',
      testName: 'Protéines Totales',
      analyte: 'Total Protein',
      primaryUnit: 'g/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'g/L',
        unitType: 'SI',
        factor: 10,
        reverseFactor: 0.1,
        decimalPlaces: 0
      }],
      category: 'proteins'
    },
    // Liver - Bilirubin
    {
      testCode: 'TBIL',
      testName: 'Bilirubine Totale',
      analyte: 'Bilirubin',
      primaryUnit: 'mg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µmol/L',
        unitType: 'SI',
        factor: 17.1,
        reverseFactor: 0.0585,
        decimalPlaces: 0
      }],
      molecularWeight: 584.66,
      category: 'chemistry'
    },
    // HbA1c
    {
      testCode: 'HBA1C',
      testName: 'Hémoglobine Glyquée',
      analyte: 'Glycated Hemoglobin',
      primaryUnit: '%',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mmol/mol',
        unitType: 'SI',
        factor: 10.93,
        reverseFactor: 0.0915,
        decimalPlaces: 0
      }],
      category: 'chemistry',
      notes: 'IFCC formula: mmol/mol = (HbA1c% - 2.15) × 10.929'
    },
    // Thyroid - TSH
    {
      testCode: 'TSH',
      testName: 'TSH',
      analyte: 'Thyroid Stimulating Hormone',
      primaryUnit: 'µIU/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'mIU/L',
        unitType: 'SI',
        factor: 1,
        reverseFactor: 1,
        decimalPlaces: 2
      }],
      category: 'hormones'
    },
    // Thyroid - T4 Free
    {
      testCode: 'FT4',
      testName: 'T4 Libre',
      analyte: 'Free T4',
      primaryUnit: 'ng/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'pmol/L',
        unitType: 'SI',
        factor: 12.87,
        reverseFactor: 0.0777,
        decimalPlaces: 1
      }],
      category: 'hormones'
    },
    // Coagulation - INR (no conversion needed)
    {
      testCode: 'INR',
      testName: 'INR',
      analyte: 'International Normalized Ratio',
      primaryUnit: 'ratio',
      primaryUnitType: 'conventional',
      conversions: [],
      category: 'coagulation'
    },
    // CRP
    {
      testCode: 'CRP',
      testName: 'Protéine C-Réactive',
      analyte: 'C-Reactive Protein',
      primaryUnit: 'mg/L',
      primaryUnitType: 'SI',
      conversions: [{
        unit: 'mg/dL',
        unitType: 'conventional',
        factor: 0.1,
        reverseFactor: 10,
        decimalPlaces: 1
      }],
      category: 'proteins'
    },
    // Ferritin
    {
      testCode: 'FER',
      testName: 'Ferritine',
      analyte: 'Ferritin',
      primaryUnit: 'ng/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µg/L',
        unitType: 'SI',
        factor: 1,
        reverseFactor: 1,
        decimalPlaces: 0
      }, {
        unit: 'pmol/L',
        unitType: 'SI',
        factor: 2.247,
        reverseFactor: 0.445,
        decimalPlaces: 0
      }],
      category: 'chemistry'
    },
    // Iron
    {
      testCode: 'FE',
      testName: 'Fer Sérique',
      analyte: 'Iron',
      primaryUnit: 'µg/dL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µmol/L',
        unitType: 'SI',
        factor: 0.179,
        reverseFactor: 5.587,
        decimalPlaces: 1
      }],
      molecularWeight: 55.85,
      category: 'chemistry'
    },
    // Vitamin D
    {
      testCode: 'VITD',
      testName: 'Vitamine D (25-OH)',
      analyte: 'Vitamin D',
      primaryUnit: 'ng/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'nmol/L',
        unitType: 'SI',
        factor: 2.496,
        reverseFactor: 0.401,
        decimalPlaces: 0
      }],
      molecularWeight: 400.64,
      category: 'vitamins'
    },
    // Vitamin B12
    {
      testCode: 'B12',
      testName: 'Vitamine B12',
      analyte: 'Vitamin B12',
      primaryUnit: 'pg/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'pmol/L',
        unitType: 'SI',
        factor: 0.738,
        reverseFactor: 1.355,
        decimalPlaces: 0
      }],
      molecularWeight: 1355.37,
      category: 'vitamins'
    },
    // Folate
    {
      testCode: 'FOL',
      testName: 'Acide Folique',
      analyte: 'Folate',
      primaryUnit: 'ng/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'nmol/L',
        unitType: 'SI',
        factor: 2.266,
        reverseFactor: 0.441,
        decimalPlaces: 1
      }],
      molecularWeight: 441.40,
      category: 'vitamins'
    },
    // PSA
    {
      testCode: 'PSA',
      testName: 'PSA',
      analyte: 'Prostate Specific Antigen',
      primaryUnit: 'ng/mL',
      primaryUnitType: 'conventional',
      conversions: [{
        unit: 'µg/L',
        unitType: 'SI',
        factor: 1,
        reverseFactor: 1,
        decimalPlaces: 2
      }],
      category: 'tumor-markers'
    }
  ];

  for (const conv of commonConversions) {
    await this.findOneAndUpdate(
      { testCode: conv.testCode },
      conv,
      { upsert: true, new: true }
    );
  }

  return commonConversions.length;
};

module.exports = mongoose.model('UnitConversion', unitConversionSchema);
