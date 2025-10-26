"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConventionalCommit = parseConventionalCommit;
exports.parseCommitMessages = parseCommitMessages;
const logger_js_1 = require("../utils/logger.js");
const childLogger = logger_js_1.logger.child({ parser: 'ConventionalCommit' });
const BUMP_TYPES = {
    feat: 'minor',
    fix: 'patch',
};
const NON_BUMP_TYPES = new Set(['chore', 'docs', 'style', 'refactor', 'test', 'perf', 'ci', 'build', 'revert']);
const VALID_PRE_RELEASE_IDENTIFIERS = new Set(['alpha', 'beta', 'rc']);
const CONVENTIONAL_COMMIT_REGEX = /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?\s*:\s*(?<description>.+)$/s;
const PRE_RELEASE_REGEX = /\bpre-release:(alpha|beta|rc)\b/i;
const BREAKING_CHANGE_FOOTER_REGEX = /^BREAKING[- ]CHANGE:\s+.+/im;
function parseConventionalCommit(message) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
        return null;
    }
    const match = CONVENTIONAL_COMMIT_REGEX.exec(trimmedMessage);
    if (!match || !match.groups) {
        return null;
    }
    const { type, scope, breaking } = match.groups;
    const hasBreakingFooter = BREAKING_CHANGE_FOOTER_REGEX.test(trimmedMessage);
    const isBreaking = breaking === '!' || hasBreakingFooter;
    const preReleaseMatch = PRE_RELEASE_REGEX.exec(trimmedMessage);
    const preReleaseIdentifier = preReleaseMatch ? preReleaseMatch[1].toLowerCase() : undefined;
    if (preReleaseIdentifier && !VALID_PRE_RELEASE_IDENTIFIERS.has(preReleaseIdentifier)) {
        return null;
    }
    let bumpType;
    if (isBreaking) {
        bumpType = 'major';
    }
    else if (type in BUMP_TYPES) {
        bumpType = BUMP_TYPES[type];
    }
    else if (NON_BUMP_TYPES.has(type)) {
        return null;
    }
    else {
        return null;
    }
    return {
        type: bumpType,
        breaking: isBreaking,
        scope: scope || undefined,
        preRelease: preReleaseIdentifier,
        message: trimmedMessage,
    };
}
function parseCommitMessages(messages) {
    childLogger.debug({ messageCount: messages.length }, 'Parsing commit messages');
    if (messages.length === 0) {
        childLogger.debug('No messages to parse');
        return null;
    }
    let highestBump = null;
    let hasBreaking = false;
    let preRelease;
    const scopes = new Set();
    const validAnalyses = [];
    for (const message of messages) {
        const analysis = parseConventionalCommit(message);
        if (!analysis) {
            continue;
        }
        validAnalyses.push(analysis);
        if (analysis.breaking) {
            hasBreaking = true;
        }
        if (analysis.scope) {
            scopes.add(analysis.scope);
        }
        if (analysis.preRelease) {
            preRelease = analysis.preRelease;
        }
        if (analysis.type === 'major') {
            highestBump = 'major';
        }
        else if (analysis.type === 'minor' && highestBump !== 'major') {
            highestBump = 'minor';
        }
        else if (analysis.type === 'patch' && !highestBump) {
            highestBump = 'patch';
        }
    }
    if (!highestBump || validAnalyses.length === 0) {
        return null;
    }
    return {
        type: highestBump,
        breaking: hasBreaking,
        scope: scopes.size > 0 ? Array.from(scopes).join(', ') : undefined,
        preRelease,
        message: `Combined analysis of ${validAnalyses.length} commit(s)`,
    };
}
//# sourceMappingURL=ConventionalCommitParser.js.map