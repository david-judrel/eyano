import { Tool } from './tool';
import { getTool } from './bootstrap';

export { Tool } from './tool';
export {
  ToolRegistry,
  toolRegistry,
  ToolRegistryError,
  ToolRegisterOptions,
  ToolRegistryErrorCode,
} from './registry';
export {
  ensureToolsRegistered,
  getTool,
  listTools,
  executeTool,
} from './bootstrap';

export { calculatorTool } from './calculator.tool';
export { dateTimeTool } from './datetime.tool';
export { webSearchTool, webSearch, buildSearchContext, WebSearchResult } from './web-search.tool';

/**
 * @deprecated Utiliser `getTool()` (registre).
 */
export function getToolByName(name: string): Tool | undefined {
  return getTool(name);
}
