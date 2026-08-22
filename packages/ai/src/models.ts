import { AIModel, AIModelInfo } from '@eyano/types';

export const EYANO_MODELS: AIModelInfo[] = [
  {
    id: 'gnoxe-brains-1',
    name: 'Gnoxe Brains 1',
    description: 'Modèle généraliste, rapide et efficace',
    maxTokens: 8192,
    available: true,
  },
  {
    id: 'gnoxe-brains-1.5',
    name: 'Gnoxe Brains 1.5',
    description: 'Modèle avancé, plus de raisonnement',
    maxTokens: 16384,
    available: true,
  },
  {
    id: 'gnoxe-brains-2',
    name: 'Gnoxe Brains 2',
    description: 'Prochainement disponible',
    maxTokens: 32768,
    available: false,
  },
  {
    id: 'gnoxe-brains-code',
    name: 'Gnoxe Brains Code',
    description: 'Optimisé pour le code',
    maxTokens: 16384,
    available: false,
  },
  {
    id: 'gnoxe-brains-vision',
    name: 'Gnoxe Brains Vision',
    description: 'Multimodal, analyse d\'images',
    maxTokens: 8192,
    available: false,
  },
];

export function getModelInfo(modelId: AIModel): AIModelInfo | undefined {
  return EYANO_MODELS.find((m) => m.id === modelId);
}

export function getAvailableModels(): AIModelInfo[] {
  return EYANO_MODELS.filter((m) => m.available);
}

export function getDefaultModel(): AIModel {
  return 'gnoxe-brains-1';
}
