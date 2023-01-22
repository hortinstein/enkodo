# Package

version       = "0.1.0"
author        = "akex"
description   = "A cross platform encyption and serialization library"
license       = "MIT"
srcDir        = "src"


# Dependencies

requires "nim >= 1.6.10"

requires "flatty"
requires "monocypher"

# task install, "Install the package":
#   exec "nimble install"

# task buildall, "Build the package":
#   exec "nimble build config"
#   exec "./bin/config"
#   exec "nimble build"
#   exec "nim js -d:nodejs --out:js/configjs.js -r src/configjs.nim"
  