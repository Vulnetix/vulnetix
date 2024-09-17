import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * Input valid serial number UUID URN or CDX URN to retrieve BOM.
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
        params.bomIdentifier
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

/**
 * Adds a new BOM to the repository.
 * Supports all CycloneDX BOM formats and versions.
 * If the submitted BOM does not have a serial number, one will be generated.
 * If the BOM does not have a version the next version number will be added.
 * The response will contain an appropriate Location header to reference the BOM in the repository.
 */
export async function onRequestPost(context) {
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
        const contentType = request.headers.get('Content-Type')
        // const original = await prisma.members.findFirst({
        //     where: {
        //         email: verificationResult.session.memberEmail,
        //     },
        // })
        // return Response.json({ ok: false, result: 'No Change' })
    } catch (err) {
        console.error(err)

        // return Response.json({ ok: false, error: { message: err }, result: 'Bad values supplied' })
    }
}
