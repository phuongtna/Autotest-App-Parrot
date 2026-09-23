#!/bin/bash
set -e
for k in 2 3 4 5 6 7 8; do
  echo "=== Bắt đầu Khối $k ($(date +%H:%M:%S)) ==="
  node compare_recap_self_vs_teacher.mjs "Khối $k" > "output/recap_khoi_${k}.log" 2>&1
  cp "output/recap_comparison_report.json" "output/recap_comparison_report_khoi_${k}.json"
  echo "=== Xong Khối $k ($(date +%H:%M:%S)) ==="
done
echo "ALL_KHOI_DONE"
