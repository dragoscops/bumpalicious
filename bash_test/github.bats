#!/usr/bin/env bash
 
load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/logging.sh"
source "./src/utils.sh"
source "./src/github.sh"

setup() {
  # Create a temporary file to simulate GITHUB_OUTPUT
  export GITHUB_OUTPUT="$(mktemp)"
}

teardown() {
  # Clean up the temporary file
  if [ -n "$GITHUB_OUTPUT" ] && [ -f "$GITHUB_OUTPUT" ]; then
    rm -f "$GITHUB_OUTPUT"
  fi
  unset GITHUB_OUTPUT
}

@test "github_output_store stores a key-value pair in GITHUB_OUTPUT" {
  # Run the function with direct arguments
  run github_output_store "test_key" "test_value"
  
  # Verify the output
  assert_success
  assert_output "test_key=test_value"
  
  # Check that the value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "test_key<<EOF"
  assert_output --partial "test_value"
  assert_output --partial "EOF"
}

@test "github_output_store can handle multi-line values" {
  # Run the function with a multi-line value
  run github_output_store "multiline_key" "line 1
line 2
line 3"
  
  # Verify the output contains the key and the first line
  assert_success
  assert_output --partial "multiline_key=line 1"
  
  # Check that the multi-line value was stored correctly in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "multiline_key<<EOF"
  assert_output --partial "line 1"
  assert_output --partial "line 2"
  assert_output --partial "line 3"
  assert_output --partial "EOF"
}

@test "github_output_store works with piped input" {
  # Create a temporary file with the value to pipe
  local piped_value_file="$(mktemp)"
  echo "piped value" > "$piped_value_file"
  
  # Use process substitution instead of a direct pipe
  run bash -c "
source ./src/github.sh; 
cat $piped_value_file | github_output_store piped_key
"
  
  # Verify the function ran successfully
  assert_success
  
  # Check that the piped value was stored in GITHUB_OUTPUT
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "piped_key<<EOF"
  assert_output --partial "piped value"
  assert_output --partial "EOF"
  
  # Clean up
  rm -f "$piped_value_file"
}

@test "github_output_store handles special characters" {
  # Run the function with special characters in the value
  run github_output_store "special_key" "value with: special* chars! and (symbols) [brackets]"
  
  # Verify the output
  assert_success
  assert_output "special_key=value with: special* chars! and (symbols) [brackets]"
  
  # Check that the value with special characters was stored correctly
  run cat "$GITHUB_OUTPUT"
  assert_output --partial "special_key<<EOF"
  assert_output --partial "value with: special* chars! and (symbols) [brackets]"
  assert_output --partial "EOF"
}

@test "github_output_store defaults to /dev/null when GITHUB_OUTPUT is not set" {
  # Unset GITHUB_OUTPUT to test the default behavior
  unset GITHUB_OUTPUT
  
  # Run the function (should not error)
  run github_output_store "test_key" "test_value"
  
  # Verify the output shows what would be stored
  assert_success
  assert_output "test_key=test_value"
}
