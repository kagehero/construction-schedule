import { supabase } from './client';
import type { Project, ContractType } from '@/domain/projects/types';
import type { Database } from './database.types';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

// Convert database row to domain type
const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  title: row.title,
  customerName: row.customer_name,
  siteName: row.site_name,
  contractType: row.contract_type as ContractType,
  contractAmount: row.contract_amount ?? undefined,
  siteAddress: row.site_address,
  startDate: row.start_date,
  endDate: row.end_date,
});

// Projects
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(toProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return toProject(data);
}

export async function createProject(project: Omit<Project, 'id'>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: project.title,
      customer_name: project.customerName,
      site_name: project.siteName,
      contract_type: project.contractType,
      contract_amount: project.contractAmount ?? null,
      site_address: project.siteAddress,
      start_date: project.startDate,
      end_date: project.endDate,
    })
    .select()
    .single();

  if (error) throw error;
  return toProject(data);
}

export async function updateProject(
  id: string,
  project: Partial<Omit<Project, 'id'>>
): Promise<Project> {
  const updateData: any = {};
  if (project.title !== undefined) updateData.title = project.title;
  if (project.customerName !== undefined) updateData.customer_name = project.customerName;
  if (project.siteName !== undefined) updateData.site_name = project.siteName;
  if (project.contractType !== undefined) updateData.contract_type = project.contractType;
  if (project.contractAmount !== undefined) updateData.contract_amount = project.contractAmount ?? null;
  if (project.siteAddress !== undefined) updateData.site_address = project.siteAddress;
  if (project.startDate !== undefined) updateData.start_date = project.startDate;
  if (project.endDate !== undefined) updateData.end_date = project.endDate;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
