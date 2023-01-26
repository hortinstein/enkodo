import { enc, dec, generateKeyPair } from "./main.ts";
import { encrypt_decrypt, wrap_unwrap } from "./main_test.ts";

Deno.bench(encrypt_decrypt);
Deno.bench(wrap_unwrap);