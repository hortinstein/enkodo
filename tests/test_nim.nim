import unittest
import os
import sysrandom
import std/base64

import flatty

import enkodo

proc writeStringToFile*(fileName: string, contents: string) =
  let f = open(filename, fmWrite)
  f.write(contents)
  defer: f.close()

proc readStringFromFile*(fileName: string): string =
  let f = open(filename, fmRead)
  defer: f.close()
  result = f.readAll()

let (a_secretKey, a_publicKey) = generateKeyPair()
let (b_secretKey, b_publicKey) = generateKeyPair()
let plaintext = cast[seq[byte]]("hello this is a test string")
  
test "testing that messages can be enc then dec":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  let decObj = dec(b_secretKey,encObj)
  doAssert(plaintext == decObj)

test "testing that messages fail on bad keys":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  try:
    let decObj = dec(getRandomBytes(sizeof(Key)),encObj)
    doAssert(plaintext == decObj)
  except IOError:
    echo "failed the decryption test [caught the error]"
  
test "testing enc, serialize, deserialize, dec":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  let serEncObj = serEncObj(encObj)
  let deSerEncObj = desEncObj(serEncObj)
  let decObj = dec(b_secretKey,deSerEncObj)
  doAssert(plaintext == decObj)

test "testing base64,enc, serialize, deserialize, dec, unbase64":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  let serEncObj = serEncObj(encObj)
  let base64SerEncObj = b64Str(serEncObj)
  let unbase64SerEncObj = unb64Str(base64SerEncObj)
  let deSerEncObj = desEncObj(unbase64SerEncObj)
  let ptext = dec(b_secretKey,deSerEncObj)
  doAssert(plaintext == ptext)

test "testing wrap,unwrap":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  let wrapped = wrap(encObj)
  let unwrapped = unwrap(wrapped)
  let ptext = dec(b_secretKey,unwrapped)
  doAssert(plaintext == ptext)

test "outputting test file for JS to read and decrypt":
  let encObj = enc(a_secretKey,b_publicKey,plaintext)
  
  let b64Str = wrap(encObj)

  writeStringToFile("TESTFILE_TYPESCRIPT_ENC_BIN", b64Str)
  
  writeStringToFile("TESTFILE_TYPESCRIPT_PRIVKEY", wrapKey(b_secretKey))

test "decrypt the foundational arguments":
  let cipherText = unwrap(readStringFromFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_ENC_BIN"))
  let privKey = unwrapKey(readStringFromFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_PRIVKEY"))
  let pubKey = unwrapKey(readStringFromFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_PUBKEY"))
  let decObj = dec(privKey,cipherText)
  assert decObj == cast[seq[byte]]("FOUNDATION")


# test "testing enc on a blank message":
#   let encObj = enc(a_secretKey,b_publicKey,"")

# test "testing dec with wrong keys":
#   let encObj = enc(a_secretKey,b_publicKey,"test")
#   let decObj = dec('',encObj)


# # Kisoteki 
# test "outputting foundational file for future iterations of the code, this is to ensure subsequent versions of this library have binary compatibility with past artifacts":
#   let encObj = enc(a_secretKey,b_publicKey,plaintext)
  
#   let b64Str = wrap(encObj)

#   writeStringToFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_ENC_BIN", b64Str)
  
#   writeStringToFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_PRIVKEY", wrapKey(b_secretKey))

#   writeStringToFile("./foundational_artifacts/TESTFILE_TYPESCRIPT_PUBKEY", wrapKey(b_secretKey))