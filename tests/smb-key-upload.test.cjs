const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

// Exercise the TypeScript service without starting Electron or contacting a phone.
const root = path.resolve(__dirname, '..')
const modules = new Map()
function load(file) {
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = (name) => {
    if (name === 'electron') return { app: {} }
    if (name.startsWith('@shared/')) return load(path.join(root, 'src/shared', name.slice(8) + '.ts'))
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'))
    return require(name)
  }
  const wrapper = vm.runInThisContext(`(function(require,module,exports,__dirname){${compiled}\n})`, { filename: file })
  wrapper(localRequire, module, module.exports, path.dirname(file))
  return module.exports
}
const { Bb10SmbClient } = load(path.join(root, 'src/main/services/bb10-smb-client.ts'))

async function withClient(fn) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'berrybridge-key-test-'))
  const key = path.join(temp, 'id_rsa_bb10.pub')
  fs.writeFileSync(key, 'ssh-rsa TEST public-key-only\n')
  const client = Object.create(Bb10SmbClient.prototype)
  try { await fn(client, key) } finally { fs.rmSync(temp, { recursive: true, force: true }) }
}

for (const [share, directory] of [
  ['media', 'accounts/1000/shared/documents'],
  ['media', 'documents'],
  ['media', 'shared/documents'],
  ['documents', '']
]) {
  test(`key and instructions use ${share}/${directory || '(root)'}`, () => withClient(async (client, key) => {
    const uploads = []
    client.listDirectory = async (host, actualShare, password, dir, username) => {
      assert.deepEqual([host, actualShare, password, username], ['phone', share, 'test-password', 'blackberry'])
      if (dir !== directory) throw new Error('NT_STATUS_OBJECT_PATH_NOT_FOUND')
      return [] // An empty Documents directory is valid.
    }
    client.uploadFile = async (host, actualShare, password, local, remote, username) => {
      uploads.push({ local, remote, contents: fs.readFileSync(local, 'utf8') })
      assert.equal(actualShare, share)
      assert.equal(username, 'blackberry')
    }
    const result = await client.provisionSshKey('phone', share, 'test-password', key, 'blackberry')
    const prefix = directory ? directory + '/' : ''
    assert.deepEqual(uploads.map(u => u.remote), [prefix + 'id_rsa_bb10.pub', prefix + 'term49-ssh-key-install.txt'])
    assert.match(uploads[1].contents, /cat \/accounts\/1000\/shared\/documents\/id_rsa_bb10.pub/)
    assert.equal(result.keyFileName, 'id_rsa_bb10.pub')
    assert.equal(fs.existsSync(uploads[1].local), false)
  }))
}

test('missing Documents fails before uploading, even when media root is readable', () => withClient(async (client, key) => {
  client.listDirectory = async (_host, _share, _password, dir) => {
    if (dir === '') return []
    throw new Error('NT_STATUS_OBJECT_PATH_NOT_FOUND')
  }
  client.uploadFile = async () => assert.fail('must not upload into an unknown directory')
  await assert.rejects(client.provisionSshKey('phone', 'media', 'test-password', key), /Could not find the Documents directory/)
}))

test('failed script upload removes the temporary script', () => withClient(async (client, key) => {
  let script
  client.listDirectory = async () => []
  client.uploadFile = async (_host, _share, _password, local) => {
    if (local !== key) { script = local; throw new Error('upload failed') }
  }
  await assert.rejects(client.provisionSshKey('phone', 'media', 'test-password', key), /upload failed/)
  assert.ok(script)
  assert.equal(fs.existsSync(script), false)
}))
