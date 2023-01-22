import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.166.0/testing/asserts.ts";
import { createRequire } from "https://deno.land/std@0.103.0/node/module.ts";

import { enc, dec, generateKeyPair } from "./main.ts";

export function encrypt_decrypt() {
  const hello_world = new TextEncoder().encode("Hello World");
  const [priv, pub] = generateKeyPair();
  const [priv2, pub2] = generateKeyPair();

  const [pub3, nonce, mac, cipher] = enc(priv, pub2, hello_world);

  const plain = dec(priv2, pub, nonce, mac, cipher);

  assertEquals(hello_world, plain);
}

function encserdesdec() {
  const hello_world = new TextEncoder().encode("Hello World");
  const [priv, pub] = generateKeyPair();
  const [priv2, pub2] = generateKeyPair();

  const [pub3, nonce, mac, cipher] = enc(priv, pub2, hello_world);

  const plain = dec(priv2, pub, nonce, mac, cipher);

  assertEquals(hello_world, plain);
}

// this function tests whether the encryption and decryption functions work
Deno.test(encrypt_decrypt);
