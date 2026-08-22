import { Tool } from './calculator.tool';

export const dateTimeTool: Tool = {
  name: 'datetime',
  description: 'Obtient la date et l\'heure actuelles, ou effectue des opérations sur les dates',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['now', 'date', 'time', 'timezone'],
        description: 'Opération à effectuer',
      },
      timezone: {
        type: 'string',
        description: 'Fuseau horaire (ex: Europe/Paris)',
      },
    },
    required: ['operation'],
  },
  async execute(args: Record<string, unknown>): Promise<string> {
    const operation = args.operation as string;
    const tz = (args.timezone as string) || 'Europe/Paris';

    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: tz };

    switch (operation) {
      case 'now':
        return now.toLocaleString('fr-FR', { ...options, dateStyle: 'full', timeStyle: 'long' });
      case 'date':
        return now.toLocaleDateString('fr-FR', { ...options, dateStyle: 'full' });
      case 'time':
        return now.toLocaleTimeString('fr-FR', { ...options, timeStyle: 'long' });
      case 'timezone':
        return `Il est ${now.toLocaleTimeString('fr-FR', { ...options, timeStyle: 'long' })} en ${tz}`;
      default:
        return now.toLocaleString('fr-FR', { ...options, dateStyle: 'full', timeStyle: 'long' });
    }
  },
};
