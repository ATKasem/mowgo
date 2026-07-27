#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
theme_file="$root_dir/MowGo/Theme.swift"
app_file="$root_dir/MowGo/MowGoApp.swift"
views_dir="$root_dir/MowGo/Views"

assert_contains() {
    file=$1
    pattern=$2
    message=$3
    if ! grep -Eq "$pattern" "$file"; then
        echo "FAIL: $message"
        exit 1
    fi
}

assert_contains "$theme_file" 'init\(_ colorScheme: ColorScheme\)' \
    "Theme must be initialized from ColorScheme"
assert_contains "$theme_file" 'background = Color\(hex: isDark \? "111827" : "ffffff"\)' \
    "Theme must define dark and light background variants"
assert_contains "$theme_file" 'surface = Color\(hex: isDark \? "1f2937" : "f3f4f6"\)' \
    "Theme must define dark and light surface variants"
assert_contains "$theme_file" 'enum AppearancePreference' \
    "AppearancePreference must support a system default"
assert_contains "$app_file" '@AppStorage\("appearanceMode"\).*system' \
    "The saved appearance must default to system"

if grep -R -Eq 'Color\(hex: "(111827|1f2937|374151|d1d5db|9ca3af|6b7280)"\)|foregroundColor\(\.(white|black)\)' \
    "$app_file" "$views_dir"; then
    echo "FAIL: views still contain hardcoded neutral colors"
    exit 1
fi

echo "PASS: appearance theme audit"
