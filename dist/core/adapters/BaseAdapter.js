"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWorkspaceAdapter = void 0;
const FileParser_js_1 = require("../../parsers/FileParser.js");
const FileUpdater_js_1 = require("../../parsers/FileUpdater.js");
class BaseWorkspaceAdapter {
    async parseFile(filePath, config) {
        return (0, FileParser_js_1.configParser)(filePath, config);
    }
    async updateFile(filePath, newVersion, config) {
        return (0, FileUpdater_js_1.configUpdater)(filePath, newVersion, config);
    }
}
exports.BaseWorkspaceAdapter = BaseWorkspaceAdapter;
//# sourceMappingURL=BaseAdapter.js.map