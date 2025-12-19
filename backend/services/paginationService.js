/**
 * Pagination Service
 *
 * Provides reusable pagination helpers for all collections to prevent
 * loading entire datasets at once, which causes browser crashes.
 *
 * Supports two pagination strategies:
 * 1. Cursor-based pagination (recommended for real-time data)
 * 2. Offset-based pagination (simpler, but less efficient for large datasets)
 */

const CONSTANTS = require('../config/constants');

/**
 * Cursor-based pagination (recommended for real-time data)
 *
 * More efficient than offset pagination for large datasets because it uses
 * indexed fields for navigation instead of counting/skipping documents.
 *
 * @param {Model} model - Mongoose model to paginate
 * @param {Object} options - Pagination options
 * @param {Object} options.filter - Query filter (e.g., { status: 'active' })
 * @param {String} options.cursorField - Field to use as cursor (default: '_id')
 * @param {String} options.cursor - Cursor value from previous page
 * @param {Number} options.limit - Results per page (default: 20, max: 100)
 * @param {String} options.sortDirection - 'asc' or 'desc' (default: 'desc')
 * @param {Object} options.populate - Mongoose populate options
 * @param {Object} options.select - Fields to select/exclude
 * @returns {Promise<Object>} { data, pagination: { nextCursor, hasMore, count } }
 */
async function paginateCursor(model, options = {}) {
  const {
    filter = {},
    cursorField = '_id',
    cursor = null,
    limit = CONSTANTS.PAGINATION.DEFAULT_PAGE_SIZE,
    sortDirection = 'desc',
    populate = null,
    select = null
  } = options;

  // Enforce max page size
  const safeLimit = Math.min(limit, CONSTANTS.PAGINATION.MAX_PAGE_SIZE);

  // Build query
  const query = { ...filter };

  // Add cursor condition if provided
  if (cursor) {
    const cursorOperator = sortDirection === 'desc' ? '$lt' : '$gt';
    query[cursorField] = { [cursorOperator]: cursor };
  }

  // Build Mongoose query
  let mongooseQuery = model.find(query);

  // Apply sorting
  const sortOrder = sortDirection === 'desc' ? -1 : 1;
  mongooseQuery = mongooseQuery.sort({ [cursorField]: sortOrder });

  // Apply limit (+1 to check if there are more results)
  mongooseQuery = mongooseQuery.limit(safeLimit + 1);

  // Apply field selection
  if (select) {
    mongooseQuery = mongooseQuery.select(select);
  }

  // Apply population
  if (populate) {
    mongooseQuery = mongooseQuery.populate(populate);
  }

  // Execute query
  const results = await mongooseQuery.lean();

  // Check if there are more results
  const hasMore = results.length > safeLimit;

  // Remove the extra result if present
  if (hasMore) {
    results.pop();
  }

  // Get next cursor
  const nextCursor = hasMore && results.length > 0
    ? results[results.length - 1][cursorField]
    : null;

  return {
    data: results,
    pagination: {
      nextCursor,
      hasMore,
      count: results.length,
      limit: safeLimit
    }
  };
}

/**
 * Offset-based pagination with total count
 *
 * Simpler than cursor pagination but less efficient for large datasets.
 * Use this when you need total counts or page numbers.
 *
 * @param {Model} model - Mongoose model to paginate
 * @param {Object} options - Pagination options
 * @param {Object} options.filter - Query filter
 * @param {Number} options.page - Page number (1-based, default: 1)
 * @param {Number} options.limit - Results per page (default: 20, max: 100)
 * @param {Object} options.sort - Sort object (e.g., { createdAt: -1 })
 * @param {Object} options.populate - Mongoose populate options
 * @param {Object} options.select - Fields to select/exclude
 * @param {Boolean} options.lean - Use lean() for better performance (default: true)
 * @returns {Promise<Object>} { data, pagination: { page, limit, total, pages, hasNext, hasPrev } }
 */
async function paginateOffset(model, options = {}) {
  const {
    filter = {},
    page = 1,
    limit = CONSTANTS.PAGINATION.DEFAULT_PAGE_SIZE,
    sort = { createdAt: -1 },
    populate = null,
    select = null,
    lean = true
  } = options;

  // Validate and enforce limits
  const safePage = Math.max(1, parseInt(page));
  const safeLimit = Math.min(
    Math.max(CONSTANTS.PAGINATION.MIN_PAGE_SIZE, parseInt(limit)),
    CONSTANTS.PAGINATION.MAX_PAGE_SIZE
  );

  // Calculate skip
  const skip = (safePage - 1) * safeLimit;

  // Execute query and count in parallel for better performance
  const [results, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .select(select)
      .populate(populate || [])
      .lean(lean),
    model.countDocuments(filter)
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / safeLimit);
  const hasNext = safePage < totalPages;
  const hasPrev = safePage > 1;

  return {
    data: results,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: totalPages,
      hasNext,
      hasPrev,
      count: results.length
    }
  };
}

/**
 * Paginate search results with text search scoring
 *
 * Special pagination for text search results that includes relevance scoring.
 *
 * @param {Model} model - Mongoose model to search
 * @param {Object} options - Search and pagination options
 * @param {String} options.searchText - Text to search for
 * @param {Object} options.filter - Additional query filters
 * @param {Number} options.page - Page number (default: 1)
 * @param {Number} options.limit - Results per page (default: 20, max: 50)
 * @param {Object} options.populate - Mongoose populate options
 * @returns {Promise<Object>} { data, pagination }
 */
async function paginateSearch(model, options = {}) {
  const {
    searchText,
    filter = {},
    page = 1,
    limit = CONSTANTS.PAGINATION.DEFAULT_PAGE_SIZE,
    populate = null
  } = options;

  if (!searchText) {
    throw new Error('searchText is required for search pagination');
  }

  // Enforce search result limit
  const safeLimit = Math.min(limit, CONSTANTS.PAGINATION.SEARCH_RESULTS_LIMIT);
  const safePage = Math.max(1, parseInt(page));
  const skip = (safePage - 1) * safeLimit;

  // Build text search query
  const searchQuery = {
    ...filter,
    $text: { $search: searchText }
  };

  // Execute search with scoring
  const [results, total] = await Promise.all([
    model
      .find(searchQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(safeLimit)
      .populate(populate || [])
      .lean(),
    model.countDocuments(searchQuery)
  ]);

  const totalPages = Math.ceil(total / safeLimit);

  return {
    data: results,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
      count: results.length
    }
  };
}

/**
 * Autocomplete pagination (limited results for typeahead)
 *
 * @param {Model} model - Mongoose model to search
 * @param {Object} options - Autocomplete options
 * @param {Object} options.filter - Query filter with regex
 * @param {Number} options.limit - Max results (default: 10)
 * @param {Object} options.select - Fields to return
 * @returns {Promise<Array>} Array of matching documents
 */
async function paginateAutocomplete(model, options = {}) {
  const {
    filter = {},
    limit = CONSTANTS.PAGINATION.AUTOCOMPLETE_RESULTS_LIMIT,
    select = null
  } = options;

  const results = await model
    .find(filter)
    .limit(limit)
    .select(select)
    .lean();

  return results;
}

/**
 * Helper to extract pagination params from Express request query
 *
 * @param {Object} query - Express req.query object
 * @param {String} defaultSort - Default sort field (default: 'createdAt')
 * @returns {Object} Pagination parameters
 */
function getPaginationParams(query, defaultSort = 'createdAt') {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || CONSTANTS.PAGINATION.DEFAULT_PAGE_SIZE;
  const sortField = query.sortBy || defaultSort;
  const sortOrder = query.order === 'asc' ? 1 : -1;
  const cursor = query.cursor || null;

  return {
    page,
    limit,
    sort: { [sortField]: sortOrder },
    cursor
  };
}

/**
 * Helper to build pagination response metadata for API responses
 *
 * @param {Object} pagination - Pagination object from paginate functions
 * @param {Object} req - Express request object
 * @returns {Object} Enhanced pagination metadata with links
 */
function buildPaginationLinks(pagination, req) {
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const queryParams = { ...req.query };

  const links = {};

  // Build next link
  if (pagination.hasNext) {
    if (pagination.nextCursor) {
      // Cursor-based
      queryParams.cursor = pagination.nextCursor;
      links.next = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    } else if (pagination.page) {
      // Offset-based
      queryParams.page = pagination.page + 1;
      links.next = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
    }
  }

  // Build previous link (offset-based only)
  if (pagination.hasPrev && pagination.page) {
    queryParams.page = pagination.page - 1;
    links.prev = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
  }

  // Build first and last links (offset-based only)
  if (pagination.pages) {
    queryParams.page = 1;
    links.first = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;

    queryParams.page = pagination.pages;
    links.last = `${baseUrl}?${new URLSearchParams(queryParams).toString()}`;
  }

  return {
    ...pagination,
    links
  };
}

module.exports = {
  paginateCursor,
  paginateOffset,
  paginateSearch,
  paginateAutocomplete,
  getPaginationParams,
  buildPaginationLinks
};
