export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

export const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Effectue des calculs mathématiques',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Expression mathématique à évaluer',
      },
    },
    required: ['expression'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const expression = args.expression as string;
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized})`)();
      return String(result);
    } catch {
      return 'Erreur: expression mathématique invalide';
    }
  },
};
