"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdapter = getAdapter;
exports.getSupportedTypes = getSupportedTypes;
exports.isTypeSupported = isTypeSupported;
exports.clearAdapterCache = clearAdapterCache;
const DenoAdapter_js_1 = require("./DenoAdapter.js");
const GoAdapter_js_1 = require("./GoAdapter.js");
const NodeAdapter_js_1 = require("./NodeAdapter.js");
const PythonAdapter_js_1 = require("./PythonAdapter.js");
const RustAdapter_js_1 = require("./RustAdapter.js");
const TextAdapter_js_1 = require("./TextAdapter.js");
const ZigAdapter_js_1 = require("./ZigAdapter.js");
const errors_js_1 = require("../../utils/errors.js");
const adapterInstances = {};
const adapterFactories = {
    node: () => new NodeAdapter_js_1.NodeAdapter(),
    python: () => new PythonAdapter_js_1.PythonAdapter(),
    deno: () => new DenoAdapter_js_1.DenoAdapter(),
    go: () => new GoAdapter_js_1.GoAdapter(),
    rust: () => new RustAdapter_js_1.RustAdapter(),
    zig: () => new ZigAdapter_js_1.ZigAdapter(),
    text: () => new TextAdapter_js_1.TextAdapter(),
};
function getAdapter(type) {
    if (adapterInstances[type]) {
        return adapterInstances[type];
    }
    const factory = adapterFactories[type];
    if (!factory) {
        throw new errors_js_1.InvalidConfigurationError('workspaceType', `Unsupported workspace type: ${type}. Supported types: ${Object.keys(adapterFactories).join(', ')}`);
    }
    const adapter = factory();
    adapterInstances[type] = adapter;
    return adapter;
}
function getSupportedTypes() {
    return Object.keys(adapterFactories);
}
function isTypeSupported(type) {
    return type in adapterFactories;
}
function clearAdapterCache() {
    for (const key of Object.keys(adapterInstances)) {
        delete adapterInstances[key];
    }
}
//# sourceMappingURL=AdapterFactory.js.map