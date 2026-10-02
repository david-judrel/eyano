import { Tool } from './tool';
import { toolRegistry } from './registry';
import { calculatorTool } from './calculator.tool';
import { dateTimeTool } from './datetime.tool';
import { webSearchTool } from './web-search.tool';

/**
 * Enregistrement par defaut des tools.
 *
 * Ne s'active que si le registry est vide, afin de ne jamais ecraser
 * un tool injecte par l'application (tests, WikiTool, FileTool, ...).
 */
export function ensureToolsRegistered(): void {
  if (toolRegistry.size() > 0) return;
  toolRegistry.registerAll([calculatorTool, dateTimeTool, webSearchTool]);
}

/** Resout un tool par son identifiant. */
export function getTool(name: string): Tool | undefined {
  ensureToolsRegistered();
  return toolRegistry.get(name);
}

export function listTools(): Tool[] {
  ensureToolsRegistered();
  return toolRegistry.list();
}

/** Resout puis invoque un tool. Rejette avec `ToolRegistryError` si inconnu. */
export function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  ensureToolsRegistered();
  return toolRegistry.execute(name, args);
}
