import { AuthResult, Server, parseSearchQuery } from "@/utils";
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
        const verificationResult = await (new Server(request, prisma)).authenticate()
        if (!verificationResult.isValid) {
            return Response.json({ ok: false, result: verificationResult.message })
        }
        const { searchParams } = new URL(request.url)
        const { exclusive, inclusive, exclude } = parseSearchQuery(searchParams.get('q'))
        console.log(exclusive, inclusive, exclude)
        return Response.json({ ok: true, results: [] })
        const findings = await prisma.Finding.findMany({
            where: {
                orgId: verificationResult.session.orgId,
                AND: {
                    triage: {
                        every: { seen: 0, analysisState: 'in_triage', }
                    }
                },
            },
            omit: {
                memberEmail: true,
            },
            include: {
                triage: true,
                spdx: {
                    include: {
                        repo: true
                    }
                },
                cdx: {
                    include: {
                        repo: true
                    }
                },
            },
            take,
            skip,
            orderBy: {
                createdAt: 'asc',
            }
        })

        return Response.json({
            ok: true, findings: findings.map(finding => {
                finding.references = JSON.parse(finding.referencesJSON)
                delete finding.referencesJSON
                finding.aliases = JSON.parse(finding.aliases)
                finding.cwes = JSON.parse(finding.cwes)
                return finding
            })
        })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
