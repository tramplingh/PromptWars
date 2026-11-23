import type { Catalog, Department, Equipment, Lab, Persona } from '@lablink/shared';
import { notFound } from '../lib/errors.js';

export interface CatalogData {
  departments: Department[];
  labs: Lab[];
  equipment: Equipment[];
  personas: Persona[];
}

/** Read-only access to reference data with O(1) lookups. */
export class CatalogService {
  private readonly equipmentById: Map<string, Equipment>;
  private readonly labById: Map<string, Lab>;
  private readonly departmentById: Map<string, Department>;
  private readonly personaById: Map<string, Persona>;

  constructor(private readonly data: CatalogData) {
    this.equipmentById = new Map(data.equipment.map((e) => [e.id, e]));
    this.labById = new Map(data.labs.map((l) => [l.id, l]));
    this.departmentById = new Map(data.departments.map((d) => [d.id, d]));
    this.personaById = new Map(data.personas.map((p) => [p.id, p]));
  }

  catalog(): Catalog {
    return {
      departments: this.data.departments,
      labs: this.data.labs,
      equipment: this.data.equipment,
    };
  }

  get equipment(): readonly Equipment[] {
    return this.data.equipment;
  }

  get labs(): readonly Lab[] {
    return this.data.labs;
  }

  get personas(): readonly Persona[] {
    return this.data.personas;
  }

  findPersona(id: string): Persona | undefined {
    return this.personaById.get(id);
  }

  requireEquipment(id: string): Equipment {
    const item = this.equipmentById.get(id);
    if (!item) throw notFound('Equipment');
    return item;
  }

  findEquipment(id: string): Equipment | undefined {
    return this.equipmentById.get(id);
  }

  labFor(equipment: Equipment): Lab {
    const lab = this.labById.get(equipment.labId);
    if (!lab) throw new Error(`Lab ${equipment.labId} missing for ${equipment.id}`);
    return lab;
  }

  department(id: string): Department {
    const department = this.departmentById.get(id);
    if (!department) throw new Error(`Department ${id} missing`);
    return department;
  }

  personaName(id: string): string {
    return this.personaById.get(id)?.name ?? 'Unknown user';
  }
}
