"""
Test script to run a custom SQL query using the Databricks client.
"""
import os
import sys
import logging
from databricks_client import DatabricksClient
from dotenv import load_dotenv

# Add the current directory to the path to import modules
sys.path.append(os.path.dirname(__file__))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Your custom SQL query
CUSTOM_QUERY = """
WITH
    -- Get a list of active investments only
    ACTIVE_INV_ONLY AS (
        SELECT INV_EXTERNAL_ID
        FROM uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_investments_v
        WHERE INV_ACTIVE = 'Yes'
    )
-- Show key columns from hierarchy table for active investments
SELECT
    hie.HIERARCHY_EXTERNAL_ID,
    hie.HIERARCHY_NAME,
    hie.HIE_INV_TYPE_NAME,
    hie.HIE_INV_EXTERNAL_ID,
    hie.HIE_INV_NAME,
    hie.HIE_INV_PARENT_NAME
FROM
    uc_prod_cgf_mdip_01.poi_edw_business_view.clrty_hierarchies_v hie
INNER JOIN
    ACTIVE_INV_ONLY inv ON hie.HIE_INV_EXTERNAL_ID = inv.INV_EXTERNAL_ID
WHERE
    hie.HIERARCHY_EXTERNAL_ID = 'H-0056'
LIMIT 10;
"""

def main():
    """Run the custom query and display results."""
    try:
        logger.info("Initializing Databricks client...")
        client = DatabricksClient()
        
        logger.info("Executing custom SQL query...")
        results = client.execute_query(CUSTOM_QUERY)
        
        logger.info(f"Query completed successfully! Found {len(results)} rows.")
        
        # Display results
        if results:
            print("\n" + "="*80)
            print("QUERY RESULTS:")
            print("="*80)
            
            for i, row in enumerate(results, 1):
                print(f"\nRow {i}:")
                print("-" * 40)
                for key, value in row.items():
                    print(f"{key}: {value}")
        else:
            print("\nNo results found.")
        
        # Disconnect from Databricks
        client.disconnect()
        
    except Exception as e:
        logger.error(f"Error executing query: {str(e)}")
        print(f"\nError: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
