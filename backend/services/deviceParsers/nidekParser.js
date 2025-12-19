/**
 * NIDEK Device Parser
 *
 * Parses XML export files from NIDEK devices:
 * - CEM-530 Specular Microscope
 * - Other NIDEK ophthalmology devices
 *
 * File naming convention: {id}_{date}_{time}_NIDEK-{model}_{serial}.xml
 * Example: 012_20250624_121649_NIDEK-CEM530_033B0C.xml
 */

const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('NidekParser');

const parser = new xml2js.Parser({
  explicitArray: false,
  ignoreAttrs: false,
  mergeAttrs: true
});

/**
 * Parse a NIDEK filename to extract metadata
 * @param {string} filename - The filename to parse
 * @returns {object} Parsed metadata
 */
function parseFilename(filename) {
  // Pattern: {examId}_{date}_{time}_NIDEK-{model}_{serial}.xml
  const match = filename.match(/^(\d+)_(\d{8})_(\d{6})_NIDEK-([A-Z0-9]+)_([A-Z0-9]+)\.(xml|jpg|bmp)$/i);

  if (!match) {
    return null;
  }

  const [, examId, dateStr, timeStr, model, serial, extension] = match;

  // Parse date: YYYYMMDD
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  // Parse time: HHMMSS
  const hour = timeStr.substring(0, 2);
  const minute = timeStr.substring(2, 4);
  const second = timeStr.substring(4, 6);

  const examDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

  return {
    examId,
    examDate,
    model,
    serialNumber: serial,
    extension,
    raw: {
      date: dateStr,
      time: timeStr
    }
  };
}

/**
 * Parse a NIDEK CEM-530 specular microscopy XML file
 * @param {string} xmlPath - Path to the XML file
 * @returns {Promise<object>} Parsed exam data
 */
async function parseCEM530(xmlPath) {
  const xmlContent = await fs.readFile(xmlPath, 'utf-8');
  const result = await parser.parseStringPromise(xmlContent);

  const filename = path.basename(xmlPath);
  const fileMeta = parseFilename(filename);

  // Extract data based on NIDEK CEM-530 XML structure
  // Note: Actual structure may vary - adjust based on real files
  const data = result.SpecularMicroscopy || result.CEM530 || result.root || result;

  const exam = {
    device: {
      manufacturer: 'NIDEK',
      model: 'CEM-530',
      serialNumber: fileMeta?.serialNumber || data.DeviceInfo?.SerialNumber
    },
    examInfo: {
      examId: fileMeta?.examId,
      examDate: fileMeta?.examDate || new Date(data.ExamDate || data.DateTime),
      operator: data.Operator || data.ExamInfo?.Operator
    },
    patient: {
      patientId: data.PatientID || data.Patient?.ID,
      lastName: data.PatientName?.LastName || data.Patient?.LastName,
      firstName: data.PatientName?.FirstName || data.Patient?.FirstName,
      dateOfBirth: data.Patient?.DOB
    },
    rightEye: null,
    leftEye: null,
    rawData: data
  };

  // Parse eye data - structure may be OD/OS or Right/Left
  const rightData = data.OD || data.RightEye || data.Eye?.find(e => e.Side === 'OD');
  const leftData = data.OS || data.LeftEye || data.Eye?.find(e => e.Side === 'OS');

  if (rightData) {
    exam.rightEye = parseEyeData(rightData);
  }

  if (leftData) {
    exam.leftEye = parseEyeData(leftData);
  }

  return exam;
}

/**
 * Parse eye-specific data from NIDEK specular microscopy
 */
function parseEyeData(eyeData) {
  return {
    // Endothelial cell analysis
    endothelialCells: {
      cellDensity: parseFloat(eyeData.CD || eyeData.CellDensity || eyeData.Endothelium?.CD) || null,
      cellDensityUnit: 'cells/mm²',
      cv: parseFloat(eyeData.CV || eyeData.CoefficientOfVariation) || null,
      hexagonality: parseFloat(eyeData.HEX || eyeData.Hexagonality || eyeData['6A']) || null,
      averageCellArea: parseFloat(eyeData.AVG || eyeData.AverageCellArea) || null,
      standardDeviation: parseFloat(eyeData.SD || eyeData.StandardDeviation) || null,
      maxCellArea: parseFloat(eyeData.MAX || eyeData.MaxCellArea) || null,
      minCellArea: parseFloat(eyeData.MIN || eyeData.MinCellArea) || null,
      numCellsAnalyzed: parseInt(eyeData.NUM || eyeData.CellCount) || null
    },
    // Pachymetry (corneal thickness)
    pachymetry: {
      central: parseFloat(eyeData.CCT || eyeData.CentralCornealThickness || eyeData.Pachymetry?.Central) || null,
      unit: 'µm'
    },
    // Image references
    images: {
      specular: eyeData.ImagePath || eyeData.SpecularImage,
      cellMap: eyeData.CellMapImage
    },
    // Quality metrics
    quality: {
      score: parseFloat(eyeData.Quality || eyeData.ImageQuality) || null,
      focus: eyeData.Focus,
      valid: eyeData.Valid !== 'false' && eyeData.Valid !== '0'
    }
  };
}

/**
 * Parse multiple NIDEK files from a directory
 * @param {string} dirPath - Directory containing NIDEK files
 * @returns {Promise<Array>} Array of parsed exams
 */
async function parseDirectory(dirPath) {
  const files = await fs.readdir(dirPath);
  const exams = [];

  // Group files by exam ID (XML + associated images)
  const examGroups = new Map();

  for (const file of files) {
    const meta = parseFilename(file);
    if (!meta) continue;

    if (!examGroups.has(meta.examId)) {
      examGroups.set(meta.examId, {
        xml: null,
        images: []
      });
    }

    const group = examGroups.get(meta.examId);

    if (meta.extension === 'xml') {
      group.xml = path.join(dirPath, file);
    } else {
      group.images.push({
        path: path.join(dirPath, file),
        type: meta.extension
      });
    }
  }

  // Parse each exam
  for (const [examId, group] of examGroups) {
    if (group.xml) {
      try {
        const exam = await parseCEM530(group.xml);
        exam.images = group.images;
        exams.push(exam);
      } catch (err) {
        log.error(`Error parsing exam ${examId}:`, err.message);
      }
    }
  }

  return exams;
}

/**
 * Convert parsed NIDEK data to MedFlow OphthalmologyExam format
 */
function toOphthalmologyExam(nidekData, patientId, visitId) {
  return {
    patient: patientId,
    visit: visitId,
    examType: 'specular_microscopy',
    device: {
      name: 'NIDEK CEM-530',
      manufacturer: nidekData.device.manufacturer,
      model: nidekData.device.model,
      serialNumber: nidekData.device.serialNumber
    },
    examDate: nidekData.examInfo.examDate,
    measurements: {
      rightEye: nidekData.rightEye ? {
        specularMicroscopy: {
          endothelialCellDensity: nidekData.rightEye.endothelialCells.cellDensity,
          coefficientOfVariation: nidekData.rightEye.endothelialCells.cv,
          hexagonality: nidekData.rightEye.endothelialCells.hexagonality,
          averageCellArea: nidekData.rightEye.endothelialCells.averageCellArea,
          centralCornealThickness: nidekData.rightEye.pachymetry.central
        }
      } : null,
      leftEye: nidekData.leftEye ? {
        specularMicroscopy: {
          endothelialCellDensity: nidekData.leftEye.endothelialCells.cellDensity,
          coefficientOfVariation: nidekData.leftEye.endothelialCells.cv,
          hexagonality: nidekData.leftEye.endothelialCells.hexagonality,
          averageCellArea: nidekData.leftEye.endothelialCells.averageCellArea,
          centralCornealThickness: nidekData.leftEye.pachymetry.central
        }
      } : null
    },
    images: nidekData.images,
    rawDeviceData: nidekData.rawData,
    source: 'device_import',
    importedFrom: {
      device: 'NIDEK_CEM530',
      importDate: new Date()
    }
  };
}

module.exports = {
  parseFilename,
  parseCEM530,
  parseDirectory,
  toOphthalmologyExam
};
