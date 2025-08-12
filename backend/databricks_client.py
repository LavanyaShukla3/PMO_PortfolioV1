"""
Azure Databricks Client for PMO Portfolio
Handles all database connections and queries
"""

import os
import logging
from typing import List, Dict, Any, Optional
from databricks import sql
import pandas as pd
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class DatabricksClient:
    """Client for connecting to Azure Databricks"""
    
    def __init__(self):
        self.server_hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
        self.http_path = os.getenv('DATABRICKS_HTTP_PATH')
        self.access_token = os.getenv('DATABRICKS_ACCESS_TOKEN')
        self.catalog = os.getenv('DATABRICKS_CATALOG', 'main')
        self.schema = os.getenv('DATABRICKS_SCHEMA', 'pmo_portfolio')
        
        # Validate configuration
        if not all([self.server_hostname, self.http_path, self.access_token]):
            raise ValueError("Missing required Databricks configuration")
    
    def get_connection(self):
        """Create a connection to Databricks"""
        try:
            connection = sql.connect(
                server_hostname=self.server_hostname,
                http_path=self.http_path,
                access_token=self.access_token
            )
            return connection
        except Exception as e:
            logger.error(f"Failed to connect to Databricks: {str(e)}")
            raise
    
    def execute_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results as list of dictionaries"""
        try:
            with self.get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query)
                    
                    # Get column names
                    columns = [desc[0] for desc in cursor.description]
                    
                    # Fetch all rows and convert to list of dictionaries
                    rows = cursor.fetchall()
                    results = [dict(zip(columns, row)) for row in rows]
                    
                    logger.info(f"Query executed successfully, returned {len(results)} rows")
                    return results
                    
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            raise
    
    def get_portfolio_data(self) -> List[Dict[str, Any]]:
        """Get portfolio data from Databricks"""
        query = f"""
        SELECT 
            HIERARCHY_EXTERNAL_ID,
            HIERARCHY_NAME,
            COE_ROADMAP_TYPE,
            COE_ROADMAP_PARENT_ID,
            COE_ROADMAP_PARENT_NAME,
            COE_ROADMAP_PARENT_CLRTY_TYPE,
            CHILD_ID,
            CHILD_NAME,
            CLRTY_CHILD_TYPE,
            If_parent_exist
        FROM {self.catalog}.{self.schema}.portfolio_data
        ORDER BY COE_ROADMAP_PARENT_NAME, CHILD_NAME
        """
        return self.execute_query(query)
    
    def get_program_data(self) -> List[Dict[str, Any]]:
        """Get program data from Databricks"""
        query = f"""
        SELECT 
            HIERARCHY_EXTERNAL_ID,
            HIERARCHY_NAME,
            COE_ROADMAP_TYPE,
            COE_ROADMAP_PARENT_ID,
            COE_ROADMAP_PARENT_NAME,
            COE_ROADMAP_PARENT_CLRTY_TYPE,
            CHILD_ID,
            CHILD_NAME,
            CLRTY_CHILD_TYPE,
            ROADMAP_OWNER
        FROM {self.catalog}.{self.schema}.program_data
        ORDER BY COE_ROADMAP_PARENT_NAME, CHILD_NAME
        """
        return self.execute_query(query)
    
    def get_subprogram_data(self) -> List[Dict[str, Any]]:
        """Get sub-program data from Databricks"""
        query = f"""
        SELECT 
            HIERARCHY_EXTERNAL_ID,
            HIERARCHY_NAME,
            COE_ROADMAP_TYPE,
            COE_ROADMAP_PARENT_ID,
            COE_ROADMAP_PARENT_NAME,
            COE_ROADMAP_PARENT_CLRTY_TYPE,
            CHILD_ID,
            CHILD_NAME,
            CLRTY_CHILD_TYPE,
            ROADMAP_OWNER
        FROM {self.catalog}.{self.schema}.subprogram_data
        ORDER BY COE_ROADMAP_PARENT_NAME, CHILD_NAME
        """
        return self.execute_query(query)
    
    def get_investment_data(self) -> List[Dict[str, Any]]:
        """Get investment data from Databricks"""
        query = f"""
        SELECT 
            INV_EXT_ID,
            INVESTMENT_NAME,
            ROADMAP_ELEMENT,
            TASK_NAME,
            TASK_START,
            TASK_FINISH,
            MILESTONE_STATUS,
            INV_OVERALL_STATUS,
            INV_FUNCTION,
            INV_MARKET,
            INV_TIER,
            SortOrder
        FROM {self.catalog}.{self.schema}.investment_data
        ORDER BY INV_EXT_ID, ROADMAP_ELEMENT, TASK_START
        """
        return self.execute_query(query)
    
    def get_filtered_data(self, table_name: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get filtered data from a specific table"""
        base_query = f"SELECT * FROM {self.catalog}.{self.schema}.{table_name}"
        
        if filters:
            where_conditions = []
            for key, value in filters.items():
                if isinstance(value, str):
                    where_conditions.append(f"{key} = '{value}'")
                else:
                    where_conditions.append(f"{key} = {value}")
            
            if where_conditions:
                base_query += " WHERE " + " AND ".join(where_conditions)
        
        return self.execute_query(base_query)
    
    def test_connection(self) -> bool:
        """Test the Databricks connection"""
        try:
            test_query = "SELECT 1 as test"
            result = self.execute_query(test_query)
            return len(result) == 1 and result[0]['test'] == 1
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            return False
