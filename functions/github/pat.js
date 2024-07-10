import { App, AuthResult } from "@/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

export async function onRequestPost(context) {
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
    const { err, result, session } = await (new App(request, prisma)).authenticate()
    if (result !== AuthResult.AUTHENTICATED) {
        return Response.json({ error: { message: err }, result })
    }
    const body = await request.json()
    if (!body.token.startsWith('github_pat_')) {
        return Response.json({ error: { message: `Invalid PAT provided, expected "github_pat_" prefix.` } })
    }
    const tokenInfo = await prisma.member_keys.create({
        data: {
            memberEmail: session.memberEmail,
            keyLabel: body.label,
            keyType: 'github_pat',
            secret: body.token,
        }
    })
    console.log(`/github/pat github_pat label=${body.label}`, tokenInfo)
    tokenInfo.secretMasked = mask(tokenInfo.secret)
    delete tokenInfo.secret
    return Response.json(tokenInfo)
}
const mask = s => s.slice(0, 11) + s.slice(10).slice(4, s.length - 4).replace(/(.)/g, '*') + s.slice(s.length - 4)