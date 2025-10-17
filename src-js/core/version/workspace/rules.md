# Project Name and Version Detection Rules

## Core Rules

1. **Project Name Fallback**:
   - If project name is not present in any configuration file, use the directory name (basename) as the project name
   - Example: All implementations use `path.basename(projectPath)` as fallback

2. **Version Sources Hierarchy**:
   - When multiple files can contain version information, establish clear precedence
   - Example: In Zig, build.zig.zon takes precedence over build.zig
   - Log warnings when inconsistent versions are found in different files

3. **Error Logging**:
   - If no version is detected after checking all sources, always log an error
   - Include the project path in the error message for clarity

4. **Default Values**:
   - Use constants for default values when necessary
   - Example: DEFAULT_VERSION is used in several implementations

## Implementation Patterns

1. **File Independence**:
   - Most implementations treat configuration files as independent
   - They check multiple files in sequence until a version is found
   - For updates, attempt to update all relevant files to maintain consistency

2. **Validation Helper Functions**:
   - Use helper functions to check validity of detected values
   - Example: `isValidString()` in Zig implementation checks for null/undefined/empty values

3. **Detection Flow**:
   - Start with primary configuration files
   - Fall back to specialized version files
   - As last resort, check source code for constants/patterns
   - Exit with error if nothing is found

4. **Update Consistency**:
   - When updating versions, attempt to update all files that might contain version info
   - Log which files were successfully updated
   - If some but not all files were updated, warn about potential inconsistency

## Language-Specific Particularities

1. **File Format Handling**:
   - JSON: Direct parsing (Node.js, partial Deno)
   - JSONC: Special parser (Deno)
   - TOML: Special parser (Rust)
   - Source code: Regex patterns (Zig, Go)

2. **Version Patterns**:
   - Config files: Dedicated version fields
   - Go: Comments in go.mod, constants in version.go files
   - Zig: Multiple patterns for detecting version in build files

3. **Context Preservation**:
   - Preserve file structure and formatting during updates
   - For complex files, use appropriate parsers
   - For text files, use regex replacements that maintain context
