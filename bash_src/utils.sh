#!/usr/bin/env bash

export SED_I_CMD="sed -i"
uname -a | grep Darwin > /dev/null && export SED_I_CMD="sed -i ''"

fail_at_missing_command() {
  local command="$1"

  if ! command -v "$command" >/dev/null; then
    do_error "'$command' application is missing"
  fi
}

which_python() {
  if command -v "python3" >/dev/null; then
    echo python3
    return
  fi
  if command -v "python" >/dev/null; then
    echo python
    return
  fi
}

# Parse command line arguments into a JSON string
# Usage: args_json=$(parse_arguments "$@")
parse_arguments() {
  # Check if jq is available
  fail_at_missing_command "jq"
  
  # Initialize an empty JSON object
  local json="{}"
  local positional_args=()
  
  while [[ "$#" -gt 0 ]]; do
    case $1 in
      --*)
        # Handle --option value pairs
        local key="${1:2}" # Remove leading --
        # Convert hyphens to underscores in key
        local key="${key//-/_}"
        
        if [[ "$#" -gt 1 && ! "$2" == --* && ! "$2" == -* ]]; then
          # Add key-value pair to JSON
          local value="$2"
          # Use printf to handle special characters consistently across systems
          json=$(printf '%s' "$json" | jq --arg k "$key" --arg v "$value" '. + {($k): $v}')
          shift
        else
          # It's a flag (--flag) with no value
          json=$(printf '%s' "$json" | jq --arg k "$key" '. + {($k): true}')
        fi
        ;;
      -*)
        # Handle short options (-h, -v)
        local key="${1:1}" # Remove leading -
        # Convert hyphens to underscores in key
        local key="${key//-/_}"
        
        if [[ "$#" -gt 1 && ! "$2" == --* && ! "$2" == -* ]]; then
          # Add key-value pair to JSON
          local value="$2"
          json=$(printf '%s' "$json" | jq --arg k "$key" --arg v "$value" '. + {($k): $v}')
          shift
        else
          # It's a flag (-h) with no value
          json=$(printf '%s' "$json" | jq --arg k "$key" '. + {($k): true}')
        fi
        ;;
      *)
        # Store positional arguments for later processing
        positional_args+=("$1")
        ;;
    esac
    shift
  done
  
  # Add positional arguments if they exist
  if [[ ${#positional_args[@]} -gt 0 ]]; then
    # Create a JSON array from positional arguments
    local pos_array="["
    local first=true
    for arg in "${positional_args[@]}"; do
      if [[ "$first" == "true" ]]; then
        first=false
      else
        pos_array+=","
      fi
      # Properly escape quotes in the argument
      arg="${arg//\"/\\\"}"
      pos_array+="\"$arg\""
    done
    pos_array+="]"
    
    # Add positional array to the JSON object
    json=$(printf '%s' "$json" | jq --argjson pos "$pos_array" '. + {"positional": $pos}')
  fi
  
  echo "$json" | jq -c .
}
