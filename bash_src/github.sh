function github_output_store() {
    local output_key="$1"
    local output_value="$2"

    if [ -z "$output_key" ]; then
        do_error "GITHUB_OUTPUT key is empty. Please use 'github_output_store <key> <value>'"
    fi

    if [ -z "$output_value" ]; then
        # If second argument is empty, read from stdin (pipe)
        if [ ! -t 0 ]; then  # Check if stdin is a pipe
            output_value=$(cat)
        fi
    fi

    if [ -z "$output_value" ]; then
        do_error "GITHUB_OUTPUT value is empty. Please use 'github_output_store <key> <value>' or 'echo \"<value>\" | github_output_store <key>'"
    fi

    # Debug print to see what's going to be stored
    echo "${output_key}=${output_value}"
    
    # Write to GITHUB_OUTPUT using the multi-line syntax
    {
        echo "${output_key}<<EOF"
        echo "${output_value}"
        echo "EOF"
    } >> "${GITHUB_OUTPUT:-/dev/null}"
}