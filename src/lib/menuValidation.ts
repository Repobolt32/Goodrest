import { z } from 'zod';

const MenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  category_id: z.string().optional(),
  image_url: z.string().optional(),
  tags: z.array(z.string()),
  is_available: z.boolean(),
});

const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  display_order: z.number(),
  is_active: z.boolean(),
});

export type ValidatedMenuItem = z.infer<typeof MenuItemSchema>;
export type ValidatedCategory = z.infer<typeof CategorySchema>;

export function validateMenuItems(data: unknown[]): { success: true; data: ValidatedMenuItem[] } | { success: false; error: string } {
  const result = z.array(MenuItemSchema).safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

export function validateCategories(data: unknown[]): { success: true; data: ValidatedCategory[] } | { success: false; error: string } {
  const result = z.array(CategorySchema).safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
