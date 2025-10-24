import { join } from 'node:path';
import { ChangelogService } from '../src/core/ChangelogService.js';
import { GitHubService } from '../src/services/GitHubService';
import { GitService } from '../src/services/GitService.js';
import { toVersion } from '../src/types/version.js';

async function run() {
  const gitService = new GitService(
    new GitHubService(process.env.GH_TOKEN as string, {
      repository: {
        owner: 'dragoscops',
        repo: 'bumpalicious',
      },
    }),
  );
  const changelogService = new ChangelogService();

  const lastTagResponse = await gitService.getLastTag();
  if (!lastTagResponse.ok) {
    console.error('Failed to get last tag:', lastTagResponse.error);
    return;
  }
  const lastTag = lastTagResponse.value;

  const commitsResponse = await gitService.getCommitsSince(lastTag?.sha as string);
  if (!commitsResponse.ok) {
    console.error('Failed to get commits since last tag:', commitsResponse.error);
    return;
  }
  const commits = commitsResponse.value;
  // console.log(commits);

  await changelogService.generateForWorkspace({
    commits,
    // preset: 'conventionalcommits',
    // preset: 'angular',
    preset: 'eslint',
    // preset: 'atom',
    workspace: {
      name: 'bumpalicious',
      path: '.',
      type: 'node',
      version: toVersion('99.0.0'),
      hasChanges: true,
      changedFiles: [],
      newVersion: toVersion('100.0.0'),
    },
    changelogPath: join(process.cwd(), 'CHANGELOG.md'),
    repository: {
      owner: 'dragoscops',
      repo: 'bumpalicious',
    },
    lastTag: lastTag?.sha as string,
  });
}

run();
