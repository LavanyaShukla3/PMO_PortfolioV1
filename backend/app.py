"""
Flask API server for PMO Portfolio application.
Provides endpoints to fetch data from Azure Databricks.
Enhanced with caching and pagination support.
"""
import os
import logging
import json
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


@app.route('/api/hierarchy_data', methods=['GET'])
def get_hierarchy_data():
    """
    Fetch hierarchy data from Databricks.
    Returns the same structure as hierarchyData.json for compatibility.
    """
    try:
        logger.info("Fetching hierarchy data from Databricks...")
        
        # Execute the hierarchy query
        data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} hierarchy records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except FileNotFoundError:
        error_msg = f"Hierarchy query file not found: {HIERARCHY_QUERY_FILE}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500
        
    except Exception as e:
        error_msg = f"Failed to fetch hierarchy data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/investment_data', methods=['GET'])
def get_investment_data():
    """
    Fetch investment/roadmap data from Databricks.
    Returns the same structure as investmentData.json for compatibility.
    """
    try:
        logger.info("Fetching investment data from Databricks...")
        
        # Execute the investment query
        data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except FileNotFoundError:
        error_msg = f"Investment query file not found: {INVESTMENT_QUERY_FILE}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500
        
    except Exception as e:
        error_msg = f"Failed to fetch investment data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/portfolios', methods=['GET'])
def get_portfolios():
    """
    Fetch portfolio hierarchy data from Databricks.
    Filters for COE_ROADMAP_TYPE = 'Portfolio' only.
    """
    try:
        logger.info("Fetching portfolio data from Databricks...")
        
        # Execute the hierarchy query and filter for Portfolio type
        hierarchy_data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        portfolio_data = [item for item in hierarchy_data if item.get('COE_ROADMAP_TYPE') == 'Portfolio']
        
        logger.info(f"Successfully fetched {len(portfolio_data)} portfolio records (filtered from {len(hierarchy_data)} total)")
        
        return jsonify({
            'status': 'success',
            'data': portfolio_data,
            'count': len(portfolio_data),
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch portfolio data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/investments', methods=['GET'])
def get_investments():
    """
    Fetch investment/roadmap data from Databricks.
    Returns all roadmap elements (investments, phases, milestones).
    """
    try:
        logger.info("Fetching investment data from Databricks...")
        
        # Execute the investment query
        data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch investment data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/data/paginated', methods=['GET'])
def get_paginated_data():
    """
    Fetch hierarchy and investment data with pagination and caching.
    This is the optimized endpoint for large datasets.
    """
    try:
        # Get pagination parameters from query string
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        
        logger.info(f"🚀 Fetching paginated data (page={page}, size={page_size}, cache={use_cache})")
        
        # Execute both queries with pagination
        hierarchy_result = databricks_client.execute_paginated_query(
            open(HIERARCHY_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=600  # 10 minutes cache for development
        )
        
        investment_result = databricks_client.execute_paginated_query(
            open(INVESTMENT_QUERY_FILE, 'r').read(),
            page=page,
            page_size=page_size,
            use_cache=use_cache,
            cache_ttl=600
        )
        
        logger.info(f"✅ Successfully fetched paginated data")
        
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
                'cached': use_cache
            }
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch paginated data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


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


@app.route('/api/data', methods=['GET'])
def get_all_data():
    """
    Fetch both hierarchy and investment data in a single request.
    Useful for frontend components that need both datasets.
    Enhanced with caching support.
    """
    try:
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        logger.info(f"Fetching all data from Databricks (cache={use_cache})...")
        
        # Read SQL queries from files
        with open(HIERARCHY_QUERY_FILE, 'r') as f:
            hierarchy_query = f.read()
        with open(INVESTMENT_QUERY_FILE, 'r') as f:
            investment_query = f.read()
        
        # Execute both queries with caching - use unlimited to get all records
        hierarchy_data = databricks_client.execute_query_unlimited(
            hierarchy_query, 
            use_cache=use_cache, 
            cache_ttl=300
        )
        investment_data = databricks_client.execute_query_unlimited(
            investment_query, 
            use_cache=use_cache, 
            cache_ttl=300
        )
        
        logger.info(f"Successfully fetched {len(hierarchy_data)} hierarchy records and {len(investment_data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_data,
                'investment': investment_data
            },
            'counts': {
                'hierarchy': len(hierarchy_data),
                'investment': len(investment_data)
            },
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch all data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


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
