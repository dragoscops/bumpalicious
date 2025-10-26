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
    async generateForWorkspace(options) {
        try {
            const fileExisted = await this.fileExists(options.changelogPath);
            const existingContent = await this.readExistingChangelog(options.changelogPath);
            const newContent = await this.generateNewContent(options);
            const finalContent = await this.buildFinalContent(newContent, existingContent, options);
            await this.writeChangelog(options.changelogPath, finalContent);
            return this.buildResult(options.changelogPath, finalContent, !fileExisted);
        }
        catch (error) {
            throw await this.handleError(error, options);
        }
    }
    async generateNewContent(options) {
        const { commits = [], preset = 'conventionalcommits', workspace, repository } = options;
        const { parserOpts, writerOpts } = await this.loadPreset(preset);
        const parsedCommits = await this.parseGitCommits(commits, parserOpts);
        const context = this.buildContext({ workspace, repository });
        const chunks = await this.parsedCommitsToChangelog(parsedCommits, writerOpts, context);
        return chunks.join('');
    }
    async loadPreset(preset) {
        const presetModule = await import(`conventional-changelog-${preset}`);
        const config = await presetModule.default();
        return {
            parserOpts: config.parser || {},
            writerOpts: config.writer || {},
        };
    }
    async parseGitCommits(commits, parserOpts) {
        const { parseCommitsStream } = await import('conventional-commits-parser');
        const acc = [];
        return new Promise((resolve, reject) => {
            this.commitsToParseStream(commits)
                .pipe(parseCommitsStream(parserOpts))
                .on('data', (commit) => acc.push(commit))
                .on('end', () => resolve(acc))
                .on('error', reject);
        });
    }
    commitsToParseStream(commits) {
        const chunks = commits.map((c) => `${c.message}\n\n-hash-\n${c.sha}\n-----------------------\n`);
        return node_stream_1.Readable.from(chunks);
    }
    buildContext({ workspace, repository }) {
        const baseUrl = `https://github.com/${repository.owner}/${repository.repo}`;
        return {
            version: workspace.newVersion,
            date: new Date().toISOString().split('T')[0],
            host: 'https://github.com',
            owner: repository.owner,
            repository: repository.repo,
            linkReferences: true,
            commitUrlFormat: `${baseUrl}/commit/{{hash}}`,
            compareUrlFormat: `${baseUrl}/compare/{{previousTag}}...{{currentTag}}`,
            issueUrlFormat: `${baseUrl}/issues/{{id}}`,
            userUrlFormat: 'https://github.com/{{user}}',
        };
    }
    async parsedCommitsToChangelog(commits, writerOpts, context) {
        const { writeChangelogStream } = await import('conventional-changelog-writer');
        const chunks = [];
        return new Promise((resolve, reject) => {
            this.commitsToWriteStream(commits)
                .pipe(writeChangelogStream(context, writerOpts))
                .on('data', (buf) => chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8')))
                .on('end', () => resolve(chunks))
                .on('error', reject);
        });
    }
    commitsToWriteStream(commits) {
        const queue = [...commits];
        return new node_stream_1.Readable({
            objectMode: true,
            read() {
                this.push(queue.length === 0 ? null : queue.shift());
            },
        });
    }
    async readExistingChangelog(changelogPath) {
        const exists = await this.fileExists(changelogPath);
        return exists ? await node_fs_1.promises.readFile(changelogPath, 'utf-8') : '';
    }
    async buildFinalContent(newContent, existingContent, options) {
        let content = this.mergeChangelogs(newContent, existingContent);
        if (options.childWorkspaces?.length) {
            const summary = this.generateChildWorkspaceSummary(options.childWorkspaces);
            content = this.appendChildSummary(content, summary, options.workspace.newVersion);
        }
        return content;
    }
    mergeChangelogs(newContent, existingContent) {
        if (!existingContent)
            return this.ensureChangelogHeader(newContent);
        const { header, body } = this.splitChangelog(existingContent);
        const newWithoutHeader = newContent.replace(/^#\s+.*?\n+/m, '').trim();
        return `${header}\n\n${newWithoutHeader}\n\n${body}`.trim() + '\n';
    }
    splitChangelog(content) {
        const versionRegex = /^#{1,3}\s+\[?\d+\.\d+\.\d+/m;
        const headerMatch = content.match(new RegExp(`^([\\s\\S]*?)(?=${versionRegex.source})`, 'm'));
        const bodyMatch = content.match(new RegExp(`(${versionRegex.source}[\\s\\S]*)`, 'm'));
        return {
            header: headerMatch?.[1].trim() || '# Changelog\n',
            body: bodyMatch?.[1] || content,
        };
    }
    ensureChangelogHeader(content) {
        return content.match(/^# CHANGELOG/i) ? content : `# Changelog\n\n${content}`;
    }
    generateChildWorkspaceSummary(childWorkspaces) {
        const workspaces = this.collectAllWorkspaces(childWorkspaces).sort((a, b) => a.path.localeCompare(b.path));
        const lines = [
            '### Child Workspaces',
            '',
            'The following workspaces are included in this release:',
            '',
            ...workspaces.map((w) => `- ${w.hasChanges ? '🔄' : '✓'} \`${w.path}\` - v${w.newVersion}`),
            '',
        ];
        return lines.join('\n');
    }
    collectAllWorkspaces(nodes) {
        const result = [];
        for (const node of nodes) {
            result.push(node.workspace);
            if (node.children.length) {
                result.push(...this.collectAllWorkspaces(node.children));
            }
        }
        return result;
    }
    appendChildSummary(content, summary, version) {
        const regex = new RegExp(`^(#{1,3}\\s+\\[?${version.replace(/\./g, '\\.')}[^\\n]*\\n)`, 'm');
        const match = content.match(regex);
        if (!match)
            return `${summary}\n${content}`;
        const insertPos = match.index + match[0].length;
        return content.slice(0, insertPos) + '\n' + summary + '\n' + content.slice(insertPos);
    }
    async writeChangelog(changelogPath, content) {
        await node_fs_1.promises.mkdir(node_path_1.default.dirname(changelogPath), { recursive: true });
        await node_fs_1.promises.writeFile(changelogPath, content, 'utf-8');
    }
    buildResult(path, content, created) {
        this.log.info({ path, created, contentLength: content.length }, 'Changelog generated');
        return { content, path, created };
    }
    async handleError(error, options) {
        const { FileOperationError } = await import('../utils/errors.js');
        const message = error instanceof Error ? error.message : String(error);
        this.log.error({ workspace: options.workspace.path, error }, 'Changelog generation failed');
        throw new FileOperationError(options.changelogPath, 'generate', `Failed to generate changelog for ${options.workspace.path}: ${message}`, error);
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
}
exports.ChangelogService = ChangelogService;
//# sourceMappingURL=ChangelogService.js.map