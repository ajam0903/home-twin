// Runs tools/maya/home_twin.py with Maya's Python:  node tools/maya/run.mjs build
// Uses MAYAPY if set, else the newest Maya under C:\Program Files\Autodesk.
// The script is started through `mayapy -c`: on this machine, passing a script
// file to mayapy sometimes crashes Maya while it starts up.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const script = resolve(here, 'home_twin.py').replace(/\\/g, '/')

function findMayapy() {
  if (process.env.MAYAPY) return process.env.MAYAPY
  const base = 'C:\\Program Files\\Autodesk'
  if (!existsSync(base)) return null
  const versions = readdirSync(base).filter((d) => /^Maya\d{4}$/.test(d)).sort().reverse()
  for (const v of versions) {
    const p = join(base, v, 'bin', 'mayapy.exe')
    if (existsSync(p)) return p
  }
  return null
}

const mayapy = findMayapy()
if (!mayapy) {
  console.error('Could not find mayapy. Set MAYAPY to its full path.')
  process.exit(1)
}
const args = process.argv.slice(2)
const code = `import runpy, sys; sys.argv = ${JSON.stringify([script, ...args])}; runpy.run_path(${JSON.stringify(script)}, run_name='__main__')`
const res = spawnSync(mayapy, ['-c', code], { stdio: 'inherit' })
process.exit(res.status ?? 1)
