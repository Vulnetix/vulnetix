export const onRequestGet = async context => {
    if (
        context.params?.email &&
        context.params?.hash
    ) {
        console.log('email', context.params.email)
        const passwordHash = await context.env.d1db.prepare(
            "SELECT passwordHash FROM members WHERE email = ?"
        )
            .bind(context.params.email)
            .first('passwordHash')
        if (!pbkdf2Verify(passwordHash, context.params.hash)) {
            return new Response.json({ 'err': 'Forbidden' })
        }
        const token = crypto.randomUUID()
        const authn_ip = context.request.headers.get('cf-connecting-ip')
        const authn_ua = context.request.headers.get('user-agent')
        const issued = +new Date()
        const expiry = (issued / 1000) + (86400 * 30) // 30 days
        const secret = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", crypto.getRandomValues(new Uint32Array(26))))).map((b) => b.toString(16).padStart(2, "0")).join("")
        const info = await context.env.d1db.prepare('INSERT INTO sessions (kid, memberEmail, expiry, issued, secret, authn_ip, authn_ua) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
            .bind(token, context.params.email, expiry, issued, secret, authn_ip, authn_ua)
            .run()
        console.log(`/login kid=${token}`, info)
        return Response.json({ token, expiry })
    }
    return new Response.json({ 'err': 'Authentication' })
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
