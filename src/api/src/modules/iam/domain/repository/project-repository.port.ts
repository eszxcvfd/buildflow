import { ProjectEntity } from '../entity/project.entity';

export interface ProjectRepositoryPort {
  findById(id: string): Promise<ProjectEntity | null>;
  findByIds(ids: string[]): Promise<ProjectEntity[]>;
  findAll(params?: { limit?: number; offset?: number }): Promise<ProjectEntity[]>;
  exists(id: string): Promise<boolean>;
}

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');
