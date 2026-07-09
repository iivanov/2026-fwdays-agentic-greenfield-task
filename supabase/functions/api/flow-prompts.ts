import { decryptPromptTemplate, encryptPromptTemplate } from './crypto.ts';
import type { ProcessingFlowRecord } from './types.ts';

export async function decryptFlowPrompt<T extends ProcessingFlowRecord>(flow: T): Promise<T> {
  if (flow.prompt_type !== 'custom') {
    return { ...flow, prompt_template: null };
  }
  return { ...flow, prompt_template: await decryptPromptTemplate(flow.prompt_template) };
}

export async function decryptFlowPrompts<T extends ProcessingFlowRecord>(
  flows: T[] | null,
): Promise<T[] | null> {
  if (!flows) return flows;
  return await Promise.all(flows.map((flow) => decryptFlowPrompt(flow)));
}

export async function buildPromptTemplateForStorage(
  promptType: 'predefined' | 'custom' | undefined,
  promptTemplate: string | null | undefined,
): Promise<string | null | undefined> {
  if (promptType === 'predefined') return null;
  if (promptTemplate === undefined) return undefined;
  if (promptTemplate === null) return null;
  return await encryptPromptTemplate(promptTemplate);
}
