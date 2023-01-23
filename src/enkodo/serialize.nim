import std/base64
import types
import flatty

when defined(js):
  import jsffi
  var module {.importc.}: JsObject

#helper function that allows type consistency with javascript
proc returnEncObj*( publicKey: Key, 
                    nonce: Nonce, 
                    mac: Mac,
                    cipherLen:  int, 
                    cipherText: seq[byte]): EncObj = 
  return EncObj( publicKey: publicKey, 
                 nonce: nonce, 
                 mac: mac,
                 cipherLen: cipherLen, 
                 cipherText: cipherText)

proc b64Str*(msg:string): string = 
  result = encode(msg,safe=true)
 
proc unb64str*(msg:string): string = 
  result = decode(msg)

proc serEncObj*(encObj:EncObj): string = 
  result = toFlatty(encObj)

proc desEncObj*(serEncObj:string): EncObj = 
  result = serEncObj.fromFlatty(EncObj)

proc wrap*(encObj: EncObj): string = 
  var serEncObj = serEncObj(encObj)
  var b64SerEncObj = b64Str(serEncObj)
  return b64SerEncObj

proc unwrap*(b64SerEncObj:string): EncObj =
  var serEncObj = unb64str(b64SerEncObj)
  var encObj = desEncObj(serEncObj)
  return encObj

when defined(js):
  module.exports.returnEncObj = returnEncObj
  module.exports.serEncObj = serEncObj
  module.exports.desEncObj = desEncObj
  module.exports.b64Str = b64Str
  module.exports.unb64Str = unb64Str
  module.exports.wrap = wrap
  module.exports.unwrap = unwrap
