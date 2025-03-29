#!/usr/bin/env bash

do_cleanup() {
  for folder in cargo deno go node python rust text; do
    rm -rf $PROJECT_ROOT/tmp/$folder
  done
}

init_deno_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/deno}"
  local version_file="${2:-deno.json}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p $(dirname "$folder") \
    && cd $(dirname "$folder") \
    && deno init $(basename "$folder") \
    && cd "$folder" \
    && cat deno.json \
    | jq \
      --arg ver "$version" \
      --arg name "$(basename $folder)" \
      '.version = $ver | .name = $name' \
      | tee > deno.jsonc \
    && rm deno.json

  case "$version_file" in
    jsr.json|deno.json|package.json)
      mv deno.jsonc $version_file
      ;;
    deno.jsonc)
      echo
      ;;
    *)
      do_error "Invalid deno config file: $version_file"
      ;;
  esac
}

init_go_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/go}"
  local version_file="${2:-go.mod}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p "$folder" \
    && cd "$folder" \
    && go mod init github.com/test/$(basename $folder)
}

init_node_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/node}"
  local version_file="${2:-package.json}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p "$folder" \
    && cd "$folder" \
    && npm init -y \
    && cat package.json \
    | jq \
      --arg ver "$version" \
      --arg name "$(basename $folder)" \
      '.version = $ver | .name = $name' \
      | tee > version \
    && rm package.json \
    && mv version $version_file
}

init_python_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/rust}"
  local version_file="${2:-package.json}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p "$folder" \
    && cd "$folder"

  case "$version_file" in
    pyproject.toml)
      cat > pyproject.toml <<EOF
[project]
name = "$(basename $folder)"
version = "$version"
dependencies = [
    "requests",
    'importlib-metadata; python_version<"3.10"',
]
EOF
    ;;
    pyproject.poetry)
      cat > pyproject.toml <<EOF
[tool.poetry]
name = "$(basename $folder)"
version = "$version"
description = "Calculate word counts in a text file!"
authors = ["Tomas Beuzen"]
license = "MIT"
readme = "README.md"
EOF
    ;;
    setup.cfg)
      cat > setup.cfg <<EOF
[metadata]
name = $(basename $folder)
version = $version

[options]
install_requires =
    requests
    importlib-metadata; python_version<"3.10"
EOF
    ;;
    setup.py)
      cat > setup.py <<EOF
from setuptools import setup

setup(
    name='$(basename $folder)',
    version='$version',
    install_requires=[
        'requests',
        'importlib-metadata; python_version<"3.10"',
    ],
)
EOF
      ;;
    *)
      do_error "Invalid python config file: $version_file"
      ;;
  esac
}

init_rust_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/rust}"
  local version_file="${2:-Cargo.toml}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p "$folder" \
    && cd "$folder" \
    && cargo init \
    && cargo set-version "$version" \
    && rm -rf Cargo.lock
}

init_text_project() {
  local folder="${1:-$PROJECT_ROOT/tmp/text}"
  local version_file="${2:-version.txt}"
  local version="${3:-1.0.0}"

  rm -rf "$folder" \
    && mkdir -p "$folder" \
    && cd "$folder" \
    && echo "$version" > "$version_file"
}
