# Package

version       = "0.1.5"
author        = "Alex"
description   = "A cross platform encyption and serialization library"
license       = "MIT"
srcDir        = "src"


# Dependencies

requires "nim >= 1.0.00"

requires "flatty == 0.3.4"
requires "monocypher == 0.2.1"

# task install, "Install the package":
#   exec "nimble install"

task buildjs, "Build the package":
  exec "nim js --out:typescript/serialize.js -r src/enkodo/serialize.nim"
  exec "nim js --out:node/serialize.js -r src/enkodo/serialize.nim"
  