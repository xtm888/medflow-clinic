import React, { useState, useEffect } from 'react';
import {
  Copy, RefreshCw, Printer, CheckCircle, AlertCircle, FileText,
  Clock, Calendar, User, Pill, Eye, Download, Send, History,
  Settings, ChevronDown, ChevronRight, Shield, Info
} from 'lucide-react';
import api from '../../services/apiConfig';

export default function EnhancedPrescription({ patientId }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [printFormat, setPrintFormat] = useState('simple');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [insuranceStatus, setInsuranceStatus] = useState(null);
  const [expandedPrescriptions, setExpandedPrescriptions] = useState({});

  const printFormats = [
    { value: 'simple', label: 'Simple Format', description: 'Basic prescription format' },
    { value: 'duplicate', label: 'Duplicate', description: 'Two copies on one page' },
    { value: 'bi-zone', label: 'Bi-zone', description: 'Separated secure zones' },
    { value: 'detailed', label: 'Detailed', description: 'With full instructions' },
    { value: 'insurance', label: 'Insurance', description: 'Insurance-compliant format' }
  ];

  useEffect(() => {
    if (patientId) {
      fetchPrescriptions();
      fetchTemplates();
    }
  }, [patientId]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/prescriptions/patient/${patientId}`);
      setPrescriptions(response.data.data);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/templates/category/prescription');
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleCopyPrescription = async (prescriptionId) => {
    try {
      const response = await api.post(`/api/prescriptions/copy/${prescriptionId}`);
      const newPrescription = response.data.data;
      setPrescriptions([newPrescription, ...prescriptions]);
      setSelectedPrescription(newPrescription);
      showNotification('Prescription copied successfully', 'success');
    } catch (error) {
      console.error('Error copying prescription:', error);
      showNotification('Failed to copy prescription', 'error');
    }
  };

  const handleRenewPrescription = async (prescriptionId) => {
    try {
      const response = await api.post(`/api/prescriptions/renew/${prescriptionId}`, {
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
      const renewedPrescription = response.data.data;
      setPrescriptions([renewedPrescription, ...prescriptions]);
      setSelectedPrescription(renewedPrescription);
      showNotification('Prescription renewed successfully', 'success');
    } catch (error) {
      console.error('Error renewing prescription:', error);
      showNotification('Failed to renew prescription', 'error');
    }
  };

  const handleQuickRenewAll = async () => {
    const activePrescriptions = prescriptions.filter(p => p.status === 'active');

    if (activePrescriptions.length === 0) {
      showNotification('No active prescriptions to renew', 'info');
      return;
    }

    try {
      const renewalPromises = activePrescriptions.map(p =>
        api.post(`/api/prescriptions/renew/${p._id}`, {
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        })
      );

      const results = await Promise.all(renewalPromises);
      const renewedPrescriptions = results.map(r => r.data.data);
      setPrescriptions([...renewedPrescriptions, ...prescriptions]);
      showNotification(`${renewedPrescriptions.length} prescriptions renewed`, 'success');
    } catch (error) {
      console.error('Error renewing prescriptions:', error);
      showNotification('Failed to renew some prescriptions', 'error');
    }
  };

  const checkInsuranceCompatibility = async (prescriptionId) => {
    try {
      const response = await api.post(`/api/prescriptions/validate`, {
        prescriptionId,
        insuranceProvider: 'patient-insurance-id' // Would come from patient data
      });
      setInsuranceStatus(response.data.data);
    } catch (error) {
      console.error('Error checking insurance:', error);
    }
  };

  const handleBatchPrint = async (prescriptionIds) => {
    try {
      const response = await api.post('/api/prescriptions/batch', {
        prescriptionIds,
        format: printFormat
      });

      // Handle the PDF blob response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error batch printing:', error);
      showNotification('Failed to generate print batch', 'error');
    }
  };

  const handlePrintPrescription = async (prescriptionId) => {
    try {
      const response = await api.get(`/api/prescriptions/${prescriptionId}/print?format=${printFormat}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error printing prescription:', error);
      showNotification('Failed to generate prescription', 'error');
    }
  };

  const applyTemplate = async (templateId, prescriptionId) => {
    try {
      const response = await api.post(`/api/templates/${templateId}/apply`, {
        context: {
          prescriptionId,
          patientId
        }
      });

      // Update prescription with template data
      const updatedPrescription = response.data.data;
      setPrescriptions(prescriptions.map(p =>
        p._id === prescriptionId ? updatedPrescription : p
      ));
      showNotification('Template applied successfully', 'success');
    } catch (error) {
      console.error('Error applying template:', error);
      showNotification('Failed to apply template', 'error');
    }
  };

  const showNotification = (message, type = 'info') => {
    // This would integrate with your notification system
    console.log(`${type}: ${message}`);
  };

  const toggleExpand = (prescriptionId) => {
    setExpandedPrescriptions(prev => ({
      ...prev,
      [prescriptionId]: !prev[prescriptionId]
    }));
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { icon: CheckCircle, color: 'bg-green-100 text-green-700' },
      'expired': { icon: Clock, color: 'bg-red-100 text-red-700' },
      'cancelled': { icon: AlertCircle, color: 'bg-gray-100 text-gray-700' },
      'on-hold': { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700' }
    };

    const badge = badges[status] || badges['active'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Prescription Management</h2>
            <p className="text-gray-600">Enhanced prescription tools with templates</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleQuickRenewAll}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Renew All Active
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </button>
          </div>
        </div>

        {/* Print Format Selector */}
        <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
          <Printer className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Print Format:</span>
          <div className="flex space-x-2">
            {printFormats.map(format => (
              <button
                key={format.value}
                onClick={() => setPrintFormat(format.value)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  printFormat === format.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                title={format.description}
              >
                {format.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Templates */}
      {templates.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Quick Templates</h3>
            <button className="text-xs text-blue-600 hover:text-blue-700">
              View All →
            </button>
          </div>
          <div className="flex space-x-2 overflow-x-auto">
            {templates.slice(0, 5).map(template => (
              <button
                key={template._id}
                onClick={() => selectedPrescription && applyTemplate(template._id, selectedPrescription._id)}
                className="flex-shrink-0 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
              >
                <FileText className="w-4 h-4 inline mr-2 text-gray-600" />
                <span className="text-sm">{template.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prescriptions List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Current Prescriptions</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading prescriptions...</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="p-8 text-center">
            <Pill className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No prescriptions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {prescriptions.map(prescription => {
              const isExpanded = expandedPrescriptions[prescription._id];

              return (
                <div key={prescription._id} className="p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => toggleExpand(prescription._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900">
                            {prescription.type === 'medication' && 'Medication Prescription'}
                            {prescription.type === 'optical' && 'Optical Prescription'}
                            {prescription.type === 'therapy' && 'Therapy Prescription'}
                          </h4>
                          {getStatusBadge(prescription.status)}
                          {insuranceStatus && insuranceStatus.prescriptionId === prescription._id && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              insuranceStatus.covered
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              <Shield className="w-3 h-3 inline mr-1" />
                              {insuranceStatus.covered ? 'Covered' : 'Not Covered'}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Issued: {formatDate(prescription.dateIssued)}
                          </span>
                          <span className="flex items-center mt-1">
                            <Clock className="w-4 h-4 mr-1" />
                            Valid until: {formatDate(prescription.validUntil)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPrescription(prescription._id);
                      }}
                      className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenewPrescription(prescription._id);
                      }}
                      className="flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm"
                      disabled={prescription.status !== 'active'}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Renew
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintPrescription(prescription._id);
                      }}
                      className="flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm"
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      Print
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        checkInsuranceCompatibility(prescription._id);
                      }}
                      className="flex items-center px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm"
                    >
                      <Shield className="w-4 h-4 mr-1" />
                      Check Insurance
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      {prescription.type === 'medication' && prescription.medications && (
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Medications:</h5>
                          <div className="space-y-2">
                            {prescription.medications.map((med, index) => (
                              <div key={index} className="bg-white p-3 rounded border border-gray-200">
                                <p className="font-medium">{med.name}</p>
                                <p className="text-sm text-gray-600">
                                  {med.dosage} - {med.frequency} for {med.duration}
                                </p>
                                {med.instructions && (
                                  <p className="text-sm text-gray-500 mt-1">{med.instructions}</p>
                                )}
                                <div className="mt-2 flex items-center text-xs text-gray-500">
                                  <Info className="w-3 h-3 mr-1" />
                                  Refills: {med.refills || 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {prescription.type === 'optical' && prescription.optical && (
                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Optical Details:</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <p className="font-medium text-sm">Right Eye (OD)</p>
                              <p className="text-sm text-gray-600">
                                Sph: {prescription.optical.OD?.sphere || 'N/A'} |
                                Cyl: {prescription.optical.OD?.cylinder || 'N/A'} |
                                Axis: {prescription.optical.OD?.axis || 'N/A'}
                              </p>
                              {prescription.optical.OD?.add && (
                                <p className="text-sm text-gray-500">Add: {prescription.optical.OD.add}</p>
                              )}
                            </div>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <p className="font-medium text-sm">Left Eye (OS)</p>
                              <p className="text-sm text-gray-600">
                                Sph: {prescription.optical.OS?.sphere || 'N/A'} |
                                Cyl: {prescription.optical.OS?.cylinder || 'N/A'} |
                                Axis: {prescription.optical.OS?.axis || 'N/A'}
                              </p>
                              {prescription.optical.OS?.add && (
                                <p className="text-sm text-gray-500">Add: {prescription.optical.OS.add}</p>
                              )}
                            </div>
                          </div>
                          {prescription.optical.pd && (
                            <p className="mt-2 text-sm text-gray-600">
                              PD: Distance {prescription.optical.pd.distance}mm | Near {prescription.optical.pd.near}mm
                            </p>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {prescription.notes && (
                        <div className="mt-3">
                          <h5 className="font-medium text-gray-700 mb-1">Notes:</h5>
                          <p className="text-sm text-gray-600">{prescription.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Batch Actions */}
        {prescriptions.length > 1 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {prescriptions.filter(p => p.status === 'active').length} active prescriptions
              </span>
              <button
                onClick={() => {
                  const activeIds = prescriptions
                    .filter(p => p.status === 'active')
                    .map(p => p._id);
                  handleBatchPrint(activeIds);
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print All Active
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}