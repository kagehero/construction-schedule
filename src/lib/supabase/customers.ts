import { supabase } from './client';

export interface Customer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
}

type CustomerRow = { id: string; name: string; address?: string | null; phone?: string | null; contact_person?: string | null };

const toCustomer = (row: CustomerRow): Customer => ({
  id: row.id,
  name: row.name,
  address: row.address ?? undefined,
  phone: row.phone ?? undefined,
  contactPerson: row.contact_person ?? undefined,
});

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, address, phone, contact_person')
    .order('name');

  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

export type CustomerInput = {
  name: string;
  address?: string;
  phone?: string;
  contactPerson?: string;
};

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      contact_person: input.contactPerson ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toCustomer(data);
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: input.name,
      address: input.address ?? null,
      phone: input.phone ?? null,
      contact_person: input.contactPerson ?? null,
    })
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
