import { useCallback, useEffect, useState } from "react";
import { Responsavel, fetchResponsaveis } from "@/utils/responsaveis";

export const useResponsaveis = (userId: string | null | undefined) => {
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [legado, setLegado] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    if (!userId) return;
    const resultado = await fetchResponsaveis(userId);
    setResponsaveis(resultado.responsaveis);
    setLegado(resultado.legado);
    setCarregado(true);
  }, [userId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { responsaveis, legado, carregado, recarregar };
};
