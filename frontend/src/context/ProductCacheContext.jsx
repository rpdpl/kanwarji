import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
} from "react";
import { getAdminItems } from "../api/products";

// In-memory + localStorage product cache + shared list fetch
const ProductCacheContext = createContext(null);

export const ProductCacheProvider = ({ children }) => {
  const cacheRef = useRef({});
  const listRef = useRef(null);
  const listMetaRef = useRef(null);
  const inflightRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  if (Object.keys(cacheRef.current).length === 0) {
    try {
      const raw = localStorage.getItem("product-cache-v1");
      if (raw) cacheRef.current = JSON.parse(raw) || {};
    } catch (e) {}
  }

  const persist = () => {
    try {
      localStorage.setItem(
        "product-cache-v1",
        JSON.stringify(cacheRef.current).slice(0, 200000)
      );
    } catch (e) {}
  };

  const putMany = useCallback((items = []) => {
    let changed = false;
    items.forEach((p) => {
      const id = p?._id || p?.id;
      if (!id) return;
      if (!cacheRef.current[id]) {
        cacheRef.current[id] = p;
        changed = true;
      }
    });
    if (changed) persist();
  }, []);

  const putOne = useCallback((product) => {
    if (!product) return;
    const id = product._id || product.id;
    if (!id) return;
    cacheRef.current[id] = { ...cacheRef.current[id], ...product };
    persist();
  }, []);

  const getOne = useCallback((id) => cacheRef.current[id] || null, []);

  const ensureProducts = useCallback(
    async ({ limit = 200, status, force = false } = {}) => {
      const prev = listMetaRef.current;
      const needsUpgrade =
        !!listRef.current?.length &&
        ((limit && prev && limit > (prev.limit || 0)) ||
          (status && prev && status !== prev.status));

      if (
        !force &&
        !needsUpgrade &&
        listRef.current &&
        listRef.current.length > 0
      ) {
        return listRef.current;
      }
      if (inflightRef.current) {
        return inflightRef.current;
      }

      setProductsLoading(true);
      const promise = (async () => {
        try {
          const res = await getAdminItems({ limit, status });
          const items =
            res.data?.success && Array.isArray(res.data.items)
              ? res.data.items
              : [];
          listRef.current = items;
          listMetaRef.current = { limit, status };
          setProducts(items);
          putMany(items);
          return items;
        } catch (e) {
          if (!listRef.current) {
            listRef.current = [];
            setProducts([]);
          }
          return listRef.current || [];
        } finally {
          setProductsLoading(false);
          inflightRef.current = null;
        }
      })();

      inflightRef.current = promise;
      return promise;
    },
    [putMany]
  );

  const value = {
    getOne,
    putOne,
    putMany,
    all: cacheRef.current,
    products,
    productsLoading,
    ensureProducts,
  };

  return (
    <ProductCacheContext.Provider value={value}>
      {children}
    </ProductCacheContext.Provider>
  );
};

export const useProductCache = () => {
  const ctx = useContext(ProductCacheContext);
  if (!ctx)
    throw new Error("useProductCache must be used within ProductCacheProvider");
  return ctx;
};
