import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * Retrieve a list of BOM serial numbers and versions that match the supplied metadata component search criteria.
 */
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
        params.group
        params.name
        params.version
        // const member = await prisma.members.findFirst({
        //     where: {
        //         email: verificationResult.session.memberEmail,
        //     },
        // })
        // return Response.json({ ok: true, member })
    } catch (err) {
        console.error(err)
        // return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
