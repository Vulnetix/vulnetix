/**
 * readRequestBody reads in the incoming request body
 * Use await readRequestBody(..) in an async function to get the string
 * @param {Request} request the incoming request to read from
 */
export async function readRequestBody(request) {
    const contentType = request.headers.get("content-type")
    if (contentType.includes("application/json")) {
        return JSON.stringify(await request.json())
    } else if (contentType.includes("application/text")) {
        return request.text()
    } else if (contentType.includes("text/html")) {
        return request.text()
    } else if (contentType.includes("form")) {
        const formData = await request.formData()
        const body = {}
        for (const entry of formData.entries()) {
            body[entry[0]] = entry[1]
        }
        return JSON.stringify(body)
    } else {
        // Perhaps some other type of data was submitted in the form
        // like an image, or some other binary data.
        throw new Error("Unhandled type")
    }
}

export async function pbkdf2Verify(key, password, hashBits = 512) {
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

export async function pbkdf2(password, iterations = 1e5, hashBits = 512) {
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

export function isJSON(str) {
    try {
        return (JSON.parse(str) && !!str);
    } catch (e) {
        return false;
    }
}
