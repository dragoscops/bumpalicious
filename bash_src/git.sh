git_setup_user() {
  # Parse arguments using the new parse_arguments function
  local args_json=$(parse_arguments "$@")
  local gitea=$(echo "$args_json" | jq -r '.gitea // "false"')

  git config user.name "GitHub Actions"
  git config user.email "actions@github.com"
  if [ ! -z "$GITHUB_WORKSPACE" ]; then
    git config --global --add safe.directory "$GITHUB_WORKSPACE"
  fi
}

git_get_commit_message() {
  # Parse arguments using the new parse_arguments function
  local args_json=$(parse_arguments "$@")
  local store=$(echo "$args_json" | jq -r '.store // "false"')
  
  commit_message=$(git log -1 --no-merges --pretty=format:%B)
  if [ "$store" = "true" ]; then
    github_output_store "commit_message" "${commit_message}"
  else 
    echo "${commit_message}"
  fi
}

git_get_last_created_tag() {
  local args_json=$(parse_arguments "$@")
  local store=$(echo "$args_json" | jq -r '.store // "false"')
  
  last_tag=$(git for-each-ref --sort=-taggerdate --format '%(refname:short)' refs/tags | head -n 1)
  if [ -z "$last_tag" ]; then
    last_tag=$(git rev-list --max-parents=0 HEAD)
  fi
  if [ "$store" = "true" ]; then
    github_output_store "last_tag" "${last_tag}"
  else
    echo "${last_tag}"
  fi
}

git_build_changelog() {
  # Parse arguments using the new parse_arguments function
  local args_json=$(parse_arguments "$@")
  local last_tag=$(echo "$args_json" | jq -r '.last_tag // ""')
  local format=$(echo "$args_json" | jq -r '.format // "list"')
  local store=$(echo "$args_json" | jq -r '.store // "false"')
  local group_by_type=$(echo "$args_json" | jq -r '.group_by_type // "false"')
  
  # If no last_tag provided, get it
  if [ -z "$last_tag" ]; then
    last_tag=$(git_get_last_created_tag)
  fi
  
  # Generate the changelog
  local changelog=""
  # Check if we have any commits to analyze
  if git rev-parse "$last_tag" >/dev/null 2>&1; then
    # Base commit log format includes hash in parentheses
    changelog=$(git log --no-merges "${last_tag}..HEAD" --pretty=format:"- (%h) %s" 2>/dev/null | grep -v "Merge" || echo "")
  else
    # If last_tag isn't valid, get all commits
    changelog=$(git log --no-merges --pretty=format:"- (%h) %s" 2>/dev/null | grep -v "Merge" || echo "")
  fi
  
  # If no commits found, exit early with empty changelog
  if [ -z "$changelog" ]; then
    if [ "$store" = "true" ]; then
      github_output_store "changelog" ""
    else
      echo ""
    fi
    return 0
  fi
  
  if [ "$format" = "markdown" ]; then
    if [ "$group_by_type" = "true" ]; then
      # Platform-independent processing for both Linux and macOS
      local features=""
      local fixes=""
      local docs=""
      local style=""
      local refactor=""
      local perf=""
      local test=""
      local build=""
      local ci=""
      local chore=""
      local other=""
      
      # Process changelog line by line to avoid platform differences in string handling
      while IFS= read -r line; do
        if echo "$line" | grep -q " feat"; then
          features="$features$line
"
        elif echo "$line" | grep -q " fix"; then
          fixes="$fixes$line
"
        elif echo "$line" | grep -q " docs"; then
          docs="$docs$line
"
        elif echo "$line" | grep -q " style"; then
          style="$style$line
"
        elif echo "$line" | grep -q " refactor"; then
          refactor="$refactor$line
"
        elif echo "$line" | grep -q " perf"; then
          perf="$perf$line
"
        elif echo "$line" | grep -q " test"; then
          test="$test$line
"
        elif echo "$line" | grep -q " build"; then
          build="$build$line
"
        elif echo "$line" | grep -q " ci"; then
          ci="$ci$line
"
        elif echo "$line" | grep -q " chore"; then
          chore="$chore$line
"
        else
          other="$other$line
"
        fi
      done <<< "$changelog"
      
      # Fixed process_section function to ensure correct output formatting
      process_section() {
        local content="$1"
        local pattern="$2"
        local replacement="$3"
        local result=""
        
        while IFS= read -r line; do
          if [ -n "$line" ]; then
            # Use platform-independent sed syntax with a fixed replacement pattern
            # to ensure no double spaces after the colon
            processed_line=$(echo "$line" | sed -E "s/$pattern/$replacement/")
            result="$result$processed_line
"
          fi
        done <<< "$content"
        
        echo "$result"
      }
      
      # Generate markdown-formatted changelog
      formatted_changelog=""
      
      if [ -n "$features" ]; then
        formatted_changelog="$formatted_changelog### 🚀 Features

$(process_section "$features" '- \(([a-f0-9]+)\) feat(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$fixes" ]; then
        formatted_changelog="$formatted_changelog### 🐛 Bug Fixes

$(process_section "$fixes" '- \(([a-f0-9]+)\) fix(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$docs" ]; then
        formatted_changelog="$formatted_changelog### 📚 Documentation

$(process_section "$docs" '- \(([a-f0-9]+)\) docs(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$style" ]; then
        formatted_changelog="$formatted_changelog### 💎 Style

$(process_section "$style" '- \(([a-f0-9]+)\) style(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$refactor" ]; then
        formatted_changelog="$formatted_changelog### ♻️ Refactor

$(process_section "$refactor" '- \(([a-f0-9]+)\) refactor(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$perf" ]; then
        formatted_changelog="$formatted_changelog### ⚡ Performance

$(process_section "$perf" '- \(([a-f0-9]+)\) perf(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$test" ]; then
        formatted_changelog="$formatted_changelog### ✅ Tests

$(process_section "$test" '- \(([a-f0-9]+)\) test(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$build" ]; then
        formatted_changelog="$formatted_changelog### 🏗️ Build

$(process_section "$build" '- \(([a-f0-9]+)\) build(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$ci" ]; then
        formatted_changelog="$formatted_changelog### 👷 CI

$(process_section "$ci" '- \(([a-f0-9]+)\) ci(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$chore" ]; then
        formatted_changelog="$formatted_changelog### 🔧 Chore

$(process_section "$chore" '- \(([a-f0-9]+)\) chore(\([^)]+\))?:?\s*' '- \1: ')
"
      fi
      
      if [ -n "$other" ]; then
        formatted_changelog="$formatted_changelog### Other Changes

$other
"
      fi
      
      # Clean up the output to fix any double spaces after colons - common issue between Linux and macOS
      changelog=$(echo "$formatted_changelog" | sed -e 's/:  /: /g' | sed -e 's/[[:space:]]*$//')
    else
      # Simple line-by-line processing for non-grouped markdown
      local processed_changelog=""
      
      while IFS= read -r line; do
        # Skip empty lines
        if [ -z "$line" ]; then
          continue
        fi
        
        local processed_line=""
        if echo "$line" | grep -q " feat"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) feat(\([^)]+\))?:?/- **✨ Feature** (\1):/g')
        elif echo "$line" | grep -q " fix"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) fix(\([^)]+\))?:?/- **🐛 Fix** (\1):/g')
        elif echo "$line" | grep -q " docs"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) docs(\([^)]+\))?:?/- **📚 Docs** (\1):/g')
        elif echo "$line" | grep -q " style"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) style(\([^)]+\))?:?/- **💎 Style** (\1):/g')
        elif echo "$line" | grep -q " refactor"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) refactor(\([^)]+\))?:?/- **♻️ Refactor** (\1):/g')
        elif echo "$line" | grep -q " perf"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) perf(\([^)]+\))?:?/- **⚡ Performance** (\1):/g')
        elif echo "$line" | grep -q " test"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) test(\([^)]+\))?:?/- **✅ Test** (\1):/g')
        elif echo "$line" | grep -q " build"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) build(\([^)]+\))?:?/- **🏗️ Build** (\1):/g')
        elif echo "$line" | grep -q " ci"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) ci(\([^)]+\))?:?/- **👷 CI** (\1):/g')
        elif echo "$line" | grep -q " chore"; then
          processed_line=$(echo "$line" | sed -E 's/- \(([a-f0-9]+)\) chore(\([^)]+\))?:?/- **🔧 Chore** (\1):/g')
        else
          processed_line="$line"
        fi
        
        processed_changelog="$processed_changelog$processed_line
"
      done <<< "$changelog"
      
      # Remove trailing newline and fix spacing issues
      changelog=$(echo "$processed_changelog" | sed -e 's/:  /: /g' | sed -e 's/[[:space:]]*$//')
    fi
  fi
  
  # Store or output the changelog
  if [ "$store" = "true" ]; then
    github_output_store "changelog" "${changelog}"
  else
    echo "${changelog}"
  fi
}

git_write_changelog() {
  local args_json=$(parse_arguments "$@")
  local version=$(echo "$args_json" | jq -r '.version // ""')
  local changes=$(echo "$args_json" | jq -r '.changes // ""')
  local changelog_file=${_MOCK_CHANGELOG_FILE:-CHANGELOG.md}
  
  if [ -z "$version" ]; then
    do_error "No version provided. Please specify --version"
  fi
  
  if [ -z "$changes" ]; then
    return 0
  fi

  # https://keepachangelog.com/en/1.1.0/
  [ -f $changelog_file ] || cat > $changelog_file <<EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
EOF

  [ -f $changelog_file ] && mv $changelog_file $changelog_file.bak
  cat > $changelog_file <<EOF
## [$version] - $(date +%Y-%m-%d)

$changes
EOF

  [ -f $changelog_file.bak ] && cat $changelog_file.bak >> $changelog_file && rm $changelog_file.bak
}

# Mock command execution for testing
_mock_command() {
  if [ "${GIT_MOCK_COMMANDS:-false}" = "true" ]; then
    echo "MOCK: $@" >> "${GIT_MOCK_OUTPUT:-/dev/null}"
    return 0
  else
    "$@"
  fi
}

git_create_version_branch() {
  local args_json=$(parse_arguments "$@")
  local version=$(echo "$args_json" | jq -r '.version // ""')
  local merge_branch=$(echo "$args_json" | jq -r '.merge_branch // ""')
  local pr_title=$(echo "$args_json" | jq -r '.pr_title // ""')
  local pr_message=$(echo "$args_json" | jq -r '.pr_message // ""')
  
  if [ -z "$version" ]; then
    do_error "No version provided. Please specify --version"
  fi

  if [ -z "$merge_branch" ]; then
    do_error "No merge branch provided. Please specify --merge-branch"
  fi
  
  if [ -z "$pr_title" ]; then
    do_error "No PR title provided. Please specify --pr-title"
  fi

  git_write_changelog --version "$version" --changes "$pr_message"
  
  local version_branch="release_branch_v${version//./_}"
  
  # Create branch locally - redirect output to /dev/null to suppress
  git checkout -b "$version_branch" > /dev/null 2>&1
  
  # Add all changes and commit - redirect output to suppress
  git add . > /dev/null 2>&1
  git commit -am "chore: ${pr_title}" > /dev/null 2>&1 || true
  
  # Push to remote - this operation is mockable
  _mock_command git push origin "$version_branch"
  
  # Create PR - this operation is mockable
  _mock_command gh pr create --base $merge_branch --head "$version_branch" \
    --title "${pr_title}" --body "${pr_message}"
    
  # Only return the branch name
  echo "$version_branch"
}

git_commit_version_changes() {
  local args_json=$(parse_arguments "$@")
  local version=$(echo "$args_json" | jq -r '.version // ""')
  local branch=$(echo "$args_json" | jq -r '.branch // ""')
  local title=$(echo "$args_json" | jq -r '.title // ""')
  local message=$(echo "$args_json" | jq -r '.message // ""')
  local changelog=$(echo "$args_json" | jq -r '.changelog // ""')
  local refresh_minor=$(echo "$args_json" | jq -r '.refresh_minor // "false"')
  
  if [ -z "$version" ]; then
    do_error "No version provided. Please specify --version."
  fi
  
  if [ -z "$title" ]; then
    do_error "No title provided. Please specify --title."
  fi

  if [ -z "$branch" ]; then
    do_error "No branch provided. Please specify --branch"
  fi

  if [ "$refresh_minor" == "true" ]; then
    refresh_minor=--refresh-minor
  else
    refresh_minor=""
  fi

  git_write_changelog --version "$version" --changes "$changelog"
  
  # Add all changes and commit
  git add . > /dev/null 2>&1
  git commit -am "chore: ${title} ${message}" > /dev/null 2>&1
  
  # Push to remote - mockable
  _mock_command git push origin $branch

  echo "Version $version committed"
}

git_create_tag() {
  local args_json=$(parse_arguments "$@")
  local version=$(echo "$args_json" | jq -r '.version // ""')
  local tag_message=$(echo "$args_json" | jq -r '.tag_message // ""')
  local refresh_minor=$(echo "$args_json" | jq -r '.refresh_minor // "false"')
  
  if [ -z "$version" ]; then
    do_error "No version provided. Please specify --version."
  fi
  
  if [ -z "$tag_message" ]; then
    do_error "No tag message provided. Please specify --tag-message."
  fi

  if git rev-parse "v$version" >/dev/null 2>&1; then
    # Delete existing tag instead of erroring, but only do it locally when in test mode
    if [ "${GIT_MOCK_COMMANDS:-false}" = "true" ]; then
      git tag -d "v$version" > /dev/null 2>&1
    else
      do_info "Tag v$version already exists, deleting it"
      git tag -d "v$version"
      git push origin :refs/tags/"v$version" || true
    fi
  fi
  
  # Create the tag locally
  git tag -a "v$version" -m "$tag_message" > /dev/null 2>&1
  
  # Push the tag to remote - mockable
  _mock_command git push origin "v$version"

  # If refresh_minor is true, also push the minor version tag
  if [ "$refresh_minor" = "true" ]; then
    local minor_version=$(echo "$version" | awk -F. '{print $1 "." $2}')
    if git rev-parse "v$minor_version" >/dev/null 2>&1; then
      # Delete existing tag instead of erroring, but only do it locally when in test mode
      if [ "${GIT_MOCK_COMMANDS:-false}" = "true" ]; then
        git tag -d "v$minor_version" > /dev/null 2>&1
      else
        # do_info "Tag v$minor_version already exists, deleting it"
        git tag -d "v$minor_version"
        git push origin :refs/tags/"v$minor_version" || true
        git fetch > /dev/null 2>&1
      fi
    fi
    
    # Create the tag locally
    git tag -a "v$minor_version" -m "$tag_message" > /dev/null 2>&1

    # Push the tag to remote - mockable
    _mock_command git push origin "v$minor_version"
  fi
  
  echo "v$version"
}