#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/utils.sh"
source "./src/version.sh"

@test "bump minor version for feat commit without pre-release" {
  run increase_version --version "1.2.3" --commit "feat(parser): add new parsing logic"
  [ "$status" -eq 0 ]
  [ "$output" = "1.3.0" ]
}

@test "bump patch version for fix commit without pre-release" {
  run increase_version --version "1.2.3" --commit "fix: correct error"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4" ]
}

@test "bump major version for commit with exclamation mark" {
  run increase_version --version "1.2.3" --commit "feat!: completely change API"
  [ "$status" -eq 0 ]
  [ "$output" = "2.0.0" ]
}

@test "bump major version for commit with BREAKING CHANGE" {
  # Use a literal newline in the commit message.
  commit_msg=$'refactor: update internals\n\nBREAKING CHANGE: changes API'
  run increase_version --version "1.2.3" --commit "$commit_msg"
  [ "$status" -eq 0 ]
  [ "$output" = "2.0.0" ]
}

@test "append pre-release label when not present" {
  run increase_version --version "1.2.3" --commit "feat: add new feature" --prerelease "alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1.3.0-alpha" ]
}

@test "increment pre-release counter if already present" {
  run increase_version --version "1.2.3-alpha.0" --commit "fix: bug fix" --prerelease "alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4-alpha.1" ]
}

@test "increment pre-release counter if already present no count" {
  run increase_version --version "1.2.3-alpha" --commit "fix: bug fix" --prerelease "alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4-alpha.1" ]
}

@test "increment pre-release counter if already present no count (2nd time)" {
  run increase_version --version "1.2.3-alpha.1" --commit "fix: bug fix" --prerelease "alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4-alpha.2" ]
}

@test "bump patch version for fix commit with different pre-release label" {
  run increase_version --version "1.2.3" --commit "fix: minor fix" --prerelease "beta"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4-beta" ]
}

@test "increase_version with named parameters" {
  run increase_version --version "1.2.3" --commit "feat: add new feature" --prerelease "alpha"
  [ "$status" -eq 0 ]
  [ "$output" = "1.3.0-alpha" ]
}

@test "increase_version with named parameters mixing order" {
  run increase_version --prerelease "beta" --version "1.2.3" --commit "fix: minor fix"
  [ "$status" -eq 0 ]
  [ "$output" = "1.2.4-beta" ]
}

@test "increase_version with named parameters for major version bump" {
  run increase_version --version "1.2.3" --commit "feat!: completely change API"
  [ "$status" -eq 0 ]
  [ "$output" = "2.0.0" ]
}
