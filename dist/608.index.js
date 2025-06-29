export const id = 608;
export const ids = [608];
export const modules = {

/***/ 8608:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  findPackage: () => (/* binding */ findPackage),
  findPackagePath: () => (/* binding */ findPackagePath),
  findPackagePathSync: () => (/* binding */ findPackagePathSync),
  findPackageSync: () => (/* binding */ findPackageSync)
});

// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
;// CONCATENATED MODULE: ./node_modules/walk-up-path/dist/mjs/index.js

const walkUp = function* (path) {
    for (path = (0,external_path_.resolve)(path); path;) {
        yield path;
        const pp = (0,external_path_.dirname)(path);
        if (pp === path) {
            break;
        }
        else {
            path = pp;
        }
    }
};
//# sourceMappingURL=index.js.map
// EXTERNAL MODULE: external "node:path"
var external_node_path_ = __webpack_require__(6760);
// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(1455);
// EXTERNAL MODULE: external "node:fs"
var external_node_fs_ = __webpack_require__(3024);
;// CONCATENATED MODULE: ./node_modules/fd-package-json/dist/esm/main.js




/**
 * Determines if a file exists or not
 * @param {string} path Path of the file
 * @return {Promise<boolean>}
 */
async function fileExists(path) {
    try {
        const stats = await (0,promises_.stat)(path);
        return stats.isFile();
    }
    catch (_err) {
        return false;
    }
}
/**
 * Synchronously determines if a file exists or not
 * @param {string} path Path of the file
 * @return {boolean}
 */
function fileExistsSync(path) {
    try {
        const stats = (0,external_node_fs_.statSync)(path);
        return stats.isFile();
    }
    catch (_err) {
        return false;
    }
}
/**
 * Finds the path of the first `package.json` encountered when traversing
 * the file system upwards from the specified `cwd`.
 * @param {string} cwd Current/starting directory
 * @return {Promise<string|null>}
 */
async function findPackagePath(cwd) {
    for (const path of walkUp(cwd)) {
        const packagePath = (0,external_node_path_.resolve)(path, 'package.json');
        const hasPackageJson = await fileExists(packagePath);
        if (hasPackageJson) {
            return packagePath;
        }
    }
    return null;
}
/**
 * Finds and returns the contents of the first `package.json` encountered
 * when traversing the file system upwards from the specified `cwd`.
 * @param {string} cwd Current/starting directory
 * @return {Promise<Package | null>}
 */
async function findPackage(cwd) {
    const packagePath = await findPackagePath(cwd);
    if (!packagePath) {
        return null;
    }
    try {
        const source = await (0,promises_.readFile)(packagePath, { encoding: 'utf8' });
        return JSON.parse(source);
    }
    catch (_err) {
        return null;
    }
}
/**
 * Synchronously Finds the path of the first `package.json` encountered when
 * traversing the file system upwards from the specified `cwd`.
 * @param {string} cwd Current/starting directory
 * @return {string|null}
 */
function findPackagePathSync(cwd) {
    for (const path of walkUp(cwd)) {
        const packagePath = (0,external_node_path_.resolve)(path, 'package.json');
        const hasPackageJson = fileExistsSync(packagePath);
        if (hasPackageJson) {
            return packagePath;
        }
    }
    return null;
}
/**
 * Synchronously finds and returns the contents of the first `package.json`
 * encountered when traversing the file system upwards from the specified `cwd`.
 * @param {string} cwd Current/starting directory
 * @return {Package | null}
 */
function findPackageSync(cwd) {
    const packagePath = findPackagePathSync(cwd);
    if (!packagePath) {
        return null;
    }
    try {
        const source = (0,external_node_fs_.readFileSync)(packagePath, { encoding: 'utf8' });
        return JSON.parse(source);
    }
    catch (_err) {
        return null;
    }
}


/***/ })

};
