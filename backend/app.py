"""
Flask API server for PMO Portfolio application.
Provides endpoints to fetch data from Azure Databricks.
"""
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from databricks_client import databricks_client
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
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[frontend_url])

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
        'version': '1.0.0'
    })


@app.route('/api/test-connection', methods=['GET'])
def test_databricks_connection():
    """Test Databricks connection endpoint."""
    try:
        is_connected = databricks_client.test_connection()
        
        if is_connected:
            return jsonify({
                'status': 'success',
                'message': 'Databricks connection successful'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Databricks connection failed'
            }), 500
            
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Connection test failed: {str(e)}'
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
            'count': len(data)
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
            'count': len(data)
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


@app.route('/api/data', methods=['GET'])
def get_all_data():
    """
    Fetch both hierarchy and investment data in a single request.
    Useful for frontend components that need both datasets.
    """
    try:
        logger.info("Fetching all data from Databricks...")
        
        # Execute both queries
        hierarchy_data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        investment_data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
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
            }
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
    logger.info(f"CORS enabled for: {frontend_url}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
