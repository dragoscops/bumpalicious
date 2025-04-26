/**
 * @typedef {Object} Workspace
 * @property {string} path - Path to the workspace
 * @property {string} name - Name of the workspace
 * @property {string} type - Type of the workspace (node, python, etc.)
 * @property {string} version - Version of the workspace
 */

/**
 * Converts a workspace string to a Workspace object
 *
 * @param {string} workspace
 * @returns {Workspace}
 */
export function stringToWorkspace(workspace) {
  const splited = workspace.split(':');
  return {
    ...(splited.length > 0 ? {path: splited[0]} : {}),
    ...(splited.length > 1 ? {type: splited[1]} : {}),
    ...(splited.length > 2 ? {name: splited[2]} : {}),
    ...(splited.length > 3 ? {version: splited[3]} : {}),
  };
}
