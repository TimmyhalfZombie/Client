import { http } from '../../lib/http';

export type CustomerRatingResponse = {
  average: number | null;
  count: number;
};

export async function fetchCustomerRating(customerId: string): Promise<CustomerRatingResponse | null> {
  const id = customerId?.trim();
  if (!id) return null;
  try {
    const data = await http.get(`/api/ratings/${encodeURIComponent(id)}`, { auth: true });
    if (!data) return null;
    const average = typeof (data as any)?.average === 'number' && Number.isFinite((data as any).average)
      ? Number((data as any).average)
      : null;
    const count = typeof (data as any)?.count === 'number' && Number.isFinite((data as any).count)
      ? Number((data as any).count)
      : 0;
    return { average, count };
  } catch {
    return null;
  }
}

