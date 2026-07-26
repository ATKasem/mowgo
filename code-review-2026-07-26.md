# MowFlow Crew Features Security Review - 2026-07-26

## Summary

Comprehensive security and bug analysis of MowFlow crew feature implementation, covering database migration, data layer, server endpoints, and UI components. Findings are severity-ranked from CRITICAL to LOW with specific file:line references.

## CRITICAL Issues

### 1. SQL Injection via Template String in Authorization Header
**File**: `client/src/lib/data.js:486`
**Issue**: The authorization header uses template string interpolation without proper escaping:
```javascript
Authorization: *** ${session.access_token}`,
```
**Risk**: If the session token contains malicious content, it could lead to HTTP header injection attacks.
**Recommendation**: Validate and sanitize the access token or use proper string concatenation.

### 2. Missing HTTPS/Secure Transport Enforcement
**File**: `server/index.js:20-22`
**Issue**: CORS configuration allows `http://localhost:5173` which could allow insecure transport in production.
**Risk**: Authentication tokens and sensitive data could be transmitted over unencrypted connections.
**Recommendation**: Enforce HTTPS-only origins in production environment.

### 3. Business ID Privilege Escalation Risk
**File**: `supabase/migrations/002_crew_features.sql:54-57`
**Issue**: The `current_business_id()` function uses `COALESCE(business_id, id)` logic that could allow privilege escalation if `business_id` is manipulated.
**Risk**: Crew members could potentially access data from other businesses.
**Recommendation**: Add additional validation to ensure business_id relationships are correct.

## HIGH Issues

### 4. Unvalidated Team Member Removal
**File**: `server/index.js:156-188`
**Issue**: Team member removal doesn't verify the member being removed belongs to the requesting owner's business before database operations.
**Risk**: Could allow unauthorized removal of team members from other businesses.
**Recommendation**: Add explicit business ownership validation before the deletion query.

### 5. RLS Policy Gap for Crew Job Updates
**File**: `supabase/migrations/002_crew_features.sql:121-132`
**Issue**: Crew members can update jobs assigned to them, but there's no validation that they haven't changed ownership or business association.
**Risk**: Crew members could potentially modify job assignments improperly.
**Recommendation**: Add WITH CHECK constraint to prevent assigned_to changes by crew members.

### 6. Missing Rate Limiting on Team Operations
**File**: `server/index.js:118-154`
**Issue**: Team invitation and removal endpoints lack specific rate limiting beyond the general API limits.
**Risk**: Could be abused for spam invitations or denial of service.
**Recommendation**: Implement stricter rate limiting for team management operations.

### 7. Sensitive Data Exposure in Client Responses
**File**: `client/src/lib/data.js:75-87`
**Issue**: Client records include sensitive fields like `key_code`, `alarm_code` in all responses.
**Risk**: Sensitive customer security information exposed to all team members.
**Recommendation**: Implement field-level permissions or data masking for sensitive fields.

## MEDIUM Issues

### 8. Weak Email Validation
**File**: `server/index.js:123-125`
**Issue**: Basic regex email validation that could be bypassed.
```javascript
if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
```
**Risk**: Invalid email addresses could be invited, leading to failed invitations.
**Recommendation**: Use a more robust email validation library.

### 9. XSS Risk in Email Template
**File**: `server/index.js:327, 346`
**Issue**: While `escapeHtml()` is used, the invoice amount is converted to string without validation:
```javascript
html: `...${escapeHtml(String(amount))}...`
```
**Risk**: If amount contains non-numeric data, it could lead to XSS.
**Recommendation**: Validate amount is numeric before string conversion.

### 10. Missing Transaction Boundaries
**File**: `server/index.js:173-185`
**Issue**: Team member removal involves multiple database operations without transaction wrapping:
- Update jobs to remove assignments
- Update profile to remove from team
**Risk**: Partial failures could leave inconsistent state.
**Recommendation**: Wrap operations in database transaction.

### 11. Inadequate Error Handling in Data Layer
**File**: `client/src/lib/data.js:209-213, 449-452`
**Issue**: Profile errors are logged but not properly handled, potentially exposing sensitive debug info.
**Risk**: Error messages could reveal internal system information.
**Recommendation**: Implement proper error sanitization and user-friendly messages.

### 12. Race Condition in Demo Team Management
**File**: `client/src/lib/data.js:524-540`
**Issue**: Demo mode team member removal has race conditions between member validation and removal operations.
**Risk**: Inconsistent state in demo mode, potential data corruption.
**Recommendation**: Implement atomic operations for demo state changes.

## LOW Issues

### 13. Missing Input Sanitization in Demo Mode
**File**: `client/src/lib/data.js:504`
**Issue**: Demo member creation uses unsanitized email prefix:
```javascript
business_name: normalizedEmail.split('@')[0],
```
**Risk**: Could create display issues if email contains special characters.
**Recommendation**: Sanitize business name extraction.

### 14. Potential Memory Leak with Event Listeners
**File**: `client/src/lib/data.js:17-20`
**Issue**: Demo mode listeners are added but cleanup is optional:
```javascript
export function onDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
```
**Risk**: If cleanup functions aren't called, listeners accumulate in memory.
**Recommendation**: Implement automatic cleanup or WeakSet usage.

### 15. Missing Accessibility Labels
**File**: `client/src/components/NewJobForm.jsx:52-59`
**Issue**: Assignee dropdown options don't have aria-describedby for role information.
**Risk**: Screen reader users may not understand member roles.
**Recommendation**: Add proper ARIA labels and descriptions.

### 16. Incomplete CSRF Protection
**File**: `server/index.js:19-22`
**Issue**: CORS is configured but no CSRF tokens are used for state-changing operations.
**Risk**: Cross-site request forgery on team management operations.
**Recommendation**: Implement CSRF token validation for POST/DELETE requests.

### 17. Hardcoded Color Array Bounds
**File**: `client/src/components/JobCard.jsx:18-21`
**Issue**: Team member color assignment uses modulo without bounds checking:
```javascript
const assignedColor = assignedMemberIdx >= 0
  ? TEAM_MEMBER_COLORS[assignedMemberIdx % TEAM_MEMBER_COLORS.length]
```
**Risk**: If TEAM_MEMBER_COLORS is empty, division by zero occurs.
**Recommendation**: Add bounds checking for color array.

### 18. Insecure Demo User ID Storage
**File**: `client/src/lib/data.js:411-424`
**Issue**: Demo user ID is stored in module scope without validation:
```javascript
let _demoCurrentUserId = 'demo-owner-001';
```
**Risk**: Could be manipulated to access unauthorized demo data.
**Recommendation**: Add validation for demo user ID changes.

### 19. Missing Content Security Policy Headers
**File**: `server/index.js:13-16`
**Issue**: CSP is disabled relying on Cloudflare:
```javascript
contentSecurityPolicy: false, // Let Cloudflare handle CSP
```
**Risk**: No defense-in-depth for XSS attacks if Cloudflare fails.
**Recommendation**: Implement backup CSP headers.

### 20. Potential Information Disclosure in Error Messages
**File**: `client/src/pages/Settings.jsx:104-106`
**Issue**: Team management errors expose technical details:
```javascript
setTeamError(err.message || 'Failed to remove team member');
```
**Risk**: Could reveal internal system information to users.
**Recommendation**: Sanitize error messages before displaying to users.

## UI/UX Issues

### 21. Missing Loading States in Team Management
**File**: `client/src/pages/Settings.jsx:97-107`
**Issue**: No loading indicator during team member removal.
**Risk**: Users may click multiple times, causing duplicate requests.
**Recommendation**: Add loading state and disable button during operations.

### 22. Inadequate Mobile Touch Targets
**File**: `client/src/pages/Settings.jsx:243-251`
**Issue**: Remove team member button may be too small for mobile touch:
```javascript
className="...p-2 min-w-10 min-h-10"
```
**Risk**: Poor mobile user experience, accidental touches.
**Recommendation**: Increase touch target size to 44x44px minimum.

### 23. Missing Confirmation for Destructive Actions
**File**: `client/src/pages/Today.jsx:288-292`
**Issue**: Rain delay move operation only has a basic confirm():
```javascript
if (!window.confirm(`Move ${toMove.length} job${toMove.length > 1 ? 's' : ''} to tomorrow?`))
```
**Risk**: Users may accidentally move jobs.
**Recommendation**: Implement custom modal with clear consequences explanation.

## Recommendations Summary

1. **Immediate Action Required**: Fix authorization header template string injection
2. **Security Hardening**: Implement proper transaction boundaries and field-level permissions
3. **Input Validation**: Strengthen email validation and implement comprehensive sanitization
4. **Access Control**: Add explicit business ownership validation in all team operations
5. **Error Handling**: Implement user-friendly error messages with proper sanitization
6. **UI Polish**: Add loading states and improve mobile accessibility

## Files Analyzed

- `supabase/migrations/002_crew_features.sql` - Database schema and RLS policies
- `client/src/lib/data.js` - Data access layer with crew functionality
- `server/index.js` - API endpoints for team management
- `client/src/components/NewJobForm.jsx` - Job creation with assignment
- `client/src/components/JobCard.jsx` - Job display with member info
- `client/src/pages/Today.jsx` - Main interface with crew filtering
- `client/src/pages/Settings.jsx` - Team management interface
- `client/src/lib/constants.js` - Shared constants and configurations

---

**Review Completed**: 2026-07-26
**Reviewer**: Automated Security Analysis
**Total Issues Found**: 23 (3 Critical, 4 High, 6 Medium, 10 Low)