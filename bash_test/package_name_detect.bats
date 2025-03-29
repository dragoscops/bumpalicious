#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/logging.sh"
source "./src/utils.sh"
source "./src/package_name_detect.sh"

source "./test/helpers.sh"

setup() {
  TEST_REPO="$PROJECT_ROOT/tmp/project_$(date +%s)_$RANDOM"
  TEST_REPO_NAME=$(basename $TEST_REPO)
}

@test "deno_detect_name outputs correct version from jsr.json" {
  init_deno_project $TEST_REPO jsr.json

  run deno_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "deno_detect_name outputs correct version from deno.json if jsr.json absent" {
  init_deno_project $TEST_REPO deno.json

  run deno_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "deno_detect_name outputs correct version from deno.jsonc if deno.json, jsr.json absent" {
  init_deno_project $TEST_REPO deno.jsonc

  run deno_detect_name
  echo "$output"
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "deno_detect_name outputs correct version from package.json if jsr.json, deno.json, deno.jsonc absent" {
  init_deno_project $TEST_REPO package.json

  run deno_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "go_detect_name outputs correct version from go.mod (no version)" {
  init_go_project $TEST_REPO
  echo "module github.com/test/$TEST_REPO_NAME 1.0.0" > go.mod

  run go_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "go_detect_name outputs correct version from go.mod" {
  init_go_project $TEST_REPO
  echo "module github.com/test/$TEST_REPO_NAME" > go.mod

  run go_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "node_detect_name outputs correct version from jsr.json" {
  init_node_project $TEST_REPO jsr.json

  run node_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "node_detect_name outputs correct version from package.json if jsr.json absent" {
  init_node_project $TEST_REPO package.json

  run node_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "python_detect_name outputs correct version from pyproject.toml (flit or setuptools)" {
  init_python_project $TEST_REPO pyproject.toml

  run python_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "python_detect_name outputs correct version from pyproject.toml (poetry)" {
  init_python_project $TEST_REPO pyproject.poetry

  run python_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "python_detect_name outputs correct version from setup.cfg if pyproject.toml is missing" {
  init_python_project $TEST_REPO setup.cfg

  run python_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "python_detect_name outputs correct version from setup.py if pyproject.toml, setup.cfg missing" {
  init_python_project $TEST_REPO setup.py

  run python_detect_name
  echo "$output"
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "rust_detect_name outputs correct version from Cargo.toml" {
  init_rust_project $TEST_REPO

  rust_detect_name
  run rust_detect_name
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}

@test "text_detect_name outputs correct version from version file" {
  init_text_project $TEST_REPO version.txt

  run text_detect_name
  echo "$output"
  [ "$status" -eq 0 ]
  [ "$output" = "$TEST_REPO_NAME" ]
}
