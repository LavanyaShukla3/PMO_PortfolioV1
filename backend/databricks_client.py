"""
Databricks SQL connector client for secure database operations.
"""
import os
import logging
from typing import List, Dict, Any, Optional
from databricks import sql
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabricksClient:
    """
    A client for connecting to and querying Databricks SQL warehouses.
    """
    
    def __init__(self):
        """Initialize the Databricks client with environment variables."""
        self.server_hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
        self.http_path = os.getenv('DATABRICKS_HTTP_PATH')
        self.access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')
        
        # Validate required environment variables
        if not all([self.server_hostname, self.http_path, self.access_token]):
            raise ValueError(
                "Missing required Databricks configuration. "
                "Please check DATABRICKS_SERVER_HOSTNAME, DATABRICKS_HTTP_PATH, "
                "and DATABRICKS_ACCESS_TOKEN environment variables."
            )
        
        self.connection = None
    
    def connect(self) -> None:
        """Establish connection to Databricks."""
        try:
            self.connection = sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token,
                _user_agent_entry="PMO-Portfolio/1.0.0"
            )
            logger.info("Successfully connected to Databricks")
        except Exception as e:
            logger.error(f"Failed to connect to Databricks: {str(e)}")
            raise
    
    def disconnect(self) -> None:
        """Close the Databricks connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
            logger.info("Disconnected from Databricks")
    
    def execute_query(self, query: str, timeout: int = 300) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return results as a list of dictionaries.
        
        Args:
            query (str): The SQL query to execute
            timeout (int): Query timeout in seconds (default: 300 = 5 minutes)
            
        Returns:
            List[Dict[str, Any]]: Query results as list of dictionaries
        """
        if not self.connection:
            self.connect()
        
        try:
            cursor = self.connection.cursor()
            
            # Add LIMIT to very long queries if not already present
            if len(query) > 2000 and "LIMIT" not in query.upper():
                logger.warning("Adding LIMIT 1000 to large query to prevent timeout")
                query = query.rstrip(';') + "\nLIMIT 1000;"
            
            logger.info(f"Executing query (length: {len(query)} chars)")
            cursor.execute(query)
            
            # Get column names
            columns = [desc[0] for desc in cursor.description]
            
            # Fetch all results and convert to list of dictionaries
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            cursor.close()
            logger.info(f"Query executed successfully, returned {len(results)} rows")
            return results
            
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            raise
    
    def execute_query_from_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Execute a SQL query from a file.
        
        Args:
            file_path (str): Path to the SQL file
            
        Returns:
            List[Dict[str, Any]]: Query results as list of dictionaries
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                query = file.read()
            
            logger.info(f"Executing query from file: {file_path}")
            return self.execute_query(query)
            
        except FileNotFoundError:
            logger.error(f"SQL file not found: {file_path}")
            raise
        except Exception as e:
            logger.error(f"Error reading SQL file {file_path}: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """
        Test the Databricks connection.
        
        Returns:
            bool: True if connection is successful, False otherwise
        """
        try:
            self.connect()
            # Execute a simple query to test connection
            test_query = "SELECT 1 as test_column"
            result = self.execute_query(test_query)
            
            if result and result[0].get('test_column') == 1:
                logger.info("Databricks connection test successful")
                return True
            else:
                logger.error("Databricks connection test failed - unexpected result")
                return False
                
        except Exception as e:
            logger.error(f"Databricks connection test failed: {str(e)}")
            return False
        finally:
            self.disconnect()


# Global client instance
databricks_client = DatabricksClient()
