import { readRequestBody } from "../../src/cf-utils"

export async function onRequestPost(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    const signature = request.headers.get('X-Hub-Signature-256')
    if (!signature) {
        return Response.json({ 'err': 'Forbidden' })
    }
    console.log('signature', signature)

    if (request.method !== "POST") {
        return Response.json({ 'err': 'Method' })
    }

    // if (signature) {
    //     const info = await env.d1db.prepare('INSERT INTO audit (installation_id, memberEmail, access_key) VALUES (?1, ?2, ?3)')
    //         .bind(token, session?.memberEmail, data.access_token)
    //         .run()
    //     console.log(`/github/install installation_id=${params?.installation_id} kid=${token}`, info)
    //     return Response.json(info)
    // }
    return new Response(await readRequestBody(request))
}

async function verifySignature(secret, header, payload) {
    let encoder = new TextEncoder()
    let parts = header.split("=")
    let sigHex = parts[1]

    let algorithm = { name: "HMAC", hash: { name: 'SHA-256' } }

    let keyBytes = encoder.encode(secret)
    let extractable = false
    let key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        algorithm,
        extractable,
        ["sign", "verify"],
    )

    let sigBytes = hexToBytes(sigHex)
    let dataBytes = encoder.encode(payload)
    let equal = await crypto.subtle.verify(
        algorithm.name,
        key,
        sigBytes,
        dataBytes,
    )

    return equal
}

function hexToBytes(hex) {
    let len = hex.length / 2
    let bytes = new Uint8Array(len)

    let index = 0
    for (let i = 0; i < hex.length; i += 2) {
        let c = hex.slice(i, i + 2)
        let b = parseInt(c, 16)
        bytes[index] = b
        index += 1
    }

    return bytes
}
