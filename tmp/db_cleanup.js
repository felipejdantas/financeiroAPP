import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dldudynonsmcutjwpgvy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZHVkeW5vbnNtY3V0andwZ3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzQ5NjAsImV4cCI6MjA3MDUxMDk2MH0.4EDdYfoccIxfdX9GXUkiite-TM_8xMTbe-a8InjIhnQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
    console.log("Starting cleanup...");

    const tables = ["Financeiro Cartão", "Financeiro Debito"];
    const replacements = [
        { from: "Credito", to: "Crédito" },
        { from: "Debito", to: "Débito" },
        { from: "Crédito ", to: "Crédito" },
        { from: "Débito ", to: "Débito" },
        { from: "Pix ", to: "Pix" },
        { from: "Dinheiro ", to: "Dinheiro" }
    ];

    for (const table of tables) {
        console.log(`Cleaning table: ${table}`);
        for (const r of replacements) {
            const { data, error, count } = await supabase
                .from(table)
                .update({ Tipo: r.to })
                .eq('Tipo', r.from)
                .select();

            if (error) {
                console.error(`Error updating ${r.from} to ${r.to} in ${table}:`, error);
            } else if (count && count > 0) {
                console.log(`Updated ${count} rows from ${r.from} to ${r.to} in ${table}`);
            }
        }
    }
    console.log("Cleanup finished.");
}

cleanup();
