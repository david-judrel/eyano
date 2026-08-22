import { ChatMessage } from '@eyano/types';

export interface AIProvider {
  name: string;
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;
  stream(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<string>;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
