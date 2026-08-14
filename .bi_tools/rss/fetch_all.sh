#!/bin/bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
ACCEPT="application/rss+xml, application/xml;q=0.9, */*;q=0.8"
for sub in LawnCarePros lawncare smallbusiness landscaping sweatystartup Entrepreneur; do
  code=$(curl -s -o "/opt/data/mowgo/.tmp_rss/$sub.xml" -w "%{http_code}" -A "$UA" -H "Accept: $ACCEPT" --max-time 25 "https://www.reddit.com/r/$sub/new/.rss?limit=25")
  echo "$sub: HTTP $code, $(wc -c < /opt/data/mowgo/.tmp_rss/$sub.xml) bytes"
  sleep 2
done