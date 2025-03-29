#!/usr/bin/env bash

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

source "./src/logging.sh"

@test "do_debug test will output '::debug:test'" {
  run do_debug "test"
  assert_output '::debug:test'
}

@test "do_error test will output '::error:test'" {
  run do_error "test"
  assert_output '::error:test'
}

@test "do_info test will output '::notice:test'" {
  run do_info "test"
  assert_output '::notice:test'
}

@test "do_warn test will output '::warning:test'" {
  run do_warn "test"
  assert_output '::warning:test'
}
