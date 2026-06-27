import { expect, test } from 'vitest'
import { version } from './index'

test('exports version', () => {
	expect(version).toBe('0.0.0')
})
