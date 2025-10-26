"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangelogService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_stream_1 = require("node:stream");
const Loggable_js_1 = require("../utils/Loggable.js");
class ChangelogService extends Loggable_js_1.Loggable {
    constructor() {
        super();
        this.log.info('ChangelogService initialized');
    }
    commitsToParseStream(commits) {
        const chunks = commits.map((c) => `${c.message}\n\n-hash-\n${c.sha}\n-----------------------\n`);
        return node_stream_1.Readable.from(chunks);
    }
    async parseGitCommits(commits, parserOpts) {
        const { parseCommitsStream } = await import('conventional-commits-parser');
        return new Promise((resolve, reject) => {
            const acc = [];
            this.commitsToParseStream(commits)
                .pipe(parseCommitsStream(parserOpts))
                .on('data', (commit) => {
                acc.push(commit);
            })
                .on('end', () => resolve(acc))
                .on('error', (err) => reject(err));
        });
    }
    commitsToWriteStream(commits) {
        const queue = [...commits];
        return new node_stream_1.Readable({
            objectMode: true,
            read() {
                if (queue.length === 0) {
                    this.push(null);
                    return;
                }
                this.push(queue.shift());
            },
        });
    }
    async parsedCommitsToChangelog(commits, writerOpts, context) {
        const { writeChangelogStream } = await import('conventional-changelog-writer');
        return new Promise((resolve, reject) => {
            const chunks = [];
            this.commitsToWriteStream(commits)
                .pipe(writeChangelogStream(context, writerOpts))
                .on('data', (buf) => {
                chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8'));
            })
                .on('end', () => resolve(chunks))
                .on('error', (err) => reject(err));
        });
    }
    async generateForWorkspace(options) {
        const { commits = [], preset = 'conventionalcommits', workspace, repository } = options;
        try {
            const presetModule = await import(`conventional-changelog-${preset}`);
            const createPreset = presetModule.default;
            const presetConfig = await createPreset();
            const parserOpts = presetConfig.parser || {};
            const writerOpts = presetConfig.writer || {};
            const parsedCommits = await this.parseGitCommits(commits, parserOpts);
            const context = this.buildContext({ workspace, repository });
            const changelogChunks = await this.parsedCommitsToChangelog(parsedCommits, writerOpts, context);
            const newContent = changelogChunks.join('');
            this.log.debug({ contentLength: newContent.length }, 'Changelog content generated');
            const changelogExists = await this.fileExists(options.changelogPath);
            this.log.debug({ changelogPath: options.changelogPath, exists: changelogExists }, 'Checked changelog existence');
            const existingChangelog = changelogExists ? await node_fs_1.promises.readFile(options.changelogPath, 'utf-8') : '';
            if (changelogExists) {
                this.log.debug({ changelogPath: options.changelogPath, existingLength: existingChangelog.length }, 'Read existing changelog');
            }
            let finalContent = this.mergeChangelogs(newContent, existingChangelog);
            if (options.childWorkspaces && options.childWorkspaces.length > 0) {
                const childSummary = this.generateChildWorkspaceSummary(options.childWorkspaces);
                finalContent = this.appendChildSummary(finalContent, childSummary, workspace.newVersion);
                this.log.debug({ childCount: options.childWorkspaces.length }, 'Appended child workspace summary');
            }
            await this.writeChangelog(options.changelogPath, finalContent);
            this.log.info({
                workspace: workspace.path,
                changelogPath: options.changelogPath,
                created: !changelogExists,
                contentLength: finalContent.length,
            }, 'Changelog generated successfully');
            return {
                content: finalContent,
                path: options.changelogPath,
                created: !changelogExists,
            };
        }
        catch (error) {
            const { FileOperationError } = await import('../utils/errors.js');
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log.error({
                workspace: workspace.path,
                changelogPath: options.changelogPath,
                error,
                errorMessage,
            }, 'Failed to generate changelog');
            throw new FileOperationError(options.changelogPath, 'generate', `Failed to generate changelog for ${workspace.path}: ${errorMessage}`, error);
        }
    }
    mergeChangelogs(newContent, existingContent) {
        if (!existingContent) {
            return this.ensureChangelogHeader(newContent);
        }
        const versionHeadingRegex = /^#{1,3}\s+\[?\d+\.\d+\.\d+/m;
        const headerMatch = existingContent.match(new RegExp(`^([\\s\\S]*?)(?=${versionHeadingRegex.source})`, 'm'));
        const existingHeader = headerMatch ? headerMatch[1].trim() : '';
        const bodyMatch = existingContent.match(new RegExp(`(${versionHeadingRegex.source}[\\s\\S]*)`, 'm'));
        const existingBody = bodyMatch ? bodyMatch[1] : existingContent;
        const newContentWithoutHeader = newContent.replace(/^#\s+.*?\n+/m, '').trim();
        const header = existingHeader || '# Changelog\n';
        return `${header}\n\n${newContentWithoutHeader}\n\n${existingBody}`.trim() + '\n';
    }
    ensureChangelogHeader(content) {
        if (content.startsWith('# Changelog') || content.startsWith('# CHANGELOG')) {
            return content;
        }
        return `# Changelog\n\n${content}`;
    }
    generateChildWorkspaceSummary(childWorkspaces) {
        const lines = ['### Child Workspaces', '', 'The following workspaces are included in this release:', ''];
        const allChildren = [];
        const collectWorkspaces = (nodes) => {
            for (const node of nodes) {
                allChildren.push(node.workspace);
                if (node.children.length > 0) {
                    collectWorkspaces(node.children);
                }
            }
        };
        collectWorkspaces(childWorkspaces);
        const sortedChildren = [...allChildren].sort((a, b) => a.path.localeCompare(b.path));
        for (const workspace of sortedChildren) {
            const changeIndicator = workspace.hasChanges ? '🔄' : '✓';
            lines.push(`- ${changeIndicator} \`${workspace.path}\` - v${workspace.newVersion}`);
        }
        lines.push('');
        return lines.join('\n');
    }
    appendChildSummary(content, summary, version) {
        const versionHeadingRegex = new RegExp(`^(#{1,3}\\s+\\[?${version.replace(/\./g, '\\.')}[^\\n]*\\n)`, 'm');
        const match = content.match(versionHeadingRegex);
        if (!match) {
            return `${summary}\n${content}`;
        }
        const headingEndIndex = match.index + match[0].length;
        return content.slice(0, headingEndIndex) + '\n' + summary + '\n' + content.slice(headingEndIndex);
    }
    async writeChangelog(changelogPath, content) {
        const dir = node_path_1.default.dirname(changelogPath);
        await node_fs_1.promises.mkdir(dir, { recursive: true });
        await node_fs_1.promises.writeFile(changelogPath, content, 'utf-8');
    }
    async fileExists(filePath) {
        try {
            await node_fs_1.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    buildContext({ workspace, repository }) {
        const date = new Date().toISOString().split('T')[0];
        return {
            version: workspace.newVersion,
            date,
            host: 'https://github.com',
            owner: repository.owner,
            repository: repository.repo,
            linkReferences: true,
            commitUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/commit/{{hash}}`,
            compareUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/compare/{{previousTag}}...{{currentTag}}`,
            issueUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/issues/{{id}}`,
            userUrlFormat: 'https://github.com/{{user}}',
        };
    }
}
exports.ChangelogService = ChangelogService;
//# sourceMappingURL=ChangelogService.js.map