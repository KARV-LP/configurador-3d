export interface CoreConfigurationSnapshot {
  readonly assignments: Readonly<Record<string, string | null>>;
}

export class ConfigurationStore {
  private readonly assignments = new Map<string, string | null>();

  constructor(surfaceIds: readonly string[]) {
    for (const surfaceId of surfaceIds) {
      if (this.assignments.has(surfaceId)) {
        throw new Error(`Surface id duplicado no estado: ${surfaceId}`);
      }
      this.assignments.set(surfaceId, null);
    }
  }

  assign(surfaceId: string, materialId: string): void {
    this.assertKnown(surfaceId);
    this.assignments.set(surfaceId, materialId);
  }

  assignAll(materialId: string): void {
    for (const surfaceId of this.assignments.keys()) {
      this.assignments.set(surfaceId, materialId);
    }
  }

  replace(nextAssignments: Readonly<Record<string, string>>): void {
    for (const surfaceId of Object.keys(nextAssignments)) this.assertKnown(surfaceId);
    for (const surfaceId of this.assignments.keys()) {
      this.assignments.set(surfaceId, nextAssignments[surfaceId] ?? null);
    }
  }

  reset(surfaceId: string): void {
    this.assertKnown(surfaceId);
    this.assignments.set(surfaceId, null);
  }

  resetAll(): void {
    for (const surfaceId of this.assignments.keys()) {
      this.assignments.set(surfaceId, null);
    }
  }

  read(): CoreConfigurationSnapshot {
    return Object.freeze({
      assignments: Object.freeze(Object.fromEntries(this.assignments.entries())),
    });
  }

  private assertKnown(surfaceId: string): void {
    if (!this.assignments.has(surfaceId)) {
      throw new Error(`Superfície fora do estado configurável: ${surfaceId}`);
    }
  }
}
