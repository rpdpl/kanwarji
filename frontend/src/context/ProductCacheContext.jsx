import React, { createContext, useContext, useRef, useCallback } from "react";

// Simple in-memory + localStorage backed product cache to avoid re-fetching lists
// Structure: { [id]: productObject }

const ProductCacheContext = createContext(null);

export const ProductCacheProvider = ({ children }) => {
  const cacheRef = useRef({});

  // hydrate from localStorage once (lazy)
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
        JSON.stringify(cacheRef.current).slice(0, 200000) // guard size
      );
    } catch (e) {}
  };

  const putMany = useCallback((products = []) => {
    let changed = false;
    products.forEach((p) => {
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

  const value = {
    getOne,
    putOne,
    putMany,
    all: cacheRef.current,
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
