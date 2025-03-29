#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/logging.sh"
source "./src/utils.sh"
source "./src/package_version_detect.sh"
source "./src/package_version_update.sh"
source "./src/github.sh"
source "./src/git.sh"

source "./test/helpers.sh"

setup() {
  # Create a fresh test repo for each test
  TEST_REPO="$PROJECT_ROOT/tmp/git_test_$(date +%s)_$RANDOM"
  _MOCK_CHANGELOG_FILE="$TEST_REPO/CHANGELOG.md"
  mkdir -p "$TEST_REPO"
  cd "$TEST_REPO"
  git init

  git_setup_user

  # Create initial file
  echo "Initial content" > init.txt
  git add init.txt
  git commit -m "Initial commit"
}

@test "git_setup_user configures git for Github" {
  run git config user.name
  assert_success
  assert_output "GitHub Actions"

  run git config user.email
  assert_success
  assert_output "actions@github.com"
}

@test "git_get_commit_message returns the last commit message" {
  cd "$TEST_REPO"
  git commit --allow-empty -m "chore: test commit"

  run git_get_commit_message

  assert_success
  assert_output "chore: test commit"
}

@test "git_get_commit_message --store to write to GITHUB_OUTPUT" {
  cd "$TEST_REPO"
  export GITHUB_OUTPUT="$(mktemp)"
  git commit --allow-empty -m "feat: new feature added"

  run git_get_commit_message --store
  
  assert_success
  # The output now comes from github_output_store function
  assert_output "commit_message=feat: new feature added"
  
  # Check if value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "commit_message<<EOF"
  assert_output --partial "feat: new feature added"
  assert_output --partial "EOF"
  unset GITHUB_OUTPUT
}

@test "git_get_last_created_tag returns initial commit hash when no tags are present" {
  cd "$TEST_REPO"
  initial_commit_hash=$(git rev-list --max-parents=0 HEAD)

  run git_get_last_created_tag

  assert_success
  assert_output "$initial_commit_hash"
}

setup_create_tag() { 
  git tag -a "v1.0.0" -m "version 1.0.0"
  echo "test" > test.txt
  git add test.txt
  git commit -m "chore: test commit"
}

@test "git_get_last_created_tag returns tag when tags are present" {
  cd "$TEST_REPO"
  setup_create_tag

  run git_get_last_created_tag

  assert_success
  assert_output "v1.0.0"
}

@test "git_get_last_created_tag --store to write to GITHUB_OUTPUT" {
  cd "$TEST_REPO"
  export GITHUB_OUTPUT="$(mktemp)"
  setup_create_tag
  
  run git_get_last_created_tag --store
  
  assert_success
  # The output now comes from github_output_store function
  assert_output "last_tag=v1.0.0"
  
  # Check if value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "last_tag<<EOF"
  assert_output --partial "v1.0.0"
  assert_output --partial "EOF"
  unset GITHUB_OUTPUT
}

setup_create_changes() { 
  # Create tag at initial commit
  git tag v0.1.0
  
  # Add commits with conventional commit format
  echo "feature content" > feature.txt
  git add feature.txt
  git commit -m "feat: add first feature"
  
  echo "fix content" > fix.txt
  git add fix.txt
  git commit -m "fix: fix a bug"
  
  echo "docs content" > docs.txt
  git add docs.txt
  git commit -m "docs: update documentation"
}

@test "git_build_changelog returns commits since last tag" {
  cd "$TEST_REPO"
  setup_create_changes
  
  # Run git_build_changelog
  run git_build_changelog --last-tag v0.1.0
  
  # Verify output
  assert_success
  assert_line --regexp "- \([a-f0-9]+\) feat: add first feature"
  assert_line --regexp "- \([a-f0-9]+\) fix: fix a bug"
  assert_line --regexp "- \([a-f0-9]+\) docs: update documentation"
}

@test "git_build_changelog --format markdown to format commits as markdown" {
  cd "$TEST_REPO"
  setup_create_changes
  
  # Run with markdown format
  run git_build_changelog --last_tag v0.1.0 --format markdown
  
  # Verify markdown formatting
  assert_success
  assert_line --regexp "- \*\*✨ Feature\*\* \([a-f0-9]+\): add first feature"
  assert_line --regexp "- \*\*🐛 Fix\*\* \([a-f0-9]+\): fix a bug"
  assert_line --regexp "- \*\*📚 Docs\*\* \([a-f0-9]+\): update documentation"
}

@test "git_build_changelog --format markdown --group-by-type to group commits by type" {
  cd "$TEST_REPO"
  setup_create_changes
  
  # Run with grouped markdown format
  run git_build_changelog --last_tag v0.1.0 --format markdown --group-by-type
  
  # Verify output contains section headers and formatted commits
  assert_success
  assert_output --partial "### 🚀 Features"
  assert_output --partial "### 🐛 Bug Fixes"
  assert_output --partial "### 📚 Documentation"
  
  assert_output --regexp "- [a-f0-9]+: add first feature"
  assert_output --regexp "- [a-f0-9]+: fix a bug"
  assert_output --regexp "- [a-f0-9]+: update documentation"
}

@test "git_build_changelog --store to write to GITHUB_OUTPUT" {
  cd "$TEST_REPO"
  setup_create_changes  
  export GITHUB_OUTPUT="$(mktemp)"
  
  # Run with store option
  run git_build_changelog --last_tag v0.1.0 --store
  
  assert_success
  # The output now comes from github_output_store function
  assert_output --partial "changelog="
  
  # Check if value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "changelog<<EOF"
  assert_output --regexp "- \([a-f0-9]+\) feat: add first feature"
  assert_output --regexp "- \([a-f0-9]+\) fix: fix a bug"
  assert_output --regexp "- \([a-f0-9]+\) docs: update documentation"
  assert_output --partial "EOF"
  
  unset GITHUB_OUTPUT
}

# Tests for the newly implemented git functions with mocking

@test "git_create_version_branch creates branch and mocks remote operations" {
  cd "$TEST_REPO"
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  export GITHUB_TOKEN="mock-token"
  
  # Run the function with mock enabled
  run git_create_version_branch --version "2.0.0" --pr-title "Release v2.0.0" --pr-message "This is a test release" --merge-branch main
  
  # Verify the function completed successfully
  assert_success
  # Check that it returns the branch name
  assert_output "release_branch_v2_0_0"
  
  # Verify that git created the branch locally
  run git branch
  assert_output --partial "release_branch_v2_0_0"
  
  # Check the mock operations were performed
  run cat "$GIT_MOCK_OUTPUT"
  # Only verify the git push and PR creation operations (no authentication step)
  assert_line --index 0 "MOCK: git push origin release_branch_v2_0_0"
  assert_line --index 1 "MOCK: gh pr create --base main --head release_branch_v2_0_0 --title Release v2.0.0 --body This is a test release"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
  unset GITHUB_TOKEN
}

@test "git_commit_version_changes commits and mocks remote operations" {
  cd "$TEST_REPO"
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  
  # Make a change to be committed
  echo "New content" > test-changes.txt
  
  # Run the function with mock enabled
  run git_commit_version_changes --version "2.1.0" --title "Release v2.1.0" --message "Another test release" --branch main
  
  # Verify the function completed successfully
  assert_success
  assert_output "Version 2.1.0 committed"
  
  # Verify that git made the commit locally
  run git log -1 --pretty=%s
  assert_output "chore: Release v2.1.0 Another test release"
  
  # Check that the mock file contains the expected remote operations
  run cat "$GIT_MOCK_OUTPUT"
  assert_output --partial "MOCK: git push origin main"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
}

@test "git_create_tag creates tag and mocks push operation" {
  cd "$TEST_REPO"
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  
  # Run the function with mock enabled
  run git_create_tag --version "3.0.0" --tag_message "Tagging version 3.0.0"
  
  # Verify the function completed successfully
  assert_success
  assert_output "v3.0.0"
  
  # Verify that git created the tag locally
  run git tag -l "v3.0.0"
  assert_output "v3.0.0"
  
  # Verify the tag message
  run git tag -l --format='%(contents)' "v3.0.0"
  assert_output --partial "Tagging version 3.0.0"
  
  # Check that the mock file contains the expected push command
  run cat "$GIT_MOCK_OUTPUT"
  assert_output "MOCK: git push origin v3.0.0"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
}

@test "git_create_tag deletes existing tag if it already exists" {
  cd "$TEST_REPO"
  # Create a tag that will need to be deleted
  git tag -a "v4.0.0" -m "Existing tag 4.0.0"
  
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  
  # Run the function to recreate the tag - redirect stderr to avoid output of deletion messages
  run git_create_tag --version "4.0.0" --tag_message "Updated tag 4.0.0" 2>/dev/null
  
  # Verify the function completed successfully
  assert_success
  assert_output "v4.0.0"
  
  # Verify that git created the new tag locally
  run git tag -l "v4.0.0"
  assert_output "v4.0.0"
  
  # Verify the updated tag message
  run git tag -l --format='%(contents)' "v4.0.0"
  assert_output --partial "Updated tag 4.0.0"
  
  # Check that the mock file contains the expected commands
  run cat "$GIT_MOCK_OUTPUT"
  assert_output "MOCK: git push origin v4.0.0"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
}

@test "git_create_tag with refresh_minor creates minor version tag" {
  cd "$TEST_REPO"
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  
  # Run the function with refresh_minor - using the correct format for args
  run git_create_tag --version "3.2.5" --tag-message "Tag with minor version" --refresh-minor true
  
  # Verify the function completed successfully
  assert_success
  assert_output "v3.2.5"
  
  # Verify that both tags were created locally
  run git tag -l "v3.2.5"
  assert_output "v3.2.5"
  
  run git tag -l "v3.2"
  assert_output "v3.2"
  
  # Check that the mock file contains both push commands
  run cat "$GIT_MOCK_OUTPUT"
  assert_line --index 0 "MOCK: git push origin v3.2.5"
  assert_line --index 1 "MOCK: git push origin v3.2"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
}

@test "git_create_tag with refresh_minor deletes existing minor tag if needed" {
  cd "$TEST_REPO"
  # Create tags that will need to be deleted
  git tag -a "v5.3.1" -m "Existing tag 5.3.1"
  git tag -a "v5.3" -m "Existing minor tag 5.3"
  
  # Create a temporary file to store mock output
  export GIT_MOCK_COMMANDS="true"
  export GIT_MOCK_OUTPUT="$(mktemp)"
  
  # Run the function to recreate both tags - redirect stderr to avoid output of deletion messages
  run git_create_tag --version "5.3.1" --tag-message "Updated tag 5.3.1" --refresh_minor true 2>/dev/null
  
  # Verify the function completed successfully
  assert_success
  assert_output "v5.3.1"
  
  # Verify both tags were updated
  run git tag -l --format='%(contents)' "v5.3.1"
  assert_output --partial "Updated tag 5.3.1"
  
  run git tag -l --format='%(contents)' "v5.3"
  assert_output --partial "Updated tag 5.3.1"
  
  # Check that the mock file contains the push commands
  run cat "$GIT_MOCK_OUTPUT"
  assert_line --index 0 "MOCK: git push origin v5.3.1"
  assert_line --index 1 "MOCK: git push origin v5.3"
  
  # Cleanup
  rm -f "$GIT_MOCK_OUTPUT"
  unset GIT_MOCK_COMMANDS
  unset GIT_MOCK_OUTPUT
}
