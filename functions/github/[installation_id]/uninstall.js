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
    const adapter = new PrismaD1(env.d1db)
    const prisma = new PrismaClient({
        adapter,
        transactionOptions: {
            maxWait: 1500, // default: 2000
            timeout: 2000, // default: 5000
        },
    })
    const app = new App(request, prisma)
    let err, result, session;
    const authToken = request.headers.get('x-trivialsec')
    if (!!authToken.trim()) {
        ({ err, result, session } = await app.authenticate())
        if (result !== AuthResult.AUTHENTICATED) {
            return Response.json({ error: { message: err }, result })
        }
    }
    try {
        const response = await prisma.github_apps.delete({
            where: { installationId: params.installation_id }
        })
        console.log(`/github/uninstall session kid=${session.token}`, response)
        return Response.json(response)
    } catch (err) {
        console.error(err)

        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
