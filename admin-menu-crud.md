# Admin Menu CRUD Integration

## Goal
Implement a seamless Add/Edit/Delete flow for the restaurant owner to manage their inventory.

## Tasks
- [ ] **Task 1: [Modify] [types/menu.ts](file:///e:/desktop/goodrest/src/types/menu.ts)** → Add optional `cuisine` or `description` field.
- [ ] **Task 2: [NEW] [adminActions.ts](file:///e:/desktop/goodrest/src/app/actions/adminActions.ts)** → Implement `addMenuItem` and `deleteMenuItem` server actions.
- [ ] **Task 3: [Modify] [adminActions.ts](file:///e:/desktop/goodrest/src/app/actions/adminActions.ts)** → Implement `updateMenuItem` (Full field update).
- [ ] **Task 4: [Modify] [MenuManagementClient.tsx](file:///e:/desktop/goodrest/src/components/admin/MenuManagementClient.tsx)** → Add FAB (Floating Action Button) for "Add Dish".
- [ ] **Task 5: [Modify] [MenuManagementClient.tsx](file:///e:/desktop/goodrest/src/components/admin/MenuManagementClient.tsx)** → Build Modal Form for Add/Edit CRUD.
- [ ] **Task 6: [Modify] [MenuManagementClient.tsx](file:///e:/desktop/goodrest/src/components/admin/MenuManagementClient.tsx)** → Implement Image Preview & Price/Stock controls in Modal.
- [ ] **Task 7: [Modify] [MenuManagementClient.tsx](file:///e:/desktop/goodrest/src/components/admin/MenuManagementClient.tsx)** → Add "Delete" button with confirmation logic.
- [ ] **Task 8: [Verify] [iPhone 14 Pro Viewport]** → Ensure all modals and lists are responsive on mobile.

## Done When
- [ ] Owner can Add, Edit, and Delete a dish from `/admin/menu`.
- [ ] Changes are instantly visible on the customer storefront.
- [ ] Images and Stock Status update correctly.
