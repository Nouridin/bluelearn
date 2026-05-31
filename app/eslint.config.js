//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  {
    ignores: [
      ".output/",
      ".nitro/",
      ".tanstack/",
      ".vinxi/",
      "dist/",
      "dist-ssr/",
      "src/routeTree.gen.ts",
    ],
  },
  ...tanstackConfig,
]
