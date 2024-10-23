import { AuthResult, EPSS, MitreCVE, OSV, Server } from "@/utils";
import { CVSS30, CVSS31, CVSS40 } from '@pandatix/js-cvss';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@prisma/client';

// Helper function to process array fields
const processArrayField = (array, key) => {
    if (!Array.isArray(array)) return ''
    return Array.from(new Set(array.map(item => item[key]?.trim()).filter(Boolean))).join(',')
}

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
        const verificationResult = await (new Server(request, prisma)).authenticate()
        if (!verificationResult.isValid) {
            return Response.json({ ok: false, result: verificationResult.message })
        }
        const { uuid } = params
        const originalFinding = await prisma.Finding.findUnique({
            where: {
                uuid,
                AND: { orgId: verificationResult.session.orgId }
            },
            omit: {
                memberEmail: true,
            },
            include: {
                triage: true,
                spdx: {
                    include: {
                        repo: true
                    }
                },
                cdx: {
                    include: {
                        repo: true
                    }
                }
            }
        })
        const finding = {
            ...originalFinding,
            cwes: JSON.parse(originalFinding.cwes ?? '[]'),
            aliases: JSON.parse(originalFinding.aliases ?? '[]'),
            referencesJSON: JSON.parse(originalFinding.referencesJSON ?? '[]'),
        }

        const osv = new OSV()
        const vuln = await osv.query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, finding.detectionTitle)
        finding.modifiedAt = (new Date(vuln.modified)).getTime()
        finding.publishedAt = (new Date(vuln.published)).getTime()
        finding.databaseReviewed = vuln?.database_specific?.github_reviewed ? 1 : 0
        finding.cve = vuln?.aliases?.filter(a => a.startsWith('CVE-')).pop()
        finding.aliases = JSON.stringify(vuln?.aliases?.filter(a => a !== finding.cve) || [])
        finding.cwes = JSON.stringify(vuln?.database_specific?.cwe_ids || [])
        finding.packageEcosystem = vuln.affected.map(affected => affected.package.ecosystem).pop()
        finding.sourceCodeUrl = vuln.affected.map(affected => affected.database_specific.source).pop()
        finding.fixVersion = vuln.affected.map(affected => affected.ranges.pop()?.events.pop()?.fixed).pop()
        finding.vulnerableVersionRange = vuln.affected.map(affected => affected.database_specific.last_known_affected_version_range).pop()
        finding.fixAutomatable = !!finding.vulnerableVersionRange && !!finding.fixVersion ? 1 : 0
        finding.malicious = vuln.id.startsWith("MAL-") ? 1 : 0
        finding.referencesJSON = JSON.stringify(vuln.references.map(reference => reference.url))
        if (finding.cve) {
            const mitre = new MitreCVE()
            const cvelistv5 = await mitre.query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, finding.cve)
            const {
                cveMetadata,
                containers: { cna, adp }
            } = cvelistv5

            if (cna?.timeline) {
                finding.timelineJSON = JSON.stringify(cna.timeline.filter(i => !!i).map(i => convertIsoDatesToTimestamps(i)))
            }

            // Extract CISA date
            const cisaAdp = adp?.find(container => container.providerMetadata.shortName === 'CISA-ADP');
            if (cisaAdp?.providerMetadata?.dateUpdated) {
                finding.cisaDateAdded = new Date(cisaAdp.providerMetadata.dateUpdated).getTime()
            }

            // Process affected products
            const affectedProducts = cna.affected || []
            const vendors = processArrayField(affectedProducts, 'vendor')
            const products = processArrayField(affectedProducts, 'product')

            if (cveMetadata?.datePublished) {
                finding.publishedAt = new Date(cveMetadata.datePublished).getTime()
            }
            if (cveMetadata?.dateReserved) {
                finding.createdAt = new Date(cveMetadata.dateReserved).getTime()
            }
            if (cveMetadata?.dateUpdated) {
                finding.modifiedAt = new Date(cveMetadata.dateUpdated).getTime()
            }
            finding.vendor = vendors || ''
            finding.product = products || ''
        }
        const info = await prisma.Finding.update({
            where: { uuid },
            data: {
                createdAt: finding.createdAt,
                modifiedAt: finding.modifiedAt,
                publishedAt: finding.publishedAt,
                databaseReviewed: finding.databaseReviewed,
                cisaDateAdded: finding.cisaDateAdded,
                cve: finding.cve,
                aliases: finding.aliases,
                cwes: finding.cwes,
                packageEcosystem: finding.packageEcosystem,
                sourceCodeUrl: finding.sourceCodeUrl,
                fixVersion: finding.fixVersion,
                vendor: finding.vendor,
                product: finding.product,
                vulnerableVersionRange: finding.vulnerableVersionRange,
                fixAutomatable: finding.fixAutomatable,
                malicious: finding.malicious,
                referencesJSON: finding.referencesJSON,
                timelineJSON: finding.timelineJSON,
            }
        })
        console.log(`Update ${finding.detectionTitle}`, info)
        let scores
        if (finding.cve) {
            const epss = new EPSS()
            scores = await epss.query(prisma, verificationResult.session.orgId, verificationResult.session.memberEmail, finding.cve)
        }
        let epssScore, epssPercentile;
        if (scores?.epss) {
            epssScore = parseFloat(scores.epss)
            epssPercentile = parseFloat(scores.percentile)
        }
        const cvss4 = vuln?.severity?.filter(i => i.score.startsWith('CVSS:4/'))?.pop()
        const cvss31 = vuln?.severity?.filter(i => i.score.startsWith('CVSS:3.1/'))?.pop()
        const cvss3 = vuln?.severity?.filter(i => i.score.startsWith('CVSS:3/'))?.pop()
        const cvssVector = !!cvss4 ? new CVSS40(cvss4.score) : !!cvss31 ? new CVSS31(cvss31.score) : cvss3 ? new CVSS30(cvss3.score) : null
        // Decision
        // Methodology
        // Exploitation
        // TechnicalImpact
        // Automatable
        // MissionWellbeingImpact        

        const { searchParams } = new URL(request.url)
        const seen = parseInt(searchParams.get('seen'), 10) || 0
        let { analysisState = 'in_triage', triageAutomated = 0, triagedAt = null, seenAt = null } = finding?.triage || {}
        if (
            (cvssVector && (
                ['E:U', 'E:P', 'E:F', 'E:H'].some(substring => cvss3?.score?.includes(substring)) ||
                ['E:A', 'E:P', 'E:U'].some(substring => cvss4?.score?.includes(substring))
            )) || epssPercentile > 0.2
        ) {
            analysisState = 'exploitable'
            triageAutomated = 1
            if (!triagedAt) {
                triagedAt = new Date().getTime()
            }
        }
        if (seen === 1) {
            seenAt = new Date().getTime()
        }
        let vexExist = true
        if (!finding.triage.some(t => t.analysisState === analysisState)) {
            vexExist = false
            finding.triage.push({
                analysisState,
                findingUuid: uuid,
                createdAt: new Date().getTime(),
                lastObserved: new Date().getTime(),
            })
        }
        let vexData = finding.triage.filter(t => t.analysisState === analysisState).pop()
        vexData.triageAutomated = triageAutomated
        vexData.triagedAt = triagedAt
        vexData.cvssVector = !!cvss4 ? cvss4.score : !!cvss31 ? cvss31.score : cvss3 ? cvss3.score : null
        vexData.cvssScore = !!cvss4 ? cvssVector.Score().toString() : !!cvss31 ? cvssVector.BaseScore().toString() : cvss3 ? cvssVector.BaseScore().toString() : null
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
        } else {
            vexData = await prisma.Triage.create({ data: vexData })
        }
        finding.triage = finding.triage.filter(f => f.uuid != vexData.uuid)
        finding.triage.push(vexData)

        // expand JSON fields
        if (finding.cwes) {
            finding.cwes = JSON.parse(finding.cwes)
        }
        if (finding.aliases) {
            finding.aliases = JSON.parse(finding.aliases)
        }
        if (finding.exploitsJSON) {
            finding.exploits = JSON.parse(finding.exploitsJSON)
            delete finding.exploitsJSON
        }
        if (finding.knownExploitsJSON) {
            finding.knownExploits = JSON.parse(finding.knownExploitsJSON)
            delete finding.knownExploitsJSON
        }
        if (finding.referencesJSON) {
            finding.references = JSON.parse(finding.referencesJSON)
            delete finding.referencesJSON
        }
        if (finding.timelineJSON) {
            finding.timeline = JSON.parse(finding.timelineJSON)
            delete finding.timelineJSON
        }
        return Response.json({ ok: true, finding })
    } catch (err) {
        console.error(err)
        return Response.json({ ok: false, error: { message: err }, result: AuthResult.REVOKED })
    }
}
