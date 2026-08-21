import esbuild from "esbuild"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const minify = !process.argv.includes("--no-minify")
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
const moduleId = packageJson.name

mkdirSync(resolve(root, "dist"), { recursive: true })
mkdirSync(resolve(root, "lib"), { recursive: true })

await esbuild.build({
  entryPoints: [resolve(root, "src/client/entry.tsx")],
  bundle: true,
  outfile: resolve(root, "dist/client.cjs"),
  format: "cjs",
  platform: "browser",
  jsx: "automatic",
  target: ["es2020"],
  sourcemap: false,
  minify,
  external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
  plugins: [{
    name: "inline-css",
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, (args) => ({
        contents: readFileSync(args.path, "utf8"),
        loader: "text",
      }))
    },
  }],
})

const app = readFileSync(resolve(root, "dist/client.cjs"), "utf8")
const wrapped = [
  "window.__ModuleLoader__.load({",
  `  id: ${JSON.stringify(moduleId)},`,
  "  factory: function (require) {",
  "    var module = { exports: {} }",
  "    var exports = module.exports",
  app,
  "    return (module.exports && module.exports.default) || module.exports",
  "  },",
  "})",
].join("\n")
writeFileSync(resolve(root, "client/client.js"), wrapped)
copyFileSync(resolve(root, "src/host/index.js"), resolve(root, "lib/index.js"))
console.log(`✓ built ${moduleId} client (${wrapped.length} bytes) and host`)
