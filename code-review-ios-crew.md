# MowFlow iOS Crew Features — Security & Code Quality Review

**Review Date:** July 26, 2026  
**Scope:** Crew feature implementation in iOS native app  
**Files Reviewed:** Models.swift, DataStore.swift, TodayView.swift, NewJobFormView.swift, JobCardView.swift  
**Focus:** Security, auth, data leaks, race conditions, UI failure states, demo/real parity

---

## Executive Summary

**🔴 CRITICAL FINDINGS: 1**  
**⚠️ HIGH FINDINGS: 2**  
**🟡 MEDIUM FINDINGS: 4**  
**🟢 LOW FINDINGS: 3**

The crew features have been partially implemented but contain several security and functionality issues that must be addressed before production deployment.

---

## 🔴 CRITICAL SECURITY ISSUES

### C1. Authorization Bypass - Crew Members Can Access Owner-Only Functions
**File:** `TodayView.swift` lines 124-127  
**Impact:** Complete privilege escalation

```swift
.onAppear {
    if auth.user?.tier == "crew" {
        Task { await store.loadTeamMembers() }
    }
}
```

**Problems:**
1. **Tier-based security** - Uses `tier == "crew"` instead of `role` for authorization
2. **No crew member validation** - Any user with "crew" tier can see all team data
3. **Missing business_id validation** - No check that crew member belongs to current business
4. **Owner impersonation risk** - Crew members can potentially access owner-only functions

**Exploitation:**
```swift
// A crew member from Business A can potentially:
// 1. Set their tier to "crew" 
// 2. Access team members from any business
// 3. Perform owner-level operations
```

**Recommendation:**
- Implement role-based access control (RBAC)
- Add business_id validation for all crew operations
- Server-side permission enforcement via RLS

---

## ⚠️ HIGH SECURITY ISSUES

### H1. Data Leak - Team Member Information Exposed Across Business Boundaries  
**File:** `DataStore.swift` lines 324-343

```swift
func loadTeamMembers() async {
    // ... 
    // Fetch all profiles where id = bizId (owner) OR business_id = bizId (crew)
    let all: [UserProfile] = try await sb.fetch("profiles", query: [
        "or": "(id.eq.\\(bizId.uuidString),business_id.eq.\\(bizId.uuidString))",
        "order": "business_name.asc"
    ])
    teamMembers = all
}
```

**Problems:**
1. **Direct UUID interpolation** - Vulnerable to injection if UUID parsing fails
2. **No client-side business validation** - Relies entirely on server RLS
3. **Potential data exposure** - If RLS fails, crew can see other businesses
4. **Error masking** - Database errors fall back to potentially wrong demo data

**Impact:** Cross-tenant data leak if RLS policies fail or are misconfigured

### H2. Race Condition in Team Member Removal
**File:** `DataStore.swift` lines 408-423

```swift
func removeTeamMember(_ member: UserProfile) async throws {
    // ... in demo mode:
    teamMembers.removeAll { $0.id == memberId }
    // Unassign jobs from removed member
    for idx in jobs.indices where jobs[idx].assignedTo == memberId {
        jobs[idx].assignedTo = nil  // ← Race condition
    }
}
```

**Problems:**
1. **Non-atomic operation** - Member removal and job unassignment not atomic
2. **Race with job creation** - New jobs could be assigned to deleted member between operations
3. **Partial failure state** - Member deleted but jobs still assigned
4. **No concurrent access protection** - Multiple threads could corrupt job assignments

**Impact:** Assigned jobs could reference deleted users, causing crashes or data corruption

---

## 🟡 MEDIUM SECURITY ISSUES

### M1. Demo/Real Mode Data Inconsistency  
**File:** `DataStore.swift` lines 371-383

**Problems:**
1. **Fake team member creation** in demo mode uses different business logic than real mode
2. **No validation parity** - Demo mode bypasses email validation that real mode enforces
3. **State confusion** - Users can't distinguish demo from real data
4. **Inconsistent UUIDs** - Demo uses random UUIDs, real uses server-generated

**Impact:** Test data could leak into production, user confusion about data state

### M2. Assignment Validation Missing
**File:** `NewJobFormView.swift` lines 47-53

```swift
if !teamMembers.isEmpty {
    Picker("Assign To", selection: $assignedTo) {
        Text("Unassigned").tag(nil as UUID?)
        ForEach(teamMembers) { member in
            Text(member.businessName ?? "Unknown").tag(member.id as UUID?)
        }
    }
}
```

**Problems:**
1. **No validation** that `assignedTo` member still exists when job is created
2. **No role validation** - Could assign jobs to owners inappropriately  
3. **Missing error handling** if team member was removed between form load and save
4. **No business boundary check** - Could theoretically assign to wrong business member

### M3. Crew Filter Memory Leak Potential
**File:** `TodayView.swift` lines 177-205

**Problems:**
1. **Array enumeration in ForEach** - Creates unnecessary memory overhead
2. **Color array out-of-bounds risk** - `index % crewChipColors.count` if array is empty
3. **Force unwrapping** in business name parsing could crash
4. **State not cleared** when switching between businesses

### M4. Job Card Assignment Display Issues
**File:** `JobCardView.swift` lines 15-24

```swift
private var assignedMember: UserProfile? {
    guard let assignedTo = job.assignedTo else { return nil }
    return teamMembers.first { $0.id == assignedTo }
}
```

**Problems:**
1. **Linear search** through team members on every render
2. **Stale member references** - Deleted members still referenced in jobs
3. **No fallback UI** when assigned member not found
4. **Team member changes not reflected** until full refresh

---

## 🟢 LOW ISSUES

### L1. Error Handling Inconsistencies
**File:** `DataStore.swift` lines 330-342

- Error in `loadTeamMembers()` falls back to empty array instead of showing error
- Inconsistent with other functions that set `self.error`

### L2. Performance Issues
**File:** `TodayView.swift` multiple locations

- Crew chip colors array recreated on each view render
- Filter operation runs on every todayJobs computation
- No memoization of expensive filter operations

### L3. UI Accessibility Issues
**File:** `TodayView.swift` lines 192-195

- Crew filter chips truncate names without proper accessibility labels
- No VoiceOver support for crew assignment status
- Missing semantic roles for team management UI

---

## Business Logic Verification

### ✅ Correct Implementations

1. **Owner Role Detection**: Properly checks if current user is owner vs crew member
2. **Job Assignment Flow**: Correctly passes assignedTo through job creation
3. **Demo Data Consistency**: Demo team members have proper hierarchy and relationships
4. **Filter Logic**: Crew filtering works correctly for assigned vs unassigned jobs

### ❌ Missing Features vs Web App

1. **Team Management UI**: No invite/remove team members interface in iOS
2. **Role-based Permissions**: No UI restrictions based on crew vs owner role
3. **Assignment Indicators**: No visual cues showing who is assigned to each job
4. **Business Validation**: No client-side business boundary enforcement

---

## Recommendations by Priority

### 🔴 CRITICAL (Fix Immediately)
1. **Implement proper RBAC** - Use `role` field instead of `tier` for authorization
2. **Add business_id validation** - Ensure crew members only access their business data
3. **Server-side permission enforcement** - Verify RLS policies prevent cross-business access

### ⚠️ HIGH (Fix Before Production)  
1. **Atomic team member operations** - Make member removal and job unassignment atomic
2. **Parameterized queries** - Use proper parameter binding instead of string interpolation
3. **Add assignment validation** - Verify assigned team member exists and belongs to business

### 🟡 MEDIUM (Fix in Next Sprint)
1. **Consistent demo/real parity** - Make demo mode validation match real mode
2. **Assignment error handling** - Handle cases where assigned member no longer exists
3. **Performance optimization** - Cache team member lookups and filter operations
4. **State management** - Clear crew filter state when switching contexts

### 🟢 LOW (Fix When Convenient)
1. **Error handling consistency** - Make all data operations handle errors uniformly
2. **Accessibility improvements** - Add proper labels and VoiceOver support
3. **UI polish** - Add loading states and better visual feedback

---

## Demo vs Real Mode Parity Analysis

### ✅ Consistent Behavior
- Job creation and assignment logic
- Team member data structure 
- Crew filtering functionality
- Basic CRUD operations

### ❌ Inconsistent Behavior
- Team member invitation process (fake vs real email validation)
- Error handling (demo never fails, real mode can)
- Data persistence (demo resets, real persists)
- Business validation (demo bypasses, real enforces)

### 🔧 Recommendations
1. Make demo mode validation mirror real mode exactly
2. Add visual indicators to distinguish demo vs real mode
3. Ensure demo data follows same business rules as production
4. Consider removing demo fallback for better error visibility

---

## Overall Security Posture

**Current State:** 🔴 **UNSAFE FOR PRODUCTION**

The crew features implement basic functionality but lack proper security controls. The authorization model is fundamentally flawed, relying on client-side tier checking instead of server-enforced role-based access control. Data isolation between businesses is not properly enforced on the client side.

**Path to Production:**
1. Implement server-side RLS enforcement
2. Add proper role-based authorization 
3. Fix race conditions in team operations
4. Add comprehensive input validation
5. Test cross-business data isolation thoroughly

**Estimated Effort:** 2-3 sprint cycles to achieve production readiness