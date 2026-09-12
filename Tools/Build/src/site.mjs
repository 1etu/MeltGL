import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const out = process.argv[2] ?? resolve(root, 'Website/index.artifact.html')
const html = readFileSync(resolve(root, 'Website/index.html'), 'utf8')
const bundle = readFileSync(resolve(root, 'Website/meltgl.min.js'), 'utf8')
const logo = readFileSync(resolve(root, 'Website/teapot.png')).toString('base64')

const expblk = bundle.match(/export\s*\{([\s\S]*?)\};?\s*(\/\/# sourceMappingURL=.*)?\s*$/)
if (!expblk) throw new Error('bundle has no export block')
const done = expblk[1]
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [local, , name] = entry.split(/\s+/)
    return { local, name: name ?? local }
  })
const library = bundle.slice(0, expblk.index)

const moduleMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/)
if (!moduleMatch) throw new Error('page has no module script')
const importMatch = moduleMatch[1].match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/meltgl\.js['"]\s*;?/)
if (!importMatch) throw new Error('page module does not import ./meltgl.js')

const names = importMatch[1].split(',').map((name) => name.trim()).filter(Boolean)
const aliases = names
  .map((name) => {
    const entry = done.find((candidate) => candidate.name === name)
    if (!entry) throw new Error(`bundle does not export ${name}`)
    return entry.local === name ? '' : `const ${name} = ${entry.local};`
  })
  .filter(Boolean)
  .join('\n')

const page = moduleMatch[1].replace(importMatch[0], '')
const combined = `<script type="module">\n${library}\n${aliases}\n${page}\n</script>`

const hs = html.indexOf('<title>')
const he = html.indexOf('</head>')
const bs = html.search(/<body[^>]*>/)
const bte = html.indexOf('>', bs) + 1
const be = html.lastIndexOf('</body>')
if (hs < 0 || he < 0 || bs < 0 || be < 0) throw new Error('page is missing title, head or body')

const head = html.slice(hs, he)
let body = html.slice(bte, be)
body = body.replace(moduleMatch[0], () => combined)

let result = head + body
const logoPattern = /(src=)(["'])[^"']*teapot\.png\2/g
const count = (result.match(logoPattern) ?? []).length
if (count === 0) throw new Error('no teapot.png src attribute found in the page')
result = result.replace(logoPattern, (_, prefix, quote) => `${prefix}${quote}data:image/png;base64,${logo}${quote}`)

writeFileSync(out, result)
console.log(`wrote ${out} (${result.length} bytes, ${count} logo reference${count === 1 ? '' : 's'} inlined)`)
