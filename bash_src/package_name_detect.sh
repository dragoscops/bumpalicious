#!/usr/bin/env bash

deno_detect_name() {
  fail_at_missing_command jq

  for file in jsr.json deno.json; do
    if [ -f $file ]; then
      jq -r '.name' "$file"
      return
    fi
  done

  if [ -f deno.jsonc ]; then
    fail_at_missing_command deno

    deno eval --quiet "const text = await Deno.readTextFile('deno.jsonc'); \
      const json = text.replace(/\/\/.*$/gm, ''); \
      const data = JSON.parse(json); \
      console.log(data.name);"
    return
  fi

  if [ -f "package.json" ]; then
    jq -r '.name' "package.json"
    return
  fi

  do_error "No version information found in jsr.json, deno.json, deno.jsonc, package.json"
}

go_detect_name() {
  if [ -f "go.mod" ]; then
    sed -nE 's/^module[[:space:]]+([^[:space:]]+)([[:space:]]+v?(.+))?$/\1/p' go.mod \
      | awk -F '/' '{ print $NF }'
    return
  fi

  do_error "No version information found in version.go or go.mod"
}

node_detect_name() {
  fail_at_missing_command jq

  for file in jsr.json package.json; do
    if [ -f "$file" ]; then
      jq -r '.name // ""' "$file"
      return
    fi
  done

  do_error "No version information found in jsr.json, package.json"
}

python_detect_name() {
  python_detect_name_pyproject_toml && return
  python_detect_name_setup_cfg && return
  python_detect_name_setup_py && return

  do_error "No package name information found in pyproject.toml, setup.cfg, or setup.py"
}

# Attempt to detect package name from pyproject.toml.
python_detect_name_pyproject_toml() {
  if [ -f "pyproject.toml" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv "$PY_VENV"
    source "$PY_VENV/bin/activate"
    python -m pip -q install toml -q

    python <<'EOF'
import sys
import toml

with open("pyproject.toml") as f:
    data = toml.loads(f.read())
    # Try both possible structures:
    name = (data.get("project", {}).get("name")
            or data.get("tool", {}).get("poetry", {}).get("name")
            or data.get("tool.poetry", {}).get("name")
            or "")
print(name)
EOF
    return 0
  fi
  return 1
}

# Attempt to detect package name from setup.cfg.
python_detect_name_setup_cfg() {
  if [ -f "setup.cfg" ]; then
    PY_VENV=${PY_VENV:-.venv}
    py=$(which_python)
    [ -d "$PY_VENV" ] || $py -m venv "$PY_VENV"
    source "$PY_VENV/bin/activate"
    python -m pip -q install configparser -q

    python <<'EOF'
import configparser

config = configparser.ConfigParser()
config.read("setup.cfg")
name = config.get("metadata", "name", fallback="")
print(name)
EOF
    return 0
  fi
  return 1
}

# Attempt to detect package name from setup.py.
python_detect_name_setup_py() {
  if [ -f "setup.py" ]; then
    name=$(grep -E "name\s*=\s*[\"']" setup.py | awk '{$1=$1; print}' | sed -E "s/.*name\s*=\s*[\"']([^\"']+)[\"'].*/\1/")
    if [ -z "$name" ]; then
      name=$(text_detect_name)
    fi
    echo "$name"
    return 0
  fi
  return 1
}

rust_detect_name() {
  # Ensure Cargo.toml exists
  if [ ! -f "Cargo.toml" ]; then
    do_error "Cargo.toml not found"
  fi

  fail_at_missing_command yq

  yq e '.package.name' Cargo.toml
}

text_detect_name() {
  basename "$(pwd)"
}

# # zig_detect_name() {
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

# # c_detect_name() {
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
