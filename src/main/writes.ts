export function serialWrites() {
  let previous: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const current = previous.then(operation)
    previous = current.catch(() => undefined)
    return current
  }
}
