# Package

version       = "0.1.0"
author        = "Alex"
description   = "A cross platform encyption and serialization library"
license       = "MIT"
srcDir        = "src"


# Dependencies

requires "nim >= 1.6.10"

requires "flatty"
requires "monocypher"

# task install, "Install the package":
#   exec "nimble install"

task buildjs, "Build the package":
  exec "nim js -d:nodejs --out:typescript/serialize.js -r src/enkodo/serialize.nim"