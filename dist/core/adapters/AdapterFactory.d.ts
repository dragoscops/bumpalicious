import type { BaseWorkspaceAdapter } from './BaseAdapter.js';
import type { WorkspaceType } from '../../types/index.js';
export declare function getAdapter(type: WorkspaceType): BaseWorkspaceAdapter;
export declare function getSupportedTypes(): ReadonlyArray<WorkspaceType>;
export declare function isTypeSupported(type: string): type is WorkspaceType;
export declare function clearAdapterCache(): void;
//# sourceMappingURL=AdapterFactory.d.ts.map