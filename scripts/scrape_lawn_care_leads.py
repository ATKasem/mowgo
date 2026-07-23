#!/usr/bin/env python3
"""
MowFlow Lead Scraper — Google Maps
Scrapes lawn care businesses from Google Maps in target cities.
Uses Hound (smart_search + smart_fetch) since we don't have Google Maps API key.

Usage: python3 scrape_cleaning_leads.py [city]
Default city: Oklahoma City
"""

import sys
import json
import csv
from datetime import datetime
from pathlib import Path

# Target cities for lead generation
TARGET_CITIES = [
    "Oklahoma City OK",
    "Edmond OK", 
    "Norman OK",
    "Tulsa OK",
    "Dallas TX",
    "Austin TX",
    "Wichita KS",
]

# Search queries to rotate through
SEARCH_QUERIES = [
    "house lawn care service {city}",
    "lawn care {city}",
    "lawn maintenance {city}",
    "residential cleaning {city}",
    "lawn care company {city}",
]

OUTPUT_DIR = Path("/opt/data/mowflow/leads")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def main():
    city = sys.argv[1] if len(sys.argv) > 1 else "Oklahoma City OK"
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    
    print(f"=== MowFlow Lead Scraper ===")
    print(f"Target: {city}")
    print(f"Timestamp: {timestamp}")
    print()
    print("To scrape leads, use Hound smart_search with these queries:")
    print()
    
    for query in SEARCH_QUERIES:
        q = query.format(city=city)
        print(f"  smart_search: \"{q}\"")
    
    print()
    print("Then smart_fetch each business website/Yelp page to extract:")
    print("  - Business name, phone, website")
    print("  - Number of employees (look for 'family owned', 'owner operated', 'team of X')")
    print("  - Do they have online booking? (If no → likely no software)")
    print("  - Any mention of software they use?")
    print()
    print(f"Save results to: {OUTPUT_DIR}/leads_{city.replace(' ', '_').lower()}_{timestamp}.md")

if __name__ == "__main__":
    main()
