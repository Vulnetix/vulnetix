import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

/**
 * If only the serialNumber parameter is supplied, retrieve the latest version of the BOM from the repository.
 * If providing serialNumber and version, a specific version of the BOM will be retrieved.
 * Supports HTTP content negotiation for all CycloneDX BOM formats and versions.
 * If original is true, returns the original, unmodified BOM.
 * 
 * curl -X GET 'http://localhost:8000/v1/bom?serialNumber=urn%3Auuid%3A3e671687-395b-41f5-a30f-a58921a69b79' -H 'accept: application/vnd.cyclonedx+json; version=1.4'
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
        params.serialNumber
        params.version
        params.original // bool
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
 * 
 * curl -X POST "http://localhost:8000/v1/bom" -H "Content-Type: application/vnd.cyclonedx+json; version=1.4" -d "{\"bomFormat\":\"CycloneDX\",\"specVersion\":\"1.3\",\"serialNumber\":\"urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79\",\"version\":1,\"components\":[{\"type\":\"library\",\"name\":\"acme-library\",\"version\":\"1.0.0\"}]}"
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

/**
 * If only the serialNumber parameter is supplied, all versions of the BOM will be deleted from the repository.
 * If serialNumber and version are supplied, only the specific version will be deleted from the repository.
 * 
 * curl -X DELETE 'http://localhost:8000/v1/bom/serialNumber=urn%3Auuid%3A3e671687-395b-41f5-a30f-a58921a69b79?version=1'
 */
export async function onRequestDelete(context) {
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
        params.serialNumber
        params.version
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
