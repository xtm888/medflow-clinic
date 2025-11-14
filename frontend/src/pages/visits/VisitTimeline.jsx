import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, User, FileText, Activity, ChevronDown, ChevronRight,
  Stethoscope, Pill, Eye, Heart, Brain, Thermometer, AlertCircle
} from 'lucide-react';
import api from '../../services/api';

export default function VisitTimeline({ patientId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedVisits, setExpandedVisits] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (patientId) {
      fetchTimeline();
    }
  }, [patientId, filter]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'all'
        ? `/api/visits/timeline/${patientId}`
        : `/api/visits/timeline/${patientId}?type=${filter}`;

      const response = await api.get(endpoint);
      setTimeline(response.data.data);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (visitId) => {
    setExpandedVisits(prev => ({
      ...prev,
      [visitId]: !prev[visitId]
    }));
  };

  const getVisitIcon = (type) => {
    const icons = {
      'routine': Stethoscope,
      'emergency': AlertCircle,
      'follow-up': Activity,
      'initial': User,
      'procedure': Heart,
      'consultation': Brain
    };
    return icons[type] || FileText;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': 'bg-green-100 border-green-300',
      'in-progress': 'bg-yellow-100 border-yellow-300',
      'scheduled': 'bg-blue-100 border-blue-300',
      'cancelled': 'bg-red-100 border-red-300'
    };
    return colors[status] || 'bg-gray-100 border-gray-300';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Visit Timeline</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Visits</option>
            <option value="routine">Routine</option>
            <option value="emergency">Emergency</option>
            <option value="follow-up">Follow-up</option>
            <option value="consultation">Consultation</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading timeline...</p>
          </div>
        ) : timeline.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No visit history found</p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {timeline.map((visit, index) => {
              const Icon = getVisitIcon(visit.visitType);
              const isExpanded = expandedVisits[visit._id];

              return (
                <div key={visit._id} className="relative">
                  {/* Timeline Node */}
                  <div className="absolute left-8 w-4 h-4 bg-white border-2 border-blue-600 rounded-full -translate-x-1/2 top-6 z-10"></div>

                  {/* Visit Card */}
                  <div className={`ml-16 bg-white rounded-lg shadow-sm border-l-4 ${getStatusColor(visit.status)} overflow-hidden`}>
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => toggleExpand(visit._id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <Icon className="w-5 h-5 text-gray-600" />
                            <span className="font-medium text-gray-900">
                              {visit.visitType.charAt(0).toUpperCase() + visit.visitType.slice(1)} Visit
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatDate(visit.visitDate)}
                            </span>
                          </div>

                          {visit.chiefComplaint && (
                            <p className="mt-2 text-gray-600">
                              {visit.chiefComplaint.complaint}
                            </p>
                          )}

                          {visit.diagnoses?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {visit.diagnoses.slice(0, 2).map((diagnosis, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                                >
                                  {diagnosis.description}
                                </span>
                              ))}
                              {visit.diagnoses.length > 2 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                                  +{visit.diagnoses.length - 2} more
                                </span>
                              )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <User className="w-4 h-4 mr-1" />
                            Dr. {visit.primaryProvider?.firstName} {visit.primaryProvider?.lastName}
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

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4">
                          {/* Visit Info */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Visit Information</h4>
                            <div className="space-y-1 text-sm">
                              <p>
                                <span className="text-gray-500">Visit ID:</span>{' '}
                                <span className="text-gray-900">{visit.visitId}</span>
                              </p>
                              <p>
                                <span className="text-gray-500">Status:</span>{' '}
                                <span className="text-gray-900">{visit.status}</span>
                              </p>
                              <p>
                                <span className="text-gray-500">Duration:</span>{' '}
                                <span className="text-gray-900">{visit.duration || 'N/A'} minutes</span>
                              </p>
                            </div>
                          </div>

                          {/* Diagnoses */}
                          {visit.diagnoses?.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Diagnoses</h4>
                              <div className="space-y-1">
                                {visit.diagnoses.map((diagnosis, idx) => (
                                  <p key={idx} className="text-sm">
                                    <span className="text-gray-500">{diagnosis.code}:</span>{' '}
                                    <span className="text-gray-900">{diagnosis.description}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Clinical Acts */}
                        {visit.clinicalActs?.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Clinical Acts Performed</h4>
                            <div className="flex flex-wrap gap-2">
                              {visit.clinicalActs.map((act, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg"
                                >
                                  {act.actName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-4 flex space-x-2">
                          <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                            View Full Report
                          </button>
                          <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition">
                            View Documents
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Connection Line to Next Visit */}
                  {index < timeline.length - 1 && (
                    <div className="ml-8 py-2">
                      <div className="text-xs text-gray-400 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.ceil(
                          (new Date(timeline[index].visitDate) - new Date(timeline[index + 1].visitDate)) /
                          (1000 * 60 * 60 * 24)
                        )} days
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}