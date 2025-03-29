#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/utils.sh"
source "./src/logging.sh"
source "./src/version.sh"
source "./src/git.sh"
source "./src/github.sh"

source "./src/package_name_detect.sh"
source "./src/package_version_detect.sh"
source "./src/package_version_update.sh"
source "./src/project.sh"

source "./test/helpers.sh"


setup() {
  TEST_REPO="$PROJECT_ROOT/tmp/git_test_$(date +%s)_$RANDOM"

  # Create text project with version.txt containing 1.0.0
  init_text_project $TEST_REPO
  cd $TEST_REPO

  git init
  git_setup_user
  
  # First commit just the root project to make sure version.txt exists
  git add .
  git commit -am "chore: init root project"
  
  # Create initial tag for version 1.0.0
  git tag -a "v1.0.0" -m "version 1.0.0"
  
  # Create all workspaces
  init_deno_project $TEST_REPO/packages/deno
  init_go_project $TEST_REPO/packages/go
  init_node_project $TEST_REPO/packages/node

  cd $TEST_REPO
  TEST_REPO_NAME=$(basename $TEST_REPO)
  
  # Add all workspace files to git and commit
  git add .
  git commit -am "chore: add all workspaces"

  # Update version and create a new tag
  text_update_version "1.1.0"
  git add version.txt
  git commit -am "chore: update version to 1.1.0"
  git tag -a "v1.1.0" -m "version 1.1.0"
}

@test "gather_workspaces_info returns the root project details" {
  cd $TEST_REPO

  # Run git_get_last_tag
  run gather_workspaces_info

  # Verify that the output matches the latest tag
  assert_success
  assert_output ".:text:$TEST_REPO_NAME:1.1.0"
}

@test "gather_workspaces_info --store to write to GITHUB_OUTPUT" {
  cd $TEST_REPO
  export GITHUB_OUTPUT="$(mktemp)"
  
  # Run gather_workspaces_info with --store parameter
  run gather_workspaces_info --store

  # Verify output
  assert_success
  assert_output "workspaces_info=.:text:$TEST_REPO_NAME:1.1.0"

  # Check if value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "workspaces_info<<EOF"
  assert_output --partial ".:text:$TEST_REPO_NAME:1.1.0"
  assert_output --partial "EOF"

  unset GITHUB_OUTPUT
}

@test "gather_workspaces_info --workspaces "..." returns the packages details" {
  cd $TEST_REPO

  # Run git_get_last_tag
  run gather_workspaces_info --workspaces ".:text,packages/deno:deno,packages/go:go,packages/node:node"

  # Verify that the output matches the latest tag
  assert_success
  assert_output ".:text:$TEST_REPO_NAME:1.1.0,packages/deno:deno:deno:1.0.0,packages/go:go:go:0.0.1,packages/node:node:node:1.0.0"
}

generate_workspace_changes() {
  # Make changes ONLY to root workspace
  cd $TEST_REPO
  echo "$(date +%s)" > root-date.txt
  git add root-date.txt
  git commit -am "chore: changing main project"

  # Make changes ONLY to deno workspace
  cd $TEST_REPO/packages/deno
  echo "$(date +%s)" > date.txt
  git add date.txt
  git commit -am "chore: changing deno project"

  # Make changes ONLY to node workspace
  cd $TEST_REPO/packages/node
  echo "$(date +%s)" > date.txt
  git add date.txt
  git commit -am "chore: changing node project"

  # Return to root workspace
  cd $TEST_REPO
}

@test "gather_changed_workspaces_info returns the packages details" {
  cd $TEST_REPO
  generate_workspace_changes
  
  # Run gather_changed_workspaces_info with all workspaces
  run gather_changed_workspaces_info \
    --workspaces ".:text,packages/deno:deno,packages/go:go,packages/node:node" \
    --tag "$(git_get_last_created_tag)"

  # Verify that the output matches only the changed workspaces
  assert_success
  
  # Check that the output contains the main workspace, deno and node packages, but not go package
  assert_output --partial ".:text:$TEST_REPO_NAME:1.1.0"
  assert_output --partial "packages/deno:deno:deno:1.0.0"
  assert_output --partial "packages/node:node:node:1.0.0"
  refute_output --partial "packages/go:go:go:0.0.1"
  
  # Make sure we have exactly 3 changed workspaces (by counting commas)
  local comma_count=$(echo "$output" | tr -cd ',' | wc -c)
  [ "$comma_count" -eq 2 ]
}

@test "gather_changed_workspaces_info with --store parameter" {
  cd $TEST_REPO
  generate_workspace_changes
  export GITHUB_OUTPUT="$(mktemp)"

  # Run gather_changed_workspaces_info with --store parameter
  run gather_changed_workspaces_info \
    --workspaces ".:text,packages/deno:deno,packages/go:go,packages/node:node" \
    --tag "$(git_get_last_created_tag)" --store

  # Verify output
  assert_success
  assert_output "changed_workspaces_info=.:text:$TEST_REPO_NAME:1.1.0,packages/deno:deno:deno:1.0.0,packages/node:node:node:1.0.0"

  # Check if value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "changed_workspaces_info<<EOF"
  assert_output --partial ".:text:$TEST_REPO_NAME:1.1.0,packages/deno:deno:deno:1.0.0,packages/node:node:node:1.0.0"
  assert_output --partial "EOF"
  unset GITHUB_OUTPUT
}

@test "increase_workspaces_versions increases versions on change packages and returns the details" {
  cd $TEST_REPO
  generate_workspace_changes

  commit_message=$(git_get_commit_message)
  last_tag=$(git_get_last_created_tag)
  changed_workspaces_info=$(gather_changed_workspaces_info \
    --workspaces ".:text,packages/deno:deno,packages/go:go,packages/node:node" \
    --tag "$last_tag")

  run increase_workspaces_versions --workspaces-info "$changed_workspaces_info" --commit-message "$commit_message" --tag "$last_tag"

  # Verify that the output matches the latest tag
  assert_success
  assert_output ".:text:$TEST_REPO_NAME:1.1.1,packages/deno:deno:deno:1.0.1,packages/node:node:node:1.0.1"
}

# @test "increase_workspaces_versions with --store parameter" {
#   cd $PROJECT_ROOT/tmp/git_text_project
#   export GITHUB_OUTPUT="$(mktemp)"
#   commit_message=$(git_get_commit_message)
#   last_tag=$(git_get_last_created_tag)
#   changed_workspaces_info=$(gather_changed_workspaces_info \
#     --workspaces ".:text,packages/deno:deno,packages/go:go,packages/node:node" \
#     --tag "$last_tag")

#   run increase_workspaces_versions --workspaces-info "$changed_workspaces_info" --commit-message "$commit_message" --tag "$last_tag" --store

#   # Verify output
#   assert_success
#   assert_output "updated_workspaces_info=.:text:git_text_project:1.1.1,packages/deno:deno:deno:1.0.1,packages/node:node:node:1.0.1"

#   # Check if value was stored in GITHUB_OUTPUT
#   run cat "$GITHUB_OUTPUT"
#   assert_output --partial "updated_workspaces_info<<EOF"
#   assert_output --partial ".:text:git_text_project:1.1.1,packages/deno:deno:deno:1.0.1,packages/node:node:node:1.0.1"
#   assert_output --partial "EOF"
#   unset GITHUB_OUTPUT
# }

# @test "update_workspaces_versions returns the packages details" {
#   cd $PROJECT_ROOT/tmp/git_text_project

#   workspaces_info=".:text:git_text_project:1.1.1,packages/deno:deno:deno:1.0.1,packages/node:node:node:1.0.1"
#   update_workspaces_versions --workspaces-info "$workspaces_info"

#   run cat version.txt
#   assert_success
#   assert_output "1.1.1"

#   run echo $(cat $PROJECT_ROOT/tmp/git_text_project/packages/deno/deno.json | jq -r '.version')
#   assert_success
#   assert_output "1.0.1"

#   run echo $(cat $PROJECT_ROOT/tmp/git_text_project/packages/node/package.json | jq -r '.version')
#   assert_success
#   assert_output "1.0.1"
# }
