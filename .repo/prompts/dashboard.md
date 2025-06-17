Add a recently triaged stat where:
- UPPER(t.analysisState) NOT IN ('IN_TRIAGE', 'EXPLOITABLE')
- triagedAt >= ${yesterday.getTime()}

Add recent false positives stat where:
- UPPER(t.analysisState) IN ('FALSE_POSITIVE', 'NOT_AFFECTED')
- triagedAt >= ${lastWeek.getTime()}

Add temporary control in place stat where:
- UPPER(t.analysisJustifications) IN ('PROTECTED_BY_MITIGATING_CONTROL')

Update the pinia store for support of the new API response properties

Add these to the Dashboard Main Content section where each passes the new filter to the URL parameter to Vulnerabilities page

Handle the new URL query param in the Vulnerabilities page to pre populate the Special Filters and ensure the new flags are supported in vulnerabilitiesStore as a filter to the /vulnerabilities/search API

Update the search file for hte /vulnerabilities/search API to handle the SQL in the same way as was used to create the insights from the originating insights API
