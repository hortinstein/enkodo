# This is just an example to get you started. You may wish to put all of your
# tests into a single file, or separate them into multiple `test1`, `test2`
# etc. files (better names are recommended, just make sure the name starts with
# the letter 't').
#
# To run these tests, simply execute `nimble test`.

import unittest
import monocypher
import sysrandom

import enkodo
import enkodo/types
import enkodo/serialize

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
    echo "failed the decryption test"
  
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

# test "testing enc on a blank message":
#   let encObj = encObj(a_secretKey,b_publicKey,'')

# test "testing dec with wrong keys":
#   let encObj = encObj(a_secretKey,b_publicKey,'test')
#   let decObj = decObj('',encObj)
  
