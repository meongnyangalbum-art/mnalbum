import type { AIImageProvider, GenerateInput, GenerateOutput } from "./provider";

export class MockAIProvider implements AIImageProvider {
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return { sourceUrl: input.referenceImages[0] || input.pet.cover_url || "/brand-reference.png", styleName: input.style.name };
  }
}
