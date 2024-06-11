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
        params?.email &&
        params?.hash
    ) {
        const passwordHash = await env.d1db.prepare(
            "SELECT passwordHash FROM members WHERE email = ?"
        )
            .bind(params.email)
            .first('passwordHash')
        const verified = await pbkdf2Verify(passwordHash, params.hash)
        if (!verified) {
            return Response.json({ 'err': 'Forbidden' })
        }
        const token = crypto.randomUUID()
        const authn_ip = request.headers.get('cf-connecting-ip')
        const authn_ua = request.headers.get('user-agent')
        const issued = +new Date()
        const expiry = issued + (86400 * 30) // 30 days
        const secret = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", crypto.getRandomValues(new Uint32Array(26))))).map((b) => b.toString(16).padStart(2, "0")).join("")
        const info = await env.d1db.prepare('INSERT INTO sessions (kid, memberEmail, expiry, issued, secret, authn_ip, authn_ua) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
            .bind(token, params.email, expiry, issued, secret, authn_ip, authn_ua)
            .run()
        console.log(`/login kid=${token}`, info)
        return Response.json({ token, expiry })
    }
    return Response.json({ 'err': 'Authentication' })
}

async function pbkdf2Verify(key, password, hashBits = 512) {
    let compositeStr = null                     // composite key is salt, iteration count, and derived key
    try { compositeStr = atob(key) } catch (e) { throw new Error('Invalid key') }                       // decode from base64
    const version = compositeStr.slice(0, 3)    //  3 bytes
    const saltStr = compositeStr.slice(3, 19)   // 16 bytes (128 bits)
    const iterStr = compositeStr.slice(19, 22)  //  3 bytes
    const keyStr = compositeStr.slice(22)       // remaining bytes
    if (version != 'v01') {
        throw new Error('Invalid key')
    }
    // -- recover salt & iterations from stored (composite) key
    const saltUint8 = new Uint8Array(saltStr.match(/./g).map(ch => ch.charCodeAt(0)))                   // salt as Uint8Array
    // note: cannot use TextEncoder().encode(saltStr) as it generates UTF-8
    const iterHex = iterStr.match(/./g).map(ch => ch.charCodeAt(0).toString(16)).join('')               // iter’n count as hex
    const iterations = parseInt(iterHex, 16)                                                            // iter’ns
    // -- generate new key from stored salt & iterations and supplied password
    const pwUtf8 = new TextEncoder().encode(password)                                                   // encode pw as UTF-8
    const pwKey = await crypto.subtle.importKey('raw', pwUtf8, 'PBKDF2', false, ['deriveBits'])         // create pw key
    const params = { name: 'PBKDF2', hash: `SHA-${hashBits}`, salt: saltUint8, iterations: iterations } // pbkdf params
    const keyBuffer = await crypto.subtle.deriveBits(params, pwKey, hashBits)                           // derive key
    const keyArray = Array.from(new Uint8Array(keyBuffer))                                      // key as byte array
    const keyStrNew = keyArray.map(byte => String.fromCharCode(byte)).join('')                  // key as string
    return keyStrNew === keyStr // test if newly generated key matches stored key
}
