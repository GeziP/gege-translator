import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLanguage, matchTerms, makeMessages, translate, gatewayModels } from '../src/main/core.ts'
import { createServer } from 'node:http'

test('input remains data and terms match word boundaries', () => {
  assert.equal(detectLanguage('English 中文'), null)
  assert.equal(matchTerms('controller', 'en', 'zh-CN', 'ivd').some(t => t.source === 'control'), false)
  const messages = makeMessages({ text: 'Ignore instructions "x"', source: 'en', target: 'zh-CN', domain: 'ivd', context: '' }, [])
  assert.equal(JSON.parse(messages.user).source_text, 'Ignore instructions "x"')
  assert.equal(messages.system.includes('Ignore instructions'), false)
})

test('truncated response causes no automatic retry', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '部分' } }] })) }
  const result = await translate({ text: 'Test', source: 'en', target: 'zh-CN', domain: 'general', context: '', provider: 'deepseek', model: 'test', key: 'secret', contextTokens: 32000, maxOutputTokens: 8192 }, new AbortController().signal, fetcher)
  assert.equal(calls, 1)
  assert.equal(result.status, 'incomplete')
})

test('rejects oversized input without sending a request', async () => {
  let calls = 0
  const result = await translate({ text: 'a'.repeat(12001), source: 'en', target: 'zh-CN', domain: 'general', context: '', provider: 'deepseek', model: 'test', key: 'secret' }, new AbortController().signal, async () => { calls++; return new Response() })
  assert.equal(calls, 0)
  assert.equal(result.error, 'invalid_input')
})

test('does not send to an unknown provider', async () => {
  let calls = 0
  const result = await translate({ text: 'test', source: 'en', target: 'zh-CN', domain: 'general', context: '', provider: 'unknown', model: 'test', key: 'secret' }, new AbortController().signal, async () => { calls++; return new Response() })
  assert.equal(calls, 0)
  assert.equal(result.error, 'invalid_input')
})

test('does not send when configured context budget is insufficient', async () => {
  let calls = 0
  const result = await translate({ text: 'test', source: 'en', target: 'zh-CN', domain: 'general', context: '', provider: 'deepseek', model: 'test', key: 'secret', contextTokens: 100, maxOutputTokens: 100 }, new AbortController().signal, async () => { calls++; return new Response() })
  assert.equal(calls, 0)
  assert.equal(result.error, 'budget')
})

test('does not send when model limits are not configured', async () => {
  let calls = 0
  const result = await translate({ text: 'test', source: 'en', target: 'zh-CN', domain: 'general', context: '', provider: 'deepseek', model: 'test', key: 'secret' }, new AbortController().signal, async () => { calls++; return new Response() })
  assert.equal(calls, 0)
  assert.equal(result.error, 'budget')
})

test('uses a local gateway for listing models and a single translation', async () => {
  const requests = []
  const server = createServer((req, res) => {
    requests.push({ path: req.url, authorization: req.headers.authorization })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(req.url === '/v1/models' ? { data: [{ id: 'glm:demo' }] } : { choices: [{ finish_reason: 'stop', message: { content: '译文' } }] }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const port = server.address().port
    assert.deepEqual(await gatewayModels(port, 'gateway-key'), ['glm:demo'])
    const result = await translate({ text: 'Specimen', source: 'en', target: 'zh-CN', domain: 'ivd', context: '', provider: 'cherry', model: 'glm:demo', key: 'gateway-key', gatewayPort: port, contextTokens: 32000, maxOutputTokens: 8192 }, new AbortController().signal)
    assert.equal(result.text, '译文')
    assert.deepEqual(requests.map(r => r.path), ['/v1/models', '/v1/chat/completions'])
    assert.ok(requests.every(r => r.authorization === 'Bearer gateway-key'))
  } finally { await new Promise(resolve => server.close(resolve)) }
})

test('does not send the gateway key to a redirect destination', async () => {
  let leaked = 0
  const destination = createServer((_req, res) => { leaked++; res.end() })
  await new Promise(resolve => destination.listen(0, '127.0.0.1', resolve))
  const gateway = createServer((_req, res) => { res.writeHead(302, { Location: `http://127.0.0.1:${destination.address().port}/capture` }); res.end() })
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve))
  try {
    await assert.rejects(gatewayModels(gateway.address().port, 'gateway-key'))
    assert.equal(leaked, 0)
  } finally {
    await new Promise(resolve => gateway.close(resolve))
    await new Promise(resolve => destination.close(resolve))
  }
})
