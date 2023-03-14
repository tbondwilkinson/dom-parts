import { PartRoot } from "./part_root.js";

export interface PartInit {
  metadata?: string[] | undefined;
}

export interface Part {
  readonly partRoot: PartRoot | undefined;
  readonly metadata: string[];
  readonly valid: boolean;

  // Disconnect the Part from the DOM.
  disconnect(): void;
}
