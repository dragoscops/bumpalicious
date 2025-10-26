"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loggable = void 0;
const logger_js_1 = require("./logger.js");
class Loggable {
    log;
    constructor() {
        this.log = logger_js_1.logger.child({ class: this.constructor.name });
    }
}
exports.Loggable = Loggable;
//# sourceMappingURL=Loggable.js.map