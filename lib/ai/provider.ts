import type { Pet, Style } from "@/lib/types";

export interface GenerateInput { pet: Pet; referenceImages: string[]; style: Style }
export interface GenerateOutput { sourceUrl: string; styleName: string }
export interface AIImageProvider { generate(input: GenerateInput): Promise<GenerateOutput> }
