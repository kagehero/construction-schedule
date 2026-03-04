import { supabase } from './client';

export interface CustomerMember {
  id: string;
  customerId: string;
  name: string;
  color?: string;
}

type CustomerMemberRow = { id: string; customer_id: string; name: string; color?: string | null };

const toCustomerMember = (row: CustomerMemberRow): CustomerMember => ({
  id: row.id,
  customerId: row.customer_id,
  name: row.name,
  color: row.color ?? undefined,
});

export async function getCustomerMembers(customerId: string): Promise<CustomerMember[]> {
  const { data, error } = await supabase
    .from('customer_members')
    .select('id, customer_id, name, color')
    .eq('customer_id', customerId)
    .order('name');

  if (error) throw error;
  return (data ?? []).map(toCustomerMember);
}

export async function getCustomerMembersByCustomerIds(customerIds: string[]): Promise<CustomerMember[]> {
  if (customerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('customer_members')
    .select('id, customer_id, name, color')
    .in('customer_id', customerIds)
    .order('name');

  if (error) throw error;
  return (data ?? []).map(toCustomerMember);
}

export async function createCustomerMember(customerId: string, name: string, color?: string): Promise<CustomerMember> {
  const { data, error } = await supabase
    .from('customer_members')
    .insert({ customer_id: customerId, name, color: color ?? null })
    .select()
    .single();

  if (error) throw error;
  return toCustomerMember(data);
}

export async function updateCustomerMember(id: string, name: string, color?: string): Promise<CustomerMember> {
  const { data, error } = await supabase
    .from('customer_members')
    .update({ name, color: color ?? null })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toCustomerMember(data);
}

export async function deleteCustomerMember(id: string): Promise<void> {
  const { error } = await supabase.from('customer_members').delete().eq('id', id);
  if (error) throw error;
}
