import { supabase } from './client';

export interface Customer {
  id: string;
  name: string;
}

const toCustomer = (row: { id: string; name: string }): Customer => ({
  id: row.id,
  name: row.name,
});

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

export async function createCustomer(name: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function updateCustomer(id: string, name: string): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) throw error;
}
