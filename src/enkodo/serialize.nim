import std/base64
import types
import flatty
import std/strutils

when defined(js):
  import jsffi
  var module {.importc.}: JsObject

proc b64Str*(msg:string): string = 
  result = encode(msg,safe=true)
 
proc unb64str*(msg:string): string = 
  result = decode(msg)

proc serEncObj*(encObj:EncObj): string = 
  result = toFlatty(encObj)

proc desEncObj*(serEncObj:string): EncObj = 
  result = serEncObj.fromFlatty(EncObj)

when defined(js):
  module.exports.serEncObj = serEncObj
  module.exports.desEncObj = desEncObj
  module.exports.b64Str = b64Str
  module.exports.unb64Str = unb64Str
