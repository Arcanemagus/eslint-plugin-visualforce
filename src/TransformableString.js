/**
 * @author Benoît Zugmeyer, Marat Vyshegorodtsev
 * @license ISC
 * For full license text, see LICENSE file in the repo root
 * or https://opensource.org/licenses/ISC
 */

function lineStarts (str) {
  const result = [ 0 ]
  const re = /\r\n|\r|\n/g
  for(;;) {
    const match = re.exec(str)
    if (!match) break
    result.push(re.lastIndex)
  }
  return result
}

function locationToIndex (location, lineStarts) {
  if (!location.line || location.line < 0 || !location.column || location.column < 0)
    throw new Error('Invalid location')

  return lineStarts[location.line - 1] + location.column - 1
}

function indexToLocation (index, lineStarts) {
  if (index < 0) throw new Error('Invalid index')

  let line = 0
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= index)
    line += 1


  return {
    line: line + 1,
    column: index - lineStarts[line] + 1,
  }
}

module.exports = class TransformableString {
  constructor (original) {
    this._original = original
    this._blocks = []
    this._lineStarts = lineStarts(original)
    this._cache = null
  }

  _compute () {
    if (!this._cache) {
      let result = ''
      let index = 0
      for (const block of this._blocks) {
        result += this._original.slice(index, block.from) + block.str
        index = block.to
      }
      result += this._original.slice(index)
      this._cache = {
        lineStarts: lineStarts(result),
        result,
      }
    }
    return this._cache
  }

  toString () {
    return this._compute().result
  }

  replace (from, to, str) {
    this._cache = null
    if (from > to || from < 0 || to > this._original.length)
      throw new Error('Invalid slice indexes')

    const newBlock = {
      from,
      to,
      str,
    }
    if (!this._blocks.length || this._blocks[this._blocks.length - 1].to <= from)
      this._blocks.push(newBlock)

    else {
      const index = this._blocks.findIndex(other => other.to > from)
      if (this._blocks[index].from < to) throw new Error("Can't replace slice")
      this._blocks.splice(index, 0, newBlock)
    }
  }

  originalIndex (index) {
    for (const block of this._blocks) {
      if (index < block.from) break

      if (index < block.from + block.str.length)
        return

      else
        index += block.to - block.from - block.str.length

    }
    if (index < 0 || index > this._original.length) throw new Error('Invalid index')
    return index
  }

  originalLocation (location) {
    const index = locationToIndex(location, this._compute().lineStarts)
    const originalIndex = this.originalIndex(index)
    if (originalIndex !== undefined) {
      const originalLocation = indexToLocation(originalIndex, this._lineStarts)
      return originalLocation
    }
  }
}
