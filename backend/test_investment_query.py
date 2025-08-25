"""
Test script to run the investment SQL query from the file using the Databricks client.
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
    """Run the investment query from file and display results."""
    try:
        logger.info("Initializing Databricks client...")
        client = DatabricksClient()
        
        # Path to the investment query file
        investment_query_file = os.path.join(os.path.dirname(__file__), 'sql_queries', 'investment_query.sql')
        
        logger.info(f"Loading query from file: {investment_query_file}")
        
        # Check if file exists
        if not os.path.exists(investment_query_file):
            logger.error(f"Query file not found: {investment_query_file}")
            return 1
        
        logger.info("Executing investment query from file...")
        results = client.execute_query_from_file(investment_query_file)
        
        logger.info(f"Query completed successfully! Found {len(results)} rows.")
        
        # Display results
        if results:
            print("\n" + "="*80)
            print("INVESTMENT QUERY RESULTS:")
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
            # Count by roadmap element if available
            roadmap_elements = {}
            investment_types = {}
            investment_status = {}
            
            for row in results:
                # Count ROADMAP_ELEMENT
                element = row.get('ROADMAP_ELEMENT', 'Unknown')
                roadmap_elements[element] = roadmap_elements.get(element, 0) + 1
                
                # Count CLRTY_INV_TYPE
                inv_type = row.get('CLRTY_INV_TYPE', 'Unknown')
                investment_types[inv_type] = investment_types.get(inv_type, 0) + 1
                
                # Count INV_OVERALL_STATUS
                status = row.get('INV_OVERALL_STATUS', 'Unknown')
                investment_status[status] = investment_status.get(status, 0) + 1
            
            if roadmap_elements:
                print("\nBreakdown by ROADMAP_ELEMENT:")
                for element, count in roadmap_elements.items():
                    print(f"  {element}: {count}")
            
            if investment_types:
                print("\nBreakdown by CLRTY_INV_TYPE:")
                for inv_type, count in investment_types.items():
                    print(f"  {inv_type}: {count}")
            
            if investment_status:
                print("\nBreakdown by INV_OVERALL_STATUS:")
                for status, count in investment_status.items():
                    print(f"  {status}: {count}")
        
        # Disconnect from Databricks
        client.disconnect()
        
    except FileNotFoundError as e:
        logger.error(f"File not found: {str(e)}")
        print(f"\nError: File not found - {str(e)}")
        return 1
        
    except Exception as e:
        logger.error(f"Error executing investment query: {str(e)}")
        print(f"\nError: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
