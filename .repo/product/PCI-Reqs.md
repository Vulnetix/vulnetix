Automatable
Software inventory



Requirement 2.2.7 All non-console administrative access is encrypted using strong cryptography.
Requirement 3.3.2 SAD that is stored electronically prior to completion of authorization is encrypted using strong cryptography.
Requirement 3.3.3 Any storage of sensitive
authentication data is Encrypted using strong cryptography.
Requirement 5.3.2.1 If periodic malware scans
Requirement 5.3.4 Audit logs for the anti-malware solution(s) are enabled and retained in accordance with Requirement 10.5.1.
Requirement 6.2.3.1 If manual code reviews are performed for bespoke and custom software prior to release to production, code changes are:
• Reviewed by individuals other than the originating code author, and who are knowledgeable about code-review techniques and secure coding practices.
• Reviewed and approved by management prior to release.
Requirement 6.3.2 An inventory of bespoke and custom software, and third-party software components incorporated into bespoke and custom software is maintained to facilitate vulnerability and patch management.
SSF 2.1
SSF 3.2
SSF 3.3
SSF 4.1
SSF 6.1
SSF 7.1

Interesting for automation

Requirement 2.2.2
Requirement 3.4.1
Requirement 3.7.4
Requirement 3.7.7
Requirement 4.2.1
Requirement 5.3.5
Requirement 6.2.1
Requirement 6.2.4


Admin
- Startmate KYC/AML
- Set up bank accounts
Business Development
- Advisors
- Marketing strategy
Comms / Marketing
- communications plan (geoff)
- marketing list
- waiting list
- Design review for one-pager
- SEO? no


# PCI Software Supply Chain Security Requirements Matrix

| PCI Req ID | Description | Format |
|------------|-------------|---------------------|
| 6.3.2 | Maintain inventory of bespoke and custom software components | SPDX, CycloneDX |
| 6.3.2.1 | Document origin and dependencies of all components | SPDX relationships, CycloneDX components |
| 6.3.2.2 | Assess and prioritize risks of components | VEX state & justification, SARIF results - SSVC, Custom CVSS (not prioritising with CVSS-B) |
| 6.3.2.3 | Track vulnerabilities in components | Scan schedule, Scan results |
| SSF 2.1 | Monitor external security requirements | VDR, CVE. OSV, etc |
| SSF 3.2 | Identify threats in components | EPSS, Exploit Maturity |
| SSF 3.3 | Implement controls for components | VEX |
| SSF 4.1 | Test components for vulnerabilities | DAST |
| SSF 6.1 | Maintain integrity of code & components | Git commit signing, SBOM signatures |
| SSF 7.1 | Protect sensitive data in components | SARIF secrets scan |

# Research on requirements

## 1. Software Component Documentation

| Requirement Area | Implementation Details | Required Formats | Additional Context |
|-----------------|------------------------|------------------|-------------------|
| Identity & Authentication | - Developer access credentials\n- Code signing keys\n- Build system authentication | - Key management documentation\n- Access control matrices\n- Authentication logs | - Must document all privileged access\n- Required audit trail of code signers |
| Change Management | - Version control records\n- Change approvals\n- Release notes | - Commit history\n- Pull request documentation\n- Release documentation | - Must track all code changes\n- Required approver documentation |
| Build Environment | - Build configurations\n- Compiler settings\n- Environment variables | - Build manifests\n- Environment configuration files\n- CI/CD pipeline definitions | - Must document build reproducibility\n- Required security settings |
| Testing Documentation | - Security test cases\n- Test coverage reports\n- Penetration test results | - Test results in machine-readable format\n- Coverage reports\n- Security scan outputs | - Must include test methodologies\n- Required validation procedures |
| Deployment Documentation | - Deployment procedures\n- Configuration baselines\n- Rollback procedures | - Infrastructure as Code (IaC)\n- Configuration management files\n- Deployment playbooks | - Must document all environments\n- Required security controls |
| Third-Party Assessment | - Vendor assessments\n- Service provider reviews\n- Compliance certifications | - Vendor questionnaires\n- Audit reports\n- Compliance certificates | - Must include vendor risk ratings\n- Required periodic reviews |
| Incident Response | - Security incident procedures\n- Contact information\n- Escalation paths | - Incident response plans\n- Communication templates\n- Severity definitions | - Must define response timelines\n- Required notification procedures |
| Software Updates | - Update mechanisms\n- Patch management\n- Distribution methods | - Update manifests\n- Distribution signatures\n- Patch documentation | - Must document update integrity\n- Required security advisories |
| Security Architecture | - Security controls\n- Trust boundaries\n- Data flow diagrams | - Architecture diagrams\n- Control matrices\n- Data flow documentation | - Must document security assumptions\n- Required threat modeling |
| Cryptographic Implementation | - Crypto modules used\n- Key management\n- Algorithm configurations | - Module specifications\n- Key lifecycle docs\n- Algorithm parameters | - Must document crypto boundaries\n- Required key protection measures |

## 2. Security Controls

| Control Category | Technical Requirements | Verification Method | Documentation Format |
|-----------------|------------------------|-------------------|-------------------|
| Secret Detection | - Pre-commit scanning\n- Runtime detection\n- Key rotation monitoring\n- Vault integration | SARIF, Custom Reports | - CWE-798 (Hard-coded Credentials)\n- CWE-321 (Hard-coded Crypto Key)\n- CWE-259 (Hard-coded Password) | - Continuous scanning\n- Rotation verification\n- Access audit logs |
| Container Security | - Base image validation\n- Layer analysis\n- Runtime protection\n- Privilege controls | CycloneDX Container | - CWE-250 (Execution with Unnecessary Privileges)\n- CWE-269 (Improper Privilege Management)\n- CWE-266 (Incorrect Privilege Assignment) | - Image verification\n- Runtime monitoring\n- Access controls |
| Package Management | - Dependency verification\n- Integrity checks\n- Version pinning\n- Update automation | SPDX, CycloneDX | - CWE-1104 (Unmaintained Components)\n- CWE-441 (Unintended Proxy/Intermediary)\n- CWE-494 (Download Without Integrity Check) | - Source verification\n- Integrity validation\n- Update tracking |
| Access Controls | - Role-based access\n- Least privilege\n- Session management\n- MFA implementation | Custom JSON, SAML | - CWE-284 (Improper Access Control)\n- CWE-287 (Improper Authentication)\n- CWE-613 (Insufficient Session Expiration) | - Permission testing\n- Access reviews\n- Session validation |
| Cryptography | - Algorithm selection\n- Key management\n- Secure RNG\n- Protocol compliance | NIST Standards | - CWE-326 (Inadequate Encryption Strength)\n- CWE-330 (Insufficient Random Values)\n- CWE-320 (Key Management Errors) | - Algorithm validation\n- Key rotation\n- RNG testing |
| Network Security | - TLS configuration\n- Firewall rules\n- Segmentation\n- Protocol security | Custom, SARIF | - CWE-319 (Cleartext Transmission)\n- CWE-300 (Channel Accessible by Non-Endpoint)\n- CWE-306 (Missing Authentication) | - Config validation\n- Traffic analysis\n- Protocol testing |
| Build Security | - Pipeline hardening\n- Artifact signing\n- Build isolation\n- Dependency scanning | SLSA Framework | - CWE-1021 (Improper Restriction)\n- CWE-912 (Hidden Functionality)\n- CWE-1188 (Insecure Default Init) | - Pipeline testing\n- Build verification\n- Artifact validation |
| Runtime Protection | - Memory safety\n- Input validation\n- Output encoding\n- Error handling | SARIF, Custom | - CWE-120 (Buffer Overflow)\n- CWE-89 (SQL Injection)\n- CWE-79 (XSS) | - Runtime testing\n- Input testing\n- Error validation |
| Configuration Management | - Secure defaults\n- Hardening\n- Change control\n- Audit logging | OSCAL, Custom | - CWE-16 (Configuration)\n- CWE-732 (Incorrect Permission)\n- CWE-756 (Missing Custom Error Page) | - Config validation\n- Change tracking\n- Audit review |
| API Security | - Input validation\n- Rate limiting\n- Authentication\n- CORS policy | OpenAPI, SARIF | - CWE-346 (Origin Validation Error)\n- CWE-307 (Brute Force)\n- CWE-601 (Open Redirect) | - API testing\n- Rate monitoring\n- Auth validation |
| Data Protection | - Encryption at rest\n- Secure transport\n- Data classification\n- Retention controls | Custom JSON | - CWE-311 (Missing Encryption)\n- CWE-319 (Cleartext Transmission)\n- CWE-922 (Insecure Storage) | - Encryption testing\n- Transport validation\n- Storage review |
| Vulnerability Management | - Scanning\n- Patching\n- Risk assessment\n- Mitigation tracking | VEX, CSAF | - CWE-937 (OWASP Top Ten)\n- CWE-1035 (Customer Security)\n- CWE-693 (Protection Mechanism) | - Scan validation\n- Patch verification\n- Risk review |

## 3. Assessments

| Assessment Type | Required Coverage | Output Format | Validation Requirements |
|----------------|-------------------|---------------|----------------------|
| Software Bill of Materials | - Complete inventory of components\n- Version information\n- Dependencies | SPDX 2.3, CycloneDX 1.4 | - CWE-937 (OWASP Top Ten)\n- CWE-1035 (Customer Security)\n- CWE-1104 (Incomplete Requirements) | Must include transitive dependencies |
| Vulnerability Documentation | - Known CVEs\n- Weakness mapping\n- OSV data | SARIF, VEX | - CWE-295 (Certificate Validation)\n- CWE-693 (Protection Mechanism Failure)\n- CWE-1026 (Weaknesses Without Effects) | Requires analysis state and justification |
| Risk Scoring | - CVSS Base Score\n- SVSS\n- EPSS | CVSS v3.1/4.0, KEV | - CWE-693 (Protection Mechanism Failure)\n- CWE-1053 (Missing Documentation)\n- CWE-1008 (Architectural Concepts) | Multiple scoring systems required |
| Identity & Authentication | - Access credentials\n- Code signing\n- Build auth | Access matrices, Auth logs | - CWE-287 (Authentication Issues)\n- CWE-284 (Access Control)\n- CWE-522 (Insufficiently Protected Credentials) | Must track privileged access |
| Change Management | - Version control\n- Approvals\n- Release notes | Commit logs, Release docs | - CWE-291 (Reliance on IP Address)\n- CWE-416 (Use After Free)\n- CWE-502 (Deserialization of Untrusted Data) | Track all code changes |
| Build Environment | - Build configs\n- Compiler settings\n- ENV vars | Build manifests, CI/CD configs | - CWE-1104 (Use of Unmaintained Third Party Components)\n- CWE-1188 (Insecure Default Initialization)\n- CWE-1195 (Manufacturing and Life Cycle) | Document build reproducibility |
| Testing Documentation | - Security tests\n- Coverage\n- Pen tests | Test results, Coverage reports | - CWE-1006 (Bad Test Coverage)\n- CWE-561 (Dead Code)\n- CWE-1120 (Excessive Code Complexity) | Include test methodologies |
| Deployment Documentation | - Deploy procedures\n- Config baselines\n- Rollback | IaC, Config management | - CWE-1176 (Uncontrolled Format String)\n- CWE-1275 (Sensitive Cookie with Improper SameSite Attribute)\n- CWE-759 (Use of a One-Way Hash without a Salt) | Document all environments |
| Third-Party Assessment | - Vendor assessments\n- Service reviews\n- Certifications | Questionnaires, Audit reports | - CWE-1059 (Insufficient Technical Documentation)\n- CWE-1148 (SEI CERT Oracle Secure Coding Standard)\n- CWE-937 (OWASP Top Ten) | Include vendor risk ratings |
| Incident Response | - Security procedures\n- Contacts\n- Escalation | IR plans, Communication templates | - CWE-778 (Insufficient Logging)\n- CWE-779 (Logging of Excessive Data)\n- CWE-223 (Omission of Security-relevant Information) | Define response timelines |
| Software Updates | - Update mechanisms\n- Patch management\n- Distribution | Update manifests, Signatures | - CWE-1277 (Firmware Not Updateable)\n- CWE-912 (Hidden Functionality)\n- CWE-494 (Download of Code Without Integrity Check) | Document update integrity |
| Security Architecture | - Security controls\n- Trust boundaries\n- Data flows | Architecture diagrams, Control matrices | - CWE-1008 (Architectural Concepts)\n- CWE-1173 (Improper Use of Validation Framework)\n- CWE-435 (Improper Interaction Between Multiple Correctly-Behaving Entities) | Document security assumptions |
| Cryptographic Implementation | - Crypto modules\n- Key management\n- Algorithms | Module specs, Key lifecycle | - CWE-310 (Cryptographic Issues)\n- CWE-320 (Key Management Errors)\n- CWE-326 (Inadequate Encryption Strength) | Document crypto boundaries |

## 4. Continuous Monitoring

| Monitoring Area | Technical Controls | Alert Criteria | Documentation Requirements |
|----------------|-------------------|----------------|---------------------------|
| Component Monitoring | - Version tracking\n- Dependency updates\n- Deprecation alerts\n- License changes | SPDX Diff, CycloneDX | - CWE-1104 (Unmaintained Components)\n- CWE-1035 (Customer Security)\n- CWE-937 (OWASP Top Ten) | - Real-time version tracking\n- Update validation\n- License compliance |
| Vulnerability Scanning | - CVE monitoring\n- Zero-day tracking\n- Exploit detection\n- Risk assessment | VEX, OVAL | - CWE-693 (Protection Mechanism)\n- CWE-209 (Information Exposure)\n- CWE-200 (Information Disclosure) | - Continuous scanning\n- Alert verification\n- Risk validation |
| Secret Management | - Key rotation\n- Certificate expiry\n- Credential usage\n- Access patterns | SARIF, Custom | - CWE-522 (Insufficient Protection)\n- CWE-321 (Hard-coded Key)\n- CWE-798 (Hard-coded Credentials) | - Rotation compliance\n- Usage monitoring\n- Access auditing |
| Runtime Analysis | - Performance metrics\n- Resource usage\n- Error rates\n- API behavior | Custom JSON | - CWE-400 (Resource Exhaustion)\n- CWE-664 (Control Flow)\n- CWE-674 (Uncontrolled Recursion) | - Performance baselines\n- Resource thresholds\n- Error tracking |
| Access Control | - Authentication events\n- Authorization changes\n- Role modifications\n- Session tracking | CADF, Custom | - CWE-284 (Access Control)\n- CWE-287 (Authentication)\n- CWE-306 (Missing Authentication) | - Auth monitoring\n- Role validation\n- Session checks |
| Network Security | - Traffic patterns\n- Protocol usage\n- Connection tracking\n- Firewall rules | IPFIX, Netflow | - CWE-311 (Missing Encryption)\n- CWE-319 (Cleartext)\n- CWE-611 (XXE) | - Traffic analysis\n- Protocol validation\n- Rule verification |
| Build Pipeline | - Build integrity\n- Artifact signing\n- Deploy status\n- Test coverage | SLSA, Custom | - CWE-915 (Modified Build)\n- CWE-494 (Download Integrity)\n- CWE-1021 (Restriction) | - Build verification\n- Sign validation\n- Coverage tracking |
| Configuration Changes | - Setting modifications\n- Environment vars\n- Policy updates\n- Compliance status | OSCAL, Custom | - CWE-16 (Configuration)\n- CWE-732 (Permissions)\n- CWE-669 (Resource Exposure) | - Change tracking\n- Policy compliance\n- Setting validation |
| Data Protection | - Encryption status\n- Data movement\n- Access patterns\n- Retention compliance | Custom JSON | - CWE-311 (Missing Encryption)\n- CWE-922 (Storage)\n- CWE-359 (Privacy Violation) | - Encryption verification\n- Access monitoring\n- Retention checks |
| Container Security | - Image updates\n- Runtime behavior\n- Resource usage\n- Privilege changes | CycloneDX Container | - CWE-250 (Privileges)\n- CWE-269 (Management)\n- CWE-266 (Assignment) | - Image validation\n- Runtime monitoring\n- Resource tracking |
| API Security | - Usage patterns\n- Rate limits\n- Error rates\n- Response times | OpenAPI, Custom | - CWE-918 (SSRF)\n- CWE-601 (Redirect)\n- CWE-346 (Origin Validation) | - Usage monitoring\n- Rate tracking\n- Error analysis |
| Incident Detection | - Security events\n- Anomaly detection\n- Alert correlation\n- Response tracking | STIX, TAXII | - CWE-778 (Logging)\n- CWE-223 (Omission)\n- CWE-779 (Excessive Data) | - Event correlation\n- Alert verification\n- Response validation |

## Interesting Requirements

| Requirement Area | Technical Requirements | Implementation Method | Common CWEs | Validation Criteria |
|-----------------|------------------------|---------------------|-------------|-------------------|
| Compliance Management | - Policy enforcement\n- Standard alignment\n- Audit controls\n- Evidence collection | OSCAL, Custom | - CWE-1059 (Documentation)\n- CWE-1148 (Coding Standards)\n- CWE-710 (Coding Standards) | - Policy validation\n- Audit tracking\n- Evidence review |
| Training Requirements | - Security awareness\n- Code review skills\n- Secure coding\n- Tool proficiency | Custom LMS | - CWE-1006 (Bad Testing)\n- CWE-637 (Unnecessary Complexity)\n- CWE-1120 (Code Complexity) | - Skill assessment\n- Knowledge testing\n- Practice validation |
| Incident Response | - Detection systems\n- Response procedures\n- Recovery plans\n- Communication protocols | STIX, TAXII | - CWE-778 (Insufficient Logging)\n- CWE-223 (Omission)\n- CWE-779 (Excessive Data) | - Response testing\n- Plan validation\n- Communication checks |
| Risk Management | - Risk assessment\n- Threat modeling\n- Impact analysis\n- Mitigation planning | FAIR, Custom | - CWE-693 (Protection)\n- CWE-1053 (Missing Info)\n- CWE-435 (Interaction) | - Risk validation\n- Threat verification\n- Impact assessment |
| Change Control | - Change tracking\n- Approval workflow\n- Impact analysis\n- Rollback procedures | Custom CMDB | - CWE-439 (Expected Behavior)\n- CWE-440 (Flow Issues)\n- CWE-915 (Modification) | - Change validation\n- Approval tracking\n- Impact testing |
| Asset Management | - Inventory tracking\n- Classification\n- Lifecycle mgmt\n- Disposal control | Custom CMDB | - CWE-1059 (Documentation)\n- CWE-499 (Sensitive Data)\n- CWE-200 (Disclosure) | - Asset validation\n- Class verification\n- Lifecycle checks |
| Business Continuity | - Recovery plans\n- Backup systems\n- Failover testing\n- Service levels | Custom BCP | - CWE-636 (Function Race)\n- CWE-611 (Resource Access)\n- CWE-662 (Resource Pool) | - Recovery testing\n- Backup validation\n- SLA monitoring |
| Vendor Management | - Assessment process\n- Performance monitoring\n- Risk tracking\n- Contract compliance | Custom VMS | - CWE-1059 (Documentation)\n- CWE-1136 (Security Policy)\n- CWE-937 (OWASP Top Ten) | - Assessment review\n- Performance tracking\n- Risk monitoring |
| Quality Assurance | - Testing standards\n- Code review\n- Performance metrics\n- Security gates | Custom QMS | - CWE-1006 (Bad Testing)\n- CWE-398 (Code Quality)\n- CWE-1120 (Complexity) | - Standard review\n- Metric validation\n- Gate verification |
| Program Management | - Project tracking\n- Resource allocation\n- Timeline mgmt\n- Status reporting | Custom PPM | - CWE-1053 (Missing Info)\n- CWE-1059 (Documentation)\n- CWE-1110 (Missing Design) | - Project validation\n- Resource tracking\n- Timeline checks |
