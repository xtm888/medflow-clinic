import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, User, Activity, FileText, Plus, ChevronRight,
  CheckCircle, AlertCircle, Clock3, Users, Stethoscope, ClipboardList
} from 'lucide-react';
import api from '../../services/api';

export default function VisitDashboard() {
  const [visits, setVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    scheduled: 0
  });

  useEffect(() => {
    fetchVisits();
    fetchStats();
  }, [activeTab]);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      let endpoint = '/api/visits/today';

      if (activeTab === 'all') {
        endpoint = '/api/visits';
      } else if (activeTab === 'pending') {
        endpoint = '/api/visits?status=in-progress';
      }

      const response = await api.get(endpoint);
      setVisits(response.data.data);
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/visits/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleStartVisit = async (visitId) => {
    try {
      await api.put(`/api/visits/${visitId}`, {
        status: 'in-progress',
        startTime: new Date()
      });
      fetchVisits();
    } catch (error) {
      console.error('Error starting visit:', error);
    }
  };

  const handleCompleteVisit = async (visitId) => {
    try {
      await api.put(`/api/visits/${visitId}/complete`);
      fetchVisits();
      setSelectedVisit(null);
    } catch (error) {
      console.error('Error completing visit:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'scheduled': { icon: Clock3, color: 'bg-blue-100 text-blue-700' },
      'checked-in': { icon: User, color: 'bg-yellow-100 text-yellow-700' },
      'in-progress': { icon: Activity, color: 'bg-green-100 text-green-700' },
      'completed': { icon: CheckCircle, color: 'bg-gray-100 text-gray-700' },
      'cancelled': { icon: AlertCircle, color: 'bg-red-100 text-red-700' }
    };

    const badge = badges[status] || badges['scheduled'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Visit Management</h1>
            <p className="text-gray-600 mt-1">Manage patient visits and clinical encounters</p>
          </div>
          <button
            onClick={() => setShowNewVisit(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Visit
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Today's Visits</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.inProgress}</p>
              </div>
              <Activity className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Scheduled</p>
                <p className="text-2xl font-bold text-purple-900">{stats.scheduled}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Visit List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visit List */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'today'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'pending'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All Visits
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading visits...</p>
              </div>
            ) : visits.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No visits found</p>
              </div>
            ) : (
              visits.map((visit) => (
                <div
                  key={visit._id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedVisit(visit)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium text-gray-900">
                          {visit.patient?.firstName} {visit.patient?.lastName}
                        </h3>
                        {getStatusBadge(visit.status)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {visit.chiefComplaint?.complaint || visit.visitType}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatTime(visit.visitDate)}
                        </span>
                        <span className="flex items-center">
                          <Stethoscope className="w-4 h-4 mr-1" />
                          Dr. {visit.primaryProvider?.firstName} {visit.primaryProvider?.lastName}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Quick Actions */}
                  {visit.status === 'checked-in' && (
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartVisit(visit._id);
                        }}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                      >
                        Start Visit
                      </button>
                    </div>
                  )}

                  {visit.status === 'in-progress' && (
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteVisit(visit._id);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                      >
                        Complete Visit
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visit Details */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {selectedVisit ? (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h2 className="text-lg font-semibold text-gray-900">Visit Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Visit ID: {selectedVisit.visitId}
                </p>
              </div>

              {/* Patient Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Patient</h3>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">
                    {selectedVisit.patient?.firstName} {selectedVisit.patient?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    ID: {selectedVisit.patient?.patientId}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedVisit.patient?.phoneNumber}
                  </p>
                </div>
              </div>

              {/* Chief Complaint */}
              {selectedVisit.chiefComplaint && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Chief Complaint</h3>
                  <p className="text-gray-600">
                    {selectedVisit.chiefComplaint.complaint}
                  </p>
                  {selectedVisit.chiefComplaint.duration && (
                    <p className="text-sm text-gray-500 mt-1">
                      Duration: {selectedVisit.chiefComplaint.duration}
                    </p>
                  )}
                </div>
              )}

              {/* Clinical Acts */}
              {selectedVisit.clinicalActs?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Clinical Acts</h3>
                  <div className="space-y-2">
                    {selectedVisit.clinicalActs.map((act, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{act.actName}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            act.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : act.status === 'in-progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {act.status}
                          </span>
                        </div>
                        {act.notes && (
                          <p className="text-sm text-gray-600 mt-1">{act.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnoses */}
              {selectedVisit.diagnoses?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Diagnoses</h3>
                  <div className="space-y-2">
                    {selectedVisit.diagnoses.map((diagnosis, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3">
                        <p className="font-medium text-sm">{diagnosis.description}</p>
                        <p className="text-xs text-gray-500">
                          {diagnosis.code} - {diagnosis.type}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2">
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  <ClipboardList className="w-4 h-4 inline mr-2" />
                  View Full Details
                </button>
                {selectedVisit.status === 'in-progress' && (
                  <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                    Add Clinical Act
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>Select a visit to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}