import {
    AuthResult,
    Client,
    ensureStrReqBody,
    hexStringToUint8Array,
    isJSON,
    unauthenticatedRoutes
} from "@/../shared/utils";
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';
import anylogger from 'anylogger';
import 'anylogger-console';

const allowedOrigins = ['www.vulnetix.com', 'staging.vulnetix.com', 'app.vulnetix.com']

// Respond to OPTIONS method
export const onRequestOptions = async context => {
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context
    const CF_ray = request.headers.get('CF-ray') || null
    if (!CF_ray) {
        allowedOrigins.push('localhost:8788')
    }
    const origin = request.headers.get('host')
    const proto = origin === 'localhost:8788' ? 'http://' : 'https://'
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? `${proto}${origin}` : 'https://app.vulnetix.com',
        },
    })
}

// Before any other middleware, setup log handling
const errorHandling = async context => {
    const { request, env, next, data } = context
    const tlsVersion = request.cf.tlsVersion;
    // Allow only TLS versions 1.2 and 1.3
    if (tlsVersion !== "TLSv1.2" && tlsVersion !== "TLSv1.3") {
        return new Response("Please use TLS version 1.2 or higher.", { status: 403 })
    }
    const userAgent = request.headers.get('User-Agent') || ''
    const lowerUserAgent = userAgent.toLowerCase()
    // List of substrings to check in the User-Agent
    const blockedSubstrings = [
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
        // Respond with 403 Forbidden
        return new Response('Forbidden', { status: 403 })
    }
    data.logger = anylogger('vulnetix-worker')
    setLoggerLevel(data.logger, env.LOG_LEVEL)
    try {
        return await next()
    } catch (err) {
        data.logger.error(err.message, err.stack)
        return new Response(err.message, { status: 500 })
    }
}

// Connection to D1 using Prisma ORM and ensure JSON body is available as an object
const setupDependencies = async context => {
    const { request, env, data, next } = context
    const adapter = new PrismaD1(env.d1db)
    const { searchParams } = new URL(request.url)
    data.searchParams = searchParams
    if (["POST", "PUT", "PATCH"].includes(request.method.toUpperCase())) {
        data.body = await ensureStrReqBody(request)
        if (isJSON(data.body)) {
            data.json = JSON.parse(data.body)
        }
    }
    const clientOptions = {
        adapter,
        transactionOptions: {
            maxWait: 1500, // default: 2000
            timeout: 2000, // default: 5000
        },
    }
    if (env.LOG_LEVEL === "DEBUG") {
        clientOptions.log = [
            {
                emit: "event",
                level: "query",
            },
        ]
    }
    data.prisma = new PrismaClient(clientOptions)
    data.prisma.$on("query", async e => {
        data.logger.debug(`${e.query} ${e.params}`)
    })

    return await next()
}

// Ensure authentication is always performed, with specified exceptions
const authentication = async context => {
    const { request, next, data } = context
    const url = new URL(request.url)
    if (request.cf.botManagement.verifiedBot || request.cf.botManagement.score <= 60) {
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.FORBIDDEN } }), { status: 403 })
    }
    const authRequired =
        !unauthenticatedRoutes.static.includes(url.pathname) &&
        !unauthenticatedRoutes.prefixes.map(i => url.pathname.startsWith(i)).includes(true)

    if (!authRequired || !url.pathname.startsWith('/api/')) {
        return await next()
    }
    const origin = request.headers.get('host')
    if (origin === 'staging.vulnetix.com') {
        data.session = await data.prisma.Session.findFirstOrThrow({
            where: { kid: '18f55ff2-cd8e-4c31-8d62-43bc60d3117e' }
        })
        return await next()
    }
    const method = request.method.toUpperCase()
    const path = url.pathname + url.search
    const body = ['GET', 'DELETE'].includes(method.toUpperCase()) ? '' : await ensureStrReqBody(request)
    // Retrieve signature and timestamp from headers
    const signature = request.headers.get('authorization')?.replace('HMAC ', '')
    const timestampStr = request.headers.get('x-timestamp')
    const kid = request.headers.get('x-vulnetix-kid')

    if (!signature || !timestampStr || !kid) {
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.FORBIDDEN } }), { status: 403 })
    }

    // Convert timestamp from string to integer
    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) {
        data.logger.warn('Invalid timestamp format', timestamp)
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.FORBIDDEN } }), { status: 403 })
    }
    // Validate timestamp (you may want to add a check to ensure the request isn't too old)
    const currentTimestamp = new Date().getTime()
    if (Math.abs(currentTimestamp - timestamp) > 3e+5) { // e.g., allow a 5-minute skew
        data.logger.warn('expired, skew', timestamp)
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.EXPIRED } }), { status: 401 })
    }
    // Retrieve the session key from the database using Prisma
    const session = await data.prisma.Session.findFirstOrThrow({
        where: { kid }
    })
    if (!session.expiry || session.expiry <= new Date().getTime()) {
        data.logger.warn('expired', timestamp)
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.EXPIRED } }), { status: 401 })
    }
    const secretKeyBytes = new TextEncoder().encode(session.secret)
    const payloadBytes = Client.makePayload({
        method,
        path,
        kid,
        timestamp,
        body: encodeURIComponent(body)
    })
    const key = await crypto.subtle.importKey(
        "raw",
        secretKeyBytes,
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["verify"]
    )

    const signatureBytes = hexStringToUint8Array(signature)
    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes)

    if (!isValid) {
        data.logger.warn('Invalid signature', signature)
        return new Response(JSON.stringify({ ok: false, error: { message: AuthResult.FORBIDDEN } }), { status: 401 })
    }
    data.session = session

    return await next()
}

const redirect = async context => {
    const { request, next } = context
    const redirects = {
        '/': 'https://www.vulnetix.com'
    }
    const url = new URL(request.url)
    if (redirects[url.pathname]) {
        return new Response(null, {
            status: 307,
            headers: {
                'Location': redirects[url.pathname],
            },
        })
    }
    return await next()
}

// Set CORS to all /api responses
const dynamicHeaders = async context => {
    const { request, next } = context
    const response = await next()
    const CF_ray = request.headers.get('CF-ray') || null
    if (!CF_ray) {
        allowedOrigins.push('localhost:8788')
    }
    const origin = request.headers.get('host')
    const proto = origin === 'localhost:8788' ? 'http://' : 'https://'
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? `${proto}${origin}` : 'https://app.vulnetix.com')
    return response
}

/**
 * Maps log level strings to their numeric values and validates input
 * @param {Object} log - Logging adapter
 * @param {Object} level - Environment configuration object containing LOG_LEVEL
 */
export const setLoggerLevel = (log, level = "WARN") => {
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

export const onRequest = [redirect, errorHandling, setupDependencies, authentication, dynamicHeaders]
