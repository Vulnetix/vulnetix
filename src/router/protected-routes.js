const routes = [
    {
        path: '/',
        component: () => import('../layouts/default.vue'),
        children: [
            {
                path: 'dashboard',
                component: () => import('../pages/Dashboard.vue'),
            },
            {
                path: 'artifacts',
                component: () => import('../pages/Artifacts.vue'),
            },
            {
                path: 'artifacts/sarif',
                component: () => import('../pages/SARIFManager.vue'),
            },
            {
                path: 'artifacts/cyclonedx',
                component: () => import('../pages/CycloneDXManager.vue'),
            },
            {
                path: 'artifacts/spdx',
                component: () => import('../pages/SPDXManager.vue'),
            },
            {
                path: 'artifacts/vex',
                component: () => import('../pages/VEXManager.vue'),
            },
            {
                path: 'artifacts/vdr',
                component: () => import('../pages/VDRManager.vue'),
            },
            {
                path: 'account',
                component: () => import('../pages/Profile.vue'),
            },
            {
                path: 'account/settings',
                component: () => import('../pages/AccountSettings.vue'),
            },
            {
                path: 'account/organisation',
                component: () => import('../pages/Organisation.vue'),
            },
            {
                path: 'projects',
                component: () => import('../pages/Projects.vue'),
            },
            {
                path: 'products',
                component: () => import('../pages/Products.vue'),
            },
            {
                path: 'triage',
                component: () => import('../pages/Tasks.vue'),
            },
            {
                path: 'triage/issues',
                component: () => import('../pages/TriageIssues.vue'),
            },
            {
                path: 'triage/exploitable',
                component: () => import('../pages/TriageExploitable.vue'),
            },
            {
                path: 'triage/overdue',
                component: () => import('../pages/TriageOverdue.vue'),
            },
            {
                path: 'triage/history',
                component: () => import('../pages/TriageHistory.vue'),
            },
            {
                path: 'integrations',
                component: () => import('../pages/Integrations.vue'),
            },
            {
                path: 'integration/vulncheck',
                component: () => import('../pages/VulnCheck.vue'),
            },
            {
                path: 'integration/osv-dev',
                component: () => import('../pages/OSV.vue'),
            },
            {
                path: 'integration/first-org',
                component: () => import('../pages/FirstOrg.vue'),
            },
            {
                path: 'integration/mend',
                component: () => import('../pages/Mend.vue'),
            },
            {
                path: 'integration/mitre-cve',
                component: () => import('../pages/MitreCve.vue'),
            },
            {
                path: 'integration/github',
                component: () => import('../pages/GitHubLogs.vue'),
            },
        ],
    },
]

export default routes
