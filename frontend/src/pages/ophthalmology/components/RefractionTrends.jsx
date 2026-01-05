import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Calendar,
  BarChart3,
  AlertCircle,
  History
} from 'lucide-react';
import api from '../../../services/apiConfig';

export default function RefractionTrends({ patientId }) {
  const [refractionHistory, setRefractionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEye, setSelectedEye] = useState('both');
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    if (patientId) {
      fetchRefractionHistory();
    }
  }, [patientId]);

  const fetchRefractionHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/ophthalmology/patients/${patientId}/refraction-history`);
      // Handle various API response formats defensively
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setRefractionHistory(data);
    } catch (error) {
      console.error('Error fetching refraction history:', error);
      setRefractionHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const filterByTimeRange = (data) => {
    if (timeRange === 'all') return data;
    const now = new Date();
    const ranges = {
      '1y': 365,
      '2y': 730,
      '5y': 1825
    };
    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.setDate(now.getDate() - daysAgo));
    return data.filter(entry => new Date(entry.examDate || entry.date) >= cutoff);
  };

  const calculateSphericalEquivalent = (sphere, cylinder) => {
    if (sphere === undefined || sphere === null) return null;
    const sph = parseFloat(sphere) || 0;
    const cyl = parseFloat(cylinder) || 0;
    return (sph + (cyl / 2)).toFixed(2);
  };

  const getTrend = (values) => {
    if (!values || values.length < 2) return null;
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    if (Math.abs(diff) < 0.25) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDiopter = (value) => {
    if (value === undefined || value === null || value === '') return '-';
    const num = parseFloat(value);
    return num >= 0 ? `+${num.toFixed(2)}` : num.toFixed(2);
  };

  const filteredHistory = filterByTimeRange(refractionHistory);

  // Extract values for trend analysis
  const getODSphereValues = () => filteredHistory
    .map(h => h.finalRefraction?.OD?.sphere || h.OD?.sphere)
    .filter(v => v !== null && v !== undefined)
    .map(v => parseFloat(v));

  const getOSSphereValues = () => filteredHistory
    .map(h => h.finalRefraction?.OS?.sphere || h.OS?.sphere)
    .filter(v => v !== null && v !== undefined)
    .map(v => parseFloat(v));

  const odSphereTrend = getTrend(getODSphereValues());
  const osSphereTrend = getTrend(getOSSphereValues());

  // Calculate myopia progression rate
  const calculateProgressionRate = (values, dates) => {
    if (values.length < 2) return null;
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const yearsDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365);
    if (yearsDiff < 0.5) return null;
    const sphereDiff = values[values.length - 1] - values[0];
    return (sphereDiff / yearsDiff).toFixed(2);
  };

  const odProgressionRate = calculateProgressionRate(
    getODSphereValues(),
    filteredHistory.map(h => h.examDate || h.date)
  );

  const osProgressionRate = calculateProgressionRate(
    getOSSphereValues(),
    filteredHistory.map(h => h.examDate || h.date)
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <History className="w-5 h-5 mr-2 text-blue-600" />
          Évolution Réfractive
        </h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tout l'historique</option>
            <option value="1y">1 an</option>
            <option value="2y">2 ans</option>
            <option value="5y">5 ans</option>
          </select>
          <select
            value={selectedEye}
            onChange={(e) => setSelectedEye(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="both">Les deux yeux</option>
            <option value="OD">OD seulement</option>
            <option value="OS">OS seulement</option>
          </select>
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun historique de réfraction disponible</p>
        </div>
      ) : (
        <>
          {/* Trend Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(selectedEye === 'both' || selectedEye === 'OD') && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Œil Droit (OD)
                </h4>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Tendance sphère:</span>
                    <div className="flex items-center gap-1 mt-1">
                      {getTrendIcon(odSphereTrend)}
                      <span className="text-sm font-medium capitalize">
                        {odSphereTrend === 'stable' ? 'Stable' :
                         odSphereTrend === 'increasing' ? 'Plus hypermétropie' :
                         odSphereTrend === 'decreasing' ? 'Plus myope' : '-'}
                      </span>
                    </div>
                  </div>
                  {odProgressionRate && (
                    <div>
                      <span className="text-sm text-gray-600">Progression/an:</span>
                      <div className="text-sm font-medium mt-1">
                        {formatDiopter(odProgressionRate)} D/an
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(selectedEye === 'both' || selectedEye === 'OS') && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Œil Gauche (OS)
                </h4>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Tendance sphère:</span>
                    <div className="flex items-center gap-1 mt-1">
                      {getTrendIcon(osSphereTrend)}
                      <span className="text-sm font-medium capitalize">
                        {osSphereTrend === 'stable' ? 'Stable' :
                         osSphereTrend === 'increasing' ? 'Plus hypermétropie' :
                         osSphereTrend === 'decreasing' ? 'Plus myope' : '-'}
                      </span>
                    </div>
                  </div>
                  {osProgressionRate && (
                    <div>
                      <span className="text-sm text-gray-600">Progression/an:</span>
                      <div className="text-sm font-medium mt-1">
                        {formatDiopter(osProgressionRate)} D/an
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Myopia Alert */}
          {(parseFloat(odProgressionRate) < -0.5 || parseFloat(osProgressionRate) < -0.5) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Progression myopique significative</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Une progression {'>'} -0.50 D/an peut nécessiter une intervention
                    (atropine faible dose, lentilles de freination, orthokératologie).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* History Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-3 font-medium">Date</th>
                  {(selectedEye === 'both' || selectedEye === 'OD') && (
                    <>
                      <th className="text-center py-3 px-2 font-medium">OD Sph</th>
                      <th className="text-center py-3 px-2 font-medium">OD Cyl</th>
                      <th className="text-center py-3 px-2 font-medium">OD Axe</th>
                      <th className="text-center py-3 px-2 font-medium bg-blue-50">OD SE</th>
                    </>
                  )}
                  {(selectedEye === 'both' || selectedEye === 'OS') && (
                    <>
                      <th className="text-center py-3 px-2 font-medium">OS Sph</th>
                      <th className="text-center py-3 px-2 font-medium">OS Cyl</th>
                      <th className="text-center py-3 px-2 font-medium">OS Axe</th>
                      <th className="text-center py-3 px-2 font-medium bg-green-50">OS SE</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry, idx) => {
                  const odData = entry.finalRefraction?.OD || entry.OD || {};
                  const osData = entry.finalRefraction?.OS || entry.OS || {};
                  const odSE = calculateSphericalEquivalent(odData.sphere, odData.cylinder);
                  const osSE = calculateSphericalEquivalent(osData.sphere, osData.cylinder);

                  return (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {new Date(entry.examDate || entry.date).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      {(selectedEye === 'both' || selectedEye === 'OD') && (
                        <>
                          <td className="text-center py-3 px-2">{formatDiopter(odData.sphere)}</td>
                          <td className="text-center py-3 px-2">{formatDiopter(odData.cylinder)}</td>
                          <td className="text-center py-3 px-2">{odData.axis || '-'}°</td>
                          <td className="text-center py-3 px-2 bg-blue-50 font-medium">
                            {odSE ? formatDiopter(odSE) : '-'}
                          </td>
                        </>
                      )}
                      {(selectedEye === 'both' || selectedEye === 'OS') && (
                        <>
                          <td className="text-center py-3 px-2">{formatDiopter(osData.sphere)}</td>
                          <td className="text-center py-3 px-2">{formatDiopter(osData.cylinder)}</td>
                          <td className="text-center py-3 px-2">{osData.axis || '-'}°</td>
                          <td className="text-center py-3 px-2 bg-green-50 font-medium">
                            {osSE ? formatDiopter(osSE) : '-'}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Change Summary */}
          {filteredHistory.length >= 2 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-3">Changement depuis la première mesure</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {(selectedEye === 'both' || selectedEye === 'OD') && (
                  <>
                    <div>
                      <span className="text-gray-600">OD Sphère:</span>
                      <p className="font-medium">
                        {(() => {
                          const first = filteredHistory[0].finalRefraction?.OD?.sphere || filteredHistory[0].OD?.sphere;
                          const last = filteredHistory[filteredHistory.length - 1].finalRefraction?.OD?.sphere ||
                                       filteredHistory[filteredHistory.length - 1].OD?.sphere;
                          if (first !== undefined && last !== undefined) {
                            const diff = parseFloat(last) - parseFloat(first);
                            return formatDiopter(diff);
                          }
                          return '-';
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">OD Cylindre:</span>
                      <p className="font-medium">
                        {(() => {
                          const first = filteredHistory[0].finalRefraction?.OD?.cylinder || filteredHistory[0].OD?.cylinder;
                          const last = filteredHistory[filteredHistory.length - 1].finalRefraction?.OD?.cylinder ||
                                       filteredHistory[filteredHistory.length - 1].OD?.cylinder;
                          if (first !== undefined && last !== undefined) {
                            const diff = parseFloat(last || 0) - parseFloat(first || 0);
                            return formatDiopter(diff);
                          }
                          return '-';
                        })()}
                      </p>
                    </div>
                  </>
                )}
                {(selectedEye === 'both' || selectedEye === 'OS') && (
                  <>
                    <div>
                      <span className="text-gray-600">OS Sphère:</span>
                      <p className="font-medium">
                        {(() => {
                          const first = filteredHistory[0].finalRefraction?.OS?.sphere || filteredHistory[0].OS?.sphere;
                          const last = filteredHistory[filteredHistory.length - 1].finalRefraction?.OS?.sphere ||
                                       filteredHistory[filteredHistory.length - 1].OS?.sphere;
                          if (first !== undefined && last !== undefined) {
                            const diff = parseFloat(last) - parseFloat(first);
                            return formatDiopter(diff);
                          }
                          return '-';
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">OS Cylindre:</span>
                      <p className="font-medium">
                        {(() => {
                          const first = filteredHistory[0].finalRefraction?.OS?.cylinder || filteredHistory[0].OS?.cylinder;
                          const last = filteredHistory[filteredHistory.length - 1].finalRefraction?.OS?.cylinder ||
                                       filteredHistory[filteredHistory.length - 1].OS?.cylinder;
                          if (first !== undefined && last !== undefined) {
                            const diff = parseFloat(last || 0) - parseFloat(first || 0);
                            return formatDiopter(diff);
                          }
                          return '-';
                        })()}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
