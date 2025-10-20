"use strict";
exports.id = 764;
exports.ids = [764];
exports.modules = {

/***/ 2764:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* HELPERS */
const stringOrCommentRe = /("(?:\\?[^])*?")|(\/\/.*)|(\/\*[^]*?\*\/)/g;
const stringOrTrailingCommaRe = /("(?:\\?[^])*?")|(,\s*)(?=]|})/g;
/* MAIN */
const JSONC = {
    parse: (text) => {
        text = String(text); // To be extra safe
        try { // Fast path for valid JSON
            return JSON.parse(text);
        }
        catch { // Slow path for JSONC and invalid inputs
            return JSON.parse(text.replace(stringOrCommentRe, '$1').replace(stringOrTrailingCommaRe, '$1'));
        }
    }
};
/* EXPORT */
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (JSONC);


/***/ })

};
;