#!/usr/bin/env python3
"""
generate-xcodeproj.py — Creates a valid MowFlow.xcodeproj for the MowFlow iOS app.

Usage (on macOS):
    cd ios-native
    python3 generate-xcodeproj.py

After running, open MowFlow.xcodeproj in Xcode and press Cmd+R.
"""

import os
import hashlib
import time
import random

# ─── UUID Generation ───────────────────────────────────────────────────────────
# Xcode uses 24-char hex UUIDs. We generate deterministic ones from content hashes
# so the project file is reproducible.

_counter = 0

def make_uuid(seed=""):
    """Generate a deterministic 24-char hex UUID."""
    global _counter
    _counter += 1
    h = hashlib.md5(f"{seed}:{_counter}:{time.time()}".encode()).hexdigest()[:24].upper()
    return h

# ─── File Structure ────────────────────────────────────────────────────────────
# All 22 Swift files in the project, organized by directory.
SWIFT_FILES = {
    "MowFlow": ["MowFlowApp.swift", "Color+Hex.swift"],
    "MowFlow/Models": ["Models.swift"],
    "MowFlow/Services": ["AuthService.swift", "ChatService.swift", "DataStore.swift",
                         "StripeService.swift", "SupabaseService.swift"],
    "MowFlow/Views/Auth": ["LoginView.swift"],
    "MowFlow/Views/Chat": ["ChatView.swift"],
    "MowFlow/Views/Clients": ["ClientsView.swift", "NewClientFormView.swift"],
    "MowFlow/Views/Components": ["JobCardView.swift", "MainTabView.swift", "ReusableViews.swift"],
    "MowFlow/Views/Home": ["HomeView.swift"],
    "MowFlow/Views/Invoices": ["InvoicesView.swift"],
    "MowFlow/Views/Payments": ["PaymentView.swift"],
    "MowFlow/Views/Settings": ["SettingsView.swift"],
    "MowFlow/Views/Today": ["NewJobFormView.swift", "TodayView.swift"],
}

ASSET_CATALOG = "MowFlow/Assets.xcassets"
CONFIG_FILE = "MowFlow/Config.xcconfig"

# ─── Build UUIDs ───────────────────────────────────────────────────────────────
# Pre-generate all UUIDs for consistency
UUIDS = {}

# Project-level
UUIDS["root_object"]     = make_uuid("root")
UUIDS["main_group"]      = make_uuid("main_group")
UUIDS["products_group"]  = make_uuid("products_group")
UUIDS["frameworks_group"] = make_uuid("frameworks_group")
UUIDS["src_group"]       = make_uuid("src_group")
UUIDS["project_ref"]     = make_uuid("project_ref")

# Target
UUIDS["target"]           = make_uuid("target")
UUIDS["product_ref"]      = make_uuid("product_ref")
UUIDS["build_config_list_target"] = make_uuid("bcl_target")
UUIDS["build_config_list_project"] = make_uuid("bcl_project")

# Configurations
UUIDS["debug_config_target"]  = make_uuid("debug_target")
UUIDS["release_config_target"] = make_uuid("release_target")
UUIDS["debug_config_project"]  = make_uuid("debug_project")
UUIDS["release_config_project"] = make_uuid("release_project")

# Build phases
UUIDS["sources_phase"]    = make_uuid("sources_phase")
UUIDS["resources_phase"]  = make_uuid("resources_phase")
UUIDS["frameworks_phase"] = make_uuid("frameworks_phase")

# Package dependency
UUIDS["package_ref"]      = make_uuid("package_ref")
UUIDS["package_product"]  = make_uuid("package_product")

# Config file ref
UUIDS["config_file_ref"]  = make_uuid("config_file")

# Build file for config
UUIDS["config_build_file"] = make_uuid("config_build_file")

# File references and build files for each Swift file
FILE_REFS = {}
BUILD_FILES = {}
GROUPS = {}
GROUP_MEMBERS = {}

# Generate UUIDs for all files
for dirpath, filenames in SWIFT_FILES.items():
    group_key = dirpath
    UUIDS[f"group_{group_key}"] = make_uuid(f"group_{group_key}")
    GROUP_MEMBERS[group_key] = []
    for fname in filenames:
        file_key = f"{dirpath}/{fname}"
        UUIDS[f"fileref_{file_key}"] = make_uuid(f"fileref_{file_key}")
        UUIDS[f"buildfile_{file_key}"] = make_uuid(f"buildfile_{file_key}")
        FILE_REFS[file_key] = UUIDS[f"fileref_{file_key}"]
        BUILD_FILES[file_key] = UUIDS[f"buildfile_{file_key}"]
        GROUP_MEMBERS[group_key].append(file_key)

# Asset catalog
UUIDS["fileref_assets"] = make_uuid("fileref_assets")
UUIDS["buildfile_assets"] = make_uuid("buildfile_assets")

# ─── PBXProject File ───────────────────────────────────────────────────────────

def generate_pbxproj():
    lines = []
    w = lines.append

    w('// !$*UTF8*$!')
    w('{')
    w('\tarchiveVersion = 1;')
    w('\tclasses = {')
    w('\t};')
    w('\tobjectVersion = 56;')
    w('\tobjects = {')
    w('')

    # ── PBXBuildPhase: Sources ──
    w('/* Begin PBXSourcesBuildPhase section */')
    w(f'\t\t{UUIDS["sources_phase"]} /* Sources */ = {{')
    w('\t\t\tisa = PBXSourcesBuildPhase;')
    w('\t\t\tbuildActionMask = 2147483647;')
    w('\t\t\tfiles = (')
    for dirpath, filenames in SWIFT_FILES.items():
        for fname in filenames:
            file_key = f"{dirpath}/{fname}"
            w(f'\t\t\t\t{BUILD_FILES[file_key]} /* {fname} in Sources */,')
    w('\t\t\t);')
    w('\t\t\trunOnlyForDeploymentPostprocessing = 0;')
    w('\t\t};')
    w('/* End PBXSourcesBuildPhase section */')
    w('')

    # ── PBXBuildPhase: Resources ──
    w('/* Begin PBXResourcesBuildPhase section */')
    w(f'\t\t{UUIDS["resources_phase"]} /* Resources */ = {{')
    w('\t\t\tisa = PBXResourcesBuildPhase;')
    w('\t\t\tbuildActionMask = 2147483647;')
    w('\t\t\tfiles = (')
    w(f'\t\t\t\t{UUIDS["buildfile_assets"]} /* Assets.xcassets in Resources */,')
    w('\t\t\t);')
    w('\t\t\trunOnlyForDeploymentPostprocessing = 0;')
    w('\t\t};')
    w('/* End PBXResourcesBuildPhase section */')
    w('')

    # ── PBXBuildPhase: Frameworks ──
    w('/* Begin PBXFrameworksBuildPhase section */')
    w(f'\t\t{UUIDS["frameworks_phase"]} /* Frameworks */ = {{')
    w('\t\t\tisa = PBXFrameworksBuildPhase;')
    w('\t\t\tbuildActionMask = 2147483647;')
    w('\t\t\tfiles = (')
    w('\t\t\t);')
    w('\t\t\trunOnlyForDeploymentPostprocessing = 0;')
    w('\t\t};')
    w('/* End PBXFrameworksBuildPhase section */')
    w('')

    # ── PBXBuildFile section ──
    w('/* Begin PBXBuildFile section */')
    for dirpath, filenames in SWIFT_FILES.items():
        for fname in filenames:
            file_key = f"{dirpath}/{fname}"
            fid = FILE_REFS[file_key]
            bid = BUILD_FILES[file_key]
            w(f'\t\t{bid} /* {fname} in Sources */ = {{')
            w('\t\t\tisa = PBXBuildFile;')
            w(f'\t\t\tfileRef = {fid} /* {fname} */;')
            w('\t\t};')
    # Assets build file
    w(f'\t\t{UUIDS["buildfile_assets"]} /* Assets.xcassets in Resources */ = {{')
    w('\t\t\tisa = PBXBuildFile;')
    w(f'\t\t\tfileRef = {UUIDS["fileref_assets"]} /* Assets.xcassets */;')
    w('\t\t};')
    # Config build file
    w(f'\t\t{UUIDS["config_build_file"]} /* Config.xcconfig */ = {{')
    w('\t\t\tisa = PBXBuildFile;')
    w(f'\t\t\tfileRef = {UUIDS["config_file_ref"]} /* Config.xcconfig */;')
    w('\t\t};')
    # Package product dependency build file
    w(f'\t\t{UUIDS["package_product"]} /* StripePayments from stripe-ios */ = {{')
    w('\t\t\tisa = PBXBuildFile;')
    w(f'\t\t\tproductRef = {UUIDS["package_product"]} /* StripePayments */;')
    w('\t\t};')
    w('/* End PBXBuildFile section */')
    w('')

    # ── PBXFileReference section ──
    w('/* Begin PBXFileReference section */')
    for dirpath, filenames in SWIFT_FILES.items():
        for fname in filenames:
            file_key = f"{dirpath}/{fname}"
            fid = FILE_REFS[file_key]
            w(f'\t\t{fid} /* {fname} */ = {{')
            w('\t\t\tisa = PBXFileReference;')
            w('\t\t\tlastKnownFileType = sourcecode.swift;')
            w(f'\t\t\tpath = {fname};')
            w('\t\t\tsourceTree = "<group>";')
            w('\t\t};')
    # Assets.xcassets
    w(f'\t\t{UUIDS["fileref_assets"]} /* Assets.xcassets */ = {{')
    w('\t\t\tisa = PBXFileReference;')
    w('\t\t\tlastKnownFileType = folder.assetcatalog;')
    w('\t\t\tpath = Assets.xcassets;')
    w('\t\t\tsourceTree = "<group>";')
    w('\t\t};')
    # Config.xcconfig
    w(f'\t\t{UUIDS["config_file_ref"]} /* Config.xcconfig */ = {{')
    w('\t\t\tisa = PBXFileReference;')
    w('\t\t\tlastKnownFileType = text.xcconfig;')
    w('\t\t\tpath = Config.xcconfig;')
    w('\t\t\tsourceTree = "<group>";')
    w('\t\t};')
    # Product reference
    w(f'\t\t{UUIDS["product_ref"]} /* MowFlow.app */ = {{')
    w('\t\t\tisa = PBXFileReference;')
    w('\t\t\texplicitFileType = wrapper.application;')
    w('\t\t\tincludeInIndex = 0;')
    w('\t\t\tpath = MowFlow.app;')
    w('\t\t\tsourceTree = BUILT_PRODUCTS_DIR;')
    w('\t\t};')
    w('/* End PBXFileReference section */')
    w('')

    # ── PBXFrameworksBuildPhase (already done above) ──

    # ── PBXGroup section ──
    w('/* Begin PBXGroup section */')

    # Root group
    w(f'\t\t{UUIDS["main_group"]} = {{')
    w('\t\t\tisa = PBXGroup;')
    w('\t\t\tchildren = (')
    w(f'\t\t\t\t{UUIDS["src_group"]} /* MowFlow */,')
    w(f'\t\t\t\t{UUIDS["config_file_ref"]} /* Config.xcconfig */,')
    w(f'\t\t\t\t{UUIDS["products_group"]} /* Products */,')
    w('\t\t\t);')
    w('\t\t\tsourceTree = "<group>";')
    w('\t\t};')

    # Products group
    w(f'\t\t{UUIDS["products_group"]} /* Products */ = {{')
    w('\t\t\tisa = PBXGroup;')
    w('\t\t\tchildren = (')
    w(f'\t\t\t\t{UUIDS["product_ref"]} /* MowFlow.app */,')
    w('\t\t\t);')
    w('\t\t\tname = Products;')
    w('\t\t\tsourceTree = "<group>";')
    w('\t\t};')

    # Source root group (MowFlow/)
    w(f'\t\t{UUIDS["src_group"]} /* MowFlow */ = {{')
    w('\t\t\tisa = PBXGroup;')
    w('\t\t\tchildren = (')
    # Top-level files first
    for fname in SWIFT_FILES.get("MowFlow", []):
        file_key = f"MowFlow/{fname}"
        w(f'\t\t\t\t{FILE_REFS[file_key]} /* {fname} */,')
    # Assets
    w(f'\t\t\t\t{UUIDS["fileref_assets"]} /* Assets.xcassets */,')
    # Subgroups
    sub_dirs = sorted([d for d in SWIFT_FILES.keys() if d != "MowFlow"])
    for d in sub_dirs:
        w(f'\t\t\t\t{UUIDS[f"group_{d}"]} /* {d.split("/")[-1]} */,')
    w('\t\t\t);')
    w('\t\t\tpath = MowFlow;')
    w('\t\t\tsourceTree = "<group>";')
    w('\t\t};')

    # Subgroups
    for dirpath in sorted(SWIFT_FILES.keys()):
        if dirpath == "MowFlow":
            continue
        dirname = dirpath.split("/")[-1]
        w(f'\t\t{UUIDS[f"group_{dirpath}"]} /* {dirname} */ = {{')
        w('\t\t\tisa = PBXGroup;')
        w('\t\t\tchildren = (')
        for fname in SWIFT_FILES[dirpath]:
            file_key = f"{dirpath}/{fname}"
            w(f'\t\t\t\t{FILE_REFS[file_key]} /* {fname} */,')
        w('\t\t\t);')
        w(f'\t\t\tpath = {dirname};')
        w('\t\t\tsourceTree = "<group>";')
        w('\t\t};')

    w('/* End PBXGroup section */')
    w('')

    # ── PBXNativeTarget section ──
    w('/* Begin PBXNativeTarget section */')
    w(f'\t\t{UUIDS["target"]} /* MowFlow */ = {{')
    w('\t\t\tisa = PBXNativeTarget;')
    w(f'\t\t\tbuildConfigurationList = {UUIDS["build_config_list_target"]} /* Build configuration list for PBXNativeTarget "MowFlow" */;')
    w('\t\t\tbuildPhases = (')
    w(f'\t\t\t\t{UUIDS["sources_phase"]} /* Sources */,')
    w(f'\t\t\t\t{UUIDS["frameworks_phase"]} /* Frameworks */,')
    w(f'\t\t\t\t{UUIDS["resources_phase"]} /* Resources */,')
    w('\t\t\t);')
    w('\t\t\tbuildRules = (')
    w('\t\t\t);')
    w('\t\t\tdependencies = (')
    w('\t\t\t);')
    w('\t\t\tname = MowFlow;')
    w('\t\t\tpackageProductDependencies = (')
    w(f'\t\t\t\t{UUIDS["package_product"]},')
    w('\t\t\t);')
    w('\t\t\tproductName = MowFlow;')
    w(f'\t\t\tproductReference = {UUIDS["product_ref"]} /* MowFlow.app */;')
    w('\t\t\tproductType = "com.apple.product-type.application";')
    w('\t\t};')
    w('/* End PBXNativeTarget section */')
    w('')

    # ── PBXProject section ──
    w('/* Begin PBXProject section */')
    w(f'\t\t{UUIDS["root_object"]} /* Project object */ = {{')
    w('\t\t\tisa = PBXProject;')
    w('\t\t\tattributes = {')
    w('\t\t\t\tBuildIndependentTargetsInParallel = 1;')
    w('\t\t\t\tLastSwiftUpdateCheck = 1540;')
    w('\t\t\t\tLastUpgradeCheck = 1540;')
    w('\t\t\t\tTargetAttributes = {')
    w(f'\t\t\t\t\t{UUIDS["target"]} = {{')
    w('\t\t\t\t\t\tCreatedOnToolsVersion = 15.4;')
    w('\t\t\t\t\t};')
    w('\t\t\t\t};')
    w('\t\t\t};')
    w(f'\t\t\tbuildConfigurationList = {UUIDS["build_config_list_project"]} /* Build configuration list for PBXProject "MowFlow" */;')
    w('\t\t\tcompatibilityVersion = "Xcode 14.0";')
    w('\t\t\tdevelopmentRegion = en;')
    w('\t\t\thasScannedForEncodings = 0;')
    w('\t\t\tknownRegions = (')
    w('\t\t\t\ten,')
    w('\t\t\t\tBase,')
    w('\t\t\t);')
    w(f'\t\t\tmainGroup = {UUIDS["main_group"]};')
    w(f'\t\t\tpackageReferences = (')
    w(f'\t\t\t\t{UUIDS["package_ref"]},')
    w('\t\t\t);')
    w(f'\t\t\tproductRefGroup = {UUIDS["products_group"]} /* Products */;')
    w('\t\t\tprojectDirPath = "";')
    w('\t\t\tprojectRoot = "";')
    w('\t\t\ttargets = (')
    w(f'\t\t\t\t{UUIDS["target"]} /* MowFlow */,')
    w('\t\t\t);')
    w('\t\t};')
    w('/* End PBXProject section */')
    w('')

    # ── XCBuildConfiguration section ──
    w('/* Begin XCBuildConfiguration section */')

    # Debug config for target
    w(f'\t\t{UUIDS["debug_config_target"]} /* Debug */ = {{')
    w('\t\t\tisa = XCBuildConfiguration;')
    w('\t\t\tbuildSettings = {')
    w('\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;')
    w('\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;')
    w(f'\t\t\t\tCODE_SIGN_STYLE = Automatic;')
    w('\t\t\t\tCURRENT_PROJECT_VERSION = 1;')
    w('\t\t\t\tDEVELOPMENT_TEAM = "";')
    w(f'\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (')
    w('\t\t\t\t\t"DEBUG=1",')
    w('\t\t\t\t\t"$(inherited)",')
    w('\t\t\t\t);')
    w('\t\t\t\tGENERATE_INFOPLIST_FILE = YES;')
    w('\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = MowFlow;')
    w('\t\t\t\tINFOPLIST_KEY_CFBundleName = MowFlow;')
    w('\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UIRequiredDeviceCapabilities = arm64;')
    w('\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;')
    w('\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (')
    w('\t\t\t\t\t"$(inherited)",')
    w('\t\t\t\t\t"@executable_path/Frameworks",')
    w('\t\t\t\t);')
    w('\t\t\t\tMARKETING_VERSION = 1.0.0;')
    w('\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.mowflow.app;')
    w('\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";')
    w('\t\t\t\tSDKROOT = iphoneos;')
    w('\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;')
    w('\t\t\t\tSWIFT_STRICT_CONCURRENCY = complete;')
    w('\t\t\t\tSWIFT_VERSION = 5.0;')
    w('\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";')
    w('\t\t\t};')
    w('\t\t\tname = Debug;')
    w('\t\t};')

    # Release config for target
    w(f'\t\t{UUIDS["release_config_target"]} /* Release */ = {{')
    w('\t\t\tisa = XCBuildConfiguration;')
    w('\t\t\tbuildSettings = {')
    w('\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;')
    w('\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;')
    w(f'\t\t\t\tCODE_SIGN_STYLE = Automatic;')
    w('\t\t\t\tCURRENT_PROJECT_VERSION = 1;')
    w('\t\t\t\tDEVELOPMENT_TEAM = "";')
    w('\t\t\t\tGENERATE_INFOPLIST_FILE = YES;')
    w('\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = MowFlow;')
    w('\t\t\t\tINFOPLIST_KEY_CFBundleName = MowFlow;')
    w('\t\t\t\tINFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;')
    w('\t\t\t\tINFOPLIST_KEY_UIRequiredDeviceCapabilities = arm64;')
    w('\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = UIInterfaceOrientationPortrait;')
    w('\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (')
    w('\t\t\t\t\t"$(inherited)",')
    w('\t\t\t\t\t"@executable_path/Frameworks",')
    w('\t\t\t\t);')
    w('\t\t\t\tMARKETING_VERSION = 1.0.0;')
    w('\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.mowflow.app;')
    w('\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";')
    w('\t\t\t\tSDKROOT = iphoneos;')
    w('\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;')
    w('\t\t\t\tSWIFT_STRICT_CONCURRENCY = complete;')
    w('\t\t\t\tSWIFT_VERSION = 5.0;')
    w('\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";')
    w('\t\t\t};')
    w('\t\t\tname = Release;')
    w('\t\t};')

    # Debug config for project
    w(f'\t\t{UUIDS["debug_config_project"]} /* Debug */ = {{')
    w('\t\t\tisa = XCBuildConfiguration;')
    w('\t\t\tbuildSettings = {')
    w('\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;')
    w('\t\t\t\tCLANG_ANALYZER_NONNULL = YES;')
    w('\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;')
    w('\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++20";')
    w('\t\t\t\tCLANG_ENABLE_MODULES = YES;')
    w('\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;')
    w('\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;')
    w('\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;')
    w('\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_COMMA = YES;')
    w('\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;')
    w('\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;')
    w('\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;')
    w('\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;')
    w('\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;')
    w('\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;')
    w('\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;')
    w('\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;')
    w('\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;')
    w('\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;')
    w('\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;')
    w('\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;')
    w('\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;')
    w('\t\t\t\tCOPY_PHASE_STRIP = NO;')
    w('\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;')
    w('\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;')
    w('\t\t\t\tENABLE_TESTABILITY = YES;')
    w('\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;')
    w('\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;')
    w('\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;')
    w('\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;')
    w('\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;')
    w('\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (')
    w('\t\t\t\t\t"DEBUG=1",')
    w('\t\t\t\t\t"$(inherited)",')
    w('\t\t\t\t);')
    w('\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;')
    w('\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;')
    w('\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;')
    w('\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;')
    w('\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;')
    w('\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;')
    w('\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;')
    w('\t\t\t\tLOCALIZATION_PREFERS_STRING_CATALOGS = YES;')
    w('\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;')
    w('\t\t\t\tMTL_FAST_MATH = YES;')
    w('\t\t\t\tONLY_ACTIVE_ARCH = YES;')
    w('\t\t\t\tSDKROOT = iphoneos;')
    w('\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";')
    w('\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";')
    w('\t\t\t};')
    w('\t\t\tname = Debug;')
    w('\t\t};')

    # Release config for project
    w(f'\t\t{UUIDS["release_config_project"]} /* Release */ = {{')
    w('\t\t\tisa = XCBuildConfiguration;')
    w('\t\t\tbuildSettings = {')
    w('\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;')
    w('\t\t\t\tCLANG_ANALYZER_NONNULL = YES;')
    w('\t\t\t\tCLANG_ANALYZER_NUMBER_OBJECT_CONVERSION = YES_AGGRESSIVE;')
    w('\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = "gnu++20";')
    w('\t\t\t\tCLANG_ENABLE_MODULES = YES;')
    w('\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;')
    w('\t\t\t\tCLANG_ENABLE_OBJC_WEAK = YES;')
    w('\t\t\t\tCLANG_WARN_BLOCK_CAPTURE_AUTORELEASING = YES;')
    w('\t\t\t\tCLANG_WARN_BOOL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_COMMA = YES;')
    w('\t\t\t\tCLANG_WARN_CONSTANT_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_DEPRECATED_OBJC_IMPLEMENTATIONS = YES;')
    w('\t\t\t\tCLANG_WARN_DIRECT_OBJC_ISA_USAGE = YES_ERROR;')
    w('\t\t\t\tCLANG_WARN_DOCUMENTATION_COMMENTS = YES;')
    w('\t\t\t\tCLANG_WARN_EMPTY_BODY = YES;')
    w('\t\t\t\tCLANG_WARN_ENUM_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_INFINITE_RECURSION = YES;')
    w('\t\t\t\tCLANG_WARN_INT_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_NON_LITERAL_NULL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_IMPLICIT_RETAIN_SELF = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_LITERAL_CONVERSION = YES;')
    w('\t\t\t\tCLANG_WARN_OBJC_ROOT_CLASS = YES_ERROR;')
    w('\t\t\t\tCLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER = YES;')
    w('\t\t\t\tCLANG_WARN_RANGE_LOOP_ANALYSIS = YES;')
    w('\t\t\t\tCLANG_WARN_STRICT_PROTOTYPES = YES;')
    w('\t\t\t\tCLANG_WARN_SUSPICIOUS_MOVE = YES;')
    w('\t\t\t\tCLANG_WARN_UNGUARDED_AVAILABILITY = YES_AGGRESSIVE;')
    w('\t\t\t\tCLANG_WARN_UNREACHABLE_CODE = YES;')
    w('\t\t\t\tCLANG_WARN__DUPLICATE_METHOD_MATCH = YES;')
    w('\t\t\t\tCOPY_PHASE_STRIP = NO;')
    w('\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";')
    w('\t\t\t\tENABLE_NS_ASSERTIONS = NO;')
    w('\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;')
    w('\t\t\t\tENABLE_USER_SCRIPT_SANDBOXING = YES;')
    w('\t\t\t\tGCC_C_LANGUAGE_STANDARD = gnu17;')
    w('\t\t\t\tGCC_NO_COMMON_BLOCKS = YES;')
    w('\t\t\t\tGCC_WARN_64_TO_32_BIT_CONVERSION = YES;')
    w('\t\t\t\tGCC_WARN_ABOUT_RETURN_TYPE = YES_ERROR;')
    w('\t\t\t\tGCC_WARN_UNDECLARED_SELECTOR = YES;')
    w('\t\t\t\tGCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;')
    w('\t\t\t\tGCC_WARN_UNUSED_FUNCTION = YES;')
    w('\t\t\t\tGCC_WARN_UNUSED_VARIABLE = YES;')
    w('\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;')
    w('\t\t\t\tLOCALIZATION_PREFERS_STRING_CATALOGS = YES;')
    w('\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;')
    w('\t\t\t\tMTL_FAST_MATH = YES;')
    w('\t\t\t\tSDKROOT = iphoneos;')
    w('\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;')
    w('\t\t\t\tVALIDATE_PRODUCT = YES;')
    w('\t\t\t};')
    w('\t\t\tname = Release;')
    w('\t\t};')

    w('/* End XCBuildConfiguration section */')
    w('')

    # ── XCConfigurationList section ──
    w('/* Begin XCConfigurationList section */')

    # Target config list
    w(f'\t\t{UUIDS["build_config_list_target"]} /* Build configuration list for PBXNativeTarget "MowFlow" */ = {{')
    w('\t\t\tisa = XCConfigurationList;')
    w('\t\t\tbuildConfigurations = (')
    w(f'\t\t\t\t{UUIDS["debug_config_target"]} /* Debug */,')
    w(f'\t\t\t\t{UUIDS["release_config_target"]} /* Release */,')
    w('\t\t\t);')
    w('\t\t\tdefaultConfigurationIsVisible = 0;')
    w('\t\t\tdefaultConfigurationName = Release;')
    w('\t\t};')

    # Project config list
    w(f'\t\t{UUIDS["build_config_list_project"]} /* Build configuration list for PBXProject "MowFlow" */ = {{')
    w('\t\t\tisa = XCConfigurationList;')
    w('\t\t\tbuildConfigurations = (')
    w(f'\t\t\t\t{UUIDS["debug_config_project"]} /* Debug */,')
    w(f'\t\t\t\t{UUIDS["release_config_project"]} /* Release */,')
    w('\t\t\t);')
    w('\t\t\tdefaultConfigurationIsVisible = 0;')
    w('\t\t\tdefaultConfigurationName = Release;')
    w('\t\t};')

    w('/* End XCConfigurationList section */')
    w('')

    # ── XCLocalSwiftPackageReference section ──
    w('/* Begin XCLocalSwiftPackageReference section */')
    w('/* End XCLocalSwiftPackageReference section */')
    w('')

    # ── XCRemoteSwiftPackageReference section ──
    w('/* Begin XCRemoteSwiftPackageReference section */')
    w(f'\t\t{UUIDS["package_ref"]} /* XCRemoteSwiftPackageReference "stripe-ios" */ = {{')
    w('\t\t\tisa = XCRemoteSwiftPackageReference;')
    w('\t\t\trepositoryURL = "https://github.com/stripe/stripe-ios.git";')
    w('\t\t\trequirement = {')
    w('\t\t\t\tkind = upToNextMajorVersion;')
    w('\t\t\t\tminimumVersion = 23.0.0;')
    w('\t\t\t};')
    w('\t\t};')
    w('/* End XCRemoteSwiftPackageReference section */')
    w('')

    # ── XCSwiftPackageProductDependency section ──
    w('/* Begin XCSwiftPackageProductDependency section */')
    w(f'\t\t{UUIDS["package_product"]} /* StripePayments */ = {{')
    w('\t\t\tisa = XCSwiftPackageProductDependency;')
    w('\t\t\tproductName = StripePayments;')
    w('\t\t};')
    w('/* End XCSwiftPackageProductDependency section */')
    w('')

    w('\t};')
    w(f'\trootObject = {UUIDS["root_object"]} /* Project object */;')
    w('}')

    return '\n'.join(lines)


def generate_xcscheme():
    """Generate a basic xcscheme for the MowFlow target."""
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1540"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{UUIDS['target']}"
               BuildableName = "MowFlow.app"
               BlueprintName = "MowFlow"
               ReferencedContainer = "container:MowFlow.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      codeCoverageEnabled = "NO">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{UUIDS['target']}"
            BuildableName = "MowFlow.app"
            BlueprintName = "MowFlow"
            ReferencedContainer = "container:MowFlow.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{UUIDS['target']}"
            BuildableName = "MowFlow.app"
            BlueprintName = "MowFlow"
            ReferencedContainer = "container:MowFlow.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
'''


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    # Create .xcodeproj directory structure
    proj_dir = "MowFlow.xcodeproj"
    scheme_dir = os.path.join(proj_dir, "xcshareddata", "xcschemes")
    os.makedirs(scheme_dir, exist_ok=True)

    # Write project.pbxproj
    pbxproj_path = os.path.join(proj_dir, "project.pbxproj")
    with open(pbxproj_path, 'w') as f:
        f.write(generate_pbxproj())
    print(f"✅ Created {pbxproj_path}")

    # Write xcscheme
    scheme_path = os.path.join(scheme_dir, "MowFlow.xcscheme")
    with open(scheme_path, 'w') as f:
        f.write(generate_xcscheme())
    print(f"✅ Created {scheme_path}")

    # Remove Package.swift if it exists (conflicts with xcodeproj)
    if os.path.exists("Package.swift"):
        os.remove("Package.swift")
        print("✅ Removed Package.swift (conflicts with xcodeproj)")

    # Update .gitignore to allow xcodeproj but keep xcuserdata excluded
    gitignore_path = ".gitignore"
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r') as f:
            content = f.read()
        # Replace the xcodeproj exclusion with a more specific one
        if "*.xcodeproj/" in content:
            content = content.replace("*.xcodeproj/", "# Note: .xcodeproj is tracked\n# xcuserdata/ is still excluded below")
            with open(gitignore_path, 'w') as f:
                f.write(content)
            print("✅ Updated .gitignore to track .xcodeproj")

    print("\n🎉 Done! Open MowFlow.xcodeproj in Xcode and press Cmd+R.")
    print("   Xcode will automatically resolve the Stripe SPM dependency on first open.")


if __name__ == "__main__":
    main()
