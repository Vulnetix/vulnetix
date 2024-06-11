export async function onRequestGet(context) {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    if (
        params?.org &&
        params?.email &&
        params?.hash
    ) {
        console.log('org', params.org)
        const exists = await env.d1db.prepare(
            "SELECT email FROM members WHERE email = ?"
        )
            .bind(params.email)
            .first('email')
        if (exists === params.email) {
            return new Response.json({ 'err': 'Forbidden' })
        }
        const info = await env.d1db.prepare('INSERT INTO members (orgName, email, passwordHash) VALUES (?1, ?2, ?3)')
            .bind(params.org, params.email, await pbkdf2(params.hash))
            .run()
        console.log(`/register email=${params.email}`, info)
        return new Response.json(info)
    }
    return new Response.json({ 'err': 'missing properties /register/[org]/[email]/[sha1]' })
}

async function pbkdf2(password, iterations = 1e6, hashBits = 512) {
    const pwUtf8 = new TextEncoder().encode(password)                                                   // encode pw as UTF-8
    const pwKey = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveBits'])         // create pw key
    const saltUint8 = crypto.getRandomValues(new Uint8Array(16))                                        // get random salt
    const params = { name: 'PBKDF2', hash: `SHA-${hashBits}`, salt: saltUint8, iterations: iterations } // pbkdf2 params
    const keyBuffer = await crypto.subtle.deriveBits(params, pwKey, hashBits)                           // derive key
    const keyArray = Array.from(new Uint8Array(keyBuffer))                                              // key as byte array
    const saltArray = Array.from(new Uint8Array(saltUint8))                                             // salt as byte array
    const iterHex = ('000000' + iterations.toString(16)).slice(-6)                                      // iter’n count as hex
    const iterArray = iterHex.match(/.{2}/g).map(byte => parseInt(byte, 16))                            // iter’ns as byte array
    const compositeArray = [].concat(saltArray, iterArray, keyArray)                                    // combined array
    const compositeStr = compositeArray.map(byte => String.fromCharCode(byte)).join('')                 // combined as string
    return btoa('v01' + compositeStr)
}
