import { expect, it } from 'vitest'
import { serialWrites } from '../src/main/writes'

it('serializes concurrent writes and keeps accepting writes after a failure', async () => {
  const write = serialWrites(), values: number[] = []
  const first = write(async () => { await new Promise(resolve => setTimeout(resolve, 10)); values.push(1) })
  const second = write(async () => { values.push(2); throw new Error('failure') })
  const third = write(async () => { values.push(3) })
  await expect(first).resolves.toBeUndefined()
  await expect(second).rejects.toThrow('failure')
  await expect(third).resolves.toBeUndefined()
  expect(values).toEqual([1, 2, 3])
})
