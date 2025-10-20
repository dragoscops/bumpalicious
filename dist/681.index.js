"use strict";
exports.id = 681;
exports.ids = [681];
exports.modules = {

/***/ 6738:
/***/ ((module) => {


module.exports = function(val) {
  return Array.isArray(val) ? val : [val];
};


/***/ }),

/***/ 772:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


var arrayify = __webpack_require__(6738);
var dotPropGet = (__webpack_require__(8399).get);

function compareFunc(prop) {
  return function(a, b) {
    var ret = 0;

    arrayify(prop).some(function(el) {
      var x;
      var y;

      if (typeof el === 'function') {
        x = el(a);
        y = el(b);
      } else if (typeof el === 'string') {
        x = dotPropGet(a, el);
        y = dotPropGet(b, el);
      } else {
        x = a;
        y = b;
      }

      if (x === y) {
        ret = 0;
        return;
      }

      if (typeof x === 'string' && typeof y === 'string') {
        ret = x.localeCompare(y);
        return ret !== 0;
      }

      ret = x < y ? -1 : 1;
      return true;
    });

    return ret;
  };
}

module.exports = compareFunc;


/***/ }),

/***/ 8399:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {


const isObj = __webpack_require__(5200);

const disallowedKeys = [
	'__proto__',
	'prototype',
	'constructor'
];

const isValidPath = pathSegments => !pathSegments.some(segment => disallowedKeys.includes(segment));

function getPathSegments(path) {
	const pathArray = path.split('.');
	const parts = [];

	for (let i = 0; i < pathArray.length; i++) {
		let p = pathArray[i];

		while (p[p.length - 1] === '\\' && pathArray[i + 1] !== undefined) {
			p = p.slice(0, -1) + '.';
			p += pathArray[++i];
		}

		parts.push(p);
	}

	if (!isValidPath(parts)) {
		return [];
	}

	return parts;
}

module.exports = {
	get(object, path, value) {
		if (!isObj(object) || typeof path !== 'string') {
			return value === undefined ? object : value;
		}

		const pathArray = getPathSegments(path);
		if (pathArray.length === 0) {
			return;
		}

		for (let i = 0; i < pathArray.length; i++) {
			if (!Object.prototype.propertyIsEnumerable.call(object, pathArray[i])) {
				return value;
			}

			object = object[pathArray[i]];

			if (object === undefined || object === null) {
				// `object` is either `undefined` or `null` so we want to stop the loop, and
				// if this is not the last bit of the path, and
				// if it did't return `undefined`
				// it would return `null` if `object` is `null`
				// but we want `get({foo: null}, 'foo.bar')` to equal `undefined`, or the supplied value, not `null`
				if (i !== pathArray.length - 1) {
					return value;
				}

				break;
			}
		}

		return object;
	},

	set(object, path, value) {
		if (!isObj(object) || typeof path !== 'string') {
			return object;
		}

		const root = object;
		const pathArray = getPathSegments(path);

		for (let i = 0; i < pathArray.length; i++) {
			const p = pathArray[i];

			if (!isObj(object[p])) {
				object[p] = {};
			}

			if (i === pathArray.length - 1) {
				object[p] = value;
			}

			object = object[p];
		}

		return root;
	},

	delete(object, path) {
		if (!isObj(object) || typeof path !== 'string') {
			return false;
		}

		const pathArray = getPathSegments(path);

		for (let i = 0; i < pathArray.length; i++) {
			const p = pathArray[i];

			if (i === pathArray.length - 1) {
				delete object[p];
				return true;
			}

			object = object[p];

			if (!isObj(object)) {
				return false;
			}
		}
	},

	has(object, path) {
		if (!isObj(object) || typeof path !== 'string') {
			return false;
		}

		const pathArray = getPathSegments(path);
		if (pathArray.length === 0) {
			return false;
		}

		// eslint-disable-next-line unicorn/no-for-loop
		for (let i = 0; i < pathArray.length; i++) {
			if (isObj(object)) {
				if (!(pathArray[i] in object)) {
					return false;
				}

				object = object[pathArray[i]];
			} else {
				return false;
			}
		}

		return true;
	}
};


/***/ }),

/***/ 5200:
/***/ ((module) => {



module.exports = value => {
	const type = typeof value;
	return value !== null && (type === 'object' || type === 'function');
};


/***/ }),

/***/ 1176:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__.p + "d46f634465240fa353a3.js";

/***/ }),

/***/ 9681:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  DEFAULT_COMMIT_TYPES: () => (/* reexport */ DEFAULT_COMMIT_TYPES),
  "default": () => (/* binding */ createPreset)
});

;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/constants.js
const DEFAULT_COMMIT_TYPES = Object.freeze([
  {
    type: 'feat',
    section: 'Features'
  },
  {
    type: 'feature',
    section: 'Features'
  },
  {
    type: 'fix',
    section: 'Bug Fixes'
  },
  {
    type: 'perf',
    section: 'Performance Improvements'
  },
  {
    type: 'revert',
    section: 'Reverts'
  },
  {
    type: 'docs',
    section: 'Documentation',
    hidden: true
  },
  {
    type: 'style',
    section: 'Styles',
    hidden: true
  },
  {
    type: 'chore',
    section: 'Miscellaneous Chores',
    hidden: true
  },
  {
    type: 'refactor',
    section: 'Code Refactoring',
    hidden: true
  },
  {
    type: 'test',
    section: 'Tests',
    hidden: true
  },
  {
    type: 'build',
    section: 'Build System',
    hidden: true
  },
  {
    type: 'ci',
    section: 'Continuous Integration',
    hidden: true
  }
].map(Object.freeze))

;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/parser.js
function createParserOpts(config) {
  return {
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
    headerCorrespondence: [
      'type',
      'scope',
      'subject'
    ],
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
    revertCorrespondence: ['header', 'hash'],
    issuePrefixes: config?.issuePrefixes || ['#']
  }
}

// EXTERNAL MODULE: external "fs/promises"
var promises_ = __webpack_require__(1943);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
// EXTERNAL MODULE: external "url"
var external_url_ = __webpack_require__(7016);
// EXTERNAL MODULE: ./node_modules/compare-func/index.js
var compare_func = __webpack_require__(772);
;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/utils.js
function hasIntersection(a, b) {
  if (!a || !b) {
    return false
  }

  let listA = a
  let listB = b

  if (!Array.isArray(listA)) {
    listA = [listA]
  }

  if (!Array.isArray(listB)) {
    listB = [listB]
  }

  return listA.some(item => listB.includes(item))
}

function matchScope(config = {}, commit) {
  const {
    scope: targetScope,
    scopeOnly = false
  } = config
  const includesScope = hasIntersection(
    commit.scope?.split(','),
    targetScope
  )

  return !targetScope
    || (scopeOnly && includesScope)
    || (!scopeOnly && (!commit.scope || includesScope))
}

;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/writer.js







const dirname = (0,external_url_.fileURLToPath)(new URL(/* asset import */ __webpack_require__(1176), __webpack_require__.b))
const COMMIT_HASH_LENGTH = 7
const releaseAsRegex = /release-as:\s*\w*@?([0-9]+\.[0-9]+\.[0-9a-z]+(-[0-9a-z.]+)?)\s*/i
/**
 * Handlebar partials for various property substitutions based on commit context.
 */
const owner = '{{#if this.owner}}{{~this.owner}}{{else}}{{~@root.owner}}{{/if}}'
const host = '{{~@root.host}}'
const repository = '{{#if this.repository}}{{~this.repository}}{{else}}{{~@root.repository}}{{/if}}'

async function createWriterOpts(config) {
  const finalConfig = {
    types: DEFAULT_COMMIT_TYPES,
    issueUrlFormat: '{{host}}/{{owner}}/{{repository}}/issues/{{id}}',
    commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
    compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}',
    userUrlFormat: '{{host}}/{{user}}',
    issuePrefixes: ['#'],
    ...config
  }
  const commitUrlFormat = expandTemplate(finalConfig.commitUrlFormat, {
    host,
    owner,
    repository
  })
  const compareUrlFormat = expandTemplate(finalConfig.compareUrlFormat, {
    host,
    owner,
    repository
  })
  const issueUrlFormat = expandTemplate(finalConfig.issueUrlFormat, {
    host,
    owner,
    repository,
    id: '{{this.issue}}',
    prefix: '{{this.prefix}}'
  })
  const [
    template,
    header,
    commit,
    footer
  ] = await Promise.all([
    (0,promises_.readFile)((0,external_path_.resolve)(dirname, './templates/template.hbs'), 'utf-8'),
    (0,promises_.readFile)((0,external_path_.resolve)(dirname, './templates/header.hbs'), 'utf-8'),
    (0,promises_.readFile)((0,external_path_.resolve)(dirname, './templates/commit.hbs'), 'utf-8'),
    (0,promises_.readFile)((0,external_path_.resolve)(dirname, './templates/footer.hbs'), 'utf-8')
  ])
  const writerOpts = getWriterOpts(finalConfig)

  writerOpts.mainTemplate = template
  writerOpts.headerPartial = header
    .replace(/{{compareUrlFormat}}/g, compareUrlFormat)
  writerOpts.commitPartial = commit
    .replace(/{{commitUrlFormat}}/g, commitUrlFormat)
    .replace(/{{issueUrlFormat}}/g, issueUrlFormat)
  writerOpts.footerPartial = footer

  return writerOpts
}

function getWriterOpts(config) {
  const commitGroupOrder = config.types.flatMap(t => t.section).filter(t => t)

  return {
    transform: (commit, context) => {
      let discard = true
      const issues = []
      const entry = findTypeEntry(config.types, commit)

      // Add an entry in the CHANGELOG if special Release-As footer
      // is used:
      if ((commit.footer && releaseAsRegex.test(commit.footer))
        || (commit.body && releaseAsRegex.test(commit.body))) {
        discard = false
      }

      const notes = commit.notes.map((note) => {
        discard = false

        return {
          ...note,
          title: 'BREAKING CHANGES'
        }
      })

      if (
        // breaking changes attached to any type are still displayed.
        discard && (entry === undefined || entry.hidden)
        || !matchScope(config, commit)
      ) {
        return undefined
      }

      const type = entry
        ? entry.section
        : commit.type
      const scope = commit.scope === '*' || config.scope
        ? ''
        : commit.scope
      const shortHash = typeof commit.hash === 'string'
        ? commit.hash.substring(0, COMMIT_HASH_LENGTH)
        : commit.shortHash
      let { subject } = commit

      if (typeof subject === 'string') {
        // Issue URLs.
        const issueRegEx = `(${config.issuePrefixes.join('|')})([a-z0-9]+)`
        const re = new RegExp(issueRegEx, 'g')

        subject = subject.replace(re, (_, prefix, issue) => {
          issues.push(prefix + issue)

          const url = expandTemplate(config.issueUrlFormat, {
            host: context.host,
            owner: context.owner,
            repository: context.repository,
            id: issue,
            prefix
          })

          return `[${prefix}${issue}](${url})`
        })
        // User URLs.
        subject = subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, user) => {
          // TODO: investigate why this code exists.
          if (user.includes('/')) {
            return `@${user}`
          }

          const usernameUrl = expandTemplate(config.userUrlFormat, {
            host: context.host,
            owner: context.owner,
            repository: context.repository,
            user
          })

          return `[@${user}](${usernameUrl})`
        })
      }

      // remove references that already appear in the subject
      const references = commit.references.filter(reference => !issues.includes(reference.prefix + reference.issue))

      return {
        notes,
        type,
        scope,
        shortHash,
        subject,
        references
      }
    },
    groupBy: 'type',
    // the groupings of commit messages, e.g., Features vs., Bug Fixes, are
    // sorted based on their probable importance:
    commitGroupsSort: (a, b) => {
      const gRankA = commitGroupOrder.indexOf(a.title)
      const gRankB = commitGroupOrder.indexOf(b.title)

      return gRankA - gRankB
    },
    commitsSort: ['scope', 'subject'],
    noteGroupsSort: 'title',
    notesSort: compare_func
  }
}

function findTypeEntry(types, commit) {
  const typeKey = (commit.revert ? 'revert' : commit.type || '').toLowerCase()

  return types.find((entry) => {
    if (entry.type !== typeKey) {
      return false
    }

    if (entry.scope && entry.scope !== commit.scope) {
      return false
    }

    return true
  })
}

// expand on the simple mustache-style templates supported in
// configuration (we may eventually want to use handlebars for this).
function expandTemplate(template, context) {
  let expanded = template

  Object.keys(context).forEach((key) => {
    expanded = expanded.replace(new RegExp(`{{${key}}}`, 'g'), context[key])
  })
  return expanded
}

;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/whatBump.js



function createWhatBump(config = {}) {
  const {
    types = DEFAULT_COMMIT_TYPES,
    bumpStrict = false
  } = config
  const hiddenTypes = bumpStrict && types.reduce((hiddenTypes, type) => {
    if (type.hidden) {
      hiddenTypes.push(type.type)
    }

    return hiddenTypes
  }, [])

  return function whatBump(commits) {
    let level = 2
    let breakings = 0
    let features = 0
    let bugfixes = 0

    commits.forEach((commit) => {
      if (!matchScope(config, commit)) {
        return
      }

      if (commit.notes.length > 0) {
        breakings += commit.notes.length
        level = 0
      } else
        if (commit.type === 'feat' || commit.type === 'feature') {
          features += 1

          if (level === 2) {
            level = 1
          }
        } else
          if (bumpStrict && !hiddenTypes.includes(commit.type)) {
            bugfixes += 1
          }
    })

    if (config?.preMajor && level < 2) {
      level++
    } else
      if (bumpStrict && level === 2 && !breakings && !features && !bugfixes) {
        return null
      }

    return {
      level,
      reason: breakings === 1
        ? `There is ${breakings} BREAKING CHANGE and ${features} features`
        : `There are ${breakings} BREAKING CHANGES and ${features} features`
    }
  }
}

;// CONCATENATED MODULE: ./node_modules/conventional-changelog-conventionalcommits/src/index.js







async function createPreset(config) {
  return {
    commits: {
      ignore: config?.ignoreCommits,
      merges: false
    },
    parser: createParserOpts(config),
    writer: await createWriterOpts(config),
    whatBump: createWhatBump(config)
  }
}


/***/ })

};
;