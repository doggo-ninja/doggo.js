# Doggo.js

A fully-typed JavaScript client for [Pat](https://pat.doggo.ninja/v1/docs), Doggo.Ninja's public API. 

This package is unstable until Project Wolfsbane is fully released.

``` bash
# NPM
npm install doggo.js
# PNPM
pnpm install doggo.js
# Yarn
yarn add doggo.js
# Bun
bun add doggo.js
```

```ts
import { PatClient } from 'doggo.js'

const pat = new PatClient()
pat.authenticate('token') // No error checking

console.log(await pat.me())
```