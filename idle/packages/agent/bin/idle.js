#!/usr/bin/env node
// "IDLE" — https://idle.app

import { main } from "../src/cli.js";

main()
  .then((code) => {
    // A hook must never take a coding session down with it.
    process.exitCode = typeof code === "number" ? code : 0;
  })
  .catch(() => {
    process.exitCode = 0;
  });
