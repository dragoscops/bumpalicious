#!/usr/bin/env bash

deno_update_version() {
  fail_at_missing_command jq

  local new_version="$1"
  local updated=0

  for file in package.json jsr.json deno.json; do
    if [ -f $file ]; then
      jq --arg ver "$new_version" '.version = $ver' $file > $file.tmp \
        && cat $file.tmp > $file \
        && rm $file.tmp

      updated=$((updated + 1))
    fi
  done

  if [ -f deno.jsonc ]; then
    deno eval "const file = await Deno.readTextFile('deno.jsonc'); \
      const data = JSON.parse(file.replace(/\/\/.*$/gm, '')); \
      data.version = '2.0.0'; \
      await Deno.writeTextFile('deno.jsonc', JSON.stringify(data, null, 2));"

    updated=$((updated + 1))
  fi

  if [ $updated -eq 0 ]; then
    do_error 'Unable to update node version; deno.json, deno.jsonc, jsr.json, package.json missing'
  fi
}

go_update_version() {
  local new_version="$1"
  local updated=0
  if [ -f "go.mod" ]; then
    $SED_I_CMD -E 's/^(module[[:space:]]+[^[:space:]]+)([[:space:]]+v?[0-9]+\.[0-9]+\.[0-9]+)?/\1 v'"${new_version}"'/' go.mod && updated=1
  fi
  [ $updated -eq 1 ] || do_error "No version information updated in go.mod"
}

node_update_version() {
  fail_at_missing_command jq

  local new_version="$1"
  local updated=0

  for file in package.json jsr.json; do
    if [ -f $file ]; then
      jq --arg ver "$new_version" '.version = $ver' $file > $file.tmp \
        && cat $file.tmp > $file \
        && rm $file.tmp

      updated=$((updated + 1))
    fi
  done

  if [ $updated -eq 0 ]; then
    do_error 'Unable to update node version; package.json, jsr.json missing'
  fi
}

python_update_version() {
  local new_version="$1"
  local updated=0

  python_update_version_pyproject_toml "$new_version" && updated=1
  python_update_version_setup_cfg "$new_version" && updated=1
  python_update_version_setup_py "$new_version" && updated=1

  [ $updated -eq 1 ] || do_error "No version file found in __init__.py, setup.py, or pyproject.toml"
}

python_update_version_pyproject_toml() {
  local new_version="$1"

  if [ -f "pyproject.toml" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv $PY_VENV
    source $PY_VENV/bin/activate
    python -m pip -q install toml -q

    python <<EOF
import toml

# Set the new version (hard-coded here; you can modify this as needed)
new_version = "${new_version}"

# Read and parse the TOML file
with open("pyproject.toml", "r") as fr:
  data = toml.load(fr)

# Update version:
if "tool" in data and "poetry" in data["tool"]:
  data["tool"]["poetry"]["version"] = new_version
elif "project" in data:
  data["project"]["version"] = new_version

# Write the updated data back to the file
with open("pyproject.toml", "w") as fw:
  fw.write(toml.dumps(data))
EOF
  return 0
  fi

  return 1
}

python_update_version_setup_cfg() {
  local new_version="$1"

  if [ -f "setup.cfg" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv $PY_VENV
    source $PY_VENV/bin/activate
    python -m pip -q install toml -q

    python <<EOF
import configparser

# Set the new version
new_version = "${new_version}"

# Create the parser and read the setup.cfg file
config = configparser.ConfigParser()
config.read("setup.cfg")

# Ensure the metadata section exists
if not config.has_section("metadata"):
    config.add_section("metadata")

# Update the version in the metadata section
config.set("metadata", "version", new_version)

# Write the updated configuration back to setup.cfg
with open("setup.cfg", "w") as configfile:
    config.write(configfile)
EOF
  return 0
  fi

  return 1
}

python_update_version_setup_py() {
  local new_version="$1"

  if [ -f setup.py ]; then
    $SED_I_CMD -E "s/(\s*version\s*=\s*[\"'])[^\"']+([\"'].*)/\1${new_version}\2/" setup.py
  fi
}

# TODO: Not sure how to update a cargo project yet
# https://medium.com/codex/rust-modules-and-project-structure-832404a33e2e
rust_update_version() {
  local new_version="$1"
  if [ ! -f "Cargo.toml" ]; then
    do_error "Cargo.toml not found"
  fi

  fail_at_missing_command cargo

  # https://github.com/killercup/cargo-edit
  cargo --list | grep set-version > /dev/null || do_error "'cargo-edit' module is missing"

  cargo set-version "$new_version" \
    || do_error 'Failed to update Cargo.toml'
}

text_update_version() {
  local new_version="$1"
  local version_files=("version" "VERSION" "version.txt" "VERSION.txt")
  local file
  local found=0

  for file in "${version_files[@]}"; do
    if [ -f "$file" ]; then
      echo "$new_version" > "$file"
      found=1
      break
    fi
  done

  if [ $found -ne 1 ]; then
    do_error "No version file found (version, VERSION, version.txt, or VERSION.txt)"
  fi
}
