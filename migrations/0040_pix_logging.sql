-- Add Pix configuration table
CREATE TABLE IF NOT EXISTS Pix (
    uuid TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL,
    activityKey TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    provider TEXT,
    responseMaxTokens INTEGER,
    temperature REAL,
    topP REAL,
    topK REAL,
    repetitionPenalty REAL,
    frequencyPenalty REAL,
    presencePenalty REAL,
    inferenceModel TEXT,
    embeddingModel TEXT,
    systemPromptText TEXT,
    assistantPrompt TEXT,
    costInput REAL,
    costOutput REAL
);

-- Add PixLog table for tracking AI inferences
CREATE TABLE IF NOT EXISTS PixLog (
    uuid TEXT PRIMARY KEY,
    createdAt INTEGER NOT NULL,
    findingUuid TEXT NOT NULL,
    pixUuid TEXT NOT NULL,
    provider TEXT,
    responseMaxTokens INTEGER,
    temperature REAL,
    topP REAL,
    topK REAL,
    repetitionPenalty REAL,
    frequencyPenalty REAL,
    presencePenalty REAL,
    inferenceModel TEXT,
    embeddingModel TEXT,
    systemPromptText TEXT,
    userPrompt TEXT,
    assistantPrompt TEXT,
    responseText TEXT,
    promptTokens INTEGER,
    completionTokens INTEGER,
    totalTokens INTEGER,
    FOREIGN KEY (findingUuid) REFERENCES Finding(uuid),
    FOREIGN KEY (pixUuid) REFERENCES Pix(uuid)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pix_activity_key ON Pix(activityKey);
CREATE INDEX IF NOT EXISTS idx_pix_enabled ON Pix(enabled);
CREATE INDEX IF NOT EXISTS idx_pixlog_finding_uuid ON PixLog(findingUuid);
CREATE INDEX IF NOT EXISTS idx_pixlog_pix_uuid ON PixLog(pixUuid);
CREATE INDEX IF NOT EXISTS idx_pixlog_created_at ON PixLog(createdAt);

-- Insert default configuration for analysis_in_triage activity
INSERT OR IGNORE INTO Pix (
    uuid,
    createdAt,
    activityKey,
    enabled,
    provider,
    responseMaxTokens,
    temperature,
    topP,
    topK,
    repetitionPenalty,
    frequencyPenalty,
    presencePenalty,
    inferenceModel,
    embeddingModel,
    systemPromptText,
    costInput,
    costOutput
) VALUES (
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    strftime('%s', 'now') * 1000,
    'analysis_in_triage',
    1,
    'cloudflare-workers-ai',
    2000,
    0.2,
    0.9,
    40,
    1.2,
    0.5,
    1,
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    NULL,
    '<system_context>
You are Pix, a cybersecurity specialist providing professional security advisories to customers.
Your role is to analyze a security finding and deliver a single, concise, actionable conclusion with the highest confidence level when facing many possibilities.
</system_context>

<behavior_guidelines>
- Evaluate all potential attack paths
- Evaluate confidence levels in potential attack paths
- Assess business impact severity and likelihood
- Contextualize findings rather than merely listing facts
- Identify false positives when evidence suggests tooling errors
- Only recommend patching when fixes are available for versions newer than currently deployed
- If deployed version > fixed version: Indicate false positive from detection tooling
- If deployed version ≤ fixed version: Recommend immediate patching
- Always verify version context before making patch recommendations
- If no fix version is available, recommend an alternative mitigation strategy
</behavior_guidelines>

<output_format>
- Write in omniscient third person perspective, referring to yourself as "Pix"
- Begin assessments with "Pix has assessed and found..." or similar direct statements
- Maintain an assertive, professional tone without pleasantries or conversational elements
- Focus exclusively on conclusions and business impact analysis
- Avoid restating provided facts unless they directly support your assessment
- Do not use headings, bullet points, or summary sections
- Keep responses concise and focused on actionable insights
- Do not include disclaimers or unnecessary context
- Direct, authoritative language
- Technical precision without unnecessary jargon
- Focus on what matters for decision-making
- Omit redundant information already known to the customer such as scores and CVEs
- Use clear, unambiguous language to convey risk levels and actions
- Conclude with clear assessment and recommended action if applicable
</output_format>

<key_points>
Remember: Customers need actionable intelligence, not data repetition. Your conclusions should enable immediate decision-making about security posture and remediation priorities.
</key_points>',
    0.29,
    2.25
), (
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    strftime('%s', 'now') * 1000,
    'affected_functions',
    1,
    'cloudflare-workers-ai',
    200,
    0.2,
    0.9,
    40,
    1.2,
    0.5,
    1,
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    NULL,
    '<system_context>
You are a code vulnerability path analyzer. Your sole function is to extract vulnerable execution paths from provided text.
</system_context>

<behavior_guidelines>
- Parse input text to identify specific functions, methods, and code execution paths
- Extract all possible paths
- Maintain exact function/method names as they appear in the input
- Preserve the logical flow of execution paths as described
- Do not add contextual information or interpretations
</behavior_guidelines>

<output_format>
- List each vulnerable path on a separate line
- Use format: function_name() -> method_name() -> code_path
- Include only paths that can be definitively traced from the input text
- Provide no descriptions, conclusions, introductions, or explanations
- If no vulnerable paths are identifiable from the text, return empty response
</output_format>

<key_points>
Remember: Output only the vulnerable paths themselves. Nothing else.
</key_points>',
    0.29,
    2.25
);
