declare module 'langextract' {
  export type Extraction = {
    extractionClass?: string;
    extractionText: string;
    attributes?: Record<string, string | string[]>;
  };

  export type ExampleData = {
    text: string;
    extractions: Extraction[];
  };

  export type AnnotatedDocument = {
    text?: string;
    extractions?: Extraction[];
  };

  export function extract(
    textOrDocuments: string | AnnotatedDocument | AnnotatedDocument[],
    options?: {
      promptDescription?: string;
      examples?: ExampleData[];
      modelType?: 'gemini' | 'openai' | 'ollama';
      modelId?: string;
      apiKey?: string;
      temperature?: number;
      maxTokens?: number;
      debug?: boolean;
    }
  ): Promise<AnnotatedDocument | AnnotatedDocument[]>;
}
