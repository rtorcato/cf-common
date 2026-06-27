/**
 * Swizzled (replace) SecondaryMenu — disabled.
 *
 * The doc plugin contributes a sidebar filler that flips the mobile drawer
 * into "secondary" mode on doc pages, which translates the primary menu off
 * screen and shows whatever content the filler provided (or an empty
 * "Display a menu" fallback on second open). We don't want that flow at all:
 * the swizzled PrimaryMenu already renders the full sidebar. Returning null
 * here ensures the secondary slot is always empty, and CSS in custom.css
 * locks the items container so the primary stays in view.
 */
export default function NavbarMobileSidebarSecondaryMenu(): null {
	return null
}
