import { Tool } from './calculator.tool';
import { calculatorTool } from './calculator.tool';
import { dateTimeTool } from './datetime.tool';

export const tools: Tool[] = [calculatorTool, dateTimeTool];

export function getToolByName(name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

export { Tool } from './calculator.tool';
