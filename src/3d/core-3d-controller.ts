import {
  ConfigurationStore,
  type CoreConfigurationSnapshot,
} from '../configurator/configuration-store';
import type { ProductionPbrMaterial } from '../materials/pbr-material';
import type { RuntimeMaterialDefinition } from '../materials/runtime-material';
import { MaterialController } from './material-controller';
import type { PbrMaterialController } from './pbr-material-controller';
import { SelectionController, type SelectionResult } from './selection-controller';

export type SelectionListener = (selection: SelectionResult) => void;

export class Core3DController {
  private selectedSurfaceId: string | null = null;

  constructor(
    private readonly selection: SelectionController,
    private readonly materials: MaterialController,
    private readonly configuration: ConfigurationStore,
    private readonly onSelectionChange: SelectionListener,
    private readonly pbr: PbrMaterialController | null = null,
  ) {}

  selectAt(clientX: number, clientY: number): SelectionResult {
    return this.commitSelection(this.selection.selectAt(clientX, clientY));
  }

  selectSurface(surfaceId: string): SelectionResult {
    return this.commitSelection(this.selection.selectSurface(surfaceId));
  }

  applySelected(material: RuntimeMaterialDefinition): boolean {
    if (!this.selectedSurfaceId) return false;
    const surfaceId = this.selectedSurfaceId;
    this.materials.clearHighlight();
    this.pbr?.reset(surfaceId);
    this.materials.apply(surfaceId, material);
    this.configuration.assign(surfaceId, material.id);
    this.materials.highlight(surfaceId);
    return true;
  }

  applyAll(material: RuntimeMaterialDefinition): void {
    const selected = this.selectedSurfaceId;
    this.materials.clearHighlight();
    this.pbr?.resetAll();
    this.materials.applyAll(material);
    this.configuration.assignAll(material.id);
    if (selected) this.materials.highlight(selected);
  }

  async applyPbrSelected(material: ProductionPbrMaterial): Promise<boolean> {
    if (!this.selectedSurfaceId) return false;
    const pbr = this.requirePbr();
    const surfaceId = this.selectedSurfaceId;
    this.materials.clearHighlight();
    try {
      await pbr.apply(surfaceId, material);
      this.configuration.assign(surfaceId, material.id);
      return true;
    } finally {
      this.materials.highlight(surfaceId);
    }
  }

  async applyPbrAll(material: ProductionPbrMaterial): Promise<void> {
    const pbr = this.requirePbr();
    const selected = this.selectedSurfaceId;
    this.materials.clearHighlight();
    try {
      await pbr.applyAll(material);
      this.configuration.assignAll(material.id);
    } finally {
      if (selected) this.materials.highlight(selected);
    }
  }

  resetSelected(): boolean {
    if (!this.selectedSurfaceId) return false;
    const surfaceId = this.selectedSurfaceId;
    this.materials.clearHighlight();
    this.pbr?.reset(surfaceId);
    this.materials.reset(surfaceId);
    this.configuration.reset(surfaceId);
    this.materials.highlight(surfaceId);
    return true;
  }

  resetAll(): void {
    const selected = this.selectedSurfaceId;
    this.materials.clearHighlight();
    this.pbr?.resetAll();
    this.materials.resetAll();
    this.configuration.resetAll();
    if (selected) this.materials.highlight(selected);
  }

  getConfiguration(): CoreConfigurationSnapshot {
    return this.configuration.read();
  }

  dispose(): void {
    this.materials.clearHighlight();
    this.pbr?.dispose();
    this.selectedSurfaceId = null;
  }

  private requirePbr(): PbrMaterialController {
    if (!this.pbr) throw new Error('Runtime PBR não inicializado.');
    return this.pbr;
  }

  private commitSelection(result: SelectionResult): SelectionResult {
    this.materials.clearHighlight();
    this.selectedSurfaceId = result.kind === 'configurable' ? result.surfaceId : null;
    if (this.selectedSurfaceId) this.materials.highlight(this.selectedSurfaceId);
    this.onSelectionChange(result);
    return result;
  }
}
