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
        const parsed = findings.map(result => ({
            ...result,
            cwes: JSON.parse(result.cwes ?? '[]'),
            aliases: JSON.parse(result.aliases ?? '[]'),
            referencesJSON: JSON.parse(result.referencesJSON ?? '[]'),
            spdx: {
                ...result?.spdx || {},
                packagesJSON: JSON.parse(result?.spdx?.packagesJSON ?? '[]'),
                relationshipsJSON: JSON.parse(result?.spdx?.relationshipsJSON ?? '[]')
            }
        })
        )
        const results = {
            ssvc_act: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionCISA.ACT).length > 0).length,
            ssvc_attend: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionCISA.ATTEND).length > 0).length,
            ssvc_track: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionCISA.TRACK).length > 0).length,
            ssvc_track_star: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionCISA.TRACK_STAR).length > 0).length,
            ssvc_immediate: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionFIRST.IMMEDIATE).length > 0).length,
            ssvc_oob: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionFIRST.OUT_OF_BAND).length > 0).length,
            ssvc_scheduled: parsed.filter(f => f.triage.filter(t => t.ssvc === ActionFIRST.SCHEDULED).length > 0).length,
            in_triage: parsed.filter(f => f.triage.filter(t => t.analysisState === 'in_triage').length > 0).length,
            resolved: parsed.filter(f => f.triage.filter(t => t.analysisState === 'resolved').length > 0).length,
            resolved_with_pedigree: parsed.filter(f => f.triage.filter(t => t.analysisState === 'resolved_with_pedigree').length > 0).length,
            exploitable: parsed.filter(f => f.triage.filter(t => t.analysisState === 'exploitable').length > 0).length,
            false_positive: parsed.filter(f => f.triage.filter(t => t.analysisState === 'false_positive').length > 0).length,
            not_affected: parsed.filter(f => f.triage.filter(t => t.analysisState === 'not_affected').length > 0).length,
            code_not_present: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'code_not_present').length > 0).length,
            code_not_reachable: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'code_not_reachable').length > 0).length,
            requires_configuration: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'requires_configuration').length > 0).length,
            requires_dependency: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'requires_dependency').length > 0).length,
            requires_environment: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'requires_environment').length > 0).length,
            protected_by_compiler: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'protected_by_compiler').length > 0).length,
            protected_at_runtime: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'protected_at_runtime').length > 0).length,
            protected_at_perimeter: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'protected_at_perimeter').length > 0).length,
            protected_by_mitigating_control: parsed.filter(f => f.triage.filter(t => t.analysisJustification === 'protected_by_mitigating_control').length > 0).length,
            can_not_fix: parsed.filter(f => f.triage.filter(t => t.analysisResponse === 'can_not_fix').length > 0).length,
            will_not_fix: parsed.filter(f => f.triage.filter(t => t.analysisResponse === 'will_not_fix').length > 0).length,
            update: parsed.filter(f => f.triage.filter(t => t.analysisResponse === 'update').length > 0).length,
            rollback: parsed.filter(f => f.triage.filter(t => t.analysisResponse === 'rollback').length > 0).length,
            workaround_available: parsed.filter(f => f.triage.filter(t => t.analysisResponse === 'workaround_available').length > 0).length,
        }

        return Response.json({ ok: true, results })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
