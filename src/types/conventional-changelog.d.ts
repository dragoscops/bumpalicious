/**
 * Type declarations for conventional-changelog presets
 */

declare module 'conventional-changelog-conventionalcommits' {
  import type { Options } from 'conventional-changelog-core';

  interface PresetConfig {
    commitUrlFormat?: string;
    compareUrlFormat?: string;
    issueUrlFormat?: string;
    userUrlFormat?: string;
    types?: Array<{
      type: string;
      section?: string;
      hidden?: boolean;
      scope?: string;
    }>;
    issuePrefixes?: string[];
    ignoreCommits?: (commit: unknown) => boolean;
    scope?: string;
  }

  const config: (config?: PresetConfig) => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-angular' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-atom' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-codemirror' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-ember' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-eslint' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-express' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-jquery' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}

declare module 'conventional-changelog-jshint' {
  import type { Options } from 'conventional-changelog-core';
  const config: () => Promise<Options.Config>;
  export default config;
}
