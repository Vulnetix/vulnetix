import { Server } from "@/utils";
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
    const take = parseInt(searchParams.get('take'), 10) || 50
    const skip = parseInt(searchParams.get('skip'), 10) || 0
    let spdx = await prisma.SPDXInfo.findMany({
        where: {
            orgId: verificationResult.session.orgId,
        },
        select: {
            spdxId: true,
            source: true,
            repoName: true,
            artifactUuid: true,
            spdxVersion: true,
            name: true,
            createdAt: true,
            toolName: true,
            packagesCount: true,
            artifact: {
                select: {
                    downloadLinks: {
                        select: {
                            contentType: true,
                            url: true,
                        }
                    }
                }
            }
        },
        take,
        skip,
        orderBy: {
            createdAt: 'desc',
        },
    })

    const repos = await prisma.gitRepo.findMany({
        where: {
            fullName: { in: spdx.map(s => s?.repoName).filter(s => !!s).filter((value, index, array) => array.indexOf(value) === index) },
        },
        select: {
            avatarUrl: true,
            fullName: true,
        },
    })
    const repoMap = new Map(repos.map(repo => [repo.fullName, repo.avatarUrl]));

    spdx = spdx.map(item => {
        let updatedItem = { ...item }
        if (item.repoName && repoMap.has(item.repoName)) {
            updatedItem.avatarUrl = repoMap.get(item.repoName)
        }
        if (item.artifact && item.artifact.downloadLinks && item.artifact.downloadLinks.length) {
            updatedItem.downloadLink = item.artifact.downloadLinks.filter(l => l.contentType === 'application/spdx+json')?.pop()?.url
        }
        delete updatedItem.artifact

        return updatedItem
    })

    return Response.json({ ok: true, spdx })
}
