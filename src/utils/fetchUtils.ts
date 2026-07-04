import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all records for a specific user from a given table,
 * bypassing the default 1000-row Supabase/PostgREST limit
 * by paginating through the results.
 */
export const fetchAllUserRecords = async (tableName: string, userId: string) => {
  const limit = 1000;

  const { count, error: countError } = await supabase
    .from(tableName as any)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) {
    console.error(`Error counting ${tableName}:`, countError);
    throw countError;
  }

  const totalPages = Math.max(1, Math.ceil((count || 0) / limit));

  const pages = await Promise.all(
    Array.from({ length: totalPages }, (_, i) => {
      const from = i * limit;
      return supabase
        .from(tableName as any)
        .select("*")
        .eq("user_id", userId)
        .range(from, from + limit - 1)
        .order("id", { ascending: false });
    })
  );

  const allData: any[] = [];
  for (const { data, error } of pages) {
    if (error) {
      console.error(`Error fetching from ${tableName}:`, error);
      throw error;
    }
    allData.push(...(data || []));
  }

  return allData;
};
