"""
Data migration script to help transition from JSON files to Databricks
This script can help you understand the data structure and prepare for migration
"""

import json
import os
import sys
from pathlib import Path

def analyze_json_structure(file_path):
    """Analyze the structure of a JSON file"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        if isinstance(data, list) and len(data) > 0:
            # Analyze first record to understand structure
            sample_record = data[0]
            columns = list(sample_record.keys())
            
            print(f"\n📄 {os.path.basename(file_path)}")
            print(f"   Records: {len(data)}")
            print(f"   Columns: {len(columns)}")
            print("   Structure:")
            
            for col in columns:
                sample_value = sample_record[col]
                value_type = type(sample_value).__name__
                print(f"     - {col}: {value_type}")
            
            return {
                'file': file_path,
                'records': len(data),
                'columns': columns,
                'sample': sample_record
            }
    
    except Exception as e:
        print(f"❌ Error analyzing {file_path}: {str(e)}")
        return None

def generate_sql_schema(analysis_results):
    """Generate SQL CREATE TABLE statements based on JSON analysis"""
    
    print("\n🏗️  Suggested SQL Schema for Databricks:")
    print("=" * 60)
    
    for result in analysis_results:
        if not result:
            continue
            
        table_name = os.path.basename(result['file']).replace('.json', '').lower()
        
        print(f"\n-- {table_name} table")
        print(f"CREATE TABLE {table_name} (")
        
        columns = []
        for col in result['columns']:
            # Determine SQL type based on sample data
            sample_value = result['sample'][col]
            
            if isinstance(sample_value, str):
                sql_type = "STRING"
            elif isinstance(sample_value, int):
                sql_type = "INT"
            elif isinstance(sample_value, float):
                sql_type = "DOUBLE"
            elif isinstance(sample_value, bool):
                sql_type = "BOOLEAN"
            else:
                sql_type = "STRING"  # Default to STRING
            
            columns.append(f"    {col} {sql_type}")
        
        print(",\n".join(columns))
        print(");")

def main():
    """Main function to analyze JSON files and suggest migration strategy"""
    
    print("🔄 PMO Portfolio Data Migration Helper")
    print("=" * 50)
    
    # Look for JSON files in the services directory
    json_files = [
        "../src/services/portfolioData.json",
        "../src/services/ProgramData.json", 
        "../src/services/SubProgramData.json",
        "../src/services/investmentData.json"
    ]
    
    analysis_results = []
    
    print("📊 Analyzing existing JSON data structure...")
    
    for json_file in json_files:
        if os.path.exists(json_file):
            result = analyze_json_structure(json_file)
            if result:
                analysis_results.append(result)
        else:
            print(f"⚠️  File not found: {json_file}")
    
    if analysis_results:
        generate_sql_schema(analysis_results)
        
        print("\n📋 Next Steps:")
        print("1. Create tables in your Databricks workspace using the SQL above")
        print("2. Load your JSON data into these tables")
        print("3. Update your .env file with Databricks credentials")
        print("4. Run test_connection.py to verify connectivity")
        print("5. Update your frontend to use the new API endpoints")
        
        print("\n💡 Tips:")
        print("- You can use Databricks File Upload or COPY INTO commands")
        print("- Consider adding indexes on frequently queried columns")
        print("- Set up scheduled jobs to refresh data if needed")
    
    else:
        print("❌ No JSON files found to analyze")

if __name__ == "__main__":
    main()
