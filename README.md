# node-rpg

## Requirements:

[here](https://tauri.app/v1/guides/getting-started/prerequisites)

## Instructions

1- install dependencies

```sh
pnpm install
```

2- Run the App in development mode:

```sh
pnpm tauri:dev
```

note that the first run will take time as tauri download and compile dependencies.

## Production

when you are happy with the results and ready to ship your useless app.

run:

```sh
pnpm tauri:build
```

## Notes:

Codemirror 6 + https://www.npmjs.com/package/@typescript/vfs
Some discussion here: https://discuss.codemirror.net/t/codemirror-6-and-typescript-lsp/3398/3
