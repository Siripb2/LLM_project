import argparse
import sys
import os
from dotenv import load_dotenv

from analyzer import analyze_log

def main():
    # Load environment variables from .env file if present
    load_dotenv()

    parser = argparse.ArgumentParser(description="LLM-Powered DevOps Assistant for CI/CD Automation")
    parser.add_argument("log_file", help="Path to the Jenkins build log file to analyze")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.log_file):
        print(f"Error: Log file {args.log_file} does not exist.", file=sys.stderr)
        sys.exit(1)
        
    print(f"Reading {args.log_file}...")
    with open(args.log_file, "r", encoding="utf-8", errors="replace") as f:
        log_content = f.read()
        
    if not log_content.strip():
        print("Error: The log file is empty.", file=sys.stderr)
        sys.exit(1)
        
    print("Analyzing log using Gemini API... (this may take a few seconds)")
    analysis_result = analyze_log(log_content)
    
    print("\n" + "="*50)
    print(" LLM DEVOPS ASSISTANT ANALYSIS ")
    print("="*50 + "\n")
    print(analysis_result)
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    main()
