import React, { useState, useEffect, useRef } from 'react';
import {
  User, Calendar, Clock, Activity, FileText, AlertCircle,
  ChevronLeft, ChevronRight, Settings, Grid, Maximize2,
  Minimize2, X, Lock, Unlock, Menu, PanelLeft, Heart,
  Thermometer, Droplet, Wind, Eye, Brain, Stethoscope
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ClinicalLayout({ children }) {
  const [patient, setPatient] = useState(null);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState(['vitals', 'allergies', 'medications']);
  const [isDragging, setIsDragging] = useState(null);
  const [lockedPanels, setLockedPanels] = useState({ left: false, right: false });

  const leftResizeRef = useRef(null);
  const rightResizeRef = useRef(null);
  const { patientId } = useParams();
  const navigate = useNavigate();

  // Available widgets
  const availableWidgets = [
    { id: 'vitals', name: 'Vital Signs', icon: Heart },
    { id: 'allergies', name: 'Allergies', icon: AlertCircle },
    { id: 'medications', name: 'Current Medications', icon: FileText },
    { id: 'recent-visits', name: 'Recent Visits', icon: Calendar },
    { id: 'lab-results', name: 'Lab Results', icon: Activity },
    { id: 'imaging', name: 'Imaging', icon: Eye },
    { id: 'problems', name: 'Problem List', icon: AlertCircle },
    { id: 'immunizations', name: 'Immunizations', icon: Brain },
    { id: 'quick-templates', name: 'Quick Templates', icon: FileText },
    { id: 'notes', name: 'Clinical Notes', icon: FileText }
  ];

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
    }
  }, [patientId]);

  useEffect(() => {
    // Load saved layout preferences
    const savedLayout = localStorage.getItem('clinicalLayout');
    if (savedLayout) {
      const layout = JSON.parse(savedLayout);
      setLeftSidebarWidth(layout.leftWidth || 320);
      setRightPanelWidth(layout.rightWidth || 400);
      setActiveWidgets(layout.widgets || ['vitals', 'allergies', 'medications']);
    }
  }, []);

  const fetchPatientData = async () => {
    try {
      const response = await api.get(`/api/patients/${patientId}`);
      setPatient(response.data.data);
    } catch (error) {
      console.error('Error fetching patient:', error);
    }
  };

  const handleMouseDown = (panel) => {
    if (panel === 'left' && !lockedPanels.left) {
      setIsDragging('left');
    } else if (panel === 'right' && !lockedPanels.right) {
      setIsDragging('right');
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging === 'left') {
      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 500) {
        setLeftSidebarWidth(newWidth);
      }
    } else if (isDragging === 'right') {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 600) {
        setRightPanelWidth(newWidth);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Save layout preferences
      const layout = {
        leftWidth: leftSidebarWidth,
        rightWidth: rightPanelWidth,
        widgets: activeWidgets
      };
      localStorage.setItem('clinicalLayout', JSON.stringify(layout));
      setIsDragging(null);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const toggleWidget = (widgetId) => {
    setActiveWidgets(prev => {
      if (prev.includes(widgetId)) {
        return prev.filter(w => w !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'vitals':
        return <VitalsWidget patient={patient} />;
      case 'allergies':
        return <AllergiesWidget patient={patient} />;
      case 'medications':
        return <MedicationsWidget patient={patient} />;
      case 'recent-visits':
        return <RecentVisitsWidget patient={patient} />;
      case 'lab-results':
        return <LabResultsWidget patient={patient} />;
      case 'problems':
        return <ProblemsWidget patient={patient} />;
      case 'quick-templates':
        return <QuickTemplatesWidget />;
      case 'notes':
        return <NotesWidget patient={patient} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Patient Context */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${
          isLeftCollapsed ? 'w-16' : ''
        }`}
        style={{ width: isLeftCollapsed ? '64px' : `${leftSidebarWidth}px` }}
      >
        <div className="h-full flex flex-col">
          {/* Patient Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center justify-between text-white">
              {!isLeftCollapsed && patient && (
                <div>
                  <h2 className="text-lg font-bold">
                    {patient.firstName} {patient.lastName}
                  </h2>
                  <p className="text-sm opacity-90">ID: {patient.patientId}</p>
                  <p className="text-sm opacity-90">DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</p>
                </div>
              )}
              <button
                onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition"
              >
                {isLeftCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Patient Quick Info */}
          {!isLeftCollapsed && patient && (
            <div className="p-4 space-y-3">
              {/* Allergies Alert */}
              {patient.medicalHistory?.allergies?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Allergies</span>
                  </div>
                  <div className="mt-1 text-xs text-red-600">
                    {patient.medicalHistory.allergies.slice(0, 2).map((allergy, idx) => (
                      <div key={idx}>{allergy.allergen}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insurance Info */}
              {patient.insurance && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">Insurance</p>
                  <p className="text-xs text-blue-600">{patient.insurance.provider}</p>
                  <p className="text-xs text-blue-600">Policy: {patient.insurance.policyNumber}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Contact</p>
                <p className="text-xs text-gray-600">{patient.phoneNumber}</p>
                <p className="text-xs text-gray-600">{patient.email}</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {!isLeftCollapsed && (
            <div className="p-4 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2">
                <button className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">
                  New Visit
                </button>
                <button className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition">
                  Prescribe
                </button>
                <button className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition">
                  Lab Order
                </button>
                <button className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition">
                  Documents
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        {!isLeftCollapsed && !lockedPanels.left && (
          <div
            ref={leftResizeRef}
            className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 transition"
            onMouseDown={() => handleMouseDown('left')}
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Patients
              </button>
              <span className="text-gray-400">|</span>
              <span className="text-sm text-gray-600">
                Current Visit: {new Date().toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLockedPanels(prev => ({ ...prev, left: !prev.left }))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                title={lockedPanels.left ? 'Unlock left panel' : 'Lock left panel'}
              >
                {lockedPanels.left ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setLockedPanels(prev => ({ ...prev, right: !prev.right }))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                title={lockedPanels.right ? 'Unlock right panel' : 'Lock right panel'}
              >
                {lockedPanels.right ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Work Area */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>

      {/* Right Panel - Widgets */}
      <div
        className={`bg-white border-l border-gray-200 transition-all duration-300 flex-shrink-0 ${
          isRightCollapsed ? 'w-16' : ''
        }`}
        style={{ width: isRightCollapsed ? '64px' : `${rightPanelWidth}px` }}
      >
        <div className="h-full flex flex-col">
          {/* Widget Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              {!isRightCollapsed && (
                <h3 className="font-medium text-gray-900">Clinical Widgets</h3>
              )}
              <button
                onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                className="p-1 hover:bg-gray-200 rounded transition"
              >
                {isRightCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Widget Selector */}
          {!isRightCollapsed && (
            <div className="p-3 border-b border-gray-200">
              <select
                onChange={(e) => toggleWidget(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                value=""
              >
                <option value="">Add Widget...</option>
                {availableWidgets
                  .filter(w => !activeWidgets.includes(w.id))
                  .map(widget => (
                    <option key={widget.id} value={widget.id}>
                      {widget.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Active Widgets */}
          {!isRightCollapsed && (
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {activeWidgets.map(widgetId => {
                const widget = availableWidgets.find(w => w.id === widgetId);
                const Icon = widget?.icon || FileText;

                return (
                  <div key={widgetId} className="bg-gray-50 rounded-lg border border-gray-200">
                    <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">{widget?.name}</span>
                      </div>
                      <button
                        onClick={() => toggleWidget(widgetId)}
                        className="p-1 hover:bg-gray-200 rounded transition"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                    <div className="p-3">
                      {renderWidget(widgetId)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        {!isRightCollapsed && !lockedPanels.right && (
          <div
            ref={rightResizeRef}
            className="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 transition"
            onMouseDown={() => handleMouseDown('right')}
          />
        )}
      </div>
    </div>
  );
}

// Widget Components
function VitalsWidget({ patient }) {
  if (!patient?.vitalSigns) return <p className="text-xs text-gray-500">No vital signs recorded</p>;

  const vitals = patient.vitalSigns;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-600">BP:</span>
        <span className="font-medium">{vitals.bloodPressure?.systolic}/{vitals.bloodPressure?.diastolic} mmHg</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">HR:</span>
        <span className="font-medium">{vitals.heartRate} bpm</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Temp:</span>
        <span className="font-medium">{vitals.temperature}°F</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">O2:</span>
        <span className="font-medium">{vitals.oxygenSaturation}%</span>
      </div>
    </div>
  );
}

function AllergiesWidget({ patient }) {
  const allergies = patient?.medicalHistory?.allergies || [];

  if (allergies.length === 0) {
    return <p className="text-xs text-gray-500">No known allergies</p>;
  }

  return (
    <div className="space-y-2">
      {allergies.map((allergy, idx) => (
        <div key={idx} className="p-2 bg-red-50 rounded text-xs">
          <p className="font-medium text-red-700">{allergy.allergen}</p>
          <p className="text-red-600">{allergy.reaction}</p>
        </div>
      ))}
    </div>
  );
}

function MedicationsWidget({ patient }) {
  const medications = patient?.currentMedications || [];

  if (medications.length === 0) {
    return <p className="text-xs text-gray-500">No current medications</p>;
  }

  return (
    <div className="space-y-2">
      {medications.map((med, idx) => (
        <div key={idx} className="p-2 bg-blue-50 rounded text-xs">
          <p className="font-medium text-blue-700">{med.name}</p>
          <p className="text-blue-600">{med.dosage} - {med.frequency}</p>
        </div>
      ))}
    </div>
  );
}

function RecentVisitsWidget({ patient }) {
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    if (patient?._id) {
      api.get(`/api/visits/patient/${patient._id}?limit=3`)
        .then(res => setVisits(res.data.data))
        .catch(console.error);
    }
  }, [patient]);

  if (visits.length === 0) {
    return <p className="text-xs text-gray-500">No recent visits</p>;
  }

  return (
    <div className="space-y-2">
      {visits.map((visit, idx) => (
        <div key={idx} className="p-2 bg-gray-100 rounded text-xs">
          <p className="font-medium">{new Date(visit.visitDate).toLocaleDateString()}</p>
          <p className="text-gray-600">{visit.visitType}</p>
        </div>
      ))}
    </div>
  );
}

function LabResultsWidget({ patient }) {
  return <p className="text-xs text-gray-500">No recent lab results</p>;
}

function ProblemsWidget({ patient }) {
  return <p className="text-xs text-gray-500">No active problems</p>;
}

function QuickTemplatesWidget() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    api.get('/api/templates/favorites')
      .then(res => setTemplates(res.data.data))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-1">
      {templates.slice(0, 5).map(template => (
        <button
          key={template._id}
          className="w-full text-left px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs transition"
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}

function NotesWidget({ patient }) {
  return (
    <textarea
      className="w-full h-32 p-2 border border-gray-300 rounded text-xs resize-none"
      placeholder="Quick notes..."
    />
  );
}