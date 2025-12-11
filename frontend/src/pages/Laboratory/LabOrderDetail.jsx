import { memo } from 'react';
import PropTypes from 'prop-types';
import {
  X, User, Download, Calendar,
  ArrowUp, ArrowDown, AlertTriangle
} from 'lucide-react';

/**
 * LabOrderDetail - Displays detailed view of lab order with results
 * Used in modal to show completed test results
 */
const LabOrderDetail = memo(function LabOrderDetail({
  order,
  onClose,
  onPrintResults,
  formatDate
}) {
  const getAbnormalFlag = (flag) => {
    if (!flag || flag === 'normal') return null;

    if (flag === 'high' || flag === 'critical_high') {
      return (
        <ArrowUp className={`h-4 w-4 ${flag.includes('critical') ? 'text-red-600' : 'text-orange-500'}`} />
      );
    }
    if (flag === 'low' || flag === 'critical_low') {
      return (
        <ArrowDown className={`h-4 w-4 ${flag.includes('critical') ? 'text-red-600' : 'text-orange-500'}`} />
      );
    }
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Résultats du Test</h2>
            <p className="text-sm text-gray-500 mt-1">
              {order.test?.testName || 'Test'} - {order.patient?.firstName} {order.patient?.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Patient Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Patient:</span>
                <p className="font-medium">
                  {order.patient?.firstName} {order.patient?.lastName}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Complété:</span>
                <p className="font-medium">{formatDate(order.test?.completedAt)}</p>
              </div>
              {order.test?.specimenQuality && (
                <div>
                  <span className="text-gray-500">Qualité spécimen:</span>
                  <p className="font-medium capitalize">{order.test.specimenQuality}</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Result (Single Value Test) */}
          {order.test?.results !== undefined && (
            <div
              className={`rounded-lg p-4 mb-4 ${
                order.test?.isCritical
                  ? 'bg-red-50 border border-red-200'
                  : order.test?.isAbnormal
                  ? 'bg-orange-50 border border-orange-200'
                  : 'bg-green-50 border border-green-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{order.test?.testName}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-bold">
                      {order.test?.results} {order.test?.unit || ''}
                    </span>
                    {getAbnormalFlag(order.test?.abnormalFlag)}
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>Réf: {order.test?.referenceRange || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Component Results (Multi-Component Test) */}
          {order.test?.componentResults?.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-3">Résultats détaillés</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Test
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Résultat
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Unité
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Valeurs de Réf.
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.test.componentResults.map((comp, index) => (
                      <tr
                        key={index}
                        className={
                          comp.abnormalFlag?.includes('critical')
                            ? 'bg-red-50'
                            : comp.isAbnormal
                            ? 'bg-orange-50'
                            : ''
                        }
                      >
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {comp.name}
                        </td>
                        <td
                          className={`px-4 py-2 text-sm font-semibold ${
                            comp.abnormalFlag?.includes('critical')
                              ? 'text-red-700'
                              : comp.isAbnormal
                              ? 'text-orange-700'
                              : 'text-gray-900'
                          }`}
                        >
                          {comp.value}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{comp.unit || ''}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {comp.referenceRangeText ||
                            comp.referenceRange?.text ||
                            (comp.referenceRange?.min !== undefined &&
                            comp.referenceRange?.max !== undefined
                              ? `${comp.referenceRange.min} - ${comp.referenceRange.max}`
                              : '-')}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            {getAbnormalFlag(comp.abnormalFlag)}
                            {comp.abnormalFlag && comp.abnormalFlag !== 'normal' && (
                              <span
                                className={`text-xs ${
                                  comp.abnormalFlag?.includes('critical')
                                    ? 'text-red-600 font-bold'
                                    : comp.abnormalFlag === 'high'
                                    ? 'text-orange-600'
                                    : comp.abnormalFlag === 'low'
                                    ? 'text-blue-600'
                                    : ''
                                }`}
                              >
                                {comp.abnormalFlag === 'critical_high'
                                  ? 'CRITIQUE ↑'
                                  : comp.abnormalFlag === 'critical_low'
                                  ? 'CRITIQUE ↓'
                                  : comp.abnormalFlag === 'high'
                                  ? 'Élevé'
                                  : comp.abnormalFlag === 'low'
                                  ? 'Bas'
                                  : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.test?.notes && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-sm text-gray-600">{order.test.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={() =>
                onPrintResults({
                  visitId: order.test?.visitId || order.visitId
                })
              }
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button onClick={onClose} className="btn btn-primary">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

LabOrderDetail.propTypes = {
  order: PropTypes.shape({
    test: PropTypes.shape({
      testName: PropTypes.string,
      results: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      unit: PropTypes.string,
      referenceRange: PropTypes.string,
      abnormalFlag: PropTypes.string,
      isCritical: PropTypes.bool,
      isAbnormal: PropTypes.bool,
      completedAt: PropTypes.string,
      specimenQuality: PropTypes.string,
      notes: PropTypes.string,
      visitId: PropTypes.string,
      componentResults: PropTypes.array
    }),
    patient: PropTypes.shape({
      firstName: PropTypes.string,
      lastName: PropTypes.string
    }),
    visitId: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  onPrintResults: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired
};

export default LabOrderDetail;
