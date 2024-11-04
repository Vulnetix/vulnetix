import { AuthResult, Server } from "@/utils";
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
        const findingCount = await prisma.Finding.count()
        let finding;
        if (findingCount > 0) {
            finding = await prisma.Finding.findFirst({
                where: {
                    orgId: verificationResult.session.orgId,
                    AND: {
                        triage: {
                            every: { seen: 0, analysisState: 'in_triage' }
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
                            repo: true,
                        }
                    },
                    cdx: {
                        include: {
                            repo: true,
                        }
                    },
                },
                take: 1,
                skip: 0,
                orderBy: {
                    createdAt: 'asc', // oldest first
                }
            })
        }
        if (finding?.referencesJSON) {
            finding.references = JSON.parse(finding.referencesJSON)
            delete finding.referencesJSON
        }
        if (finding?.timelineJSON) {
            finding.timeline = JSON.parse(finding.timelineJSON)
            delete finding.timelineJSON
        }
        if (finding?.exploitsJSON) {
            finding.exploits = JSON.parse(finding.exploitsJSON)
            delete finding.exploitsJSON
        }
        if (finding?.knownExploitsJSON) {
            finding.knownExploits = JSON.parse(finding.knownExploitsJSON)
            delete finding.knownExploitsJSON
        }
        if (finding?.aliases) {
            finding.aliases = JSON.parse(finding.aliases)
        }
        if (finding?.cwes) {
            finding.cwes = JSON.parse(finding.cwes)
        }

        return Response.json({ ok: true, finding, findingCount })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
