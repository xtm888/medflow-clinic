/**
 * DOCUMENT GENERATOR INTEGRATION EXAMPLES
 *
 * This file shows how to integrate the DocumentGenerator component
 * into different parts of the Magloire application.
 */

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import DocumentGenerator from './DocumentGenerator';

// ============================================================
// EXAMPLE 1: Integration in Queue/Visit Page
// ============================================================

export const QueuePageIntegration = ({ visit, patient }) => {
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  return (
    <div>
      {/* Your existing visit/queue content */}

      {/* Add this button in the action bar */}
      <button
        onClick={() => setShowDocumentGenerator(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <FileText className="w-5 h-5" />
        Générer Document
      </button>

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={visit._id}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            console.log('Document generated:', doc);
            // Optionally refresh visit documents
            // refreshVisitData();
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// EXAMPLE 2: Integration in Patient Detail Page
// ============================================================

export const PatientDetailIntegration = ({ patient, currentVisit }) => {
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  return (
    <div>
      {/* Patient header actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowDocumentGenerator(true)}
          className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
        >
          <FileText className="w-5 h-5" />
          Certificat / Courrier
        </button>
      </div>

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={currentVisit?._id} // Optional: only if in context of a visit
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            console.log('Document generated:', doc);
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// EXAMPLE 3: Integration in Visit Actions Menu (Dropdown)
// ============================================================

export const VisitActionsMenuIntegration = ({ visit, patient }) => {
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      {/* Actions Dropdown Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
      >
        Actions ▼
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <button
            onClick={() => {
              setShowDocumentGenerator(true);
              setShowMenu(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
          >
            <FileText className="w-5 h-5 text-blue-600" />
            Générer un document
          </button>
          {/* Other menu items */}
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={visit._id}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            console.log('Document generated:', doc);
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// EXAMPLE 4: Standalone Document Generation Page
// ============================================================

export const DocumentGenerationPage = () => {
  // This would be a full page route
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);

  if (!selectedPatient) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Génération de Documents</h1>
        <p className="text-gray-600 mb-4">Sélectionnez d'abord un patient pour continuer</p>
        {/* Patient selector component */}
      </div>
    );
  }

  return (
    <div className="p-6">
      <DocumentGenerator
        patientId={selectedPatient._id}
        visitId={selectedVisit?._id}
        onClose={() => {
          // Handle navigation back
          setSelectedPatient(null);
        }}
        onDocumentGenerated={(doc) => {
          console.log('Document generated:', doc);
        }}
      />
    </div>
  );
};

// ============================================================
// EXAMPLE 5: Quick Certificate Button in Visit Summary
// ============================================================

export const VisitSummaryIntegration = ({ visit, patient }) => {
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Actions de la Visite</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Quick action buttons */}
        <button
          onClick={() => setShowDocumentGenerator(true)}
          className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
        >
          <FileText className="w-6 h-6 text-blue-600" />
          <span className="font-medium text-blue-700">Certificat</span>
        </button>

        {/* Other quick actions */}
      </div>

      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={visit._id}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            console.log('Document generated:', doc);
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// EXAMPLE 6: Batch Document Generation (e.g., after cataract surgery)
// ============================================================

export const BatchDocumentGeneration = ({ visit, patient }) => {
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);

  const handleGeneratePostOpDocuments = async () => {
    // This would use the bulkGenerateDocuments API
    // to generate multiple related documents at once
    setShowDocumentGenerator(true);
  };

  return (
    <div>
      <button
        onClick={handleGeneratePostOpDocuments}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Générer Documents Post-Op
      </button>

      {showDocumentGenerator && (
        <DocumentGenerator
          patientId={patient._id}
          visitId={visit._id}
          onClose={() => setShowDocumentGenerator(false)}
          onDocumentGenerated={(doc) => {
            console.log('Documents generated:', doc);
          }}
        />
      )}
    </div>
  );
};

// ============================================================
// HOW TO ADD TO EXISTING COMPONENTS:
// ============================================================

/**
 * 1. Import the component:
 * import DocumentGenerator from './components/documents/DocumentGenerator';
 *
 * 2. Add state for showing/hiding:
 * const [showDocGen, setShowDocGen] = useState(false);
 *
 * 3. Add a button/trigger:
 * <button onClick={() => setShowDocGen(true)}>
 *   <FileText /> Generate Document
 * </button>
 *
 * 4. Add the modal:
 * {showDocGen && (
 *   <DocumentGenerator
 *     patientId={patient._id}
 *     visitId={visit?._id}
 *     onClose={() => setShowDocGen(false)}
 *     onDocumentGenerated={(doc) => {
 *       console.log('Generated:', doc);
 *       // Optional: refresh data, show toast, etc.
 *     }}
 *   />
 * )}
 */

// ============================================================
// SPECIFIC INTEGRATION POINTS IN EXISTING FILES:
// ============================================================

/**
 * 1. Queue.jsx:
 *    - Add button in the visit actions section
 *    - File: frontend/src/pages/Queue.jsx
 *    - Location: In the "Actions" column of the queue table
 *
 * 2. PatientVisit.jsx (if exists):
 *    - Add in the visit header actions
 *    - Add in the "Documents" tab
 *
 * 3. Prescriptions.jsx:
 *    - Add button to generate prescription certificate
 *    - Location: After prescription is created
 *
 * 4. RefractionExam.jsx:
 *    - Add button to generate visual acuity certificate
 *    - Location: After exam completion
 *
 * 5. MainLayout.jsx:
 *    - Optionally add to the main navigation menu
 *    - Location: In sidebar or top menu
 */
