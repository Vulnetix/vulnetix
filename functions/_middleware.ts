import { PrismaD1 } from '@prisma/adapter-d1';
import { Prisma, PrismaClient, Session } from '@prisma/client';
import { Context } from "@shared/interfaces";
import {
    AuthResult,
    Client,
    ensureStrReqBody,
    hexStringToUint8Array,
    isJSON,
    unauthenticatedRoutes
} from "@shared/utils";
import anylogger from 'anylogger';
import 'anylogger-console';
import { parse } from "cookie";
import { createRemoteJWKSet, JWTPayload, jwtVerify, JWTVerifyResult } from 'jose';

const allowedOrigins: string[] = ['www.vulnetix.com', 'staging.vulnetix.com', 'app.vulnetix.com']
const AUD = "30bd33509be064eb1c217310e933a935cba3c8bd4a08092cbfaf32de134eed96" // CF Zero Trust Access (WARP)
const ISS = "https://vulnetix-staff.cloudflareaccess.com"
const SUB = "23baebb8-6232-5d70-bc8c-73a523db723a" // Google SSO Staging
const CERTS_URL = `${ISS}/cdn-cgi/access/certs`
const JWKS = createRemoteJWKSet(new URL(CERTS_URL))

// Respond to OPTIONS method
export const onRequestOptions = async (context: Context) => {
    const { request } = context
    const CF_ray: string | null = request.headers.get('CF-ray') || null
    if (!CF_ray) {
        allowedOrigins.push('localhost:8788')
    }
    const origin: string = request.headers.get('host') || ''
    const proto: string = origin === 'localhost:8788' ? 'http://' : 'https://'
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? `${proto}${origin}` : 'https://app.vulnetix.com',
        },
    })
}

// Before any other middleware, setup log handling
const errorHandling = async (context: Context) => {
    const { request, env, next, data } = context
    const tlsVersion: string | undefined = request.cf?.tlsVersion
    // Allow only TLS versions 1.2 and 1.3
    const origin: string = request.headers.get('host') || '127.0.0.1'
    if (origin !== '127.0.0.1' && (tlsVersion !== "TLSv1.2" && tlsVersion !== "TLSv1.3")) {
        return new Response("Please use TLS version 1.2 or higher.", { status: 403 })
    }
    const userAgent: string = request.headers.get('User-Agent') || ''
    const lowerUserAgent: string = userAgent.toLowerCase()
    // List of substrings to check in the User-Agent
    const blockedSubstrings: string[] = [
        "semrushbot", "ahrefsbot", "dotbot", "whatcms", "rogerbot", "blexbot",
        "linkfluence", "mj12bot", "aspiegelbot", "domainstatsbot", "cincraw",
        "nimbostratus", "httrack", "serpstatbot", "megaindex", "semanticbot",
        "cocolyzebot", "domcopbot", "traackr", "bomborabot", "linguee",
        "webtechbot", "clickagy", "sqlmap", "internet-structure-research-project-bot",
        "seekport", "awariosmartbot", "onalyticabot", "buck", "riddler", "sbl-bot",
        "df", "pubmatic", "bvbot", "sogou", "barkrowler", "embed.ly",
        "semantic-visions", "voluumdsp", "wc-test-dev-bot", "gulperbot", "moreover",
        "ltx71", "accompanybot", "mauibot", "moatbot", "seznambot", "zagbot",
        "ccbot", "tweetmemebot", "paperlibot", "livelapbot", "slurp", "sottopop",
        "mail.ru_bot", "rasabot", "anderspinkbot", "zoominfobot", "castlebot",
        "linkdexbot", "coccocbot", "yacybot", "isec_bot", "flockbrain", "csscheck",
        "surdotlybot", "contxbot", "relemindbot", "pulno", "zombiebot",
        "dmasslinksafetybot", "linkpadbot", "aaabot", "mtrobot", "snappreviewbot",
        "scrapy", "bytespider", "bytedance", "mozlila", "nessus", "binlar",
        "blackwidow", "blekkobot", "blowfish", "bullseye", "bunnys", "butterfly",
        "careerbot", "casper", "checkpriv", "cheesebot", "cherrypick", "chinaclaw",
        "choppy", "clshttp", "cmsworld", "copernic", "copyrightcheck", "cosmos",
        "crescent", "cy_cho", "datacha", "diavol", "discobot", "dittospyder",
        "dotnetdotcom", "dumbot", "emailcollector", "emailsiphon", "emailwolf",
        "extract", "eyenetie", "seokicks", "futuribot", "netpeakcheckerbot",
        "yellowbrandprotectionbot", "datagnionbot", "uptime-kuma", "peer39", "crawler",
        "claudebot", "fidget", "my-tiny", "flaming", "flashget", "flicky", "foobot",
        "g00g1e", "getright", "gigabot", "go-ahead-got", "gozilla", "grabnet",
        "grafula", "harvest", "heritrix", "icarus6j", "jetbot", "jetcar",
        "jikespider", "kmccrew", "leechftp", "libweb", "linkextractor", "linkscan",
        "linkwalker", "loader", "masscan", "miner", "majestic", "mechanize",
        "morfeus", "moveoverbot", "netmechanic", "netspider", "nicerspro", "nikto",
        "ninja", "nutch", "octopus", "pagegrabber", "planetwork", "postrank",
        "purebot", "pycurl", "python", "queryn", "queryseeker", "radian6",
        "radiation", "realdownload", "scooter", "seekerspider", "semalt", "siclab",
        "sindice", "sistrix", "sitebot", "siteexplorer", "sitesnagger", "skygrid",
        "smartdownload", "snoopy", "sosospider", "spankbot", "spbot", "stackrambler",
        "stripper", "sucker", "surftbot", "finditanswersbot", "vebidoobot",
        "coibotparser", "anybot", "dingtalkbot", "echobot", "popscreen", "vuhuvbot",
        "marketwirebot", "hypestat", "whatyoutypebot", "mixrankbot", "xforce",
        "smtbot", "thesis-research-bot", "sux0r", "suzukacz", "suzuran", "takeout",
        "teleport", "telesoft", "true_robots", "turingos", "vampire", "vikspider",
        "voideye", "webleacher", "webreaper", "webstripper", "webvac", "webviewer",
        "webwhacker", "winhttp", "wwwoffle", "woxbot", "xaldon", "xxxyy", "yamanalab",
        "yioopbot", "youda", "zeus", "zmeu", "zune", "zyborg", "lanaibot",
        "metadataparser", "go-http-client", "daum", "yandexbot", "libwww",
        "guzzlehttp", "expert-html", "geedobot", "newspaper", "peacockmedia",
        "gobuster", "expanseinc", "crawling", "tineye", "damieng", "scpitspi",
        "screaming", "babbar", "scalaj", "turnitin", "blackbox", "okhttp",
        "acebookexternalhit", "externalhit", "dataforseo", "semrush", "contentking",
        "siteauditbot", "botify", "cxense", "revvim", "colly", "github",
        "img2dataset", "petalbot", "whizebot", "projectdiscovery", "datenbutler",
        "seebot.org", "fuseonbot", "vipnytt", "pandalytics", "ninjbot", "gowikibot",
        "360spider", "acapbot", "acoonbot", "ahrefs", "alexibot", "asterias",
        "attackbot", "backdorbot", "becomebot", "gptbot", "kauaibot", "zagbot"
    ]
    // Check if the User-Agent contains any blocked substrings
    if (blockedSubstrings.some(substring => lowerUserAgent.includes(substring))) {
        return new Response(AuthResult.FORBIDDEN, { status: 403 })
    }
    data.logger = anylogger('vulnetix-worker')
    setLoggerLevel(data.logger, env.LOG_LEVEL)
    try {
        return next()
    } catch (err) {
        data.logger.error(err.message, err.stack)
        return new Response(err.message, { status: 500 })
    }
}

// Connection to D1 using Prisma ORM and ensure JSON body is available as an object
const setupDependencies = async (context: Context) => {
    const { request, env, data, next } = context
    const adapter: PrismaD1 = new PrismaD1(env.d1db)
    const { searchParams } = new URL(request.url)
    data.searchParams = searchParams
    if (["POST", "PUT", "PATCH"].includes(request.method.toUpperCase())) {
        data.body = await ensureStrReqBody(request)
        if (isJSON(data.body)) {
            data.json = JSON.parse(data.body)
        }
    }
    const clientOptions: Prisma.PrismaClientOptions = {
        adapter,
        transactionOptions: {
            maxWait: 1500, // default: 2000
            timeout: 2000, // default: 5000
        },
        log: [{ emit: 'event', level: 'query' }]
    }
    data.prisma = new PrismaClient(clientOptions)
    if (env.LOG_LEVEL === "DEBUG") {
        // @ts-ignore
        data.prisma.$on("query", async (e: Prisma.QueryEvent) => {
            data.logger.debug(`${e.query} ${e.params}`)
        })
    }

    return next()
}

// Ensure authentication is always performed, with specified exceptions
const authentication = async (context: Context) => {
    const { request, next, data } = context
    try {
        const url: URL = new URL(request.url)
        const origin: string = request.headers.get('host') || '127.0.0.1'
        if (origin !== '127.0.0.1' && (request.cf.botManagement.verifiedBot || request.cf.botManagement.score <= 60)) {
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }
        const authRequired: boolean =
            !unauthenticatedRoutes.static.includes(url.pathname) &&
            !unauthenticatedRoutes.prefixes.map(i => url.pathname.startsWith(i)).includes(true)

        if (!authRequired || !url.pathname.startsWith('/api/')) {
            return next()
        }
        if (origin === 'staging.vulnetix.com' && data?.jwtVerifyResult) {
            data.cfzt = data.jwtVerifyResult.payload as JWTPayload // all claims verified previously
            delete data.jwtVerifyResult
            data.session = await data.prisma.session.findFirstOrThrow({
                where: { kid: '18f55ff2-cd8e-4c31-8d62-43bc60d3117e' } // special Staging INTERNAL_ADMIN user
            })
            return next()
        }
        const method: string = request.method.toUpperCase()
        const path: string = url.pathname + url.search
        const body: string = ['GET', 'DELETE'].includes(method.toUpperCase()) ? '' : await ensureStrReqBody(request)
        // Retrieve signature and timestamp from headers
        const signature: string | null = request.headers.get('authorization')?.replace('HMAC ', '')
        const timestampStr: string | null = request.headers.get('x-timestamp')
        const kid: string | null = request.headers.get('x-vulnetix-kid')

        if (!signature || !timestampStr || !kid) {
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }

        // Convert timestamp from string to integer
        const timestamp: number = parseInt(timestampStr, 10)
        if (isNaN(timestamp)) {
            data.logger.warn('Invalid timestamp format', timestamp)
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }
        // Validate timestamp (you may want to add a check to ensure the request isn't too old)
        const currentTimestamp: number = new Date().getTime()
        if (Math.abs(currentTimestamp - timestamp) > 3e+5) { // e.g., allow a 5-minute skew
            data.logger.warn('expired, skew', timestamp)
            return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.EXPIRED } }), { status: 401 })
        }
        // Retrieve the session key from the database using Prisma
        const session: Session = await data.prisma.session.findFirstOrThrow({
            where: { kid }
        })
        if (!session.expiry || session.expiry <= new Date().getTime()) {
            data.logger.warn('expired', timestamp)
            return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.EXPIRED } }), { status: 401 })
        }
        const secretKeyBytes: Uint8Array = new TextEncoder().encode(session.secret)
        const payloadBytes: Uint8Array = Client.makePayload({
            method,
            path,
            kid,
            timestamp,
            body: encodeURIComponent(body)
        })
        const key: CryptoKey = await crypto.subtle.importKey(
            "raw",
            secretKeyBytes,
            { name: "HMAC", hash: "SHA-512" },
            false,
            ["verify"]
        )

        const signatureBytes: Uint8Array = hexStringToUint8Array(signature)
        const isValid: boolean = await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes)

        if (!isValid) {
            data.logger.warn('Invalid signature', signature)
            return new Response(AuthResult.FORBIDDEN, { status: 401 })
        }
        data.session = session
    } catch (err) {
        data.logger.error(err.message, err.stack)
        return new Response(AuthResult.FORBIDDEN, { status: 403 })
    }
    return next()
}

// Ensure authentication is always performed, with specified exceptions
const pre_authentication = async (context: Context) => {
    const { request, next, data } = context
    try {
        const url: URL = new URL(request.url)
        const origin: string = request.headers.get('host') || '127.0.0.1'
        if (origin !== '127.0.0.1' && (request.cf.botManagement.verifiedBot || request.cf.botManagement.score <= 60)) {
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }
        const authRequired: boolean =
            !unauthenticatedRoutes.static.includes(url.pathname) &&
            !unauthenticatedRoutes.prefixes.map(i => url.pathname.startsWith(i)).includes(true)

        if (!authRequired || !url.pathname.startsWith('/api/')) {
            return next()
        }
        if (origin === 'staging.vulnetix.com') {
            const cookie = parse(request.headers.get("Cookie") || "")
            const token = cookie['CF_Authorization']
            if (!token) {
                console.warn('Potentially malicious request')
                return new Response(AuthResult.REVOKED, { status: 302, headers: { 'Location': `${ISS}/cdn-cgi/access/logout` } })
            }
            try {
                 data.jwtVerifyResult = await jwtVerify(token, JWKS, {
                    issuer: ISS,
                    audience: AUD,
                    subject: SUB,
                    algorithms: ['RS256'],
                }) as JWTVerifyResult
                // Validate expiry timestamp
                const currentTimestamp: number = new Date().getTime()
                if (Math.abs(currentTimestamp - data.jwtVerifyResult.payload.exp) > -200) { // allow 200ms skew
                    console.warn('expired', data.cfzt)
                    return new Response(AuthResult.EXPIRED, { status: 302, headers: { 'Location': `${ISS}/cdn-cgi/access/logout` } })
                }
            } catch (err) {
                console.error(err.message, err.stack)
                return new Response(AuthResult.FORBIDDEN, { status: 403, headers: { 'Location': `${ISS}/cdn-cgi/access/logout` } })
            }
            return next()
        }
        // Retrieve signature and timestamp from headers
        const signature: string | null = request.headers.get('authorization')?.replace('HMAC ', '')
        const timestampStr: string | null = request.headers.get('x-timestamp')
        const kid: string | null = request.headers.get('x-vulnetix-kid')
        if (!signature || !timestampStr || !kid) {
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }
        // Convert timestamp from string to integer
        const timestamp: number = parseInt(timestampStr, 10)
        if (isNaN(timestamp)) {
            console.warn('Invalid timestamp format', timestamp)
            return new Response(AuthResult.FORBIDDEN, { status: 403 })
        }
        // Pre-validate timestamp (you may want to add a check to ensure the request isn't too old)
        const currentTimestamp: number = new Date().getTime()
        if (Math.abs(currentTimestamp - timestamp) > 3e+5) { // e.g., allow a 5-minute skew
            console.warn('expired, skew', timestamp)
            return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.EXPIRED } }), { status: 401 })
        }

    } catch (err) {
        console.error(err.message, err.stack)
        return new Response(AuthResult.FORBIDDEN, { status: 403 })
    }
    return next()
}

const redirect = async (context: Context) => {
    const { request, data, next } = context
    const redirects: Record<string, string> = {
        '/': 'https://www.vulnetix.com'
    }
    const origin: string = request.headers.get('host') || '127.0.0.1'
    const url = new URL(request.url)
    if (origin === 'staging.vulnetix.com') {
        return next()
    }
    if (redirects[url.pathname]) {
        return new Response(null, {
            status: 307,
            headers: {
                'Location': redirects[url.pathname],
            },
        })
    }
    return next()
}

// Set CORS to all /api responses
const dynamicHeaders = async (context: Context) => {
    const { request, next } = context
    const CF_ray: string | null = request.headers.get('CF-ray') || null
    if (!CF_ray) {
        allowedOrigins.push('localhost:8788')
    }
    const origin: string = request.headers.get('host') || ''
    const proto: string = origin === 'localhost:8788' ? 'http://' : 'https://'
    const acao: string = allowedOrigins.includes(origin) ? `${proto}${origin}` : 'https://app.vulnetix.com'
    try {
        const response = await next()
        response.headers.set('Access-Control-Allow-Origin', acao)
        return response
    } catch (err) {
        console.error(err)
        return new Response(JSON.stringify({
            ok: false,
            error: { type: err.constructor.name, message: err.message }
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': acao
            },
        })
    }
}

/**
 * Maps log level strings to their numeric values and validates input
 * @param {Object} log - Logging adapter
 * @param {Object} level - Environment configuration object containing LOG_LEVEL
 */
export const setLoggerLevel = (log: any, level: string = "WARN") => {
    const LOG_LEVEL_MAP = {
        'ERROR': log.ERROR,
        'WARN': log.WARN,
        'INFO': log.INFO,
        'LOG': log.LOG,
        'DEBUG': log.DEBUG,
        'TRACE': log.TRACE,
        'ALL': log.ALL,
        'NONE': log.NONE
    }
    log.level = !level || !(level in LOG_LEVEL_MAP) ? log.LOG : LOG_LEVEL_MAP[level]
}

export const onRequest = [
    redirect, // Redirect to Vulnetix homepage
    errorHandling, // Handle errors and log them
    pre_authentication, // Check signatures for requests before connecting to the Database
    setupDependencies, // Setup Prisma ORM and ensure JSON body is available
    authentication, // Authenticate requests
    dynamicHeaders // Set CORS headers for all /api responses
]
