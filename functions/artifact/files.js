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
            }
        })
        const verificationResult = await (new Server(request, prisma)).authenticate()
        if (!verificationResult.isValid) {
            return Response.json({ ok: false, result: verificationResult.message })
        }
        const { searchParams } = new URL(request.url)
        const take = parseInt(searchParams.get('take'), 10) || 50
        const skip = parseInt(searchParams.get('skip'), 10) || 0
        const result = await prisma.Artifact.findMany({
            where: {
                OR: [
                    {
                        spdx: {
                            some: {
                                orgId: verificationResult.session.orgId,
                            },
                        },
                    },
                    {
                        sarif: {
                            some: {
                                orgId: verificationResult.session.orgId,
                            },
                        },
                    },
                    {
                        cdx: {
                            some: {
                                orgId: verificationResult.session.orgId,
                            },
                        },
                    },
                    {
                        vex: {
                            some: {
                                finding: {
                                    is: {
                                        orgId: verificationResult.session.orgId,
                                    },
                                },
                            },
                        },

                    },
                ]
            },
            select: {
                uuid: true,
                type: true,
                date: true,
                bomFormat: true,
                downloadLinks: true,
                spdx: {
                    select: {
                        source: true,
                        repoName: true,
                        spdxVersion: true,
                        createdAt: true,
                        packagesCount: true,
                    },
                },
                sarif: {
                    select: {
                        source: true,
                        fullName: true,
                        toolName: true,
                        toolVersion: true,
                        createdAt: true,
                        resultsCount: true,
                    },
                },
                cdx: {
                    select: {
                        source: true,
                        repoName: true,
                        cdxVersion: true,
                        createdAt: true,
                        dependenciesCount: true,
                    },
                },
                vex: {
                    select: {
                        lastObserved: true,
                        analysisState: true,
                        analysisJustification: true,
                        analysisResponse: true,
                        finding: {
                            select: {
                                source: true,
                                repoName: true,
                                detectionTitle: true,
                            }
                        }
                    },
                },
            },
            take,
            skip,
            orderBy: {
                date: 'desc',
            },
        })

        const artifacts = result.map(artifact => {
            artifact.spdx = artifact.spdx.sort((a, b) => a.createdAt - b.createdAt)?.pop()
            artifact.sarif = artifact.sarif.sort((a, b) => a.createdAt - b.createdAt)?.pop()
            artifact.cdx = artifact.cdx.sort((a, b) => a.createdAt - b.createdAt)?.pop()
            const vex = artifact.vex.sort((a, b) => a.lastObserved - b.lastObserved)?.pop()
            if (vex?.finding) {
                vex.repoName = vex?.finding?.repoName
                vex.source = vex?.finding?.source
                vex.findingTitle = vex?.finding?.detectionTitle
                delete vex.finding
            }
            artifact.vex = vex
            artifact.downloadLink = artifact.downloadLinks.sort((a, b) => a.id - b.id)?.pop()
            delete artifact.downloadLinks
            return artifact
        })

        return Response.json({ ok: true, artifacts })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
