package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseTags(t *testing.T) {
	tests := []struct {
		name    string
		tagsStr string
		expected []string
	}{
		{name: "Empty string", tagsStr: "", expected: nil},
		{name: "Single tag", tagsStr: "tag1", expected: []string{"tag1"}},
		{name: "Multiple tags comma separated", tagsStr: "tag1, tag2,tag3", expected: []string{"tag1", "tag2", "tag3"}},
		{name: "Tags with spaces", tagsStr: "  tag1  ,  tag2  ", expected: []string{"tag1", "tag2"}},
		{name: "Tags with YAML list markers", tagsStr: "[tag1, tag2]", expected: []string{"tag1", "tag2"}},
		{name: "Tags with quotes", tagsStr: "'tag1', \"tag2\"", expected: []string{"tag1", "tag2"}},
		{name: "Mixed case tags", tagsStr: "TagA, tagB", expected: []string{"TagA", "tagB"}},
		{name: "Tags with special characters", tagsStr: "tag-1, tag_2", expected: []string{"tag-1", "tag_2"}},
		{name: "Only spaces", tagsStr: "   ", expected: nil},
		{name: "Empty tags in between", tagsStr: "tag1,,tag2", expected: []string{"tag1", "tag2"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := ParseTags(tt.tagsStr)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestGenerateArtifactNamingConvention(t *testing.T) {
	tests := []struct {
		name           string
		config         *VulnetixConfig
		toolCategory   string
		baseArtifactName string
		expected       string
	}{
		{
			name: "Standard case",
			config: &VulnetixConfig{
				GitHub: GitHubContext{
					Repository: "octocat/Spoon-Knife",
					RunID:      "123456789",
				},
			},
			toolCategory:   "sast",
			baseArtifactName: "results.sarif",
			expected:       "vulnetix-octocat-Spoon-Knife-123456789-sast-results.sarif",
		},
		{
			name: "Repository with hyphens",
			config: &VulnetixConfig{
				GitHub: GitHubContext{
					Repository: "my-org/my-repo",
					RunID:      "98765",
				},
			},
			toolCategory:   "sca",
			baseArtifactName: "sbom.json",
			expected:       "vulnetix-my-org-my-repo-98765-sca-sbom.json",
		},
		{
			name: "Empty base artifact name",
			config: &VulnetixConfig{
				GitHub: GitHubContext{
					Repository: "test/repo",
					RunID:      "111",
				},
			},
			toolCategory:   "secret",
			baseArtifactName: "",
			expected:       "vulnetix-test-repo-111-secret-",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := tt.config.GenerateArtifactNamingConvention(tt.toolCategory, tt.baseArtifactName)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestGetWorkflowRunContext(t *testing.T) {
	config := &VulnetixConfig{
		GitHub: GitHubContext{
			RunID:       "run-123",
			RunNumber:   "1",
			RunAttempt:  "1",
			Repository:  "test/repo",
			WorkflowRef: "refs/heads/main",
			WorkflowSHA: "abcdef",
		},
	}

	expected := map[string]string{
		"workflow_run_id":      "run-123",
		"workflow_run_number":  "1",
		"workflow_run_attempt": "1",
		"repository":           "test/repo",
		"workflow_ref":         "refs/heads/main",
		"workflow_sha":         "abcdef",
	}

	actual := config.GetWorkflowRunContext()
	assert.Equal(t, expected, actual)
}

func TestGetSiblingJobsContext(t *testing.T) {
	config := &VulnetixConfig{
		Task: TaskRelease,
		Release: ReleaseConfig{
			WorkflowTimeout: 30,
		},
		GitHub: GitHubContext{
			RunID:       "run-456",
			RunNumber:   "2",
			RunAttempt:  "1",
			Repository:  "another/repo",
			WorkflowRef: "refs/tags/v1.0.0",
			WorkflowSHA: "fedcba",
			EventName:   "release",
			HeadRef:     "",
			BaseRef:     "",
			APIURL:      "https://api.github.com",
		},
	}

	expected := map[string]interface{}{
		"workflow_run_id":      "run-456",
		"workflow_run_number":  "2",
		"workflow_run_attempt": "1",
		"repository":           "another/repo",
		"workflow_ref":         "refs/tags/v1.0.0",
		"workflow_sha":         "fedcba",
		"event_name":           "release",
		"head_ref":             "",
		"base_ref":             "",
		"artifact_pattern":     "vulnetix-another-repo-run-456-*",
		"api_url":              "https://api.github.com",
		"timeout_minutes":      30,
	}

	actual := config.GetSiblingJobsContext()
	assert.Equal(t, expected, actual)
}

func TestGetReleaseArtifactPattern(t *testing.T) {
	config := &VulnetixConfig{
		GitHub: GitHubContext{
			Repository: "org/project",
			RunID:      "7890",
		},
	}

	expected := "vulnetix-org-project-7890-*"
	actual := config.GetReleaseArtifactPattern()
	assert.Equal(t, expected, actual)
}
