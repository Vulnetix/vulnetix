import { App, AuthResult } from "@/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

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

        let findings = await prisma.findings.findMany({
            where: {
                memberEmail: session.memberEmail,
            },
            omit: {
                memberEmail: true,
            },
            include: {
                spdx: true,
                triage: {
                    where: {
                        analysisState: params.state
                    }
                },
                // cdx: true
            }
        })
        const vex = findings.flatMap(({ triage }) => triage)
        const findingKeys = new Set(findings.flatMap(({ spdx, ...rest }) => [...Object.keys(rest), ...Object.keys(spdx)]))
        findings = findings.map(({ spdx, triage, ...rest }) => {
            const finding = { ...rest, ...spdx }
            for (const k of findingKeys) {
                if (typeof finding[k] === 'undefined') {
                    finding[k] = ''
                }
            }
            finding['actions'] = ''
            return finding
        })
        const sca = findings.filter(finding => finding.category === 'sca')
        const sast = findings.filter(finding => finding.category === 'sast')

        const sarifResults = await prisma.sarif.findMany({
            where: {
                memberEmail: session.memberEmail,
            },
            omit: {
                memberEmail: true,
            },
            include: {
                results: true
            }
        })
        const sarifKeys = new Set(sarifResults.flatMap(({ results, ...result }) =>
            results.flatMap(sarif => Object.keys({ ...sarif, ...result }))
        ))

        let sarif = sarifResults.flatMap(({ results, ...result }) =>
            results.map(sarif => ({ ...sarif, ...result }))
        )

        sarif = sarif.map(finding => {
            sarifKeys.forEach(k => {
                finding[k] = finding[k] || ''
            })
            finding['actions'] = ''
            return finding
        })
        return Response.json({ ok: true, sca, sast, sarif, vex })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
