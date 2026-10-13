/// <reference types="astro/client" />

declare module "virtual:astro-d1-reactions/config" {
  type Config = import("./config").ResolvedD1ReactionsConfig;
  const config: Config & { icons: import("./config").ReactionsIcons };
  export default config;
  export const apiRoute: Config["apiRoute"];
  export const maxHearts: Config["maxHearts"];
  export const maxText: Config["maxText"];
  export const thanks: Config["thanks"];
  export const icons: import("./config").ReactionsIcons;
}

// Only for type-checking this repo: `astro check` in the consuming project
// reads the components' real props.
declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
