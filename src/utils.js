export const unauthenticatedRoutes = {
    static: [
        "/",
        '/register',
        '/api/register',
        '/logout'
    ],
    prefixes: [
        '/login',
        '/sso',
        '/api/login',
        '/api/github/install',
        '/webhooks',
    ],
}

export class VexAnalysisState {
    static get resolved() { return "Resolved" }
    static get resolved_with_pedigree() { return "Resolved With Pedigree" }
    static get exploitable() { return "Exploitable" }
    static get in_triage() { return "In Triage" }
    static get false_positive() { return "False Positive" }
    static get not_affected() { return "Not Affected" }
}
export class VexAnalysisJustification {
    static get code_not_present() { return "Code Not Present" }
    static get code_not_reachable() { return "Code Not Reachable" }
    static get requires_configuration() { return "Requires Configuration" }
    static get requires_dependency() { return "Requires Dependency" }
    static get requires_environment() { return "Requires Environment" }
    static get protected_by_compiler() { return "Protected By Compiler" }
    static get protected_at_runtime() { return "Protected At Runtime" }
    static get protected_at_perimeter() { return "Protected At Perimeter" }
    static get protected_by_mitigating_control() { return "Protected By Mitigating Control" }
}
export class VexAnalysisResponse {
    static get can_not_fix() { return "Can Not Fix" }
    static get will_not_fix() { return "Will Not Fix" }
    static get update() { return "Update" }
    static get rollback() { return "Rollback" }
    static get workaround_available() { return "Workaround Available" }
}

/**
 * Class representing the possible results of an authentication attempt.
 */
export class AuthResult {
    static get FORBIDDEN() { return "Forbidden" }
    static get REVOKED() { return "Revoked" }
    static get EXPIRED() { return "Expired" }
    static get AUTHENTICATED() { return "Authenticated" }
}

/**
 * Class representing the results of an signed request verification.
 */
export class SignatureVerificationResult {
    constructor(isValid, message, signature, timestamp, session) {
        this.isValid = isValid // Boolean indicating whether the signature is valid
        this.message = message // Message detailing the result of the verification
        this.signature = signature // The signature that was provided in the request
        this.timestamp = timestamp // The timestamp provided in the request
        this.session = session // The session object retrieved from the database
    }
}

/**
 * Class representing an application with authentication logic.
 */
export class Server {
    /**
     * Create an App instance.
     * @param {Object} request - The request object, typically containing headers.
     * @param {Object} prisma - The Prisma client instance for database interaction.
     */
    constructor(request, prisma) {
        this.request = request
        this.prisma = prisma
    }

    /**
     * Checks if an email has been registered or not.
     * @return {Promise<Object>} The authentication result.
     */
    async memberExists(memberEmail) {
        try {
            const member = await this.prisma.Member.findFirstOrThrow({
                where: { email: memberEmail }
            })

            return { exists: memberEmail === member.email, member }
        } catch (err) {
            if (err.name === 'NotFoundError') {
                return { exists: false }
            }
            throw err
        }
    }
}

/**
 * A utility class for securely storing and retrieving a single shared secret key
 * using the IndexedDB API. This key is intended to be used for signing requests
 * to a server using HMAC.
 */
export class Client {
    #db;
    #storeName;

    /**
     * Creates an instance of Client and initializes the connection
     * to the IndexedDB database.
     * 
     * @param {string} dbName - The name of the IndexedDB database.
     * @param {string} storeName - The name of the object store within the database.
     */
    constructor(dbName = 'Vulnetix', storeName = 'SecretStore') {
        this.#storeName = storeName
        this.#db = this.#initDB(dbName)
    }

    async #initDB(dbName) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1)

            request.onupgradeneeded = (event) => {
                const db = event.target.result
                if (!db.objectStoreNames.contains(this.#storeName)) {
                    db.createObjectStore(this.#storeName, { keyPath: 'id' })
                }
            }

            request.onsuccess = (event) => {
                resolve(event.target.result)
            }

            request.onerror = (event) => {
                reject(`Error opening IndexedDB: ${event.target.error}`)
            }
        })
    }

    async #getDB() {
        return this.#db
    }

    /**
     * Checks if there is an active login by verifying the presence of a valid session secret key.
     * 
     * @returns {Promise<boolean>} - A promise that resolves to true if there's an active login, false otherwise.
     */
    async isLoggedIn() {
        try {
            const secretKey = await this.retrieveKey('sessionSecret')
            return !!secretKey // Returns true if secretKey exists and is not null/undefined/empty string
        } catch (_) {
            return false
        }
    }

    /**
     * Deletes the shared secret key from the IndexedDB store.
     * 
     * @param {string} keyId - The id for the record of the secret key.
     * @returns {Promise<void>} - A promise that resolves when the key is successfully deleted.
     */
    async deleteKey(keyId) {
        const db = await this.#getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.#storeName], 'readwrite')
            const store = transaction.objectStore(this.#storeName)
            const request = store.delete(keyId)

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = (event) => {
                reject(`Failed to delete the ${keyId} key: ${event.target.error}`)
            }
        })
    }

    /**
     * Saves the shared secret key to the IndexedDB store.
     * 
     * @param {string} keyId - The id for the record of the secret key.
     * @param {Object} value - The value Object to store.
     * @returns {Promise<void>} - A promise that resolves when the key is successfully stored.
     */
    async storeKey(keyId, value) {
        const db = await this.#getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.#storeName], 'readwrite')
            const store = transaction.objectStore(this.#storeName)
            const request = store.put({ id: keyId, ...value })

            request.onsuccess = () => {
                resolve()
            }

            request.onerror = (event) => {
                reject(`Error storing the ${keyId} key: ${event.target.error}`)
            }
        })
    }

    /**
     * Retrieves the shared secret key from the IndexedDB store.
     * 
     * @param {string} keyId - The id for the record of the secret key.
     * @returns {Promise<string>} - A promise that resolves to the stored secret key.
     */
    async retrieveKey(keyId) {
        const db = await this.#getDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.#storeName], 'readonly')
            const store = transaction.objectStore(this.#storeName)

            const request = store.get(keyId)

            request.onsuccess = (event) => {
                resolve(event.target.result || null)
            }

            request.onerror = (event) => {
                reject(`Error retrieving the ${keyId} key: ${event.target.error}`)
            }
        })
    }

    /**
     * Creates payload bytes for the signing or verification process
     * 
     * @param {string} method - The HTTP method (e.g., 'GET', 'POST') of the request.
     * @param {string} path - The path of the request (e.g., '/api/data').
     * @param {Object} kid - The Vulnetix KID to sign as a request header.
     * @param {Object} timestamp - The unix timestamp to sign as a request header.
     * @param {string} [body] - The optional body of the request. Base64 encoded if present.
     * @returns {Promise<string>} - A promise that resolves to the generated HMAC signature.
     */
    static makePayload({ method = "GET", path, kid, timestamp, body = null }) {
        // Normalize method to uppercase to handle case insensitivity
        const normalizedMethod = method.toUpperCase()

        // Determine if the method supports a body
        const supportsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)

        const headers = {
            'X-Vulnetix-KID': kid,
            'X-Timestamp': timestamp,
        }

        const payload = {
            method: normalizedMethod,
            path,
            headers,
        }

        // If the method supports a body and a body is provided, include the body in the payload
        if (supportsBody && body) {
            payload.body = encodeToBase64(body)
        }

        const encoder = new TextEncoder()
        const payloadString = JSON.stringify(payload)
        return encoder.encode(payloadString)
    }

    /**
     * Signs a request using the stored secret key. The signature is created using
     * HMAC with SHA-512.
     * 
     * @param {string} method - The HTTP method (e.g., 'GET', 'POST') of the request.
     * @param {string} path - The path of the request (e.g., '/api/data').
     * @param {Object} headers - The headers of the request.
     * @param {string} [body] - The optional body of the request. Base64 encoded if present.
     * @param {string} secretKey - The session secret key to sign requests
     * @returns {Promise<string>} - A promise that resolves to the generated HMAC signature.
     */
    static async signRequest({ method = "GET", path, kid, body = null, secretKey }) {
        if (!secretKey) {
            throw new Error('Secret key is required.')
        }
        const timestamp = new Date().getTime()
        const secretKeyBytes = new TextEncoder().encode(secretKey)
        const payloadBytes = Client.makePayload({
            method,
            path,
            kid,
            timestamp,
            body
        })
        const key = await crypto.subtle.importKey(
            "raw",
            secretKeyBytes,
            { name: "HMAC", hash: "SHA-512" },
            false,
            ["sign"]
        )
        const signatureBytes = await crypto.subtle.sign("HMAC", key, payloadBytes)
        const signature = bufferToHex(signatureBytes)

        return { signature, timestamp }
    }

    /**
     * Performs a Browser fetch GET request with a signature using the stored secret key.
     * 
     * @param {string} path - The URL path segment, excluding the origin.
     * @returns {Promise<Response>} - A promise that resolves to the fetch API response.
     */
    async get(path) {
        return this.signedFetch(`/api${path}`)
    }

    /**
     * Performs a Browser fetch DELETE request with a signature using the stored secret key.
     * 
     * @param {string} path - The URL path segment, excluding the origin.
     * @returns {Promise<Response>} - A promise that resolves to the fetch API response.
     */
    async delete(path) {
        return this.signedFetch(`/api${path}`, { method: 'DELETE' })
    }

    /**
     * Performs a Browser fetch GET request with a signature using the stored secret key.
     * 
     * @param {string} path - The URL path segment, excluding the origin.
     * @param {string} [body] - The optional body of the request.
     * @param {Object} [headers={}] - The extra headers to include in the request.
     * @returns {Promise<Response>} - A promise that resolves to the fetch API response.
     */
    async post(path, body, headers = {}) {
        if (typeof body === 'object') {
            body = encodeURIComponent(JSON.stringify(body))
            headers = { 'Content-Type': 'application/json', ...headers }
        }
        const method = 'POST'
        return this.signedFetch(`/api${path}`, { method, body, headers })
    }

    /**
     * Performs a Browser fetch request with the appropriate headers and signature using the stored secret key.
     * 
     * @param {string} path - The URL path segment, excluding the origin.
     * @param {string} method - The HTTP method (e.g., 'GET', 'POST') of the request.
     * @param {Object} [headers={}] - The extra headers to include in the request.
     * @param {string} [body] - The optional body of the request.
     * @returns {Promise<Response>} - A promise that resolves to the fetch API response.
     */
    async signedFetch(path, { method = 'GET', headers = {}, body = null } = {}) {
        const url = `${location.origin}${path}`
        const session = await this.retrieveKey(`session`)
        headers = { ...headers, 'X-Vulnetix-KID': session?.kid }
        const normalizedMethod = method.toUpperCase()
        const supportsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)
        if (!!session?.secret) {
            const { signature, timestamp } = await Client.signRequest({
                method: normalizedMethod,
                path,
                kid: session?.kid,
                body,
                secretKey: session?.secret,
            })
            headers = {
                ...headers,
                'Authorization': `HMAC ${signature}`,
                'X-Timestamp': timestamp,
            }
        }
        const response = await fetch(url, {
            method,
            headers,
            body: supportsBody && body ? body : null,  // Include body only for methods that support it
        })
        const respText = await response.text()
        if (!response.ok) {
            console.error(`${method} ${url}`)
            console.error(`req headers=${JSON.stringify(headers, null, 2)}`)
            console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
            console.error(respText)
            console.error(`Error! status: ${response.status} ${response.statusText}`)
        }
        if (!isJSON(respText)) {
            throw new Error(`There was an error fetching the issue from the server, please retry shortly.`)
        }
        const data = JSON.parse(respText)
        if (data?.error?.message) {
            throw new Error(data.error.message.toString())
        }
        if (["Expired", "Revoked", "Forbidden"].includes(data?.result)) {
            console.error(data.result, data)
            // window.location = `${window.location.origin}/logout`
        }
        return { ok: response.ok, status: response.status, statusText: response.statusText, result: data?.result, data, url }
    }
}

export class OSV {
    constructor() {
        this.headers = {
            'Accept': 'application/json',
            'User-Agent': 'Vulnetix',
        }
        this.baseUrl = "https://api.osv.dev/v1"
    }
    async fetchJSON(url, body = null, method = 'POST') {
        try {
            if (method === 'POST' && typeof body !== "string") {
                body = JSON.stringify(body)
            }
            const response = await fetch(url, { headers: this.headers, method, body })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`${method} ${url}`)
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`OSV error! status: ${response.status} ${response.statusText}`)
            }
            if (!isJSON(respText)) {
                return { ok: false, status: response.status, statusText: response.statusText, error: { message: `Response not JSON format` }, content: respText, url }
            }
            const content = JSON.parse(respText)
            return { ok: response.ok, status: response.status, statusText: response.statusText, content, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { url, status: 500, error: { message: e.message, lineno, colno } }
        }
    }
    async queryBatch(prisma, orgId, memberEmail, queryArr) {
        // https://google.github.io/osv.dev/post-v1-querybatch/
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `osv` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('OSV.dev Integration is Disabled')
        }
        const url = `${this.baseUrl}/querybatch`
        const results = []
        for (const queries of chunkArray(queryArr, 1000)) {
            const resp = await this.fetchJSON(url, { queries })
            if (resp?.content?.results) {
                const items = resp.content.results.map(r => r?.vulns).flat(1).filter(q => q?.id)
                const createLog = await prisma.IntegrationUsageLog.create({
                    data: {
                        memberEmail,
                        orgId,
                        source: 'osv',
                        request: JSON.stringify({ method: 'POST', url, queries }).trim(),
                        response: JSON.stringify({ body: items.filter(i => !!i).map(i => convertIsoDatesToTimestamps(i)), status: resp.status }).trim(),
                        statusCode: resp?.status || 500,
                        createdAt: new Date().getTime(),
                    }
                })
                // console.log(`osv.queryBatch()`, createLog)
                results.push(...resp.content.results)
            }
        }
        return results
    }
    async query(prisma, orgId, memberEmail, vulnId) {
        // https://google.github.io/osv.dev/get-v1-vulns/
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `osv` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('OSV.dev Integration is Disabled')
        }
        const url = `${this.baseUrl}/vulns/${vulnId}`
        const resp = await this.fetchJSON(url, null, "GET")
        if (resp?.content) {
            const result = resp.content
            const createLog = await prisma.IntegrationUsageLog.create({
                data: {
                    memberEmail,
                    orgId,
                    source: 'osv',
                    request: JSON.stringify({ method: "GET", url, vulnId }).trim(),
                    response: JSON.stringify({ body: convertIsoDatesToTimestamps(result), status: resp.status }).trim(),
                    statusCode: resp?.status || 500,
                    createdAt: new Date().getTime(),
                }
            })
            // console.log(`osv.query()`, createLog)
            return result
        }
    }
}

export class EPSS {
    constructor() {
        this.headers = {
            'User-Agent': 'Vulnetix',
        }
        this.baseUrl = "https://api.first.org/data/v1"
    }
    async fetchJSON(url, body = null, method = 'POST') {
        try {
            if (method === 'POST' && typeof body !== "string") {
                body = JSON.stringify(body)
            }
            const response = await fetch(url, { headers: this.headers, method, body })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`${method} ${url}`)
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`EPSS error! status: ${response.status} ${response.statusText}`)
            }
            if (!isJSON(respText)) {
                return { ok: false, status: response.status, statusText: response.statusText, error: { message: `Response not JSON format` }, content: respText, url }
            }
            const content = JSON.parse(respText)
            return { ok: response.ok, status: response.status, statusText: response.statusText, content, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { url, status: 500, error: { message: e.message, lineno, colno } }
        }
    }
    async query(prisma, orgId, memberEmail, cve) {
        // https://google.github.io/osv.dev/get-v1-vulns/
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `first` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('FIRST.org Integration is Disabled')
        }
        const url = `${this.baseUrl}/epss?cve=${cve}`
        const resp = await this.fetchJSON(url, null, "GET")
        if (resp?.content) {
            const createLog = await prisma.IntegrationUsageLog.create({
                data: {
                    memberEmail,
                    orgId,
                    source: 'first',
                    request: JSON.stringify({ method: "GET", url }).trim(),
                    response: JSON.stringify({ body: convertIsoDatesToTimestamps(resp.content), status: resp.status }).trim(),
                    statusCode: resp?.status || 500,
                    createdAt: new Date().getTime(),
                }
            })
            // console.log(`epss.query()`, createLog)
            return resp.content.data.filter(d => d.cve === cve).pop()
        }
    }
}

export class MitreCVE {
    constructor() {
        this.headers = {
            'User-Agent': 'Vulnetix',
        }
        this.baseUrl = "https://github.com/CVEProject/cvelistV5/raw/refs/heads/main/cves/"
        this.cveRegex = new RegExp(`^CVE-\\d{4}-\\d{4,}$`)
    }

    async fetchJSON(url, body = null, method = 'GET') {
        try {
            if (method === 'POST' && typeof body !== "string") {
                body = JSON.stringify(body)
            }
            const response = await fetch(url, { headers: this.headers, method, body })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`${method} ${url}`)
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`MitreCVE error! status: ${response.status} ${response.statusText}`)
            }
            if (!isJSON(respText)) {
                return { ok: false, status: response.status, statusText: response.statusText, error: { message: `Response not JSON format` }, content: respText, url }
            }
            const content = JSON.parse(respText)
            return { ok: response.ok, status: response.status, statusText: response.statusText, content, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { url, status: 500, error: { message: e.message, lineno, colno } }
        }
    }

    constructURL(cveId) {
        if (!this.cveRegex.test(cveId)) {
            throw new Error("Invalid CVE ID format. Expected format: CVE-YYYY-NNNNN....")
        }
        const [, year, number] = cveId.split('-')
        const subfolder = number.slice(0, -3) + "xxx"
        const path = `${year}/${subfolder}/${cveId}.json`
        return `${this.baseUrl}${path}`
    }

    async query(prisma, orgId, memberEmail, cveId) {
        const mitreCveIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `mitre-cve` } } })
        if (!!mitreCveIntegration?.suspend) {
            throw new Error('Mitre CVE Integration is Disabled')
        }
        let url = `https://cveawg.mitre.org/api/cve/${cveId}`
        const resp = await this.fetchJSON(url)

        if (resp?.content) {
            const data = resp.content
            const createLog = await prisma.IntegrationUsageLog.create({
                data: {
                    memberEmail,
                    orgId,
                    source: 'mitre-cve',
                    request: JSON.stringify({ method: "GET", url }).trim(),
                    response: JSON.stringify({ body: convertIsoDatesToTimestamps(data), status: resp.status }).trim(),
                    statusCode: resp?.status || 500,
                    createdAt: new Date().getTime(),
                }
            })
            // console.log(`MitreCVE.query()`, createLog)
            return data
        } else {
            url = this.constructURL(cveId)
            const response = await this.fetchJSON(url)

            if (response?.content) {
                const cveData = response.content
                const log = await prisma.IntegrationUsageLog.create({
                    data: {
                        memberEmail,
                        orgId,
                        source: 'mitre-cve',
                        request: JSON.stringify({ method: "GET", url }).trim(),
                        response: JSON.stringify({ body: convertIsoDatesToTimestamps(cveData), status: response.status }).trim(),
                        statusCode: response?.status || 500,
                        createdAt: new Date().getTime(),
                    }
                })
                // console.log(`MitreCVE.query()`, log)
                return cveData
            }
        }
    }
}

export class VulnCheck {
    constructor(BearerToken) {
        this.headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${BearerToken}`,
            'User-Agent': 'Vulnetix',
        }
        this.baseUrl = "https://api.vulncheck.com/v3"
    }
    async fetchJSON(url) {
        try {
            const response = await fetch(url, { headers: this.headers })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`VulnCheck error! status: ${response.status} ${response.statusText}`)
            }
            if (!isJSON(respText)) {
                return { ok: false, status: response.status, statusText: response.statusText, error: { message: `Response not JSON format` }, content: respText, url }
            }
            const content = JSON.parse(respText)
            return { ok: response.ok, status: response.status, statusText: response.statusText, content, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { url, error: { message: e.message, lineno, colno } }
        }
    }
    async getPurl(purl) {
        // https://docs.vulncheck.com/api/purl
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `vulncheck` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('VulnCheck Integration is Disabled')
        }
        // for (const vulnerability of vc.content?.data?.vulnerabilities) {
        //     fixedVersion: vulnerability?.fixed_version,
        //     maliciousSource: vulnerability?.research_attributes.malicious_source,
        //     abandoned: vulnerability?.research_attributes.abandoned,
        //     squattedPackage: vulnerability?.research_attributes.squatted_package,
        // }
        const url = `${this.baseUrl}/purl?purl=${purl}`
        // console.log(`VulnCheck.getPurl(${purl})`)
        return this.fetchJSON(url)
    }
    async getCPE(cpe) {
        // https://docs.vulncheck.com/api/cpe
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `vulncheck` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('VulnCheck Integration is Disabled')
        }
        const url = `${this.baseUrl}/cpe?cpe=${cpe}`
        // console.log(`VulnCheck.getCPE(${cpe})`)
        return await this.fetchJSON(url)
    }
    async getCVE(cve_id) {
        // https://docs.vulncheck.com/community/nist-nvd/nvd-2
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `vulncheck` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('VulnCheck Integration is Disabled')
        }
        const url = `${this.baseUrl}/index/nist-nvd2?cve=${cve_id}`
        // console.log(`VulnCheck.getCVE(${cve_id})`)
        return await this.fetchJSON(url)
    }
    async getNVD() {
        // https://docs.vulncheck.com/community/nist-nvd/nvd-2
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `vulncheck` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('VulnCheck Integration is Disabled')
        }
        const url = `${this.baseUrl}/index/nist-nvd2`
        // Check hash before downloading
    }
    async getKEV() {
        // https://docs.vulncheck.com/community/vulncheck-kev/schema
        const githubIntegration = await prisma.IntegrationConfig.findFirst({ where: { orgId, AND: { name: `vulncheck` } } })
        if (!!githubIntegration?.suspend) {
            throw new Error('VulnCheck Integration is Disabled')
        }
        const url = `${this.baseUrl}/index/vulncheck-kev`
        // Check hash before downloading
    }
}

export class GitHub {
    constructor(prisma, orgId, memberEmail, accessToken) {
        this.headers = {
            'Accept': 'application/vnd.github+json',
            'Authorization': `token ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Vulnetix',
        }
        this.baseUrl = "https://api.github.com"
        this.prisma = prisma
        this.orgId = orgId
        this.memberEmail = memberEmail
        this.integrationEnabled = false
    }
    async __IntegrationEnabled() {
        if (this.integrationEnabled) {
            return true
        }
        try {
            const githubIntegration = await this.prisma.IntegrationConfig.findFirst({ where: { orgId: this.orgId, AND: { name: `github` } } })
            this.integrationEnabled = !githubIntegration?.suspend
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)
            this.integrationEnabled = false
        }

        return this.integrationEnabled
    }
    async fetchJSON(url) {
        try {
            if (!this.__IntegrationEnabled()) {
                return { ok: false, url, error: { message: `GitHub Integrations Disabled` } }
            }
            const response = await fetch(url, { headers: this.headers })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`GitHub error! status: ${response.status} ${response.statusText}`)
            }
            if (!isJSON(respText)) {
                return { ok: false, status: response.status, statusText: response.statusText, error: { message: `Response not JSON format` }, content: respText, url }
            }
            const tokenExpiry = (new Date(response.headers.get('GitHub-Authentication-Token-Expiration'))).getTime()
            const content = JSON.parse(respText)
            if (this.memberEmail && this.orgId) {
                const createLog = await this.prisma.IntegrationUsageLog.create({
                    data: {
                        memberEmail: this.memberEmail,
                        orgId: this.orgId,
                        source: 'github',
                        request: JSON.stringify({ method: "GET", url }).trim(),
                        response: JSON.stringify({ body: convertIsoDatesToTimestamps(content), tokenExpiry: tokenExpiry }).trim(),
                        statusCode: response.status,
                        createdAt: new Date().getTime(),
                    }
                })
                // console.log(`GitHub.fetchJSON()`, createLog)
            }

            return { ok: response.ok, status: response.status, statusText: response.statusText, tokenExpiry, error: { message: content?.message }, content, url, raw: respText }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { ok: false, url, error: { message: e.message, lineno, colno } }
        }
    }
    async __FetchSARIF(url) {
        try {
            const headers = Object.assign(this.headers, { 'Accept': 'application/sarif+json' })
            const response = await fetch(url, { headers })
            const respText = await response.text()
            if (!response.ok) {
                console.error(`resp headers=${JSON.stringify(response.headers, null, 2)}`)
                console.error(respText)
                console.error(`GitHub error! status: ${response.status} ${response.statusText}`)
            }
            let content = respText
            if (isJSON(respText)) {
                content = JSON.parse(respText)
            }
            const tokenExpiry = (new Date(response.headers.get('GitHub-Authentication-Token-Expiration'))).getTime()
            return { ok: response.ok, status: response.status, statusText: response.statusText, tokenExpiry, error: { message: content?.message }, content, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { ok: false, url, error: { message: e.message, lineno, colno } }
        }
    }
    async fetchSARIF(url) {
        try {
            const response = await this.__FetchSARIF(url)
            const createLog0 = await this.prisma.IntegrationUsageLog.create({
                data: {
                    memberEmail: this.memberEmail,
                    orgId: this.orgId,
                    source: 'github',
                    request: JSON.stringify({ method: "GET", url }).trim(),
                    response: JSON.stringify({ body: convertIsoDatesToTimestamps(response.content), tokenExpiry: response.tokenExpiry }).trim(),
                    statusCode: response?.status || 500,
                    createdAt: new Date().getTime(),
                }
            })
            // console.log(`GitHub.getRepoSarif()`, createLog0)
            return response
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { ok: false, url, error: { message: e.message, lineno, colno } }
        }
    }
    async getRepoSarif(full_name) {
        // https://docs.github.com/en/rest/code-scanning/code-scanning?apiVersion=2022-11-28#list-code-scanning-analyses-for-a-repository
        const files = []
        const perPage = 100
        let page = 1

        while (true) {
            const url = `${this.baseUrl}/repos/${full_name}/code-scanning/analyses?per_page=${perPage}&page=${page}`
            // console.log(`github.getRepoSarif(${full_name}) ${url}`)
            const data = await this.fetchJSON(url)
            if (!data?.ok) {
                return data
            }
            for (const report of data.content) {
                const sarifUrl = `${this.baseUrl}/repos/${full_name}/code-scanning/analyses/${report.id}`
                // console.log(`github.getRepoSarif(${full_name}) ${sarifUrl}`)
                const sarifData = await this.__FetchSARIF(sarifUrl)
                const createLog = await this.prisma.IntegrationUsageLog.create({
                    data: {
                        memberEmail: this.memberEmail,
                        orgId: this.orgId,
                        source: 'github',
                        request: JSON.stringify({ method: "GET", url: sarifUrl }).trim(),
                        response: JSON.stringify({ body: convertIsoDatesToTimestamps(sarifData.content), tokenExpiry: sarifData.tokenExpiry }).trim(),
                        statusCode: sarifData?.status || 500,
                        createdAt: new Date().getTime(),
                    }
                })
                // console.log(`GitHub.getRepoSarif()`, createLog)
                if (!sarifData?.ok) {
                    return sarifData
                }
                if (report?.id && isSARIF(sarifData.content)) {
                    files.push({
                        full_name,
                        report: Object.assign({}, report),
                        sarif: Object.assign({}, sarifData.content)
                    })
                } else {
                    // console.log(`github.getRepoSarif(${full_name})`, report?.id, isSARIF(sarifData.content), sarifData)
                }
            }

            if (data.content.length < perPage) {
                break
            }

            page++
        }

        return { ok: true, content: files }
    }
    async getRepoSpdx(full_name) {
        // https://docs.github.com/en/rest/dependency-graph/sboms?apiVersion=2022-11-28#export-a-software-bill-of-materials-sbom-for-a-repository
        const url = `${this.baseUrl}/repos/${full_name}/dependency-graph/sbom`
        // console.log(`github.getRepoSpdx(${full_name}) ${url}`)
        const data = await this.fetchJSON(url)
        return data
    }
    async getUserEmails() {
        // https://docs.github.com/en/rest/users/emails?apiVersion=2022-11-28#list-email-addresses-for-the-authenticated-user
        const url = `${this.baseUrl}/user/emails`
        // console.log(`github.getUserEmails() ${url}`)
        const data = await this.fetchJSON(url)
        return data
    }
    async getUser() {
        // https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user
        const url = `${this.baseUrl}/user`
        // console.log(`github.getUser() ${url}`)
        const data = await this.fetchJSON(url)
        return data
    }
    async getInstallations() {
        // https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#list-app-installations-accessible-to-the-user-access-token
        const url = `${this.baseUrl}/user/installations`
        // console.log(`github.getInstallations() ${url}`)
        const data = await this.fetchJSON(url)
        return data
    }
    async revokeToken() {
        const url = `${this.baseUrl}/installation/token`
        try {
            const method = "DELETE"
            const response = await fetch(url, { headers: this.headers, method })
            if (!response.ok) {
                console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
                console.error(`GitHub error! status: ${response.status} ${response.statusText}`)
            }

            return { ok: response.ok, status: response.status, statusText: response.statusText, url }
        } catch (e) {
            const [, lineno, colno] = e.stack.match(/(\d+):(\d+)/)
            console.error(`line ${lineno}, col ${colno} ${e.message}`, e.stack)

            return { ok: false, url, error: { message: e.message, lineno, colno } }
        }
    }
    async getRepos() {
        // https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
        const repos = []
        const perPage = 100
        let page = 1

        while (true) {
            const url = `${this.baseUrl}/user/repos?per_page=${perPage}&page=${page}`
            // console.log(`github.getRepos() ${url}`)
            const data = await this.fetchJSON(url)
            if (!data?.ok) {
                return data
            }
            repos.push(...data.content)

            if (data.content.length < perPage) {
                break
            }

            page++
        }

        return { ok: true, content: repos }
    }
    async getBranch(repoName, branch) {
        // https://docs.github.com/en/rest/branches/branches?apiVersion=2022-11-28#get-a-branch
        const url = `${this.baseUrl}/repos/${repoName}/branches/${branch}`
        const response = await this.fetchJSON(url)
        if (!response.ok) {
            console.error(`req headers=${JSON.stringify(this.headers, null, 2)}`)
            console.error(`GitHub error! status: ${response.status} ${response.statusText}`)
        }

        return response
    }
    async getBranches(full_name) {
        // https://docs.github.com/en/rest/branches/branches?apiVersion=2022-11-28#list-branches
        const branches = []
        const perPage = 100
        let page = 1
        let url;

        while (true) {
            url = `${this.baseUrl}/repos/${full_name}/branches?per_page=${perPage}&page=${page}`
            const data = await this.fetchJSON(url)
            if (data?.content?.status === '401') {
                break
            }
            branches.push(...data.content)

            if (data.content.length < perPage) {
                break
            }

            page++
        }

        return { ok: true, content: branches }
    }
    async getCommit(full_name, commit_sha) {
        // https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28
        const url = `${this.baseUrl}/repos/${full_name}/commits/${commit_sha}`
        // console.log(`github.getCommit() ${url}`)
        const data = await this.fetchJSON(url)
        return data
    }
    async getCommits(full_name, branch_name) {
        // https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28
        const commits = []
        const perPage = 100
        let page = 1
        let url;
        while (true) {
            url = `${this.baseUrl}/repos/${full_name}/commits?sha=${branch_name}&per_page=${perPage}&page=${page}`
            const data = await this.fetchJSON(url)
            commits.push(...data.content)
            if (data.length < perPage) {
                break
            }
            page++
        }

        return { ok: true, content: commits }
    }
}

export const parseSearchQuery = query => {
    const inclusive = []  // for AND groups
    const exclude = []    // for NOT groups
    const exclusive = []  // all terms for OR groups
    const terms = []  // Any of these
    const decodedQuery = decodeURIComponent(query)

    // handle quoted terms
    function processQuotes(str) {
        const result = []
        let currentTerm = ''
        let inQuotes = false

        for (let i = 0; i < str.length; i++) {
            if (str[i] === '"') {
                inQuotes = !inQuotes
                if (!inQuotes && currentTerm) {
                    result.push(currentTerm)
                    currentTerm = ''
                }
            } else if (inQuotes) {
                currentTerm += str[i]
            } else if (str[i] !== ' ') {
                currentTerm += str[i]
            } else if (currentTerm) {
                result.push(currentTerm)
                currentTerm = ''
            }
        }

        if (currentTerm) {
            result.push(currentTerm)
        }

        return result
    }

    // Split by spaces while preserving quoted terms
    const tokens = processQuotes(decodedQuery)

    // Process tokens for OR and NOT groups
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'AND') {
            if (i > 0 && i < tokens.length - 1) {
                inclusive.push({
                    left: tokens[i - 1],
                    right: tokens[i + 1]
                })
                terms.push(tokens[i - 1])
                terms.push(tokens[i + 1])
                // Skip the next token as it's already processed
                i++
            }
        } else if (tokens[i] === 'NOT') {
            if (i > 0 && i < tokens.length - 1) {
                exclude.push(tokens[i + 1])
                // Skip the next token as it's already processed
                i++
            }
        } else {
            // Check if this term is not part of a previous OR/AND group
            const isPartOfGroup = (i > 0 && (tokens[i - 1] === 'AND' || tokens[i - 1] === 'NOT')) ||
                (i < tokens.length - 1 && (tokens[i + 1] === 'AND'))

            if (!isPartOfGroup) {
                exclusive.push(tokens[i])
                terms.push(tokens[i])
            }
        }
    }

    return { exclusive, inclusive, exclude, terms: terms.filter((value, index, array) => array.indexOf(value) === index) }
}

/**
 * Constructs a version range string from version objects following the CVE schema
 * @param {Array} versions - Array of version objects from CVE data
 * @returns {string|null} Formatted version range string or null if invalid
 */
export const constructVersionRangeString = versions => {
    if (!Array.isArray(versions) || versions.length === 0) {
        return null
    }

    const ranges = versions
        .map(v => {
            // Skip invalid entries
            if (!v?.version) return null

            // Case 1: Single version
            if (!v.lessThan && !v.lessThanOrEqual && !v.changes) {
                return `${v.version}`
            }

            // Case 2: Version range with less than
            if (v.lessThan) {
                return `>=${v.version} <${v.lessThan}`
            }

            // Case 3: Version range with less than or equal
            if (v.lessThanOrEqual) {
                return `>=${v.version} <=${v.lessThanOrEqual}`
            }

            // Case 4: Version range with changes
            if (v.changes) {
                // Note: This is a semver string comparison
                const sortedChanges = [...v.changes].sort((a, b) => {
                    // Split versions into components and pre-release tags
                    const [aBase, aPreRelease] = a.split('-')
                    const [bBase, bPreRelease] = b.split('-')

                    // Split version numbers
                    const [aMajor, aMinor, aPatch] = aBase.split('.').map(Number)
                    const [bMajor, bMinor, bPatch] = bBase.split('.').map(Number)

                    // Compare major versions
                    if (aMajor !== bMajor) return aMajor - bMajor

                    // Compare minor versions
                    if (aMinor !== bMinor) return aMinor - bMinor

                    // Compare patch versions
                    if (aPatch !== bPatch) return aPatch - bPatch

                    // If one has a pre-release tag and the other doesn't,
                    // the one without comes first
                    if (aPreRelease && !bPreRelease) return 1
                    if (!aPreRelease && bPreRelease) return -1

                    // If both have pre-release tags, compare them
                    if (aPreRelease && bPreRelease) {
                        return aPreRelease.localeCompare(bPreRelease)
                    }

                    return 0
                })

                const changePoints = sortedChanges
                    .map(change => `${change.at}(${change.status})`)
                    .join(', ')

                return `${v.version} with changes at ${changePoints}`
            }

            return `${v.version}`
        })
        .filter(Boolean)

    if (ranges.length === 0) {
        return null
    }

    // Combine ranges with ' || ' to indicate multiple ranges
    return ranges.join(' || ')
}

/**
 * ensureStrReqBody reads in the incoming request body
 * Use await ensureStrReqBody(..) in an async function to get the string
 * @param {Request} request the incoming request to read from
 */
export const ensureStrReqBody = async (request) => {
    const contentType = request.headers.get("content-type") || ''
    if (contentType.includes("application/json")) {
        try {
            return JSON.stringify(await request.clone().json())
        } catch (e) {
            const jsonText = await request.clone().text()
            return decodeURIComponent(jsonText)
        }
    } else if (contentType.includes("application/text")) {
        return request.clone().text()
    } else if (contentType.includes("text/html")) {
        return request.clone().text()
    } else if (contentType.includes("form")) {
        const formData = await request.clone().formData()
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

/**
 * Converts a Buffer or ArrayBuffer to a hexadecimal string.
 *
 * If `Buffer` is not defined (e.g., in a browser environment), it will attempt to convert the input using
 * `ArrayBuffer` and `Uint8Array`.
 *
 * @param {Buffer|ArrayBuffer} input - The input data to convert.
 * @returns {string} The hexadecimal string representation of the input data.
 */
export const bufferToHex = input => {
    if (typeof Buffer !== 'undefined') {
        // Node.js environment or using a Buffer polyfill
        return Buffer.from(input).toString('hex')
    } else {
        // Browser environment without Buffer support
        const arrayBuffer = input instanceof ArrayBuffer ? input : new ArrayBuffer(input.byteLength)
        const view = new Uint8Array(arrayBuffer)
        const hexArray = Array.from(view).map(byte => byte.toString(16).padStart(2, '0'))
        return hexArray.join('')
    }
}

/**
 * Encodes a given string to Base64.
 *
 * This function is designed to be compatible with both Node.js and browsers.
 *
 * @param {string} body - The string to be encoded.
 * @returns {string} The Base64-encoded string.
 */
export const encodeToBase64 = body => {
    if (typeof Buffer !== 'undefined') {
        // Node.js environment
        return Buffer.from(body).toString('base64')
    } else {
        // Browser environment
        return btoa(body)
    }
}

/**
 * Decodes a Base64-encoded string into its original string.
 *
 * This function is designed to be compatible with both Node.js and browsers.
 *
 * @param {string} base64String - The Base64-encoded string.
 * @returns {string} The decoded original string.
 */
export const decodeFromBase64 = base64String => {
    if (typeof Buffer !== 'undefined') {
        // Node.js environment
        return Buffer.from(base64String, 'base64').toString()
    } else {
        // Browser environment
        return atob(base64String)
    }
}

/**
 * Verifies a password against a previously generated key using PBKDF2 (Password-Based Key Derivation Function 2).
 *
 * This function is designed to be asynchronous and utilizes the Web Crypto API for secure key derivation.
 *
 * @param {string} key - The Base64-encoded composite key containing salt, iteration count, and derived key.
 * @param {string} password - The password to be verified.
 * @param {number} [hashBits=512] - The number of bits to use for the hash function (default: 512).
 * @returns {Promise<boolean>} A promise that resolves to `true` if the password matches the key, otherwise `false`.
 * @throws {Error} - Throws an error if the key is invalid or there's an issue with the Web Crypto API operations.
 */
export const pbkdf2Verify = async (key, password, hashBits = 512) => {
    let compositeStr = null                     // composite key is salt, iteration count, and derived key
    try {
        compositeStr = decodeFromBase64(key)
    } catch (error) {
        console.error(error)
        throw new Error('Invalid key')
    }
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

/**
 * Generates a secure key using PBKDF2 (Password-Based Key Derivation Function 2) from a given password.
 *
 * This function is asynchronous and utilizes the Web Crypto API for secure key derivation and random salt generation.
 *
 * @param {string} password - The password to be used for key generation.
 * @param {number} [iterations=100000] - The number of iterations for the PBKDF2 algorithm (default: 100,000). Higher values are more secure but take longer.
 * @param {number} [hashBits=512] - The number of bits to use for the hash function (default: 512).
 * @returns {Promise<string>} A promise that resolves to a Base64-encoded string containing the salt, iteration count, and derived key.
 */
export const pbkdf2 = async (password, iterations = 1e5, hashBits = 512) => {
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

/**
 * Validates if the given input is a valid SPDX document.
 *
 * This function checks if the input is a JSON string or an object, and then validates the required fields and versions.
 *
 * @param {string|object} input - The input to be validated as an SPDX document.
 * @returns {boolean} True if the input is a valid SPDX document, false otherwise.
 * @throws {string} Throws an error if the provided SPDX version is not supported.
 */
export const isSPDX = input => {
    const supportedVersions = ["SPDX-2.3"]
    let spdx
    if (typeof input === "string" && isJSON(input)) {
        spdx = JSON.parse(input)
    } else {
        spdx = Object.assign({}, input)
    }
    if (typeof spdx?.spdxVersion === 'undefined' || typeof spdx?.SPDXID === 'undefined') {
        throw `Missing "spdxVersion" or "SPDXID"`
    }
    if (!supportedVersions.includes(spdx.spdxVersion)) {
        throw `Provided SPDX version ${spdx.spdxVersion} is not supported. Must be one of: ${supportedVersions}`
    }
    if (typeof spdx?.name === 'undefined' ||
        typeof spdx?.dataLicense === 'undefined' ||
        typeof spdx?.packages === 'undefined' ||
        typeof spdx?.creationInfo?.creators === 'undefined' ||
        !spdx?.creationInfo?.creators.length ||
        !spdx.packages.length
    ) {
        throw `SPDX is missing "dataLicense", "name", "relationships", "packages", "creationInfo.creators", or "documentDescribes"`
    }
    return true
}

function validCdxComponent(o, specVersion) {
    if (specVersion === "1.4") {
        if (typeof o?.name === 'undefined' ||
            typeof o?.version === 'undefined' ||
            typeof o?.purl === 'undefined' ||
            typeof o?.['bom-ref'] === 'undefined'
        ) {
            // console.log(o)
            return false
        }
    } else if (specVersion === "1.5") {
        if (typeof o?.name === 'undefined' ||
            typeof o?.version === 'undefined' ||
            typeof o?.purl === 'undefined' ||
            typeof o?.['bom-ref'] === 'undefined'
        ) {
            // console.log(o)
            return false
        }
    } else if (specVersion === "1.6") {
        if (typeof o?.name === 'undefined' ||
            typeof o?.version === 'undefined' ||
            typeof o?.purl === 'undefined' ||
            typeof o?.['bom-ref'] === 'undefined'
        ) {
            // console.log(o)
            return false
        }
        for (const ref of o?.externalReferences || []) {
            if (typeof ref?.type === 'undefined' || (ref.type === 'distribution' && !ref?.hashes?.length)) {
                // console.log(ref)
                return false
            }
        }
    }
    return true
}
function validCdxDependency(o) {
    if (typeof o?.ref === 'undefined') {
        return false
    }
    return true
}

/**
 * Validates if the given input is a valid CycloneDX document.
 *
 * This function checks if the input is a JSON string or an object, and then validates the required fields and versions.
 * Additionally, it verifies the validity of individual components and dependencies using helper functions (`validCdxComponent` and `validCdxDependency`).
 *
 * @param {string|object} input - The input to be validated as a CDX document.
 * @returns {boolean} True if the input is a valid CDX document, false otherwise.
 * @throws {string} Throws an error if the provided CDX version is not supported.
 */
export const isCDX = input => {
    const supportedVersions = ["1.4", "1.5", "1.6"]
    let cdx
    if (typeof input === "string" && isJSON(input)) {
        cdx = JSON.parse(input)
    } else {
        cdx = Object.assign({}, input)
    }
    if (typeof cdx?.specVersion === 'undefined') {
        throw 'Missing specVersion'
    }
    if (!supportedVersions.includes(cdx?.specVersion)) {
        throw `Provided CycloneDX version ${cdx?.specVersion} is not supported. Must be one of: ${supportedVersions}`
    }
    if (typeof cdx?.metadata?.tools === 'undefined' ||
        typeof cdx?.components === 'undefined' ||
        typeof cdx?.dependencies === 'undefined' ||
        !cdx?.metadata.tools.length ||
        !cdx?.components.length
    ) {
        throw 'Provided CycloneDX "components", "dependencies", or "metadata.tools" is missing'
    }
    if (cdx.components.filter(c => !validCdxComponent(c, cdx.specVersion)).length > 0) {
        throw 'Component "name", "version", or "purl" is missing'
    }
    if (cdx.dependencies.filter(d => !validCdxDependency(d)).length > 0) {
        throw 'Dependency missing "ref" or "dependsOn"'
    }
    return true
}

/**
 * Validates if the given input is a valid SARIF (Static Analysis Results Interchange Format) document.
 *
 * This function checks if the input is a JSON string, and then validates the required fields and versions.
 * Additionally, it verifies the structure of the SARIF document, including runs, results, tools, rules, and extensions.
 *
 * @param {string|object} input - The input to be validated as a SARIF document.
 * @returns {boolean} True if the input is a valid SARIF document, false otherwise.
 * @throws {string} Throws an error if the provided SARIF version is not supported or if the document is empty.
 */
export const isSARIF = input => {
    const supportedVersions = ["2.1.0"]
    let sarif = input
    if (typeof input === "string" && isJSON(input)) {
        sarif = JSON.parse(input)
    }
    if (typeof sarif?.$schema === 'undefined' || typeof sarif?.version === 'undefined') {
        return false
    }
    if (!supportedVersions.includes(sarif.version)) {
        throw `Provided SARIF version ${sarif.version} is not supported. Must be one of: ${supportedVersions}`
    }
    if (typeof sarif?.runs === 'undefined' || !sarif.runs.length) {
        throw `Provided SARIF was empty`
    }
    for (const run in sarif.runs) {
        if (typeof run?.results === 'undefined' || !run.results.length) {
            continue
        }
        if (typeof run?.tool?.driver?.name === 'undefined') {
            return false
        }
        if (typeof run?.tool?.driver?.rules === 'undefined' ||
            !run.tool.driver.rules.length
        ) {
            return false
        }
        for (const rule in run.tool.driver.rules) {
            if (typeof rule?.fullDescription?.text === 'undefined' ||
                typeof rule?.help?.text === 'undefined' ||
                typeof rule?.shortDescription?.text === 'undefined' ||
                typeof rule?.name === 'undefined'
            ) {
                return false
            }
        }
        for (const extension in run?.extensions || []) {
            if (typeof extension?.name === 'undefined' ||
                typeof extension?.rules === 'undefined' ||
                !extension.rules.length
            ) {
                return false
            }
            for (const rule in extension.rules) {
                if (typeof rule?.fullDescription?.text === 'undefined' ||
                    typeof rule?.help?.text === 'undefined' ||
                    typeof rule?.shortDescription?.text === 'undefined' ||
                    typeof rule?.name === 'undefined'
                ) {
                    return false
                }
            }
        }
    }
    return true
}

/**
 * Saves an artifact to R2 storage and creates corresponding database entries.
 * 
 * @async
 * @param {Object} prisma - Prisma client instance for database operations.
 * @param {Object} r2adapter - R2 adapter for storage operations.
 * @param {string} strContent - The content of the artifact to be saved.
 * @param {string} artifactUuid - Unique identifier (UUIDv4) for the artifact.
 * @param {string} artifactType - Type of the artifact (e.g., 'cyclonedx', 'spdx', 'vex', 'vdr', 'sarif').
 * 
 * @returns {Promise<Object>} The created artifact object with download links.
 * 
 * @description
 * This function performs the following operations:
 * 1. Saves the artifact content to R2 storage.
 * 2. Creates a Link entry in the database.
 * 3. Creates an Artifact entry in the database.
 * 4. Determines the appropriate content type and BOM format based on the artifact type.
 */
export const saveArtifact = async (prisma, r2adapter, strContent, artifactUuid, artifactType) => {
    const objectPath = `${artifactType}/${artifactUuid}.json`
    const link = {
        url: `https://artifacts.vulnetix.app/${objectPath}`,
        contentType: 'application/json',
    }
    const artifact = {
        uuid: artifactUuid,
        type: 'OTHER',
        date: new Date().getTime(),
        bomFormat: '',
    }
    if (['cyclonedx', 'spdx'].includes(artifactType.toLowerCase())) {
        artifact.type = 'BOM'
        if ('cyclonedx' === artifactType.toLowerCase()) {
            artifact.bomFormat = 'CycloneDX'
            link.contentType = 'application/vnd.cyclonedx+json'
        } else if ('spdx' === artifactType.toLowerCase()) {
            artifact.bomFormat = 'SPDX'
            link.contentType = 'application/spdx+json'
        }
    } else if (['vex', 'vdr'].includes(artifactType.toLowerCase())) {
        artifact.bomFormat = artifactType.toUpperCase()
        link.contentType = 'application/vnd.cyclonedx+json'
    } else if ('sarif' === artifactType.toLowerCase()) {
        link.contentType = 'application/sarif+json'
    }
    const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
    const artifactInfo = await r2adapter.put(objectPath, strContent, putOptions)
    // console.log('artifactInfo', artifactInfo)
    const artifactLookup = await prisma.Artifact.findUnique({ where: { uuid: artifactUuid }, include: { downloadLinks: true } })
    // console.log('artifactLookup', artifactLookup)
    if (artifactLookup?.downloadLinks) {
        for (const dlLink of artifactLookup.downloadLinks) {
            if (dlLink.url === link.url) {
                return artifactLookup
            }
        }
    }
    link.artifact = {
        connectOrCreate: {
            where: {
                uuid: artifactUuid,
            },
            create: artifact,
        },
    }
    const newLink = await prisma.Link.create({ data: link })
    // console.log('newLink', newLink)
    artifact.downloadLinks = [newLink]
    return artifact
}

export const appExpiryPeriod = (86400000 * 365 * 10)  // 10 years

/**
 * Converts ISO 8601 formatted date strings within an object or array to Unix timestamps (milliseconds since epoch).
 *
 * This function recursively traverses the provided object or array, converting any encountered ISO 8601 date strings
 * to their corresponding Unix timestamps. Other data types (e.g., numbers, strings) are left unchanged.
 *
 * @param {object|array} obj - The object or array to be processed.
 * @returns {object|array} A new object or array with ISO 8601 dates converted to timestamps.
 */
export const convertIsoDatesToTimestamps = obj => {
    if (Array.isArray(obj)) {
        return obj.map(item => convertIsoDatesToTimestamps(item))
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => {
                if (typeof value === 'string' && /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/.test(value)) {
                    value = new Date(value).getTime()
                } else if (!!value && typeof value === 'object') {
                    value = convertIsoDatesToTimestamps(value)
                }
                return [key, value]
            })
        )
    } else {
        return obj // Handle other data types (e.g., numbers, strings)
    }
}
/**
 * Parses a SemVer string into its components
 * @param {string} versionString - The version string to parse
 * @returns {Object} Object containing version components and constraints
 */
export function parseSemVer(versionString) {
    // Regular expressions for different parts
    const operatorRegex = /^([<>]=?|={1,2}|\*|~|\^)|^.*(\.x|\.\*)/;
    const versionRegex = /^v?(\d+|[x*])(?:\.(\d+|[x*]))?(?:\.(\d+|[x*]))?(?:-?([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

    let operator = '';
    let version = versionString;

    // Extract operator if present
    const operatorMatch = versionString.match(operatorRegex);
    if (operatorMatch && operatorMatch[0]) {
        operator = operatorMatch[1];
        version = versionString.slice(operator.length).trim();
    } else if (operatorMatch && operatorMatch[2]) {
        operator = operatorMatch[2];
        version = versionString.replace(operator, '.0').trim();
    }

    // Handle "*" and "x" as a special case
    if (['*', 'x'].includes(version)) {
        return {
            operator,
            major: '*',
            minor: '*',
            patch: '*',
            prerelease: null,
            buildMetadata: null,
            original: versionString
        };
    }

    // Parse version parts
    const match = version.match(versionRegex);
    if (!match) {
        return {
            operator,
            major: '',
            minor: '',
            patch: '',
            prerelease: null,
            buildMetadata: null,
            original: versionString
        };
    }

    const [, major, minor, patch, prerelease, buildMetadata] = match;

    // Convert version parts to numbers or keep as special characters
    const processVersionPart = (part) => {
        if (!part) return '0';
        if (['*', 'x'].includes(part)) return '*';
        return part;
    };

    return {
        operator,
        major: processVersionPart(major),
        minor: processVersionPart(minor),
        patch: processVersionPart(patch),
        prerelease: prerelease || null,
        buildMetadata: buildMetadata || null,
        original: versionString
    };
}
export function getSemVerWithoutOperator(versionString) {
    if (!versionString) {
        return ''
    }
    // Regular expressions for different parts
    const operatorRegex = /^([<>]=?|={1,2}|\*|~|\^)|^.*(\.x|\.\*)/;
    let operator = '';
    let version = versionString;
    // Extract operator if present
    const operatorMatch = versionString.match(operatorRegex);
    if (operatorMatch && operatorMatch[0]) {
        operator = operatorMatch[1];
        version = versionString.slice(operator.length).trim();
    } else if (operatorMatch && operatorMatch[2]) {
        operator = operatorMatch[2];
        version = versionString.replace(operator, '.0').trim();
    }

    return version
}
/**
 * Splits a version string into comparison operator and version number
 * @param {string} versionString - The version string to split
 * @returns {[string, string]} Array containing [comparison, version]
 */
export function splitVersionComparison(versionString) {
    const parsed = parseSemVer(versionString)
    if (!parsed) return ['=', versionString]
    const { operator, major, minor, patch } = parsed
    const version = `${major}.${minor}.${patch}`
    return [operator || '=', version]
}

export const isValidSemver = version => {
    if (!version) return false;
    const semverRegex = /^v?(\d+|[x*])(?:\.(\d+|[x*]))?(?:\.(\d+|[x*]))?(?:-?([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
    return semverRegex.test(version);
}

export function getVersionString(versionString, majorDefault = "0", minorDefault = "0", patchDefault = "0") {
    // Get clean version number for each part
    const cleanVersions = versionString.split('||').map(v => v.trim()).filter(v => !!v).map(v => {
        const [, version = ''] = splitVersionComparison(v)
        return version.trim()
    }).filter(i => !!i)
    if (!cleanVersions.length) return `${majorDefault}.${minorDefault}.${patchDefault}`
    const comp = (v1, v2) => {
        const versionRegex = /^v?(\d+|[x*])(?:\.(\d+|[x*]))?(?:\.(\d+|[x*]))?(?:-?([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
        if (v2.includes('*.*.*')) return v1
        if (v1.includes('*.*.*')) return v2
        if (!v1.match(versionRegex)) return v2
        if (!v2.match(versionRegex)) return v1
        const parse = (v) => v.split('.').map(part => ['*', 'x'].includes(part) ? Infinity : part);
        const [major1, minor1, patch1] = parse(v1);
        const [major2, minor2, patch2] = parse(v2);

        if (major1 !== major2) return major1 > major2 ? v1 : v2;
        if (minor1 !== minor2) return minor1 > minor2 ? v1 : v2;
        return patch1 >= patch2 ? v1 : v2;
    }
    const semVer = cleanVersions.reduce((highest, current) => {
        return comp(highest, current)
    })
    if (!semVer) return `${majorDefault}.${minorDefault}.${patchDefault}`
    const { major = majorDefault, minor = minorDefault, patch = patchDefault } = parseSemVer(semVer)
    return `${major}.${minor}.${patch}`
}

export const versionSorter = (v1, v2) => {
    if (!v1 || !v2) return 0
    const v1Parts = v1.split('.').map(part => {
        const matches = part.match(/(\d+)([a-z]*)/);
        return matches ? [parseInt(matches[1]), matches[2] || ''] : [parseInt(part), ''];
    });

    const v2Parts = v2.split('.').map(part => {
        const matches = part.match(/(\d+)([a-z]*)/);
        return matches ? [parseInt(matches[1]), matches[2] || ''] : [parseInt(part), ''];
    });

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const [num1 = 0, suffix1 = ''] = v1Parts[i] || [];
        const [num2 = 0, suffix2 = ''] = v2Parts[i] || [];

        if (num1 !== num2) return num1 - num2;
        if (suffix1 !== suffix2) return suffix1.localeCompare(suffix2);
    }

    return 0;
}

export function chunkArray(array, chunkSize = 1000) {
    return Array.from(
        { length: Math.ceil(array.length / chunkSize) },
        (_, index) => array.slice(index * chunkSize, (index + 1) * chunkSize)
    )
}
/**
 * Determines if a version is vulnerable based on a set of version ranges
 * 
 * @param {string} version - The version to check (e.g., "2.10.6")
 * @param {string} vulnerableRanges - String containing version ranges (e.g., "< 2.11.2 >= 0")
 *                                   Multiple ranges can be separated by "||"
 *                                   Space-separated comparisons within a range are treated as AND conditions
 *                                   "||" separated ranges are treated as OR conditions
 * 
 * Examples:
 * "< 2.11.2 >= 0" - Version must be less than 2.11.2 AND greater than or equal to 0
 * "< 2.11.2 || >= 0 < 2.8.7" - Version must either be less than 2.11.2 OR (greater than or equal to 0 AND less than 2.8.7)
 * 
 * @returns {boolean} True if the version is vulnerable according to any of the ranges
 */
export const isVersionVulnerable = (version, vulnerableRanges) => {
    // First normalize the version by removing any operators
    const normalizedVersion = getSemVerWithoutOperator(version)

    // Helper function to compare two version strings
    const compareVersions = (version1, version2) => {
        // Convert versions to arrays of numbers for comparison
        const v1Parts = version1.split('.').map(Number)
        const v2Parts = version2.split('.').map(Number)

        // Compare each part (major, minor, patch)
        for (let i = 0; i < 3; i++) {
            if (v1Parts[i] !== v2Parts[i]) {
                return v1Parts[i] - v2Parts[i]
            }
        }
        return 0 // Versions are equal
    };

    // Helper function to evaluate a single comparison
    const evaluateComparison = (comparison, targetVersion) => {
        // Split into operator and version
        const [operator, compareVersion] = splitVersionComparison(comparison)

        // Validate both versions
        if (!isValidSemver(targetVersion) || !isValidSemver(compareVersion)) {
            return false
        }

        // Get the difference between versions
        const versionDifference = compareVersions(targetVersion, compareVersion)

        // Evaluate based on operator
        switch (operator) {
            case '<':
                return versionDifference < 0
            case '<=':
                return versionDifference <= 0
            case '>':
                return versionDifference > 0
            case '>=':
                return versionDifference >= 0
            case '=':
            case '==':
                return versionDifference === 0
            default:
                return false
        }
    };

    // Normalize the ranges string:
    // 1. Trim whitespace
    // 2. Replace multiple spaces with single space
    // 3. Remove spaces around comparison operators
    const normalizedRanges = vulnerableRanges
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*(>=|>|<=|<)\s*/g, ' $1')

    // Split into individual range sets (separated by ||)
    const rangeSets = normalizedRanges.split('||').map(range => range.trim())

    // Check each range set (these are OR conditions)
    for (const rangeSet of rangeSets) {
        // Get all comparisons in this range set (these are AND conditions)
        const comparisons = rangeSet.split(' ').filter(i => !!i.trim())

        // Track if all comparisons in this range set are true, meaning the version is within range if all are true
        const rangeResults = []

        // Check each comparison in the current range set
        for (const comparison of comparisons) {
            rangeResults.push(evaluateComparison(comparison, normalizedVersion))
        }

        // If all comparisons in this range set matched, we can return true immediately
        // (because range sets are OR conditions)
        if (rangeResults.every(r => r === true)) {
            return true
        }
    }

    // If we get here, no range set was satisfied
    return false
}

/**
 * Flattens a nested object into a single-level object, optionally converting ISO 8601 date strings to Unix timestamps.
 *
 * This function recursively traverses the object, flattening nested objects and arrays. If a `convertDates` option is provided,
 * it will convert any ISO 8601 date strings encountered to their corresponding Unix timestamps.
 *
 * @param {object} obj - The object to be flattened.
 * @param {string} [prefix=''] - An optional prefix to prepend to the keys of the flattened object.
 * @param {boolean} [convertDates=false] - An optional flag indicating whether to convert ISO 8601 dates to timestamps.
 * @returns {object} A flattened object with all nested properties merged into a single level.
 */
export const flatten = (obj, prefix = '', convertDates = false) =>
    Object.entries(obj).reduce((acc, [key, value]) => {
        const newKey = prefix ? `${prefix}_${key}` : key
        return Array.isArray(value)
            ? { ...acc, [newKey]: value } // Flatten array directly
            : value && typeof value === 'object'
                ? { ...acc, ...flatten(value, newKey, convertDates) } // Handle nested objects
                : convertDates && typeof value === 'string' && /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/.test(value)
                    ? { ...acc, [newKey]: new Date(value).getTime() } // Convert date to timestamp
                    : { ...acc, [newKey]: value } // Handle primitives
    }, {})

/**
 * Converts a text string to a hexadecimal hash using the specified hashing algorithm.
 *
 * This function uses the Web Crypto API to perform the hashing operation.
 *
 * @param {string} text - The text string to be hashed.
 * @param {string} [name="SHA-1"] - The name of the hashing algorithm to use (e.g., "SHA-1", "SHA-256", "SHA-384", "SHA-512").
 * @returns {Promise<string>} A promise that resolves to the hexadecimal representation of the hash.
 */
export async function hex(text, name = "SHA-1") {
    return [...new Uint8Array(await crypto.subtle.digest({ name }, new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Rounds a number to a specified number of decimal places.
 * 
 * @param {number} n - The number to round.
 * @param {number} [p=10] - The precision factor. Defaults to 10.
 *   - p = 10 results in 1 decimal place
 *   - p = 100 results in 2 decimal places
 *   - p = 1000 results in 3 decimal places, and so on
 * 
 * @returns {number} The rounded number.
 * 
 * @example
 * round(3.14159, 10)  // Returns 3.1
 * round(3.14159, 100) // Returns 3.14
 * round(3.14159)      // Returns 3.1 (uses default precision)
 */export const round = (n, p = 10) => Math.round((n + Number.EPSILON) * p) / p

export const isJSON = str => {
    try {
        return (JSON.parse(str) && !!str)
    } catch (e) {
        return false
    }
}

/**
 * Calculates a human-readable time difference between the current time and a given date.
 *
 * This function returns a string indicating how long ago the date was, such as "2 years ago", "1 month ago", or "just now".
 *
 * @param {Date} date - The date to calculate the time difference from.
 * @returns {string} A human-readable time difference string.
 */
export const timeAgo = date => {
    const seconds = Math.floor((new Date() - date) / 1000)

    const interval = Math.floor(seconds / 31536000)

    if (interval > 1) {
        return interval + " years ago"
    }
    if (interval === 1) {
        return interval + " year ago"
    }

    const months = Math.floor(seconds / 2628000)
    if (months > 1) {
        return months + " months ago"
    }
    if (months === 1) {
        return months + " month ago"
    }

    const days = Math.floor(seconds / 86400)
    if (days > 1) {
        return days + " days ago"
    }
    if (days === 1) {
        return days + " day ago"
    }

    const hours = Math.floor(seconds / 3600)
    if (hours > 1) {
        return hours + " hours ago"
    }
    if (hours === 1) {
        return hours + " hour ago"
    }

    const minutes = Math.floor(seconds / 60)
    if (minutes > 1) {
        return minutes + " minutes ago"
    }
    if (minutes === 1) {
        return minutes + " minute ago"
    }

    return "just now"
}

/**
 * Helper function to convert hex string to Uint8Array
 * @return {Uint8Array<Object>}
 */
export const hexStringToUint8Array = hexString => {
    const length = hexString.length / 2
    const array = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
        array[i] = parseInt(hexString.substr(i * 2, 2), 16)
    }
    return array
}

export const getPastelColor = () => {
    const red = Math.floor(Math.random() * 75 + 180)
    const green = Math.floor(Math.random() * 75 + 180)
    const blue = Math.floor(Math.random() * 75 + 180)
    return '#' +
        red.toString(16).padStart(2, '0') +
        green.toString(16).padStart(2, '0') +
        blue.toString(16).padStart(2, '0')
}

const owasp_top_ten_cwe = {
    "A01 Broken Access Control": [
        { "ref": "CWE-22", "text": "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')" },
        { "ref": "CWE-23", "text": "Relative Path Traversal" },
        { "ref": "CWE-35", "text": "Path Traversal" },
        { "ref": "CWE-59", "text": "Improper Link Resolution Before File Access ('Link Following')" },
        { "ref": "CWE-200", "text": "Exposure of Sensitive Information to an Unauthorized Actor" },
        { "ref": "CWE-201", "text": "Exposure of Sensitive Information Through Sent Data" },
        { "ref": "CWE-219", "text": "Storage of File with Sensitive Data Under Web Root" },
        { "ref": "CWE-264", "text": "Permissions, Privileges, and Access Controls (should no longer be used)" },
        { "ref": "CWE-275", "text": "Permission Issues" },
        { "ref": "CWE-276", "text": "Incorrect Default Permissions" },
        { "ref": "CWE-284", "text": "Improper Access Control" },
        { "ref": "CWE-285", "text": "Improper Authorization" },
        { "ref": "CWE-352", "text": "Cross-Site Request Forgery (CSRF)" },
        { "ref": "CWE-359", "text": "Exposure of Private Personal Information to an Unauthorized Actor" },
        { "ref": "CWE-377", "text": "Insecure Temporary File" },
        { "ref": "CWE-402", "text": "Transmission of Private Resources into a New Sphere ('Resource Leak')" },
        { "ref": "CWE-425", "text": "Direct Request ('Forced Browsing')" },
        { "ref": "CWE-441", "text": "Unintended Proxy or Intermediary ('Confused Deputy')" },
        { "ref": "CWE-497", "text": "Exposure of Sensitive System Information to an Unauthorized Control Sphere" },
        { "ref": "CWE-538", "text": "Insertion of Sensitive Information into Externally-Accessible File or Directory" },
        { "ref": "CWE-540", "text": "Inclusion of Sensitive Information in Source Code" },
        { "ref": "CWE-548", "text": "Exposure of Information Through Directory Listing" },
        { "ref": "CWE-552", "text": "Files or Directories Accessible to External Parties" },
        { "ref": "CWE-566", "text": "Authorization Bypass Through User-Controlled SQL Primary Key" },
        { "ref": "CWE-601", "text": "URL Redirection to Untrusted Site ('Open Redirect')" },
        { "ref": "CWE-639", "text": "Authorization Bypass Through User-Controlled Key" },
        { "ref": "CWE-651", "text": "Exposure of WSDL File Containing Sensitive Information" },
        { "ref": "CWE-668", "text": "Exposure of Resource to Wrong Sphere" },
        { "ref": "CWE-706", "text": "Use of Incorrectly-Resolved Name or Reference" },
        { "ref": "CWE-862", "text": "Missing Authorization" },
        { "ref": "CWE-863", "text": "Incorrect Authorization" },
        { "ref": "CWE-913", "text": "Improper Control of Dynamically-Managed Code Resources" },
        { "ref": "CWE-922", "text": "Insecure Storage of Sensitive Information" },
        { "ref": "CWE-1275", "text": "Sensitive Cookie with Improper SameSite Attribute" },
    ],
    "A02 Cryptographic Failures": [
        { "ref": "CWE-261", "text": "Weak Encoding for Password" },
        { "ref": "CWE-296", "text": "Improper Following of a Certificate's Chain of Trust" },
        { "ref": "CWE-310", "text": "Cryptographic Issues" },
        { "ref": "CWE-319", "text": "Cleartext Transmission of Sensitive Information" },
        { "ref": "CWE-321", "text": "Use of Hard-coded Cryptographic Key" },
        { "ref": "CWE-322", "text": "Key Exchange without Entity Authentication" },
        { "ref": "CWE-323", "text": "Reusing a Nonce, Key Pair in Encryption" },
        { "ref": "CWE-324", "text": "Use of a Key Past its Expiration Date" },
        { "ref": "CWE-325", "text": "Missing Required Cryptographic Step" },
        { "ref": "CWE-326", "text": "Inadequate Encryption Strength" },
        { "ref": "CWE-327", "text": "Use of a Broken or Risky Cryptographic Algorithm" },
        { "ref": "CWE-328", "text": "Reversible One-Way Hash" },
        { "ref": "CWE-329", "text": "Not Using a Random IV with CBC Mode" },
        { "ref": "CWE-330", "text": "Use of Insufficiently Random Values" },
        { "ref": "CWE-331", "text": "Insufficient Entropy" },
        { "ref": "CWE-335", "text": "Incorrect Usage of Seeds in Pseudo-Random Number Generator(PRNG)" },
        { "ref": "CWE-336", "text": "Same Seed in Pseudo-Random Number Generator (PRNG)" },
        { "ref": "CWE-337", "text": "Predictable Seed in Pseudo-Random Number Generator (PRNG)" },
        { "ref": "CWE-338", "text": "Use of Cryptographically Weak Pseudo-Random Number Generator(PRNG)" },
        { "ref": "CWE-340", "text": "Generation of Predictable Numbers or Identifiers" },
        { "ref": "CWE-347", "text": "Improper Verification of Cryptographic Signature" },
        { "ref": "CWE-523", "text": "Unprotected Transport of Credentials" },
        { "ref": "CWE-720", "text": "OWASP Top Ten 2007 Category A9 - Insecure Communications" },
        { "ref": "CWE-757", "text": "Selection of Less-Secure Algorithm During Negotiation('Algorithm Downgrade')" },
        { "ref": "CWE-759", "text": "Use of a One-Way Hash without a Salt" },
        { "ref": "CWE-760", "text": "Use of a One-Way Hash with a Predictable Salt" },
        { "ref": "CWE-780", "text": "Use of RSA Algorithm without OAEP" },
        { "ref": "CWE-818", "text": "Insufficient Transport Layer Protection" },
        { "ref": "CWE-916", "text": "Use of Password Hash With Insufficient Computational Effort" },
    ],
    "A03 Injection": [
        { "ref": "CWE-20", "text": "Improper Input Validation" },
        { "ref": "CWE-74", "text": "Improper Neutralization of Special Elements in Output Used by a Downstream Component('Injection')" },
        { "ref": "CWE-75", "text": "Failure to Sanitize Special Elements into a Different Plane(Special Element Injection)" },
        { "ref": "CWE-77", "text": "Improper Neutralization of Special Elements used in a Command('Command Injection')" },
        { "ref": "CWE-78", "text": "Improper Neutralization of Special Elements used in an OS Command('OS Command Injection')" },
        { "ref": "CWE-79", "text": "Improper Neutralization of Input During Web Page Generation('Cross-site Scripting')" },
        { "ref": "CWE-80", "text": "Improper Neutralization of Script - Related HTML Tags in a Web Page(Basic XSS)" },
        { "ref": "CWE-83", "text": "Improper Neutralization of Script in Attributes in a Web Page" },
        { "ref": "CWE-87", "text": "Improper Neutralization of Alternate XSS Syntax" },
        { "ref": "CWE-88", "text": "Improper Neutralization of Argument Delimiters in a Command('Argument Injection')" },
        { "ref": "CWE-89", "text": "Improper Neutralization of Special Elements used in an SQL Command('SQL Injection')" },
        { "ref": "CWE-90", "text": "Improper Neutralization of Special Elements used in an LDAP Query('LDAP Injection')" },
        { "ref": "CWE-91", "text": "XML Injection(aka Blind XPath Injection)" },
        { "ref": "CWE-93", "text": "Improper Neutralization of CRLF Sequences('CRLF Injection')" },
        { "ref": "CWE-94", "text": "Improper Control of Generation of Code('Code Injection')" },
        { "ref": "CWE-95", "text": "Improper Neutralization of Directives in Dynamically Evaluated Code('Eval Injection')" },
        { "ref": "CWE-96", "text": "Improper Neutralization of Directives in Statically Saved Code('Static Code Injection')" },
        { "ref": "CWE-97", "text": "Improper Neutralization of Server - Side Includes(SSI) Within a Web Page" },
        { "ref": "CWE-98", "text": "Improper Control of Filename for Include / Require Statement in PHP Program('PHP Remote File Inclusion')" },
        { "ref": "CWE-99", "text": "Improper Control of Resource Identifiers('Resource Injection')" },
        { "ref": "CWE-100", "text": "Deprecated: Was catch-all for input validation issues" },
        { "ref": "CWE-113", "text": "Improper Neutralization of CRLF Sequences in HTTP Headers('HTTP Response Splitting')" },
        { "ref": "CWE-116", "text": "Improper Encoding or Escaping of Output" },
        { "ref": "CWE-138", "text": "Improper Neutralization of Special Elements" },
        { "ref": "CWE-184", "text": "Incomplete List of Disallowed Inputs" },
        { "ref": "CWE-470", "text": "Use of Externally - Controlled Input to Select Classes or Code('Unsafe Reflection')" },
        { "ref": "CWE-471", "text": "Modification of Assumed - Immutable Data(MAID)" },
        { "ref": "CWE-564", "text": "SQL Injection: Hibernate" },
        { "ref": "CWE-610", "text": "Externally Controlled Reference to a Resource in Another Sphere" },
        { "ref": "CWE-643", "text": "Improper Neutralization of Data within XPath Expressions('XPath Injection')" },
        { "ref": "CWE-644", "text": "Improper Neutralization of HTTP Headers for Scripting Syntax" },
        { "ref": "CWE-652", "text": "Improper Neutralization of Data within XQuery Expressions('XQuery Injection')" },
        { "ref": "CWE-917", "text": "Improper Neutralization of Special Elements used in an Expression Language Statement('Expression Language Injection')" },
    ],
    "A04 Insecure Design": [
        { "ref": "CWE-73", "text": "External Control of File Name or Path" },
        { "ref": "CWE-183", "text": "Permissive List of Allowed Inputs" },
        { "ref": "CWE-209", "text": "Generation of Error Message Containing Sensitive Information" },
        { "ref": "CWE-213", "text": "Exposure of Sensitive Information Due to Incompatible Policies" },
        { "ref": "CWE-235", "text": "Improper Handling of Extra Parameters" },
        { "ref": "CWE-256", "text": "Unprotected Storage of Credentials" },
        { "ref": "CWE-257", "text": "Storing Passwords in a Recoverable Format" },
        { "ref": "CWE-266", "text": "Incorrect Privilege Assignment" },
        { "ref": "CWE-269", "text": "Improper Privilege Management" },
        { "ref": "CWE-280", "text": "Improper Handling of Insufficient Permissions or Privileges" },
        { "ref": "CWE-311", "text": "Missing Encryption of Sensitive Data" },
        { "ref": "CWE-312", "text": "Cleartext Storage of Sensitive Information" },
        { "ref": "CWE-313", "text": "Cleartext Storage in a File or on Disk" },
        { "ref": "CWE-316", "text": "Cleartext Storage of Sensitive Information in Memory" },
        { "ref": "CWE-419", "text": "Unprotected Primary Channel" },
        { "ref": "CWE-430", "text": "Deployment of Wrong Handler" },
        { "ref": "CWE-434", "text": "Unrestricted Upload of File with Dangerous Type" },
        { "ref": "CWE-444", "text": "Inconsistent Interpretation of HTTP Requests ('HTTP Request Smuggling')" },
        { "ref": "CWE-451", "text": "User Interface (UI) Misrepresentation of Critical Information" },
        { "ref": "CWE-472", "text": "External Control of Assumed-Immutable Web Parameter" },
        { "ref": "CWE-501", "text": "Trust Boundary Violation" },
        { "ref": "CWE-522", "text": "Insufficiently Protected Credentials" },
        { "ref": "CWE-525", "text": "Use of Web Browser Cache Containing Sensitive Information" },
        { "ref": "CWE-539", "text": "Use of Persistent Cookies Containing Sensitive Information" },
        { "ref": "CWE-579", "text": "J2EE Bad Practices: Non-serializable Object Stored in Session" },
        { "ref": "CWE-598", "text": "Use of GET Request Method With Sensitive Query Strings" },
        { "ref": "CWE-602", "text": "Client-Side Enforcement of Server-Side Security" },
        { "ref": "CWE-642", "text": "External Control of Critical State Data" },
        { "ref": "CWE-646", "text": "Reliance on File Name or Extension of Externally-Supplied File" },
        { "ref": "CWE-650", "text": "Trusting HTTP Permission Methods on the Server Side" },
        { "ref": "CWE-653", "text": "Insufficient Compartmentalization" },
        { "ref": "CWE-656", "text": "Reliance on Security Through Obscurity" },
        { "ref": "CWE-657", "text": "Violation of Secure Design Principles" },
        { "ref": "CWE-799", "text": "Improper Control of Interaction Frequency" },
        { "ref": "CWE-807", "text": "Reliance on Untrusted Inputs in a Security Decision" },
        { "ref": "CWE-840", "text": "Business Logic Errors" },
        { "ref": "CWE-841", "text": "Improper Enforcement of Behavioral Workflow" },
        { "ref": "CWE-927", "text": "Use of Implicit Intent for Sensitive Communication" },
        { "ref": "CWE-1021", "text": "Improper Restriction of Rendered UI Layers or Frames" },
        { "ref": "CWE-1173", "text": "Improper Use of Validation Framework" },
    ],
    "A05 Security Misconfiguration": [
        { "ref": "CWE-2", "text": "7PK - Environment" },
        { "ref": "CWE-11", "text": "ASP.NET Misconfiguration: Creating Debug Binary" },
        { "ref": "CWE-13", "text": "ASP.NET Misconfiguration: Password in Configuration File" },
        { "ref": "CWE-15", "text": "External Control of System or Configuration Setting" },
        { "ref": "CWE-16", "text": "Configuration" },
        { "ref": "CWE-260", "text": "Password in Configuration File" },
        { "ref": "CWE-315", "text": "Cleartext Storage of Sensitive Information in a Cookie" },
        { "ref": "CWE-520", "text": ".NET Misconfiguration: Use of Impersonation" },
        { "ref": "CWE-526", "text": "Exposure of Sensitive Information Through Environmental Variables" },
        { "ref": "CWE-537", "text": "Java Runtime Error Message Containing Sensitive Information" },
        { "ref": "CWE-541", "text": "Inclusion of Sensitive Information in an Include File" },
        { "ref": "CWE-547", "text": "Use of Hard-coded, Security-relevant Constants" },
        { "ref": "CWE-611", "text": "Improper Restriction of XML External Entity Reference" },
        { "ref": "CWE-614", "text": "Sensitive Cookie in HTTPS Session Without 'Secure' Attribute" },
        { "ref": "CWE-756", "text": "Missing Custom Error Page" },
        { "ref": "CWE-776", "text": "Improper Restriction of Recursive Entity References in DTDs ('XML Entity Expansion')" },
        { "ref": "CWE-942", "text": "Permissive Cross-domain Policy with Untrusted Domains" },
        { "ref": "CWE-1004", "text": "Sensitive Cookie Without 'HttpOnly' Flag" },
        { "ref": "CWE-1032", "text": "OWASP Top Ten 2017 Category A6 - Security Misconfiguration" },
        { "ref": "CWE-1174", "text": "ASP.NET Misconfiguration: Improper Model Validation" },
    ],
    "A06 Vulnerable and Outdated Components": [
        { "ref": "CWE-937", "text": "OWASP Top 10 2013: Using Components with Known Vulnerabilities" },
        { "ref": "CWE-1035", "text": "2017 Top 10 A9: Using Components with Known Vulnerabilities" },
        { "ref": "CWE-1104", "text": "Use of Unmaintained Third Party Components" },
    ],
    "A07 Identification and Authentication Failures": [
        { "ref": "CWE-255", "text": "Credentials Management Errors" },
        { "ref": "CWE-259", "text": "Use of Hard-coded Password" },
        { "ref": "CWE-287", "text": "Improper Authentication" },
        { "ref": "CWE-288", "text": "Authentication Bypass Using an Alternate Path or Channel" },
        { "ref": "CWE-290", "text": "Authentication Bypass by Spoofing" },
        { "ref": "CWE-294", "text": "Authentication Bypass by Capture-replay" },
        { "ref": "CWE-295", "text": "Improper Certificate Validation" },
        { "ref": "CWE-297", "text": "Improper Validation of Certificate with Host Mismatch" },
        { "ref": "CWE-300", "text": "Channel Accessible by Non-Endpoint" },
        { "ref": "CWE-302", "text": "Authentication Bypass by Assumed-Immutable Data" },
        { "ref": "CWE-304", "text": "Missing Critical Step in Authentication" },
        { "ref": "CWE-306", "text": "Missing Authentication for Critical Function" },
        { "ref": "CWE-307", "text": "Improper Restriction of Excessive Authentication Attempts" },
        { "ref": "CWE-346", "text": "Origin Validation Error" },
        { "ref": "CWE-384", "text": "Session Fixation" },
        { "ref": "CWE-521", "text": "Weak Password Requirements" },
        { "ref": "CWE-613", "text": "Insufficient Session Expiration" },
        { "ref": "CWE-620", "text": "Unverified Password Change" },
        { "ref": "CWE-640", "text": "Weak Password Recovery Mechanism for Forgotten Password" },
        { "ref": "CWE-798", "text": "Use of Hard-coded Credentials" },
        { "ref": "CWE-940", "text": "Improper Verification of Source of a Communication Channel" },
        { "ref": "CWE-1216", "text": "Lockout Mechanism Errors" },
    ],
    "A08 Software and Data Integrity Failures": [
        { "ref": "CWE-345", "text": "Insufficient Verification of Data Authenticity" },
        { "ref": "CWE-353", "text": "Missing Support for Integrity Check" },
        { "ref": "CWE-426", "text": "Untrusted Search Path" },
        { "ref": "CWE-494", "text": "Download of Code Without Integrity Check" },
        { "ref": "CWE-502", "text": "Deserialization of Untrusted Data" },
        { "ref": "CWE-565", "text": "Reliance on Cookies without Validation and Integrity Checking" },
        { "ref": "CWE-784", "text": "Reliance on Cookies without Validation and Integrity Checking in a Security Decision" },
        { "ref": "CWE-829", "text": "Inclusion of Functionality from Untrusted Control Sphere" },
        { "ref": "CWE-830", "text": "Inclusion of Web Functionality from an Untrusted Source" },
        { "ref": "CWE-915", "text": "Improperly Controlled Modification of Dynamically-Determined Object Attributes" },
    ],
    "A09 Security Logging and Monitoring Failures": [
        { "ref": "CWE-117", "text": "Improper Output Neutralization for Logs" },
        { "ref": "CWE-223", "text": "Omission of Security-relevant Information" },
        { "ref": "CWE-532", "text": "Insertion of Sensitive Information into Log File" },
        { "ref": "CWE-778", "text": "Insufficient Logging" },
    ],
    "A10 Server Side Request Forgery (SSRF)": [
        { "ref": "CWE-918", "text": "Server-Side Request Forgery (SSRF)" },
    ],
}

// https://octodex.github.com/images/
export const octodex = [
    "parentocats.png",
    "godotocat.png",
    "NUX_Octodex.gif",
    "yogitocat.png",
    "mona-the-rivetertocat.png",
    "manufacturetocat.png",
    "OctoAsians_dex_Full.png",
    "Octoqueer.png",
    "Terracottocat_Single.png",
    "Octogatos.png",
    "Adacats.png",
    "Fintechtocat.png",
    "Brennatocat.png",
    "filmtocats.png",
    "Sentrytocat_octodex.jpg",
    "puddle_jumper_octodex.jpg",
    "boxertocat_octodex.jpg",
    "surftocat.png",
    "hula_loop_octodex03.gif",
    "scubatocat.png",
    "vinyltocat.png",
    "tentocats.jpg",
    "snowtocat_final.jpg",
    "justicetocat.jpg",
    "blacktocats.png",
    "saint_nictocat.jpg",
    "mona-lovelace.jpg",
    "dinotocat.png",
    "bannekat.png",
    "catstello.png",
    "mcefeeline.jpg",
    "skatetocat.png",
    "bewitchedtocat.jpg",
    "inflatocat.png",
    "welcometocat.png",
    "filmtocat.png",
    "privateinvestocat.jpg",
    "gracehoppertocat.jpg",
    "gobbleotron.gif",
    "jetpacktocat.png",
    "minertocat.png",
    "saketocat.png",
    "luchadortocat.png",
    "saritocat.png",
    "topguntocat.png",
    "carlostocat.gif",
    "grinchtocat.gif",
    "maxtocat.gif",
    "yaktocat.png",
    "steroidtocat.png",
    "mummytocat.gif",
    "labtocat.png",
    "dunetocat.png",
    "octoliberty.png",
    "femalecodertocat.png",
    "daftpunktocat-thomas.gif",
    "daftpunktocat-guy.gif",
    "foundingfather_v2.png",
    "poptocat_v2.png",
    "Mardigrastocat.png",
    "kimonotocat.png",
    "Professortocat_v2.png",
    "goretocat.png",
    "Robotocat.png",
    "motherhubbertocat.png",
    "skitchtocat.png",
    "gangnamtocat.png",
    "droctocat.png",
    "spidertocat.png",
    "megacat-2.png",
    "dodgetocat_v2.png",
    "stormtroopocat.png",
    "pusheencat.png",
    "deckfailcat.png",
    "murakamicat.png",
    "homercat.png",
    "minion.png",
    "droidtocat.png",
    "octofez.png",
    "heisencat.png",
    "red-polo.png",
    "twenty-percent-cooler-octocat.png",
    "momtocat.png",
    "snowoctocat.png",
    "electrocat.png",
    "codercat.jpg",
    "strongbadtocat.png",
    "adventure-cat.png",
    "doctocat-brown.jpg",
    "dojocat.jpg",
    "defunktocat.png",
    "herme-t-crabb.png",
    "saint-nicktocat.jpg",
    "orderedlistocat.png",
    "thanktocat.png",
    "megacat.jpg",
    "linktocat.jpg",
    "plumber.jpg",
    "octotron.jpg",
    "baracktocat.jpg",
    "octocat-de-los-muertos.jpg",
    "grim-repo.jpg",
    "father_timeout.jpg",
    "waldocat.png",
    "hipster-partycat.jpg",
    "riddlocat.png",
    "visionary.jpg",
    "oktobercat.png",
    "shoptocat.png",
    "nyantocat.gif",
    "octdrey-catburn.jpg",
    "spectrocat.png",
    "bear-cavalry.png",
    "andycat.jpg",
    "notocat.jpg",
    "dodgetocat.jpg",
    "cloud.jpg",
    "scarletteocat.jpg",
    "poptocat.png",
    "jenktocat.jpg",
    "xtocat.jpg",
    "chellocat.jpg",
    "cherryontop-o-cat.png",
    "supportcat.png",
    "collabocats.jpg",
    "constructocat2.jpg",
    "total-eclipse-of-the-octocat.jpg",
    "pacman-ghosts.jpg",
    "okal-eltocat.jpg",
    "octoclark-kentocat.jpg",
    "agendacat.png",
    "ironcat.jpg",
    "inspectocat.jpg",
    "jean-luc-picat.jpg",
    "spocktocat.png",
    "wilson.jpg",
    "swagtocat.png",
    "hubot.jpg",
    "monroe.jpg",
    "trekkie.png",
    "octonaut.jpg",
    "bouncercat.png",
    "founding-father.jpg",
    "pythocat.png",
    "drupalcat.jpg",
    "socialite.jpg",
    "setuptocat.jpg",
    "repo.png",
    "forktocat.jpg",
    "benevocats.png",
    "scottocat.jpg",
    "puppeteer.png",
    "octobiwan.jpg",
    "class-act.png",
    "original.png",
    "idokungfoo-avatar.jpg",
]
