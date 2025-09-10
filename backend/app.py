"""
Flask API server for PMO Portfolio application.
Provides endpoints to fetch data from Azure Databricks.
Enhanced with caching, pagination, and progressive loading support.
"""
import os
import logging
import json
from typing import Dict, Any, Optional
from flask import Flask, jsonify, request
from flask_cors import CORS
from databricks_client import databricks_client
from cache_service import cache_service
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
frontend_urls = [
    os.getenv('FRONTEND_URL', 'http://localhost:3000'),
    'http://localhost:3001'  # Additional port for development
]
CORS(app, origins=frontend_urls)

# SQL query file paths
SQL_QUERIES_DIR = os.path.join(os.path.dirname(__file__), 'sql_queries')
HIERARCHY_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'hierarchy_query.sql')
INVESTMENT_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'investment_query.sql')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'message': 'PMO Portfolio API is running',
        'version': '1.0.0',
        'mode': 'databricks'
    })


@app.route('/api/test-connection', methods=['GET'])
def test_databricks_connection():
    """Test Databricks connection endpoint."""
    
    try:
        is_connected = databricks_client.test_connection()
        
        if is_connected:
            return jsonify({
                'status': 'success',
                'message': 'Databricks connection successful',
                'mode': 'databricks'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Databricks connection failed',
                'mode': 'databricks'
            }), 500
            
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Connection test failed: {str(e)}',
            'mode': 'databricks'
        }), 500


# =============================================================================
# OPTIMIZED PROGRESSIVE LOADING ENDPOINTS
# These endpoints support pagination and secure parameterized queries
# =============================================================================

@app.route('/api/data/portfolio', methods=['GET'])
def get_portfolio_data():
    """Get paginated portfolio-level data with a proper filter for high performance."""
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"Fetching portfolio data - Page: {page}, Limit: {limit}")
        
        # 1. Read the base hierarchy query
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')
        
        # 2. CRITICAL FIX: Add a WHERE clause to only select top-level portfolios.
        # This is the key to making the query fast.
        hierarchy_query += " WHERE COE_ROADMAP_TYPE = 'Portfolio'"

        # 3. Add pagination to the already filtered query
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        # 4. Execute the fast, filtered query. Caching is handled automatically by databricks_client.
        hierarchy_results = databricks_client.execute_query(hierarchy_query)
        
        investment_results = []
        
        # 5. Get ALL investment data (don't filter by portfolio IDs)
        # This matches the approach in apiDataService.js
        if hierarchy_results:
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Execute the full investment query to get all investment records
            # We'll let the frontend do the matching logic (like apiDataService.js does)
            investment_results = databricks_client.execute_query(investment_query)

        # 6. Structure and return the response
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_portfolio_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch portfolio data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/program', methods=['GET'])
def get_program_data():
    """Get paginated program-level data with proper filtering for high performance."""
    try:
        portfolio_id = request.args.get('portfolioId')
        if not portfolio_id:
            return jsonify({
                'status': 'error',
                'message': 'portfolioId parameter is required'
            }), 400
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        logger.info(f"Fetching program data for portfolio: {portfolio_id}, Page: {page}, Limit: {limit}")
        
        # 1. Read the base hierarchy query and filter for programs under this portfolio
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read().strip().rstrip(';')
        
        # 2. Filter for programs under the specific portfolio
        hierarchy_query += " WHERE COE_ROADMAP_PARENT_ID = %(portfolio_id)s AND COE_ROADMAP_TYPE = 'Program'"
        
        # 3. Add pagination
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        
        # 4. Execute the filtered query
        params = {'portfolio_id': portfolio_id}
        hierarchy_results = databricks_client.execute_query(hierarchy_query, parameters=params)
        
        investment_results = []
        program_ids = [record['CHILD_ID'] for record in hierarchy_results]

        # 5. If we found programs, fetch their investment data
        if program_ids:
            with open(INVESTMENT_QUERY_FILE, 'r') as f:
                investment_query = f.read().strip().rstrip(';')

            # Use parameterized queries for security
            id_placeholders = ', '.join(['%(id' + str(i) + ')s' for i in range(len(program_ids))])
            investment_params = {f'id{i}': pid for i, pid in enumerate(program_ids)}
            
            investment_query += f" WHERE INV_EXT_ID IN ({id_placeholders})"
            investment_results = databricks_client.execute_query(investment_query, parameters=investment_params)

        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'portfolio_id': portfolio_id,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks'
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_program_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch program data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/subprogram', methods=['GET'])
def get_subprogram_data():
    """Get paginated subprogram-level data with secure parameterized queries."""
    try:
        program_id = request.args.get('programId')
        if not program_id:
            return jsonify({
                'status': 'error',
                'message': 'programId parameter is required'
            }), 400
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        # Build parameters securely
        params = {
            'program_id': program_id
        }
        
        cache_key = f"subprogram_data_{program_id}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving subprogram data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching subprogram data for program: {program_id}")
        
        # Read and modify SQL queries for subprogram-level data
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Add WHERE clauses securely
        if "WHERE" not in hierarchy_query.upper():
            hierarchy_query += " WHERE COE_ROADMAP_PARENT_ID = %(program_id)s AND COE_ROADMAP_TYPE = 'SubProgram'"
        else:
            hierarchy_query += " AND COE_ROADMAP_PARENT_ID = %(program_id)s AND COE_ROADMAP_TYPE = 'SubProgram'"
        
        if "WHERE" not in investment_query.upper():
            investment_query += " WHERE INV_EXT_ID LIKE CONCAT(%(program_id)s, '%')"
        else:
            investment_query += " AND INV_EXT_ID LIKE CONCAT(%(program_id)s, '%')"
        
        # Add pagination (Databricks/Spark SQL syntax)
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        investment_query += f" ORDER BY INV_EXT_ID LIMIT {limit} OFFSET {offset}"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query, parameters=params)
        investment_results = databricks_client.execute_query(investment_query, parameters=params)
        
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'program_id': program_id,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks',
            'cache_info': {
                'cached': False,
                'cache_key': cache_key
            }
        }
        
        # Cache the response
        cache_service.set(cache_key, response_data, ttl=300)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_subprogram_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch subprogram data: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/data/region', methods=['GET'])
def get_region_data():
    """Get paginated region-filtered data with secure parameterized queries."""
    try:
        region = request.args.get('region')
        if not region:
            return jsonify({
                'status': 'error',
                'message': 'region parameter is required'
            }), 400
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        
        # Build parameters securely
        params = {
            'region': region
        }
        
        cache_key = f"region_data_{region}_p{page}_l{limit}"
        
        # Check cache first
        cached_data = cache_service.get(cache_key)
        if cached_data:
            logger.info(f"Serving region data from cache: {cache_key}")
            return jsonify(cached_data)
        
        logger.info(f"Fetching region data for: {region}")
        
        # Read and modify SQL queries for region-filtered data
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Add WHERE clauses securely (assuming there's a REGION column)
        if "WHERE" not in hierarchy_query.upper():
            hierarchy_query += " WHERE REGION = %(region)s"
        else:
            hierarchy_query += " AND REGION = %(region)s"
        
        if "WHERE" not in investment_query.upper():
            investment_query += " WHERE REGION = %(region)s"
        else:
            investment_query += " AND REGION = %(region)s"
        
        # Add pagination (Databricks/Spark SQL syntax)
        offset = (page - 1) * limit
        hierarchy_query += f" ORDER BY CHILD_ID LIMIT {limit} OFFSET {offset}"
        investment_query += f" ORDER BY INV_EXT_ID LIMIT {limit} OFFSET {offset}"
        
        # Execute queries
        hierarchy_results = databricks_client.execute_query(hierarchy_query, parameters=params)
        investment_results = databricks_client.execute_query(investment_query, parameters=params)
        
        response_data = {
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_results,
                'investment': investment_results,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'region': region,
                    'total_items': len(hierarchy_results),
                    'has_more': len(hierarchy_results) == limit
                }
            },
            'mode': 'databricks',
            'cache_info': {
                'cached': False,
                'cache_key': cache_key
            }
        }
        
        # Cache the response
        cache_service.set(cache_key, response_data, ttl=300)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error in get_region_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to fetch region data: {str(e)}',
            'mode': 'databricks'
        }), 500


# =============================================================================
# LEGACY ENDPOINT (Kept for minimal backward compatibility with limited data)
# =============================================================================

@app.route('/api/data/paginated', methods=['GET'])
def get_paginated_data():
    """
    Legacy paginated endpoint - kept for backward compatibility.
    Limited to small datasets to prevent performance issues.
    """
    try:
        # Get pagination parameters from query string
        page = request.args.get('page', 1, type=int)
        page_size = min(request.args.get('page_size', 25, type=int), 50)  # Cap at 50
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        
        logger.info(f"🚀 Fetching limited paginated data (page={page}, size={page_size}, cache={use_cache})")
        
        # Execute both queries with pagination - using smaller page sizes
        hierarchy_result = databricks_client.execute_paginated_query(
            open(HIERARCHY_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=300  # 5 minutes cache for legacy endpoint
        )
        
        investment_result = databricks_client.execute_paginated_query(
            open(INVESTMENT_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=300
        )
        
        logger.info(f"✅ Successfully fetched limited paginated data")
        
        return jsonify({
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_result,
                'investment': investment_result
            },
            'mode': 'databricks',
            'pagination_info': {
                'page': page,
                'page_size': page_size,
                'cached': use_cache,
                'note': 'Legacy endpoint - use specific endpoints like /api/data/portfolio for better performance'
            }
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch paginated data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


# =============================================================================
# DEPRECATED ENDPOINTS (REMOVED FOR PERFORMANCE)
# =============================================================================
# The following endpoints have been removed because they fetch entire datasets
# and cause 4-7 minute loading times. Use the progressive endpoints above instead:
#
# REMOVED: /api/hierarchy_data - Use /api/data/portfolio, /api/data/program, etc.
# REMOVED: /api/investment_data - Use /api/data/portfolio, /api/data/program, etc.  
# REMOVED: /api/portfolios - Use /api/data/portfolio with pagination
# REMOVED: /api/investments - Use /api/data/portfolio, /api/data/program, etc.
# REMOVED: /api/data - Use specific progressive endpoints based on context
#
# Migration Guide: See PROGRESSIVE_LOADING_MIGRATION_GUIDE.md
# =============================================================================

# =============================================================================
# UTILITY AND CACHE MANAGEMENT ENDPOINTS
# =============================================================================


@app.route('/api/cache/stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics and performance metrics."""
    try:
        stats = cache_service.get_cache_stats()
        return jsonify({
            'status': 'success',
            'cache_stats': stats,
            'mode': 'databricks'
        })
    except Exception as e:
        error_msg = f"Failed to get cache stats: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """Clear cache entries."""
    try:
        pattern = request.json.get('pattern') if request.json else None
        success = cache_service.clear_cache(pattern)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Cache cleared successfully',
                'mode': 'databricks'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to clear cache'
            }), 500
            
    except Exception as e:
        error_msg = f"Failed to clear cache: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


# =============================================================================
# ERROR HANDLERS
# =============================================================================


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Validate environment variables on startup
    required_env_vars = [
        'DATABRICKS_SERVER_HOSTNAME',
        'DATABRICKS_HTTP_PATH', 
        'DATABRICKS_ACCESS_TOKEN'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please check your .env file and ensure all required variables are set.")
        exit(1)
    
    # Check if SQL query files exist
    if not os.path.exists(HIERARCHY_QUERY_FILE):
        logger.error(f"Hierarchy query file not found: {HIERARCHY_QUERY_FILE}")
        exit(1)
    
    if not os.path.exists(INVESTMENT_QUERY_FILE):
        logger.error(f"Investment query file not found: {INVESTMENT_QUERY_FILE}")
        exit(1)
    
    # Start the Flask server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting PMO Portfolio API server on port {port}")
    logger.info(f"CORS enabled for: {', '.join(frontend_urls)}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
