import { PoolClient } from 'pg';
import { ContractorEntity } from '../entity/contractor.entity';

export interface ContractorFilter {
  status?: string;
  search?: string; // search code, name, contactName, email, scope
  scope?: string; // filter by scope substring
  limit?: number;
  offset?: number;
}

export interface ContractorRepositoryPort {
  findById(id: string): Promise<ContractorEntity | null>;
  findByCode(code: string): Promise<ContractorEntity | null>;
  findMany(filter: ContractorFilter): Promise<{ entities: ContractorEntity[]; total: number }>;
  findActiveForAssignment(filter?: { search?: string; scope?: string; limit?: number; offset?: number }): Promise<{ entities: ContractorEntity[]; total: number }>;
  create(contractor: ContractorEntity): Promise<void>;
  createWithClient?(client: PoolClient, contractor: ContractorEntity): Promise<void>;
  save(contractor: ContractorEntity): Promise<void>;
  saveWithClient?(client: PoolClient, contractor: ContractorEntity): Promise<void>;
  hasHistory?(contractorId: string): Promise<boolean>;
}

export const CONTRACTOR_REPOSITORY = Symbol('CONTRACTOR_REPOSITORY');
