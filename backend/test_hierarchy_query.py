"""
Test script to run the hierarchy SQL query from the file using the Databricks client.
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

def main():
    """Run the hierarchy query from file and display results."""
    try:
        logger.info("Initializing Databricks client...")
        client = DatabricksClient()
        
        # Path to the hierarchy query file
        hierarchy_query_file = os.path.join(os.path.dirname(__file__), 'sql_queries', 'hierarchy_query.sql')
        
        logger.info(f"Loading query from file: {hierarchy_query_file}")
        
        # Check if file exists
        if not os.path.exists(hierarchy_query_file):
            logger.error(f"Query file not found: {hierarchy_query_file}")
            return 1
        
        logger.info("Executing hierarchy query from file...")
        results = client.execute_query_from_file(hierarchy_query_file)
        
        logger.info(f"Query completed successfully! Found {len(results)} rows.")
        
        # Display results
        if results:
            print("\n" + "="*80)
            print("HIERARCHY QUERY RESULTS:")
            print("="*80)
            
            # Print column headers
            if len(results) > 0:
                headers = list(results[0].keys())
                print("\nColumns:", ", ".join(headers))
                print("-" * 80)
            
            for i, row in enumerate(results, 1):
                print(f"\nRow {i}:")
                print("-" * 40)
                for key, value in row.items():
                    # Truncate long values for readability
                    display_value = str(value)[:100] + "..." if len(str(value)) > 100 else value
                    print(f"{key}: {display_value}")
                
                # Only show first 5 rows to avoid overwhelming output
                if i >= 5:
                    remaining = len(results) - i
                    if remaining > 0:
                        print(f"\n... and {remaining} more rows")
                    break
        else:
            print("\nNo results found.")
        
        # Show summary statistics
        print(f"\n{'='*80}")
        print("SUMMARY:")
        print(f"{'='*80}")
        print(f"Total rows returned: {len(results)}")
        
        if results:
            # Count by roadmap type if available
            roadmap_types = {}
            child_types = {}
            
            for row in results:
                # Count COE_ROADMAP_TYPE
                roadmap_type = row.get('COE_ROADMAP_TYPE', 'Unknown')
                roadmap_types[roadmap_type] = roadmap_types.get(roadmap_type, 0) + 1
                
                # Count CLRTY_CHILD_TYPE
                child_type = row.get('CLRTY_CHILD_TYPE', 'Unknown')
                child_types[child_type] = child_types.get(child_type, 0) + 1
            
            if roadmap_types:
                print("\nBreakdown by COE_ROADMAP_TYPE:")
                for rtype, count in roadmap_types.items():
                    print(f"  {rtype}: {count}")
            
            if child_types:
                print("\nBreakdown by CLRTY_CHILD_TYPE:")
                for ctype, count in child_types.items():
                    print(f"  {ctype}: {count}")
        
        # Disconnect from Databricks
        client.disconnect()
        
    except FileNotFoundError as e:
        logger.error(f"File not found: {str(e)}")
        print(f"\nError: File not found - {str(e)}")
        return 1
        
    except Exception as e:
        logger.error(f"Error executing hierarchy query: {str(e)}")
        print(f"\nError: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
