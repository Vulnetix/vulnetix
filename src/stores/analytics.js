import { useMemberStore } from '@/stores/member';
import { default as axios } from 'axios';
import { defineStore } from 'pinia';

const Member = useMemberStore()

axios.defaults.headers.common = {
    'X-Vulnetix': Member.session?.token,
}

export const useAnalyticsStore = defineStore('analytics', {
    state: async () => {
        try {
            const { data } = await axios.get(`/analytics`)
            if (data?.error?.message) {
                console.error('useAnalyticsStore', data.error.message)
            } else if (data?.ok && data?.results) {
                return data.results
            }
        } catch (e) {
            console.error('useAnalyticsStore', e)
        }
        return {
            ssvc_act: 0,
            ssvc_attend: 0,
            ssvc_track: 0,
            ssvc_track_star: 0,
            ssvc_immediate: 0,
            ssvc_oob: 0,
            ssvc_scheduled: 0,
            in_triage: 0,
            resolved: 0,
            resolved_with_pedigree: 0,
            exploitable: 0,
            false_positive: 0,
            not_affected: 0,
            code_not_present: 0,
            code_not_reachable: 0,
            requires_configuration: 0,
            requires_dependency: 0,
            requires_environment: 0,
            protected_by_compiler: 0,
            protected_at_runtime: 0,
            protected_at_perimeter: 0,
            protected_by_mitigating_control: 0,
            can_not_fix: 0,
            will_not_fix: 0,
            update: 0,
            rollback: 0,
            workaround_available: 0
        }
    },
})
