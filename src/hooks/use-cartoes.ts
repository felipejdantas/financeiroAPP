import { useCallback, useEffect, useState } from "react";
import { Cartao, fetchCartoes } from "@/utils/cartoes";

export const useCartoes = (userId: string | null | undefined) => {
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [legado, setLegado] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    if (!userId) return;
    const resultado = await fetchCartoes(userId);
    setCartoes(resultado.cartoes);
    setLegado(resultado.legado);
    setCarregado(true);
  }, [userId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { cartoes, legado, carregado, recarregar };
};
