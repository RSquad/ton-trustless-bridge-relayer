import {keccak, rlp} from 'ethereumjs-util';


function matchingNibbleLength(a: number[], b: number[]) {
  const i = a.findIndex((_, i) => _ !== b[i])
  return i < 0 ? a.length : i + 1
}

// create the nibbles of a path
const hexToInt = {'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, a: 10, b: 11, c: 12, d: 13, e: 14, f: 15}

function stringToNibbles(bkey: Buffer): number[] {
  // @ts-ignore
  return bkey.toString('hex').split('').map(_ => hexToInt[_])
}

class Node {
  raw: Buffer[]  // raw input node data
  key: number[] = [] // keys
  value: Buffer = Buffer.from('') // new Buffer('')  // value
  type: 'branch' | 'leaf' | 'extension' | 'empty'

  constructor(data: Buffer[]) {
    this.raw = data
    if (data.length === 17) {
      this.type = 'branch'
      this.value = data[16]
    }
    else if (data.length === 2) {
      this.type = (data[0][0] >> 4) > 1 ? 'leaf' : 'extension'
      this.value = data[1]
      this.key = stringToNibbles(data[0]).slice((data[0][0] >> 4) % 2 ? 1 : 2)
      console.log(stringToNibbles(data[0]), (data[0][0] >> 4), (data[0][0] >> 4) % 2 ? 1 : 2, this.key)
    }
    else if (data.length === 0)
      this.type = 'empty'
    else {
      throw new Error('Unknown type');
    }
  }
}

export async function verifyMerkleProof(
  rootHash: Buffer,
  path: Buffer,
  proof: Buffer[],
  expectedValue: Buffer, // receipt.serialize()
  errorMsg?: string,
) {

  // prepare Error-Message
  const errorPrefix = errorMsg ? errorMsg + ' : ' : ''

  // create the nibbles to iterate over the path
  const key = stringToNibbles(path)

  // start with the root-Hash
  let wantedHash = rootHash
  let lastNode: Node | null = null

  // iterate through the nodes starting at root
  for (let i = 0; i < proof.length; i++) {
    const p = proof[i]
    const hash = keccak(p)

    // verify the hash of the node
    if (Buffer.compare(hash, wantedHash)) {
      console.log(hash.toString('hex'), wantedHash.toString('hex'))
      throw new Error('Bad proof node ' + i + ': hash mismatch')

    }

    // create the node
    const node = lastNode = new Node(rlp.decode(p) as any)

    console.log(wantedHash.toString('hex'));

    switch (node.type) {
      case 'empty':
        if (i == 0 && expectedValue === null)
          return null
        throw new Error('invalid empty node here')
      case 'branch':
        // we reached the end of the path
        if (key.length === 0) {
          if (i !== proof.length - 1)
            throw new Error(errorPrefix + 'Additional nodes at end of proof (branch)')

          // our value is a branch, but we can return the value
          // TODO does this make sense?
          return node.value
        }

        // find the childHash
        const childHash = node.raw[key[0]] as Buffer
        // remove the first item
        key.splice(0, 1)

        if (childHash.length === 2) {
          const embeddedNode = new Node(childHash as any as Buffer[])
          if (i !== proof.length - 1)
            throw new Error(errorPrefix + 'Additional nodes at end of proof (embeddedNode)')

          if (matchingNibbleLength(embeddedNode.key, key) !== embeddedNode.key.length)
            throw new Error(errorPrefix + 'Key length does not match with the proof one (embeddedNode)')

          key.splice(0, embeddedNode.key.length)
          if (key.length !== 0)
            throw new Error(errorPrefix + 'Key does not match with the proof one (embeddedNode)')

          // all is fine we return the value
          return embeddedNode.value
        }
        else
          wantedHash = childHash
        break


      case 'leaf':
      case 'extension':
        const val = node.value
        console.log('node key:', node.key);
        // if the relativeKey in the leaf does not math our rest key, we throw!
        if (matchingNibbleLength(node.key, key) !== node.key.length) {
          // so we have a wrong leaf here, if we actually expected this node to not exist,
          // the last node in this path may be a different leaf or a branch with a empty hash
          if (key.length === node.key.length && i === proof.length - 1 && expectedValue === null)
            return val

          throw new Error(errorPrefix + 'Key does not match with the proof one (extention|leaf)')
        }

        // remove the items
        key.splice(0, node.key.length)

        if (key.length === 0) {
          if (i !== proof.length - 1)
            throw new Error(errorPrefix + 'Additional nodes at end of proof (extention|leaf)')

          // if we are expecting a value we need to check
          if (expectedValue && expectedValue.compare(val))
            throw new Error(errorPrefix + ' The proven value was expected to be ' + expectedValue.toString('hex') + ' but is ' + val.toString('hex'))

          // if we are proven a value which shouldn't exist this must throw an error
          if (expectedValue === null)
            throw new Error(errorPrefix + ' The value shouldn\'t exist, but is ' + val.toString('hex'))

          return val
        } else
          // we continue with the hash
          wantedHash = val
        break

      default:
        throw new Error(errorPrefix + 'Invalid node type')

    }

  }

  // if we expected this to be null and there is not further node since wantedHash is empty or we had a extension as last element, than it is ok not to find leafs
  if (expectedValue === null && (lastNode === null || lastNode.type === 'extension' || wantedHash.length === 0))
    return null

  // we reached the end of the proof, but not of the path
  throw new Error('Unexpected end of proof')
}

