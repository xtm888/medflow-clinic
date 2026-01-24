const DocumentTemplate = require('../models/DocumentTemplate');
const Patient = require('../models/Patient');
const Visit = require('../models/Visit');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper function to calculate age from date of birth
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to format date in French format (DD/MM/YYYY)
const formatDateFR = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function to auto-fill template with patient/visit data
const autoFillTemplateData = async (template, patientId, visitId = null, userId = null, customData = {}) => {
  const data = { ...customData };

  // Fetch patient data if patientId provided
  if (patientId) {
    const patient = await Patient.findById(patientId);
    if (patient) {
      data.patientName = `${patient.firstName} ${patient.lastName}`;
      data.patientFirstName = patient.firstName;
      data.patientLastName = patient.lastName;
      data.patientTitle = patient.gender === 'male' ? 'Monsieur' : 'Madame';
      data.dateOfBirth = patient.dateOfBirth ? formatDateFR(patient.dateOfBirth) : '';
      data.patientAge = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : '';
      data.patientPhone = patient.phoneNumber || '';
      data.patientEmail = patient.email || '';
    }
  }

  // Fetch visit data if visitId provided
  if (visitId) {
    const visit = await Visit.findById(visitId)
      .populate('patient')
      .populate('primaryProvider')
      .populate('examinations.refraction');

    if (visit) {
      // Visit basic info
      data.visitDate = formatDateFR(visit.visitDate);
      data.consultationDate = formatDateFR(visit.visitDate);

      // Diagnoses
      if (visit.diagnoses && visit.diagnoses.length > 0) {
        data.diagnosis = visit.diagnoses[0].diagnosis || '';
      }

      // Refraction data if available
      if (visit.examinations?.refraction) {
        const refraction = visit.examinations.refraction;
        data.vaOD = refraction.visualAcuity?.withoutCorrection?.right?.decimal || '0';
        data.vaOG = refraction.visualAcuity?.withoutCorrection?.left?.decimal || '0';
        data.vaODCorrected = refraction.visualAcuity?.withCorrection?.right?.decimal || '0';
        data.vaOGCorrected = refraction.visualAcuity?.withCorrection?.left?.decimal || '0';
      }

      // IOP (intraocular pressure)
      if (visit.vitalSigns?.iop) {
        data.iopOD = visit.vitalSigns.iop.right || '0';
        data.iopOG = visit.vitalSigns.iop.left || '0';
      }
    }
  }

  // Fetch user (doctor) data if userId provided
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      const title = user.gender === 'male' ? 'Mr' : 'Dr';
      data.doctorName = `${title} ${user.firstName} ${user.lastName}`;
      data.doctorFirstName = user.firstName;
      data.doctorLastName = user.lastName;
      data.doctorSpecialty = user.specialization || '';
    }
  }

  // Add current date if not provided
  if (!data.consultationDate) {
    data.consultationDate = formatDateFR(new Date());
  }

  return data;
};

// Helper function to replace template variables
const fillTemplate = (templateContent, data) => {
  let filledContent = templateContent;

  // Replace all {{variableName}} with actual values
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    filledContent = filledContent.replace(regex, data[key] || '');
  });

  // Remove any remaining unfilled variables
  filledContent = filledContent.replace(/{{.*?}}/g, '___________');

  return filledContent;
};

// @desc    Get all document templates
// @route   GET /api/document-generation/templates
// @access  Private
exports.getTemplates = asyncHandler(async (req, res, _next) => {
  const { category, subCategory, specialty, search, popular } = req.query;

  // Build query
  const query = { status: 'active' };
  if (category) query.category = category;
  if (subCategory) query.subCategory = subCategory;
  if (specialty) query.specialty = specialty;
  if (search) {
    // Escape special regex characters to prevent ReDoS/injection attacks
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: new RegExp(escapedSearch, 'i') },
      { nameEn: new RegExp(escapedSearch, 'i') },
      { tags: new RegExp(escapedSearch, 'i') }
    ];
  }

  let templates;
  if (popular === 'true') {
    templates = await DocumentTemplate.getPopularTemplates(20);
  } else {
    templates = await DocumentTemplate.find(query)
      .select('templateId name nameEn category subCategory specialty language tags usageCount')
      .sort({ category: 1, name: 1 });
  }

  // Get categories summary
  const categorySummary = await DocumentTemplate.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: { category: '$category', subCategory: '$subCategory' }, count: { $sum: 1 } } },
    { $sort: { '_id.category': 1, '_id.subCategory': 1 } }
  ]);

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates,
    categorySummary
  });
});

// @desc    Get single template with details
// @route   GET /api/document-generation/templates/:id
// @access  Private
exports.getTemplate = asyncHandler(async (req, res, _next) => {
  const template = await DocumentTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Get template by templateId
// @route   GET /api/document-generation/templates/code/:templateId
// @access  Private
exports.getTemplateByCode = asyncHandler(async (req, res, _next) => {
  const template = await DocumentTemplate.findOne({ templateId: req.params.templateId });

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  res.status(200).json({
    success: true,
    data: template
  });
});

// @desc    Auto-fill template preview (no save)
// @route   POST /api/document-generation/templates/:id/preview
// @access  Private
exports.previewTemplate = asyncHandler(async (req, res, _next) => {
  const template = await DocumentTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  const { patientId, visitId, customData } = req.body;

  // Auto-fill data from patient/visit
  const autoFilledData = await autoFillTemplateData(
    template,
    patientId,
    visitId,
    req.user.id,
    customData || {}
  );

  // Fill template
  const filledContent = fillTemplate(template.content, autoFilledData);

  res.status(200).json({
    success: true,
    data: {
      templateId: template.templateId,
      templateName: template.name,
      content: filledContent,
      autoFilledData,
      remainingVariables: template.variables.filter(v => !autoFilledData[v.name])
    }
  });
});

// @desc    Generate document from template
// @route   POST /api/document-generation/generate
// @access  Private
exports.generateDocument = asyncHandler(async (req, res, _next) => {
  const { templateId, patientId, visitId, customData, saveToVisit } = req.body;

  // Validate required fields
  if (!templateId) {
    return res.status(400).json({
      success: false,
      error: 'Template ID is required'
    });
  }

  if (!patientId) {
    return res.status(400).json({
      success: false,
      error: 'Patient ID is required'
    });
  }

  // Find template
  const template = await DocumentTemplate.findById(templateId);
  if (!template) {
    return res.status(404).json({
      success: false,
      error: 'Template not found'
    });
  }

  // Auto-fill data
  const autoFilledData = await autoFillTemplateData(
    template,
    patientId,
    visitId,
    req.user.id,
    customData || {}
  );

  // Fill template
  const filledContent = fillTemplate(template.content, autoFilledData);

  // Update template usage
  await template.recordUsage();

  // Save to visit if requested and visitId provided
  if (saveToVisit && visitId) {
    const visit = await Visit.findById(visitId);
    if (visit) {
      const document = {
        name: template.name,
        type: 'generated_document',
        category: template.category,
        content: filledContent,
        templateId: template.templateId,
        generatedBy: req.user.id,
        generatedAt: new Date(),
        metadata: {
          templateName: template.name,
          category: template.category,
          subCategory: template.subCategory
        }
      };

      visit.documents.push(document);
      await visit.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'Document generated successfully',
    data: {
      templateId: template.templateId,
      templateName: template.name,
      category: template.category,
      content: filledContent,
      generatedAt: new Date(),
      savedToVisit: !!(saveToVisit && visitId)
    }
  });
});

// @desc    Get generated documents for a visit
// @route   GET /api/document-generation/visit/:visitId/documents
// @access  Private
exports.getVisitDocuments = asyncHandler(async (req, res, _next) => {
  const visit = await Visit.findById(req.params.visitId)
    .populate('patient', 'firstName lastName patientId')
    .select('documents visitId visitDate');

  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  // Filter only generated documents
  const generatedDocs = visit.documents.filter(doc =>
    doc.type === 'generated_document' || doc.templateId
  );

  res.status(200).json({
    success: true,
    count: generatedDocs.length,
    data: {
      visitId: visit.visitId,
      visitDate: visit.visitDate,
      patient: visit.patient,
      documents: generatedDocs
    }
  });
});

// @desc    Get patient's all generated documents across visits
// @route   GET /api/document-generation/patient/:patientId/documents
// @access  Private
exports.getPatientDocuments = asyncHandler(async (req, res, _next) => {
  const { patientId } = req.params;

  // Validate patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      error: 'Patient not found'
    });
  }

  // Find all visits for this patient with generated documents
  const visits = await Visit.find({
    patient: patientId,
    'documents.type': 'generated_document'
  })
    .select('visitId visitDate documents')
    .sort({ visitDate: -1 });

  // Extract generated documents from all visits
  const allDocuments = [];
  visits.forEach(visit => {
    const generatedDocs = visit.documents.filter(doc =>
      doc.type === 'generated_document' || doc.templateId
    );
    generatedDocs.forEach(doc => {
      allDocuments.push({
        ...doc.toObject(),
        visitId: visit.visitId,
        visitDate: visit.visitDate
      });
    });
  });

  res.status(200).json({
    success: true,
    count: allDocuments.length,
    data: {
      patient: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        patientId: patient.patientId
      },
      documents: allDocuments
    }
  });
});

// @desc    Get template categories
// @route   GET /api/document-generation/categories
// @access  Private
exports.getCategories = asyncHandler(async (req, res, _next) => {
  const categories = await DocumentTemplate.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: {
          category: '$category',
          subCategory: '$subCategory',
          specialty: '$specialty'
        },
        count: { $sum: 1 },
        templates: {
          $push: {
            id: '$_id',
            templateId: '$templateId',
            name: '$name',
            nameEn: '$nameEn'
          }
        }
      }
    },
    { $sort: { '_id.category': 1, '_id.subCategory': 1 } }
  ]);

  // Organize by main category
  const organized = {};
  categories.forEach(cat => {
    const mainCat = cat._id.category;
    if (!organized[mainCat]) {
      organized[mainCat] = [];
    }
    organized[mainCat].push({
      subCategory: cat._id.subCategory,
      specialty: cat._id.specialty,
      count: cat.count,
      templates: cat.templates
    });
  });

  res.status(200).json({
    success: true,
    data: organized,
    categoryList: Object.keys(organized)
  });
});

// @desc    Bulk generate documents for a visit
// @route   POST /api/document-generation/visit/:visitId/bulk-generate
// @access  Private
exports.bulkGenerateDocuments = asyncHandler(async (req, res, _next) => {
  const { visitId } = req.params;
  const { templateIds, customData } = req.body;

  if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Template IDs array is required'
    });
  }

  const visit = await Visit.findById(visitId).populate('patient');
  if (!visit) {
    return res.status(404).json({
      success: false,
      error: 'Visit not found'
    });
  }

  const generatedDocuments = [];
  const errors = [];

  // Generate each template
  for (const templateId of templateIds) {
    try {
      const template = await DocumentTemplate.findById(templateId);
      if (!template) {
        errors.push({ templateId, error: 'Template not found' });
        continue;
      }

      // Auto-fill data
      const autoFilledData = await autoFillTemplateData(
        template,
        visit.patient._id,
        visitId,
        req.user.id,
        customData || {}
      );

      // Fill template
      const filledContent = fillTemplate(template.content, autoFilledData);

      // Add to visit
      const document = {
        name: template.name,
        type: 'generated_document',
        category: template.category,
        content: filledContent,
        templateId: template.templateId,
        generatedBy: req.user.id,
        generatedAt: new Date(),
        metadata: {
          templateName: template.name,
          category: template.category,
          subCategory: template.subCategory
        }
      };

      visit.documents.push(document);
      generatedDocuments.push({
        templateId: template.templateId,
        templateName: template.name,
        success: true
      });

      // Update template usage
      await template.recordUsage();
    } catch (error) {
      errors.push({ templateId, error: error.message });
    }
  }

  // Save visit with all generated documents
  await visit.save();

  res.status(200).json({
    success: true,
    message: `Generated ${generatedDocuments.length} documents successfully`,
    data: {
      visitId: visit.visitId,
      generated: generatedDocuments,
      errors: errors.length > 0 ? errors : undefined
    }
  });
});

// ============================================================
// SURGERY REPORT PDF GENERATION
// ============================================================

/**
 * @desc    Generate Surgery Report PDF (Operative Report)
 * @route   GET /api/documents/surgery-report/:surgeryReportId/pdf
 * @access  Private (doctor, surgeon, admin)
 */
exports.generateSurgeryReportPDF = asyncHandler(async (req, res, _next) => {
  const { surgeryReportId } = req.params;

  const SurgeryReport = require('../models/SurgeryReport');
  const Clinic = require('../models/Clinic');

  const report = await SurgeryReport.findById(surgeryReportId)
    .populate('patient')
    .populate('surgeon', 'firstName lastName title specialty')
    .populate('assistantSurgeon', 'firstName lastName title')
    .populate('surgeryType', 'name code')
    .populate('clinic');

  if (!report) {
    return res.status(404).json({
      success: false,
      error: 'Compte rendu opératoire non trouvé'
    });
  }

  const patient = report.patient;
  let clinic = report.clinic;

  // If clinic not populated, try to get from patient or default
  if (!clinic) {
    clinic = await Clinic.findOne({ status: 'active' });
  }

  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generateSurgeryReportPDF(report, patient, clinic);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="compte-rendu-operatoire-${report._id}.pdf"`,
    'Content-Length': pdfBuffer.length
  });

  res.send(pdfBuffer);
});

/**
 * @desc    Generate Pre-Op Checklist PDF
 * @route   GET /api/documents/surgery-case/:surgeryCaseId/preop-checklist/pdf
 * @access  Private (doctor, nurse, admin)
 */
exports.generatePreOpChecklistPDF = asyncHandler(async (req, res, _next) => {
  const { surgeryCaseId } = req.params;

  const SurgeryCase = require('../models/SurgeryCase');
  const Clinic = require('../models/Clinic');

  const surgeryCase = await SurgeryCase.findById(surgeryCaseId)
    .populate('patient')
    .populate('surgeryType', 'name code')
    .populate('surgeon', 'firstName lastName title')
    .populate('clinic');

  if (!surgeryCase) {
    return res.status(404).json({
      success: false,
      error: 'Cas chirurgical non trouvé'
    });
  }

  const patient = surgeryCase.patient;
  let clinic = surgeryCase.clinic;

  if (!clinic) {
    clinic = await Clinic.findOne({ status: 'active' });
  }

  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generatePreOpChecklistPDF(surgeryCase, patient, clinic);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="checklist-preop-${surgeryCase._id}.pdf"`,
    'Content-Length': pdfBuffer.length
  });

  res.send(pdfBuffer);
});

/**
 * @desc    Generate Post-Op Note PDF (Patient Take-Home Instructions)
 * @route   GET /api/documents/surgery-report/:surgeryReportId/postop-note/pdf
 * @access  Private (doctor, nurse, admin)
 */
exports.generatePostOpNotePDF = asyncHandler(async (req, res, _next) => {
  const { surgeryReportId } = req.params;

  const SurgeryReport = require('../models/SurgeryReport');
  const Clinic = require('../models/Clinic');

  const report = await SurgeryReport.findById(surgeryReportId)
    .populate('patient')
    .populate('surgeon', 'firstName lastName title')
    .populate('surgeryType', 'name code')
    .populate('clinic');

  if (!report) {
    return res.status(404).json({
      success: false,
      error: 'Compte rendu opératoire non trouvé'
    });
  }

  const patient = report.patient;
  let clinic = report.clinic;

  if (!clinic) {
    clinic = await Clinic.findOne({ status: 'active' });
  }

  const pdfGenerator = require('../services/pdfGenerator');
  const pdfBuffer = await pdfGenerator.generatePostOpNotePDF(report, patient, clinic);

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="instructions-postop-${report._id}.pdf"`,
    'Content-Length': pdfBuffer.length
  });

  res.send(pdfBuffer);
});
