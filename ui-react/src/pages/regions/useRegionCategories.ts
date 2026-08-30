import { useMemo } from 'react';
import { useListRegionCategoriesQuery } from '@/graphql/generated/graphql';

interface CategoryItem {
  id: string;
  name: string;
  citation?: string | null;
}

/**
 * Fetches all region categories and returns:
 *  - categories: flat list of all top-level categories
 *  - subcategoriesFor(categoryId): subcategories of the given category
 */
export function useListRegionCategoriesWithHierarchy() {
  const { data, loading, error } = useListRegionCategoriesQuery();

  const { categories, subCategoryMap } = useMemo(() => {
    if (!data?.region_category) {
      return {
        categories: [] as CategoryItem[],
        subCategoryMap: {} as Record<string, string[]>,
      };
    }

    // Collect which IDs appear as sub-categories
    const subCatIds = new Set<string>();
    const subCategoryMap: Record<string, string[]> = {};

    data.region_category.forEach((cat) => {
      const subs = cat.sub_categories ?? [];
      subs.forEach((sub) => {
        subCatIds.add(sub.region_category_id);
        const arr = subCategoryMap[cat.id];
        if (!arr) {
          subCategoryMap[cat.id] = [sub.region_category_id];
        } else {
          arr.push(sub.region_category_id);
        }
      });
    });

    // Top-level categories (not a sub of anything)
    const categories = data.region_category
      .filter((cat) => !subCatIds.has(cat.id))
      .map((cat) => ({ id: cat.id, name: cat.name, citation: cat.citation }));

    return { categories, subCategoryMap };
  }, [data]);

  const categoryById = useMemo(() => {
    const map: Record<string, CategoryItem> = {};
    data?.region_category.forEach((cat) => {
      map[cat.id] = { id: cat.id, name: cat.name, citation: cat.citation };
    });
    return map;
  }, [data]);

  const subcategoriesFor = (categoryId: string): CategoryItem[] => {
    const ids = subCategoryMap[categoryId] ?? [];
    return ids.flatMap((id) => {
      const c = categoryById[id];
      return c ? [c] : [];
    });
  };

  return { categories, subcategoriesFor, categoryById, loading, error };
}
