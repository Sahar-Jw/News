/**
 * "Quick add": an admin screen shown only as its add window (a modal), so a button on a public page can open the form right there
 * instead of sending the person to Settings. `onClose` = the window was closed (saved or not); `onSaved` = the item was saved.
 */
export interface QuickAdd { onClose: () => void; onSaved?: () => void }
