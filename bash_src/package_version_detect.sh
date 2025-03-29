#!/usr/bin/env bash

deno_detect_version() {
  fail_at_missing_command jq

  for file in jsr.json deno.json package.json; do
    if [ -f $file ]; then
      jq -r '.version // "0.0.1"' "$file"
      return
    fi
  done

  if [ -f deno.jsonc ]; then
    fail_at_missing_command deno

    deno eval --quiet "const text = await Deno.readTextFile('deno.jsonc'); \
      const json = text.replace(/\/\/.*$/gm, ''); \
      const data = JSON.parse(json); \
      console.log(data.version ?? '0.0.1');"
    return
  fi

  do_error "No version information found in jsr.json, deno.json, deno.jsonc, package.json"
}

go_detect_version() {
  if [ -f "go.mod" ]; then
    version=$(sed -nE 's/^module[[:space:]]+([^[:space:]]+)([[:space:]]+v?(.+))?$/\3/p' go.mod)
    version=${version:-0.0.1}
    echo "$version"
    return
  fi

  do_error "No version information found in version.go or go.mod"
}

node_detect_version() {
  fail_at_missing_command jq

  for file in jsr.json package.json; do
    if [ -f $file ]; then
      jq -r '.version // "0.0.1"' "$file"
      return
    fi
  done

  do_error "No version information found in jsr.json, package.json"
}

#
# @see https://python-poetry.org/docs/basic-usage/
# @see https://flit.pypa.io/en/stable/
# @see https://setuptools.pypa.io/en/latest/userguide/quickstart.html
python_detect_version() {
  python_detect_version_pyproject_toml && return
  python_detect_version_setup_cfg && return
  python_detect_version_setup_py && return

  do_error "No version information found in __init__.py, setup.py, or pyproject.toml"
}

python_detect_version_pyproject_toml() {
  if [ -f "pyproject.toml" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv $PY_VENV
    source $PY_VENV/bin/activate
    python -m pip -q install toml -q

    python <<'EOF'
import sys
import toml

with open("pyproject.toml") as f:
  data = toml.loads(f.read())
  version = (data.get("project", {}).get("version")
             or data.get("tool", {}).get("poetry", {}).get("version")
             or "0.0.1")
  print(version)
EOF
    return 0
  fi
  return 1
}

python_detect_version_setup_cfg() {
  if [ -f "setup.cfg" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv $PY_VENV
    source $PY_VENV/bin/activate
    python -m pip -q install configparser -q

    python <<'EOF'
import configparser

config = configparser.ConfigParser()
config.read("setup.cfg")
version = config.get("metadata", "version", fallback="0.0.1")
print(version)
EOF
    return 0
  fi
  return 1
}

python_detect_version_setup_py() {
  if [ -f "setup.py" ]; then
    version=$(cat setup.py | egrep "version\s*=\s*[\"']" | awk '{$1=$1; print}' | sed -E "s/version\s*=\s*[\"']([^\"']+)[\"'].*/\1/")
    version=${version:-0.0.1}
    echo "$version"
    return 0
  fi
  return 1
}

rust_detect_version() {
  # Ensure Cargo.toml exists
  if [ ! -f "Cargo.toml" ]; then
    do_error "Cargo.toml not found"
  fi

  if ! command -v yq > /dev/null; then
    do_error "'yq' application is missing"
  fi

  yq e '.package.version' Cargo.toml
}

text_detect_version() {
  # List of candidate version file names
  local version_files=("version" "VERSION" "version.txt" "VERSION.txt")
  local file version

  # Loop over each candidate file
  for file in "${version_files[@]}"; do
    if [ -f "$file" ]; then
      # Read the first non-empty line from the file and trim whitespace
      version=$(grep -m 1 . "$file" | tr -d ' \t\n\r')
      if [ -n "$version" ]; then
        echo "$version"
        return 0
      fi
    fi
  done

  do_error "No version information found in any version file (version, VERSION, version.txt, or VERSION.txt)"
}

# # zig_detect_version() {
# #   if [ -f "build.zig" ]; then
# #     version=$(grep -E 'const\s+version\s*=\s*".+"' build.zig | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')
# #     if [ -n "$version" ]; then
# #       echo "$version"
# #       return
# #     fi
# #   fi

# #   if [ -f "version.zig" ]; then
# #     version=$(grep -E 'pub\s+const\s+version\s*=\s*".+"' version.zig | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')
# #     if [ -n "$version" ]; then
# #       echo "$version"
# #       return
# #     fi
# #   fi

# #   do_error "No version information found in build.zig or version.zig"
# # }

# # c_detect_version() {
# #   if [ -f "version.h" ]; then
# #     version=$(grep -E '#define\s+VERSION\s+"[^"]+"' version.h | head -n 1 | sed -E 's/#define\s+VERSION\s+"([^"]+)".*/\1/')
# #     if [ -n "$version" ]; then
# #       echo "$version"
# #       return
# #     fi
# #   fi

# #   if [ -f "CMakeLists.txt" ]; then
# #     version=$(grep -E 'set\s*\(\s*VERSION\s+"[^"]+"' CMakeLists.txt | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')
# #     if [ -n "$version" ]; then
# #       echo "$version"
# #       return
# #     fi
# #   fi

# #   do_error "No version information found in version.h or CMakeLists.txt"
# # }
