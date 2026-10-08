import { MarkdownPageEvent } from 'typedoc-plugin-markdown'

/**
 * Local typedoc-plugin-markdown extension.
 *
 * By default each function renders as:
 *   ### name()  ->  signature  ->  description  ->  Parameters  ->  Returns  ->  Example
 *
 * We move the `#### Example` block up to sit directly under the description
 * (before `#### Parameters` / `#### Returns`) so readers see usage first.
 *
 * @param {import('typedoc').Application} app
 */
export function load(app) {
	app.renderer.on(MarkdownPageEvent.END, (page) => {
		if (page.contents) {
			page.contents = reorderExamples(page.contents)
		}
	})
}

/** Split the page before each h3 (one per exported function) and reorder each. */
function reorderExamples(contents) {
	return contents.split(/\n(?=### )/).map(moveExampleAboveParameters).join('\n')
}

function moveExampleAboveParameters(block) {
	// Only function blocks (h3); leave the page preamble untouched.
	if (!block.startsWith('### ')) return block

	const match = block.match(/\n#### Example\n+[\s\S]*?(?=\n#### |\n\*\*\*|$)/)
	if (!match) return block

	const body = match[0].replace(/^\n#### Example\n+/, '').trim()
	const example = `#### Example\n\n${body}\n`

	const withoutExample = block.replace(match[0], '')
	const firstSection = withoutExample.search(/\n#### /)
	if (firstSection === -1) return block // no other section to sit in front of

	const reordered = `${withoutExample.slice(0, firstSection)}\n\n${example}${withoutExample.slice(firstSection)}`
	return reordered.replace(/\n{3,}/g, '\n\n')
}
