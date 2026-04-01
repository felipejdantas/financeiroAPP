import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all records for a specific user from a given table,
 * bypassing the default 1000-row Supabase/PostgREST limit
 * by paginating through the results.
 */
export const fetchAllUserRecords = async (tableName: string, userId: string) => {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName as any)
      .select("*")
      .eq("user_id", userId)
      .range(from, from + limit - 1)
      .order("id", { ascending: false });

    if (error) {
      console.error(`Error fetching from ${tableName}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allData = [...allData, ...data];

    // Se retornou menos que o limite, significa que acabaram os registros.
    if (data.length < limit) {
      break;
    }

    from += limit;
  }

  return allData;
};
