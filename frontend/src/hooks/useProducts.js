import { useEffect } from "react";
import { useProductCache } from "../context/ProductCacheContext";

/**
 * Shared products list via ProductCacheContext (single fetch/cache path).
 */
export default function useProducts(options = {}) {
  const { limit = 200, status, enabled = true } = options;
  const { products, productsLoading, ensureProducts, putMany, getOne, putOne } =
    useProductCache();

  useEffect(() => {
    if (!enabled) return;
    ensureProducts({ limit, status });
  }, [enabled, ensureProducts, limit, status]);

  return {
    products,
    loading: productsLoading,
    ensureProducts,
    putMany,
    getOne,
    putOne,
  };
}
