#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

# Source our script
source "./src/utils.sh"

@test "parse_arguments handles named arguments" {
  result=$(parse_arguments --github-repository "test/repo" --github-token "secret-token")
  assert_equal "$result" '{"github_repository":"test/repo","github_token":"secret-token"}'
}

@test "parse_arguments handles flags" {
  result=$(parse_arguments --verbose --help)
  assert_equal "$result" '{"verbose":true,"help":true}'
}

@test "parse_arguments handles mixed arguments" {
  result=$(parse_arguments --runner-count "5" --additional-labels "test,prod" -h)
  assert_equal "$result" '{"runner_count":"5","additional_labels":"test,prod","h":true}'
}

@test "parse_arguments handles positional arguments" {
  result=$(parse_arguments command subcommand --option value)
  assert_equal "$result" '{"option":"value","positional":["command","subcommand"]}'
}

@test "parse_arguments escapes quotes in values" {
  result=$(parse_arguments --message "Hello \"world\"")
  assert_equal "$result" '{"message":"Hello \"world\""}'
}