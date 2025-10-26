"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionService = void 0;
const semver_1 = __importDefault(require("semver"));
const version_js_1 = require("../types/version.js");
const errors_js_1 = require("../utils/errors.js");
const Loggable_js_1 = require("../utils/Loggable.js");
class VersionService extends Loggable_js_1.Loggable {
    constructor() {
        super();
        this.log.info('VersionService initialized');
    }
    calculateNewVersion(currentVersion, analysis) {
        this.log.debug({
            currentVersion,
            bumpType: analysis.type,
            breaking: analysis.breaking,
            preRelease: analysis.preRelease,
            message: analysis.message?.substring(0, 100),
        }, 'Calculating new version');
        if (!(0, version_js_1.isVersion)(currentVersion)) {
            this.log.error({ currentVersion }, 'Invalid current version format');
            throw new errors_js_1.VersionCalculationError(`Invalid version format: ${currentVersion}`);
        }
        const current = (0, version_js_1.toVersion)(currentVersion);
        const { type, breaking, preRelease } = analysis;
        try {
            const effectiveBumpType = breaking ? 'major' : type;
            if (preRelease) {
                return this.calculatePreReleaseVersion(current, effectiveBumpType, preRelease);
            }
            const newVersion = this.increaseVersion(current, effectiveBumpType);
            this.log.info({
                current,
                new: newVersion,
                bumpType: effectiveBumpType,
            }, 'Version calculated successfully');
            return newVersion;
        }
        catch (error) {
            this.log.error({
                current,
                bumpType: type,
                breaking,
                preRelease,
                error,
            }, 'Failed to calculate new version');
            throw new errors_js_1.VersionCalculationError(`Failed to calculate version from ${current}`, error);
        }
    }
    increaseVersion(currentVersion, bumpType) {
        this.log.debug({
            currentVersion,
            bumpType,
        }, 'Increasing version');
        const semverBumpType = bumpType === 'pre-release' ? 'patch' : bumpType;
        const newVersion = semver_1.default.inc(currentVersion, semverBumpType);
        if (!newVersion) {
            throw new errors_js_1.VersionCalculationError(`Failed to increment version ${currentVersion} with bump type ${bumpType}`);
        }
        if (!(0, version_js_1.isVersion)(newVersion)) {
            throw new errors_js_1.VersionCalculationError(`Calculated version ${newVersion} is not a valid semantic version`);
        }
        return (0, version_js_1.toVersion)(newVersion);
    }
    calculatePreReleaseVersion(currentVersion, bumpType, preReleaseId) {
        const parsed = semver_1.default.parse(currentVersion);
        if (!parsed) {
            throw new errors_js_1.VersionCalculationError(`Failed to parse version: ${currentVersion}`);
        }
        const currentPreRelease = parsed.prerelease;
        const hasPreRelease = currentPreRelease.length > 0;
        const currentPreReleaseId = hasPreRelease ? currentPreRelease[0] : null;
        const currentPreReleaseNum = hasPreRelease && typeof currentPreRelease[1] === 'number' ? currentPreRelease[1] : -1;
        this.log.debug({
            currentVersion,
            currentPreReleaseId,
            currentPreReleaseNum,
            requestedPreReleaseId: preReleaseId,
            hasPreRelease,
        }, 'Analyzing pre-release version');
        if (hasPreRelease && currentPreReleaseId === preReleaseId) {
            const nextPreReleaseNum = currentPreReleaseNum + 1;
            const newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-${preReleaseId}.${nextPreReleaseNum}`;
            if (!(0, version_js_1.isVersion)(newVersion)) {
                throw new errors_js_1.VersionCalculationError(`Generated invalid pre-release version: ${newVersion}`);
            }
            this.log.info({
                current: currentVersion,
                new: newVersion,
                preReleaseId,
                preReleaseNum: nextPreReleaseNum,
            }, 'Incremented pre-release number');
            return (0, version_js_1.toVersion)(newVersion);
        }
        const semverBumpType = bumpType === 'pre-release' ? 'patch' : bumpType;
        const bumpedVersion = semver_1.default.inc(currentVersion, semverBumpType);
        if (!bumpedVersion) {
            throw new errors_js_1.VersionCalculationError(`Failed to bump version ${currentVersion} with type ${bumpType} for pre-release`);
        }
        const newVersion = `${bumpedVersion}-${preReleaseId}.0`;
        if (!(0, version_js_1.isVersion)(newVersion)) {
            throw new errors_js_1.VersionCalculationError(`Generated invalid pre-release version: ${newVersion}`);
        }
        this.log.info({
            current: currentVersion,
            new: newVersion,
            baseVersionBumped: bumpedVersion,
            preReleaseId,
        }, 'Created new pre-release version');
        return (0, version_js_1.toVersion)(newVersion);
    }
}
exports.VersionService = VersionService;
//# sourceMappingURL=VersionService.js.map