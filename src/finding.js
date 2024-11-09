import {
    constructVersionRangeString,
    convertIsoDatesToTimestamps,
    EPSS,
    getSemVerWithoutOperator,
    parseVersionRanges,
    isValidSemver,
    isVersionVulnerable,
    MitreCVE,
    OSV,
    VexAnalysisState
} from "@/utils";
import { CVSS30, CVSS31, CVSS40 } from '@pandatix/js-cvss';
/**
 * Adds or replaces an object in an array based on a key-value match condition.
 * 
 * @param {Array|string} inputObject - The input array or JSON string containing an array of objects.
 *                                    If a string is provided, it must be a valid JSON-encoded array.
 * @param {string} keyName - The name of the key to match against in each object.
 * @param {Object} newObject - The new object to add or replace in the array.
 * 
 * @returns {Array|string} Returns either:
 *                        - An array if the input was an array
 *                        - A JSON string if the input was a JSON string
 * 
 * @throws {Error} Throws an error if:
 *                 - inputObject is neither an array nor a string
 *                 - inputObject is a string but contains invalid JSON
 *                 - Parsed JSON string does not contain an array
 * 
 * @example
 * // With array input
 * const arr = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
 * const newObj = { id: 1, name: 'Johnny' };
 * addToList(arr, 'id', newObj);
 * // Returns: [{ id: 1, name: 'Johnny' }, { id: 2, name: 'Jane' }]
 * 
 * @example
 * // With JSON string input
 * const jsonStr = '[{"id": 1, "name": "John"}, {"id": 2, "name": "Jane"}]';
 * addToList(jsonStr, 'id', { id: 1, name: 'Johnny' });
 * // Returns: '[{"id":1,"name":"Johnny"},{"id":2,"name":"Jane"}]'
 */
function addToList(inputObject, keyName, newObject) {
    // Store the type of inputObject
    const inputType = typeof inputObject
    // Initialize working array
    let workingArray
    // Handle input based on type
    if (Array.isArray(inputObject)) {
        workingArray = inputObject
    } else if (inputType === 'string') {
        try {
            workingArray = JSON.parse(inputObject);
            if (!Array.isArray(workingArray)) {
                throw new Error('Parsed JSON is not an array')
            }
        } catch (error) {
            throw new Error('Invalid JSON string: ' + error.message)
        }
    } else {
        console.error(inputObject, 'inputObject must be either an array or a JSON string')
        return inputObject
    }

    if (!newObject?.[keyName]) {
        workingArray.push(newObject)
    } else {
        // Find index of matching object
        const index = workingArray.findIndex(item => item[keyName] === newObject[keyName]);
        // Replace or add newObject
        if (index !== -1) {
            workingArray[index] = newObject
        } else {
            workingArray.push(newObject)
        }
    }
    // Return based on input type
    if (inputType === 'string') {
        return JSON.stringify(workingArray)
    }

    return workingArray
}

export const processFinding = async (prisma, r2adapter, verificationResult, finding, seen = 0) => {
    const osvData = await new OSV().query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, finding.detectionTitle)
    finding.modifiedAt = (new Date(osvData.modified)).getTime()
    finding.publishedAt = (new Date(osvData.published)).getTime()
    finding.databaseReviewed = osvData?.database_specific?.github_reviewed ? 1 : 0
    if (osvData?.database_specific?.github_reviewed && osvData?.database_specific?.github_reviewed_at) {
        finding.timelineJSON = addToList(finding.timelineJSON ?? '[]', 'value', { value: `GitHub Advisory review`, time: new Date(osvData.database_specific.github_reviewed_at).getTime() })
    }
    if (osvData?.database_specific?.nvd_published_at) {
        finding.timelineJSON = addToList(finding.timelineJSON ?? '[]', 'value', { value: `NIST Advisory NVD review`, time: new Date(osvData.database_specific.nvd_published_at).getTime() })
    }
    finding.aliases = JSON.stringify(osvData?.aliases?.filter(a => a !== finding.cveId) || [])
    finding.cwes = JSON.stringify(osvData?.database_specific?.cwe_ids || [])
    const fixVersions = []
    const vulnerableVersionRange = []
    for (const affected of osvData.affected) {
        for (const range of affected?.ranges || []) {
            let fixed = ''
            let introduced = ''
            for (const event of range?.events || []) {
                if (event?.fixed) {
                    fixVersions.push(event.fixed)
                    fixed = ` < ${event.fixed}`
                }
                if (event?.last_affected) {
                    fixed = ` <= ${event.last_affected}`
                }
                if (event?.introduced) {
                    introduced = `>= ${event.introduced}`
                }
            }
            vulnerableVersionRange.push(introduced + fixed)
        }
        if (affected?.database_specific?.last_known_affected_version_range) {
            // vulnerableVersionRange.push(affected.database_specific.last_known_affected_version_range)
        }
        if (affected?.package?.ecosystem) {
            finding.packageEcosystem = affected.package.ecosystem
        }
        if (affected?.database_specific?.source) {
            finding.advisoryUrl = affected.database_specific.source
        }
        if (affected?.ecosystem_specific?.affected_functions) {
            finding.affectedFunctions = affected.ecosystem_specific.affected_functions.join(`\n`)
        }
    }
    if (vulnerableVersionRange.length) {
        finding.vulnerableVersionRange = vulnerableVersionRange.join(' || ')
    }
    if (fixVersions.length) {
        finding.fixVersion = fixVersions.join(' || ')
    }
    finding.fixAutomatable = !!finding.vulnerableVersionRange && !!finding.fixVersion ? 1 : 0
    finding.malicious = osvData.id.startsWith("MAL-") ? 1 : 0
    finding.referencesJSON = JSON.stringify(osvData.references.map(reference => reference.url))

    const cveId = finding.detectionTitle.startsWith('CVE-') ? finding.detectionTitle : osvData?.aliases?.filter(a => a.startsWith('CVE-')).pop()
    let cvssVector
    let cvssScore
    let cvelistv5
    let cve
    if (cveId) {
        cve = await getCveData(prisma, r2adapter, verificationResult, cveId)
    }
    if (cve?.fileLink?.url) {
        const [, year, number] = cveId.split('-')
        const objectPath = `cvelistv5/${year}/${number.slice(0, -3) + "xxx"}/${cveId}.json`
        const r2object = await r2adapter.get(objectPath)
        if (r2object) {
            try {
                cvelistv5 = await r2object.json()
            } catch (err) { }
        }
    }
    if (cvelistv5) {
        const {
            cveMetadata,
            containers: { cna, adp }
        } = cvelistv5
        const cvssVector = findVectorString(cna.metrics)
        if (cvssVector) {
            if (cvssVector.startsWith('CVSS:4.0/')) {
                cvssScore = new CVSS40(cvssVector).Score().toString()
            } else if (cvssVector.startsWith('CVSS:3.1/')) {
                cvssScore = new CVSS31(cvssVector).BaseScore().toString()
            } else if (cvssVector.startsWith('CVSS:3.0/')) {
                cvssScore = new CVSS30(cvssVector).BaseScore().toString()
            }
        }
        if (cna?.timeline) {
            finding.timelineJSON = addToList(finding.timelineJSON, 'value', JSON.stringify(cna.timeline.map(i => convertIsoDatesToTimestamps(i))))
        }
        // Extract CISA date
        const cisaAdp = adp?.find(container => container.providerMetadata.shortName === 'CISA-ADP')
        if (cisaAdp?.providerMetadata?.dateUpdated) {
            finding.cisaDateAdded = new Date(cisaAdp.providerMetadata.dateUpdated).getTime()
        }
        // Get affected data from ADP and CNA
        const adpAffected = adp?.flatMap(container => container.affected || []) || []
        const cnaAffected = cna.affected || []
        // Required properties we're looking for
        const requiredProps = ['versions', 'vendor', 'product']
        // Find first valid affected data, preferring ADP over CNA
        const primaryAffected = findFirstValidAffected(adpAffected, requiredProps) ||
            findFirstValidAffected(cnaAffected, requiredProps) || null
        // Extract affected data ensuring valid values
        const affectedData = {
            versions: primaryAffected?.versions?.filter(v => isValidValue(v.version)) || [],
            vendor: isValidValue(primaryAffected?.vendor) ? primaryAffected.vendor : null,
            product: isValidValue(primaryAffected?.product) ? primaryAffected.product : null,
            cpes: primaryAffected?.cpes?.filter(cpe => isValidValue(cpe))?.join('\n')
        }

        if (cveMetadata?.datePublished) {
            finding.publishedAt = new Date(cveMetadata.datePublished).getTime()
        }
        if (cveMetadata?.dateReserved) {
            finding.createdAt = new Date(cveMetadata.dateReserved).getTime()
        }
        if (cveMetadata?.dateUpdated) {
            finding.modifiedAt = new Date(cveMetadata.dateUpdated).getTime()
        }
        finding.vulnerableVersionRange = affectedData.versions.length > 0 ? constructVersionRangeString(affectedData.versions) : null
        finding.cpe = affectedData?.cpes
        finding.vendor = affectedData?.vendor
        finding.product = affectedData?.product
    }
    const confidence = evaluateAdvisoryConfidence(finding)
    finding.confidenceScore = confidence.percentage
    finding.confidenceLevel = confidence.confidenceLevel
    finding.confidenceRationaleJSON = JSON.stringify(confidence.evaluations.filter(i => i.result).map(i => i.rationale))
    finding.timelineJSON = makeTimeline(finding)
    const info = await prisma.Finding.update({
        where: { uuid: finding.uuid },
        data: {
            detectionTitle: finding.detectionTitle,
            createdAt: finding.createdAt,
            modifiedAt: finding.modifiedAt,
            publishedAt: finding.publishedAt,
            databaseReviewed: finding.databaseReviewed,
            cisaDateAdded: finding.cisaDateAdded,
            aliases: finding.aliases,
            cwes: finding.cwes,
            packageEcosystem: finding.packageEcosystem,
            advisoryUrl: finding.advisoryUrl,
            fixVersion: finding.fixVersion,
            fixAutomatable: finding.fixAutomatable,
            vulnerableVersionRange: finding.vulnerableVersionRange,
            cpe: finding.cpe,
            vendor: finding.vendor,
            product: finding.product,
            malicious: finding.malicious,
            referencesJSON: finding.referencesJSON,
            timelineJSON: finding.timelineJSON,
        }
    })
    // console.log(`Update ${finding.detectionTitle}`, info)
    let scores
    if (cveId) {
        const epss = new EPSS()
        scores = await epss.query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, cveId)
    }
    let epssScore, epssPercentile;
    if (scores?.epss) {
        epssScore = parseFloat(scores.epss)
        epssPercentile = parseFloat(scores.percentile)
    }
    const cvss = {}
    if (!cvssVector || !cvssVector.startsWith('CVSS:4/')) {
        cvss.v4 = osvData?.severity?.filter(i => i.type === 'CVSS_V4')?.pop()
        cvss.v31 = osvData?.severity?.filter(i => i.score.startsWith('CVSS:3.1/'))?.pop()
        cvss.v3 = osvData?.severity?.filter(i => i.score.startsWith('CVSS:3/'))?.pop()
        cvssVector = !!cvss.v4 ? cvss.v4.score : !!cvss.v31 ? cvss.v31.score : cvss.v3 ? cvss.v3.score : cvssVector
        const vector = !!cvss.v4 ? new CVSS40(cvss.v4.score) : !!cvss.v31 ? new CVSS31(cvss.v31.score) : cvss.v3 ? new CVSS30(cvss.v3.score) : null
        cvssScore = !!cvss.v4 ? vector.Score().toString() : !!cvss.v31 ? vector.BaseScore().toString() : cvss.v3 ? vector.BaseScore().toString() : null
    }
    // Decision
    // Methodology
    // Exploitation
    // TechnicalImpact
    // Automatable
    // MissionWellbeingImpact        
    let { analysisState = 'in_triage', triageAutomated = 0, triagedAt = null, seenAt = null, analysisDetail = null } = {}
    if (finding.exploits.length || finding.knownExploits.length) {
        analysisState = 'exploitable'
        triageAutomated = 1
        analysisDetail = `Known exploitation`
        if (!triagedAt) {
            triagedAt = new Date().getTime()
        }
    } else if (
        (cvssVector && (
            ['E:U', 'E:P', 'E:F', 'E:H'].some(substring => cvss.v3?.score?.includes(substring)) ||
            ['E:U', 'E:P', 'E:F', 'E:H'].some(substring => cvss.v31?.score?.includes(substring)) ||
            ['E:A', 'E:P', 'E:U'].some(substring => cvss.v4?.score?.includes(substring))
        ))
    ) {
        analysisState = 'exploitable'
        triageAutomated = 1
        analysisDetail = `CVSS provided exploitability vector, without known exploits in the database.`
        if (!triagedAt) {
            triagedAt = new Date().getTime()
        }
    } else if (
        // https://www.first.org/epss/articles/prob_percentile_bins
        epssPercentile > 0.954 // EPSS is best used when there is no other evidence of active exploitation
    ) {
        analysisState = 'exploitable'
        triageAutomated = 1
        analysisDetail = `EPSS Percentile greater than 95.4% which is a critical prediction.`
        if (!triagedAt) {
            triagedAt = new Date().getTime()
        }
    }
    if (analysisState === 'exploitable') {
        triageAutomated = 1
        if (!triagedAt) {
            triagedAt = new Date().getTime()
        }
    }
    // if (!isVersionVulnerable(
    //     getSemVerWithoutOperator(finding.packageVersion),
    //     finding?.vulnerableVersionRange ? parseVersionRanges(finding.vulnerableVersionRange) : parseVersionRanges(`< ${getSemVerWithoutOperator(finding.fixVersion)}`)
    // )) {
    //     analysisState = 'false_positive'
    //     triageAutomated = 1
    //     analysisDetail = `Vulnerbility database error: ${getSemVerWithoutOperator(finding.packageVersion)} in not within vulnerable range "${finding.vulnerableVersionRange}"`
    //     if (!triagedAt) {
    //         triagedAt = new Date().getTime()
    //     }
    // }
    if (seen === 1) {
        seenAt = new Date().getTime()
    }
    const vexExist = finding.triage.filter(t => t.analysisState === analysisState).length !== 0
    let vexData = finding.triage.filter(t => t.analysisState === analysisState).pop() || {}
    if (!vexExist) {
        vexData.analysisState = analysisState
        vexData.findingUuid = finding.uuid
        vexData.createdAt = new Date().getTime()
        vexData.lastObserved = new Date().getTime()
    }
    vexData.analysisDetail = analysisDetail
    vexData.triageAutomated = triageAutomated
    vexData.triagedAt = triagedAt
    vexData.cvssVector = cvssVector
    vexData.cvssScore = cvssScore
    if (epssPercentile) {
        vexData.epssPercentile = epssPercentile.toString()
    }
    if (epssScore) {
        vexData.epssScore = epssScore.toString()
    }
    vexData.seen = seen
    vexData.seenAt = seenAt
    if (vexExist) {
        const vexInfo = await prisma.Triage.update({
            where: {
                uuid: vexData.uuid,
            },
            data: vexData,
        })
        // console.log(`Updated VEX ${finding.detectionTitle}`, vexInfo)
        finding.triage = finding.triage.filter(f => f.uuid != vexData.uuid)
        finding.triage.push(vexData)
    } else {
        vexData = await prisma.Triage.create({ data: vexData })
        finding.triage = finding.triage.filter(f => f.uuid != vexData.uuid)
        finding.triage.push(vexData)
        finding.timelineJSON = makeTimeline(finding)
        const info = await prisma.Finding.update({
            where: { uuid: finding.uuid },
            data: {
                modifiedAt: finding.modifiedAt,
                timelineJSON: finding.timelineJSON,
            }
        })
        // console.log(`Update ${finding.detectionTitle}`, info)
    }

    // expand JSON fields
    finding.confidenceRationale = finding?.confidenceRationaleJSON ? JSON.parse(finding.confidenceRationaleJSON) : []
    finding.references = finding?.referencesJSON ? JSON.parse(finding.referencesJSON) : []
    finding.timeline = finding?.timelineJSON ? JSON.parse(finding.timelineJSON) : []
    finding.exploits = finding?.exploitsJSON ? JSON.parse(finding.exploitsJSON) : []
    finding.knownExploits = finding?.knownExploitsJSON ? JSON.parse(finding.knownExploitsJSON) : []
    finding.aliases = finding?.aliases ? JSON.parse(finding.aliases) : []
    finding.cwes = finding?.cwes ? JSON.parse(finding.cwes) : []
    delete finding.confidenceRationaleJSON
    delete finding.referencesJSON
    delete finding.knownExploitsJSON
    delete finding.timelineJSON
    delete finding.exploitsJSON
    return finding
}

// Helper function to check if a value is valid (exists and not "n/a")
export const isValidValue = value => {
    return value != null && value !== "n/a" && value !== "";
};

// Helper function to find first affected entry with valid required properties
export const findFirstValidAffected = (affectedList = [], requiredProps = []) => {
    return affectedList.find(affected =>
        requiredProps.every(prop => {
            if (prop === 'versions') {
                return Array.isArray(affected.versions) &&
                    affected.versions.length > 0 &&
                    affected.versions.some(v => isValidValue(v.version));
            }
            if (prop === 'cpes') {
                return Array.isArray(affected.cpes) &&
                    affected.cpes.length > 0 &&
                    affected.cpes.some(cpe => isValidValue(cpe));
            }
            return isValidValue(affected[prop]);
        })
    );
};

// Helper function to find valid CVSS vector string with version preference
export const findVectorString = (metrics = []) => {
    const cvssVersions = ['cvssV4_0', 'cvssV3_1', 'cvssV3_0']

    for (const version of cvssVersions) {
        for (const metric of metrics) {
            const vectorString = metric[version]?.vectorString
            if (isValidValue(vectorString)) {
                return vectorString
            }
        }
    }
    return null
}

// Helper function to find valid CVSS vector string with version preference
export const getCveData = async (prisma, r2adapter, verificationResult, cveId) => {
    let cve = await prisma.CVEMetadata.findUnique({
        where: { cveId },
        include: {
            fileLink: true,
            adp: true,
            cna: true,
        }
    })
    if (!cve) {
        cve = await fetchCVE(prisma, r2adapter, verificationResult, cveId)
    }
    return cve
}

export const fetchCVE = async (prisma, r2adapter, verificationResult, cveId) => {
    const cvelistv5 = await new MitreCVE().query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, cveId)
    if (!cvelistv5) {
        return {}
    }
    const {
        cveMetadata,
        dataVersion,
        containers: { cna = {}, adp = [] }
    } = cvelistv5
    // Create or connect CNA organization
    await prisma.cVENumberingAuthrity.upsert({
        where: { orgId: cna.providerMetadata.orgId },
        create: {
            orgId: cna.providerMetadata.orgId,
            shortName: cna.providerMetadata.shortName
        },
        update: {}
    })

    // Get affected data from ADP and CNA
    const adpAffected = adp.flatMap(container => container.affected || []);
    const cnaAffected = cna.affected || [];

    // Required properties we're looking for
    const requiredProps = ['versions', 'vendor', 'product'];

    // Find first valid affected data, preferring ADP over CNA
    const primaryAffected = findFirstValidAffected(adpAffected, requiredProps) ||
        findFirstValidAffected(cnaAffected, requiredProps) ||
        null;

    // Extract affected data ensuring valid values
    const affectedData = {
        versions: primaryAffected?.versions?.filter(v => isValidValue(v.version)) || [],
        vendor: isValidValue(primaryAffected?.vendor) ? primaryAffected.vendor : null,
        product: isValidValue(primaryAffected?.product) ? primaryAffected.product : null,
        cpes: primaryAffected?.cpes?.filter(cpe => isValidValue(cpe)) || []
    }

    const vectorString = findVectorString(cna.metrics)

    // Create file link for the source
    const [, year, number] = cveId.split('-')
    const objectPath = `cvelistv5/${year}/${number.slice(0, -3) + "xxx"}/${cveId}.json`
    const putOptions = { httpMetadata: { contentType: 'application/json', contentEncoding: 'utf8' } }
    await r2adapter.put(objectPath, JSON.stringify(cvelistv5), putOptions)
    const fileLink = await prisma.Link.create({
        data: {
            url: `https://artifacts.vulnetix.app/${objectPath}`,
            contentType: "PLAIN_JSON"
        }
    })
    const update = {
        dataVersion,
        state: cveMetadata.state,
        datePublished: new Date(cveMetadata.datePublished).getTime(),
        dateUpdated: cveMetadata?.dateUpdated ? new Date(cveMetadata.dateUpdated).getTime() : null,
        dateReserved: cveMetadata?.dateReserved ? new Date(cveMetadata.dateReserved).getTime() : null,
        vectorString,
        title: cna?.title || 'Mitre CVE',
        sourceAdvisoryRef: isValidValue(cna.source?.advisory) ? cna.source.advisory : null,
        affectedVendor: affectedData.vendor,
        affectedProduct: affectedData.product,
        affectedVersionsJSON: affectedData.versions.length > 0 ? JSON.stringify(affectedData.versions) : null,
        cpesJSON: affectedData.cpes.length > 0 ? JSON.stringify(affectedData.cpes) : null,
        cnaOrgId: cna.providerMetadata.orgId,
        fileLinkId: fileLink.id
    }
    // Create the main CVE record
    const cve = await prisma.CVEMetadata.upsert({
        where: { cveId },
        create: {
            cveId,
            ...update
        },
        update,
    })

    // Link ADP records
    for (const adpContainer of adp) {
        const { providerMetadata, title = '' } = adpContainer
        await prisma.authorizedDataPublisher.upsert({
            where: { orgId: providerMetadata.orgId },
            create: {
                orgId: providerMetadata.orgId,
                shortName: providerMetadata.shortName,
                title
            },
            update: {}
        })
        try {
            // Create the relationship between CVE and ADP
            await prisma.CVEADP.create({
                data: {
                    cveId,
                    adpId: providerMetadata.orgId
                }
            })
        } catch (e) { }
    }
    return cve
}

const makeTimeline = finding => {
    const retJson = !finding?.timeline
    const timeline = retJson ? JSON.parse(finding?.timelineJSON || '[]') : finding?.timeline || []
    const events = [
        {
            value: 'First discovered in repository',
            time: finding.createdAt,
        },
        {
            value: `Last synchronized with ${finding.source}`,
            time: finding.modifiedAt,
        },
        {
            value: 'Advisory first published',
            time: finding.publishedAt - 1,
        }
    ]
    for (const vex of finding.triage) {
        if (vex.lastObserved) {
            events.push({
                value: `VEX generated as ${VexAnalysisState[vex.analysisState]}`,
                time: vex.lastObserved,
            })
        }
        if (vex.triagedAt && vex.memberEmail) {
            events.push({
                value: `${vex.memberEmail} Traiged`,
                time: vex.triagedAt,
            })
        }
        if (vex.seenAt && vex.memberEmail) {
            events.push({
                value: `${vex.memberEmail} Review`,
                time: vex.seenAt,
            })
        }
    }
    if (finding.cisaDateAdded) {
        events.push({
            value: 'Added to CISA KEV',
            time: finding.cisaDateAdded,
        })
    }
    if (finding.spdx?.createdAt) {
        events.push({
            value: 'SPDX BOM published',
            time: finding.spdx.createdAt,
        })
    }
    if (finding.cdx?.createdAt) {
        events.push({
            value: 'CycloneDX BOM published',
            time: finding.cdx.createdAt,
        })
    }
    timeline.forEach(t => events.push(t))
    const ret = [...new Map(events.map(item => [`${item.value}-${item.time}`, item])).values()]
        .filter(i => !['Last VEX created', 'Pix Automated', 'Last finding outcome decision'].includes(i.value))
        .sort((a, b) => a.time - b.time)

    return retJson ? JSON.stringify(ret) : ret
}

export const confidenceRules = {
    // falsePositiveVersion: {
    //     weight: 20,
    //     evaluate: finding => ({
    //         result: !isVersionVulnerable(
    //             getSemVerWithoutOperator(finding.packageVersion),
    //             finding?.vulnerableVersionRange ? parseVersionRanges(finding.vulnerableVersionRange) : parseVersionRanges(`< ${getSemVerWithoutOperator(finding.fixVersion)}`)
    //         ),
    //         rationale: `Vulnerbility database error: ${getSemVerWithoutOperator(finding.packageVersion)} in not within vulnerable range "${finding.vulnerableVersionRange}"`,
    //         score: !isVersionVulnerable(
    //             getSemVerWithoutOperator(finding.packageVersion),
    //             finding?.vulnerableVersionRange ? parseVersionRanges(finding.vulnerableVersionRange) : parseVersionRanges(`< ${getSemVerWithoutOperator(finding.fixVersion)}`)
    //         ) ? 20 : 0
    //     })
    // },
    databaseReviewed: {
        weight: 2,
        evaluate: finding => ({
            result: finding.databaseReviewed === 1,
            rationale: `Information in this advisory has been fact checked.`,
            score: finding.databaseReviewed === 1 ? 2 : 0
        })
    },
    invalidPackageVersion: {
        weight: -5,
        evaluate: finding => ({
            result: !isValidSemver(getSemVerWithoutOperator(finding.packageVersion)),
            rationale: "Package version format is not SemVer and prone to false positive detections.",
            score: !isValidSemver(getSemVerWithoutOperator(finding.packageVersion)) ? -5 : 0
        })
    },
    cisaValidated: {
        weight: 5,
        evaluate: finding => ({
            result: Boolean(finding.cisaDateAdded),
            rationale: "CISA vulnrichment provides higher confidence for information in the CVE.",
            score: finding.cisaDateAdded ? 5 : 0
        })
    },
    invalidFixVersion: {
        weight: -1,
        evaluate: finding => ({
            result: !isValidSemver(getSemVerWithoutOperator(finding.fixVersion)),
            rationale: "Without a valid Fix Version and known patch, the Advisory may not have been verified because it has no known fix.",
            score: !isValidSemver(getSemVerWithoutOperator(finding.fixVersion)) ? -1 : 0
        })
    },
    maliciousPackage: {
        weight: 10,
        evaluate: finding => ({
            result: finding.malicious === 1,
            rationale: "All known malicious packages should be immediately assessed.",
            score: finding.malicious === 1 ? 10 : 0
        })
    },
    goodReferences: {
        weight: 2,
        evaluate: finding => ({
            result: finding.references?.length >= 5,
            rationale: "There are a good amount of references which indicates wide spread reporting and review.",
            score: (finding.references?.length || 0) >= 5 ? 2 : 0
        })
    },
    limitedReferences: {
        weight: -1,
        evaluate: finding => ({
            result: finding.references?.length < 5,
            rationale: "There are too few references which may indicate a relatively low quality report, in terms of coverage of advisories and evidence.",
            score: (finding.references?.length || 0) < 5 ? -1 : 0
        })
    },
    exploitsAvailable: {
        weight: 2,
        evaluate: finding => ({
            result: (finding.exploits?.length || 0) >= 1,
            rationale: "While exploits are often mere detection only PoC, rather than proof of real exploitation, having even a detection is a strong indication of true positive.",
            score: (finding.exploits?.length || 0) >= 1 ? 2 : 0
        })
    }
}

export const evaluateAdvisoryConfidence = advisory => {
    // Calculate maximum possible score
    const max = Object.values(confidenceRules)
        .filter(rule => rule.weight > 0)
        .reduce((sum, rule) => sum + rule.weight < 0 ? 0 : rule.weight, 0)

    const min = Object.values(confidenceRules)
        .filter(rule => rule.weight < 0)
        .reduce((sum, rule) => sum - rule.weight < 0 ? Math.abs(rule.weight) : 0, 0)

    // Evaluate each rule
    const evaluations = Object.entries(confidenceRules).map(([key, rule]) => {
        advisory.references = advisory?.referencesJSON ? JSON.parse(advisory.referencesJSON) : []
        advisory.exploits = advisory?.exploitsJSON ? JSON.parse(advisory.exploitsJSON) : []
        advisory.knownExploits = advisory?.knownExploitsJSON ? JSON.parse(advisory.knownExploitsJSON) : []
        const evaluation = rule.evaluate(advisory)
        return {
            rule: key,
            ...evaluation
        };
    });

    // Calculate total score
    const result = evaluations.reduce((sum, res) => sum + res.score, 0)

    // Calculate confidence level dynamically
    const offset = min < 0 ? Math.abs(min) : 0
    const normalizedScore = result + offset
    const normalizedMax = max + offset
    const percentage = parseFloat(((normalizedScore / normalizedMax) * 100).toFixed(2))

    let confidenceLevel;
    if (percentage <= 33) {
        confidenceLevel = "Low"
    } else if (percentage < 80) {
        confidenceLevel = "High"
    } else {
        confidenceLevel = "Sure"
    }

    return {
        percentage,
        confidenceLevel,
        result,
        max,
        min,
        evaluations: evaluations.map(res => ({
            rule: res.rule,
            result: res.result,
            rationale: res.rationale,
            score: res.score
        }))
    };
}
