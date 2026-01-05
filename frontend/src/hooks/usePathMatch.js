import { useLocation } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook for matching URL paths with query parameters
 *
 * Unlike simple location.pathname comparisons, this hook properly handles
 * URLs with query parameters (e.g., /multi-clinic?tab=dashboard)
 *
 * @returns {Object} Object containing path matching utilities
 */
export default function usePathMatch() {
  const location = useLocation();

  /**
   * Check if a menu path is active (handles query params)
   * @param {string} menuPath - The path to check (can include query params)
   * @returns {boolean} True if the path is active
   */
  const isPathActive = useCallback((menuPath) => {
    if (!menuPath) return false;

    // Parse the menu path to extract pathname and search params
    const [menuPathname, menuSearch] = menuPath.split('?');

    // First check: pathname must match
    if (location.pathname !== menuPathname) return false;

    // If menu path has no query params, pathname match is enough
    if (!menuSearch) return true;

    // If menu path has query params, check if they're present in current location
    const menuParams = new URLSearchParams(menuSearch);
    const currentParams = new URLSearchParams(location.search);

    // Check if all menu params are present in current URL
    for (const [key, value] of menuParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  }, [location.pathname, location.search]);

  /**
   * Check if any path in an array is active
   * @param {string[]} paths - Array of paths to check
   * @returns {boolean} True if any path is active
   */
  const isAnyPathActive = useCallback((paths) => {
    if (!paths || !Array.isArray(paths)) return false;
    return paths.some(path => isPathActive(path));
  }, [isPathActive]);

  /**
   * Get the base pathname without query params
   * @param {string} path - The full path (may include query params)
   * @returns {string} The pathname portion only
   */
  const getPathname = useCallback((path) => {
    if (!path) return '';
    return path.split('?')[0];
  }, []);

  return {
    isPathActive,
    isAnyPathActive,
    getPathname,
    currentPathname: location.pathname,
    currentSearch: location.search
  };
}
