import {BN} from 'ethereumjs-util';


const fixLength = (hex: string) => hex.length % 2 ? '0' + hex : hex

/**
 * converts any value as Buffer
 *  if len === 0 it will return an empty Buffer if the value is 0 or '0x00', since this is the way rlpencode works wit 0-values.
 */
export function toBuffer(val: unknown, len = -1) {
  // @ts-ignore
  if (val && val._isBigNumber) val = val.toHexString()
  if (typeof val == 'string')
    val = val.startsWith('0x')
      ? Buffer.from((val.length % 2 ? '0' : '') + val.substr(2), 'hex')
      : val.length && (parseInt(val) || val == '0')
        ? new BN(val).toArrayLike(Buffer)
        : Buffer.from(val, 'utf8')
  else if (typeof val == 'number')
    val = val === 0 && len === 0 ? Buffer.allocUnsafe(0) : Buffer.from(fixLength(val.toString(16)), 'hex')
  else if (BN.isBN(val))
    val = val.toArrayLike(Buffer)

  if (!val) val = Buffer.allocUnsafe(0)

  // remove leading zeros
  // @ts-ignore
  while (len == 0 && val[0] === 0) val = val.slice(1)

  // since rlp encodes an empty array for a 0 -value we create one if the required len===0
  // @ts-ignore
  if (len == 0 && val.length == 1 && val[0] === 0)
    return Buffer.allocUnsafe(0)



  // if we have a defined length, we should padLeft 00 or cut the left content to ensure length
  if (len > 0 && Buffer.isBuffer(val) && val.length !== len)
    return val.length < len
      ? Buffer.concat([Buffer.alloc(len - val.length), val])
      : val.slice(val.length - len)

  return val as Buffer

}

/** padStart for legacy */
export function padStart(val: string, minLength: number, fill = ' ') {
  while (val.length < minLength)
    val = fill + val
  return val
}

/**
 * Converts a `Buffer` into a `0x`-prefixed hex `String`.
 * @param buf `Buffer` object to convert
 */
export const bufferToHex = function (buf: Buffer): string {
  buf = toBuffer(buf)
  return '0x' + buf.toString('hex')
}

/**
 * converts any value as hex-string
 */
export function toHex(val: any, bytes?: number): string | undefined {
  if (val === undefined) return undefined
  let hex: string
  if (typeof val === 'string')
    hex = val.startsWith('0x') ? val.substr(2) : (parseInt(val[0]) ? new BN(val).toString(16) : Buffer.from(val, 'utf8').toString('hex'))
  else if (typeof val === 'number')
    hex = val.toString(16)
  else if (BN.isBN(val))
    hex = val.toString(16)
  else if (val && val._isBigNumber)
    hex = val.toHexString();
  else
    hex = /* ethUtil. */ bufferToHex(val).substr(2)
  if (bytes)
    hex = padStart(hex, bytes * 2, '0') as string  // workarounf for ts-error in older js
  if (hex.length % 2)
    hex = '0' + hex
  return '0x' + hex.toLowerCase()
}

/** removes all leading 0 in the hexstring */
export function toMinHex(key: string | Buffer | number) {
  if (typeof key === 'number') {
    const k = toHex(key)
    if (k) {
      key = k;
    } else {
      throw new Error('???')
    }
  }

  if (typeof key === 'string') {
    key = key.trim()

    if (key.length < 3 || key[0] != '0' || key[1] != 'x')
      throw new Error("Only Hex format is supported. Given value " + key + " is not valid Hex ")

    for (let i = 2; i < key.length; i++) {
      if (key[i] !== '0')
        return '0x' + key.substr(i)
    }
  }
  else if (Buffer.isBuffer(key)) {
    const hex = key.toString('hex')
    for (let i = 0; i < hex.length; i++) {
      if (hex[i] !== '0')
        return '0x' + hex.substr(i)
    }
  }
  return '0x0'
}

/**
 * converts to a js-number
 */
export function toNumber(val: any): number {
  switch (typeof val) {
    case 'number':
      return val
    case 'string':
      return parseInt(val)
    default:
      if (Buffer.isBuffer(val))
        return val.length == 0 ? 0 : parseInt(toMinHex(val))
      else if (BN.isBN(val))
        return val.bitLength() > 53 ? toNumber(val.toArrayLike(Buffer)) : val.toNumber()
      else if (val && val._isBigNumber)
        try {
          return val.toNumber()
        }
        catch (ex) {
          return toNumber(val.toHexString())
        }
      else if (val === undefined || val === null)
        return 0
      throw new Error('can not convert a ' + (typeof val) + ' to number')
  }
}

/** converts it to a Buffer with 256 bytes length */
// @ts-ignore
export const bytes256 = val => toBuffer(val, 256)
/** converts it to a Buffer with 32 bytes length */
// @ts-ignore
export const bytes32 = val => toBuffer(val, 32)
/** converts it to a Buffer with 8 bytes length */
// @ts-ignore
export const bytes8 = val => toBuffer(val, 8)
/** converts it to a Buffer  */
// @ts-ignore
export const bytes = val => toBuffer(val)
/** converts it to a Buffer with 20 bytes length */
// @ts-ignore
export const address = val => toBuffer(val, 20)
/** converts it to a Buffer with a variable length. 0 = length 0*/
// @ts-ignore
export const uint = val => toBuffer(val, 0)
