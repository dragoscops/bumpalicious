#!/usr/bin/env bash
# This script provides utility functions for logging and displaying debug, info, warning, and error messages with colored output.
# The functions use ANSI escape codes to color the text for better visibility.
# The Greek letter lambda (λ) is used as a prefix to distinguish log messages.
# lambda (λ) symbol used as a prefix for all log messages

###########################################
# do_log()
# Prints an informational message in the specified color.
# Arguments:
#   $1 - The message to display. If empty, reads from standard input.
# Output:
#   An informational message is printed in the specified color.
###########################################
do_log() {
  local _type="$1"
  local _message="$2"

  echo "::$_type:$_message"
  [ "$_type" = "error" ] && exit 1
}

###########################################
# debug()
# Prints a debug message in blue if the DEBUG variable is set.
# Arguments:
#   $1 - The debug message to display.
# Output:
#   A blue debug message is printed to STDERR if debugging is enabled.
###########################################
do_debug() {
  do_log "debug" "$1"
}

###########################################
# error()
# Prints an error message in red and exits the script with a non-zero status.
# Arguments:
#   $1 - The error message to display.
# Output:
#   A red error message is printed to STDERR, and the script exits with status 1.
###########################################
do_error() {
  do_log "error" "$1"
}

###########################################
# info()
# Prints an informational message in green.
# Arguments:
#   $1 - The info message to display.
# Output:
#   A green info message is printed to STDERR.
###########################################
do_info() {
  do_log "notice" "$1"
}

###########################################
# warn()
# Prints a warning message in yellow.
# Arguments:
#   $1 - The warning message to display.
# Output:
#   A yellow warning message is printed to STDERR.
###########################################
do_warn() {
  do_log "warning" "$1"
}
