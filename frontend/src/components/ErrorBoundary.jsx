import { Component } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import logger from '../services/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Check if this is a React hooks/HMR error
    const isHMRError = error?.message?.includes('useContext') ||
                       error?.message?.includes('useState') ||
                       error?.message?.includes('useEffect') ||
                       error?.message?.includes('reading \'use');

    this.setState({
      error,
      errorInfo,
      isHMRError
    });

    // Send error to Sentry via logger (PHI is automatically scrubbed)
    // Only include safe, non-PHI context
    const safeContext = {
      componentStack: errorInfo?.componentStack?.substring(0, 500), // Limit stack size
      location: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      isHMRError,
      errorBoundaryName: this.props.name || 'default'
    };

    logger.captureException(error, safeContext);

    // Add breadcrumb for error tracking
    logger.addBreadcrumb('error', 'Error boundary triggered', {
      errorMessage: error?.message?.substring(0, 100), // Truncate message
      isHMRError
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isHMRError: false
    });
  };

  handleHardRefresh = () => {
    // Clear cache and do a hard refresh
    window.location.reload(true);
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {this.state.isHMRError ? 'Erreur de chargement de module' : 'Oups ! Une erreur est survenue'}
            </h1>

            <p className="text-gray-600 text-center mb-6">
              {this.state.isHMRError
                ? 'Un module n\'a pas pu se charger correctement. Un rafraîchissement de page résout généralement ce problème.'
                : 'Ne vous inquiétez pas, vos données sont en sécurité. L\'application a rencontré une erreur inattendue.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-red-800 mb-2">Détails de l'erreur :</p>
                <p className="text-xs text-red-700 font-mono break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-700 cursor-pointer">Trace d'exécution</summary>
                    <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-48">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {this.state.isHMRError && (
                <button
                  onClick={this.handleHardRefresh}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Rafraîchir la page
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Accueil
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-6">
              Si ce problème persiste, veuillez contacter le support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
