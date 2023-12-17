
import unittest
import os
import sysrandom
import std/base64

import flatty
import enkodo
import test_nim

test "decrypt the foundational arguments":
  let cipherText = unwrap(readStringFromFile("./foundational_artifacts/ARTIFACT_ENC_BIN"))
  let privKey = unwrapKey(readStringFromFile("./foundational_artifacts/ARTIFACT_B_PRIVKEY"))
  let decObj = dec(privKey,cipherText)
  assert decObj == cast[seq[byte]]("FOUNDATION")

