import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Usuário master (tabela app_admins). Só serve pra decidir o que mostrar: os dados das outras
// contas são protegidos no banco (fin_admin_contas recusa quem não é master).
export const useSouAdmin = () => {
  const [souAdmin, setSouAdmin] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase.rpc("fin_sou_admin" as any).then(({ data, error }) => {
      if (!ativo) return;
      setSouAdmin(!error && data === true);
      setCarregado(true);
    });
    return () => { ativo = false; };
  }, []);

  return { souAdmin, carregado };
};
