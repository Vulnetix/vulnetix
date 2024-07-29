import { App, AuthResult } from "@/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';
import { ActionCISA, ActionFIRST } from "ssvc";

export async function onRequestGet(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    try {
        const adapter = new PrismaD1(env.d1db)
        const prisma = new PrismaClient({
            adapter,
            transactionOptions: {
                maxWait: 1500, // default: 2000
                timeout: 2000, // default: 5000
            },
        })
        const { err, result, session } = await (new App(request, prisma)).authenticate()
        if (result !== AuthResult.AUTHENTICATED) {
            return Response.json({ ok: false, error: { message: err }, result })
        }

        const findings = await prisma.findings.findMany({
            where: {
                memberEmail: session.memberEmail,
            },
            omit: {
                memberEmail: true,
            },
            include: {
                spdx: {
                    include: {
                        repo: true
                    }
                },
                triage: true,
                // cdx: true
            }
        })

        const parseJSON = (str) => JSON.parse(str ?? '[]')

        const parsed = findings.map(result => ({
            ...result,
            cwes: parseJSON(result.cwes),
            aliases: parseJSON(result.aliases),
            referencesJSON: parseJSON(result.referencesJSON),
            spdx: {
                ...result?.spdx || {},
                packagesJSON: parseJSON(result?.spdx?.packagesJSON),
                relationshipsJSON: parseJSON(result?.spdx?.relationshipsJSON)
            }
        }))

        const countByFilter = (filterFn) => parsed.filter(filterFn).length

        const ssvcKeys = [
            { key: 'ssvc_act', action: ActionCISA.ACT },
            { key: 'ssvc_attend', action: ActionCISA.ATTEND },
            { key: 'ssvc_track', action: ActionCISA.TRACK },
            { key: 'ssvc_track_star', action: ActionCISA.TRACK_STAR },
            { key: 'ssvc_immediate', action: ActionFIRST.IMMEDIATE },
            { key: 'ssvc_oob', action: ActionFIRST.OUT_OF_BAND },
            { key: 'ssvc_scheduled', action: ActionFIRST.SCHEDULED }
        ]

        const analysisStateKeys = [
            'in_triage', 'resolved', 'resolved_with_pedigree', 'exploitable',
            'false_positive', 'not_affected'
        ]

        const analysisJustificationKeys = [
            'code_not_present', 'code_not_reachable', 'requires_configuration',
            'requires_dependency', 'requires_environment', 'protected_by_compiler',
            'protected_at_runtime', 'protected_at_perimeter', 'protected_by_mitigating_control'
        ]

        const analysisResponseKeys = [
            'can_not_fix', 'will_not_fix', 'update', 'rollback', 'workaround_available'
        ]

        const results = {}

        // Add SSVC keys
        ssvcKeys.forEach(({ key, action }) => {
            results[key] = countByFilter(f => f.triage.some(t => t.ssvc === action))
        })

        // Add analysis state keys
        analysisStateKeys.forEach(state => {
            results[state] = countByFilter(f => f.triage.some(t => t.analysisState === state))
        })

        // Add analysis justification keys
        analysisJustificationKeys.forEach(justification => {
            results[justification] = countByFilter(f => f.triage.some(t => t.analysisJustification === justification))
        })

        // Add analysis response keys
        analysisResponseKeys.forEach(response => {
            results[response] = countByFilter(f => f.triage.some(t => t.analysisResponse === response))
        })

        console.log(results)

        return Response.json({ ok: true, results })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
