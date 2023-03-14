export interface PartInit {
  metadata?: string[] | undefined;
}

export interface Part {
  readonly metadata: string[];
  readonly valid: boolean;

  // Disconnect the Part from the DOM.
  disconnect(): void;
}
