# User-Facing Error Messages - Fixed

## Problem
Error messages exposed internal implementation details ("Firecrawl") to end users, which is confusing and unprofessional.

## Solution
Replaced all user-facing mentions of "Firecrawl" with generic terms:

### Changes Made

| Before | After |
|--------|-------|
| `Firecrawl is experiencing issues processing this site` | `Our crawling service is experiencing issues processing this site` |
| `Firecrawl request failed` | `Website crawl request failed` |
| `Firecrawl crawl: no job ID returned` | `Website crawl: no job ID returned` |
| `throw new ProviderNotConfiguredError("Firecrawl")` | `throw new ProviderNotConfiguredError("Website crawling service")` |

### Example Error Message (After Fix)

```
Deep crawl timed out after 15 minutes with no pages collected. 

This usually means:
• The site is blocking automated crawlers (common for Netflix, streaming services, banking sites)
• The site requires JavaScript/authentication to load content
• Our crawling service is experiencing issues processing this site

Recommendations:
1. Try using Smart Crawl mode instead (faster, works for most sites)
2. Test with a simpler website first (e.g., a blog or documentation site)
3. Check if the site allows automated crawling in their robots.txt
```

### Internal References (Kept as-is)

These are NOT user-facing, so they still mention "firecrawl":
- Log statements: `logger.info("firecrawl.crawl", ...)`
- Console logs: `console.log("[v0] firecrawl.deepCrawl: ...")`
- Function names: `firecrawlFetch()`, `isFirecrawlConfigured()`
- File names: `lib/integrations/firecrawl/`
- Test files: `circuit-breaker.test.ts`

## Files Modified

1. **lib/integrations/firecrawl/client.ts**
   - Line 21: ProviderNotConfiguredError message
   - Line 39: Request failed error message
   - Line 153: Job ID error message
   - Line 226: Timeout error message

## Testing

To verify the fix:

1. **Test timeout error**: Try deep crawling Netflix
   - Should show: "Our crawling service is experiencing issues..."
   - Should NOT show: "Firecrawl is experiencing issues..."

2. **Test configuration error**: Remove FIRECRAWL_API_KEY from env
   - Should show: "Website crawling service is not configured"
   - Should NOT show: "Firecrawl is not configured"

3. **Test request error**: Force a bad API request
   - Should show: "Website crawl request failed"
   - Should NOT show: "Firecrawl request failed"

## Impact

- ✅ Professional user-facing error messages
- ✅ No internal implementation details leaked
- ✅ Users get actionable guidance without technical jargon
- ✅ Internal logging and debugging still clear
