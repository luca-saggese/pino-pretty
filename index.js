'use strict'

const chalk = require('chalk')
const jmespath = require('jmespath')
const colors = require('./lib/colors')
const { ERROR_LIKE_KEYS, MESSAGE_KEY } = require('./lib/constants')
const {
  isObject,
  prettifyErrorLog,
  prettifyLevel,
  prettifyMessage,
  prettifyMetadata,
  prettifyObject,
  prettifyTime
} = require('./lib/utils')

const bourne = require('bourne')
const jsonParser = input => {
  try {
    return { value: bourne.parse(input, { protoAction: 'remove' }) }
  } catch (err) {
    return { err }
  }
}

const defaultOptions = {
  colorize: chalk.supportsColor,
  crlf: false,
  errorLikeObjectKeys: ERROR_LIKE_KEYS,
  errorProps: '',
  levelFirst: false,
  messageKey: MESSAGE_KEY,
  translateTime: false,
  useMetadata: false,
  outputStream: process.stdout
}

module.exports = function prettyFactory (options) {
  const opts = Object.assign({}, defaultOptions, options)
  const EOL = opts.crlf ? '\r\n' : '\n'
  const IDENT = '    '
  const messageKey = opts.messageKey
  const errorLikeObjectKeys = opts.errorLikeObjectKeys
  const errorProps = opts.errorProps.split(',')
  const ignoreKeys = opts.ignore ? new Set(opts.ignore.split(',')) : undefined

  const colorizer = colors(opts.colorize)
  const search = opts.search
  const min_level = parseInt(opts.level)

  return pretty

  function pretty (inputData) {
    let log
    if (!isObject(inputData)) {
      const parsed = jsonParser(inputData)
      log = parsed.value
      if (parsed.err) {
        // pass through
        return inputData + EOL
      }
    } else {
      log = inputData
    }

    // Short-circuit for spec allowed primitive values.
    if ([null, true, false].includes(log)) {
      return `${log}\n`
    }

    if (search && !jmespath.search(log, search)) {
      return
    }
    
    if (min_level && log.level && parseInt(log.level) < min_level) {
      return
    }

    if (ignoreKeys) {
      log = Object.keys(log)
        .filter(key => !ignoreKeys.has(key))
        .reduce((res, key) => {
          res[key] = log[key]
          return res
        }, {})
    }

    const prettifiedLevel = prettifyLevel({ log, colorizer })
    const prettifiedMessage = prettifyMessage({ log, messageKey, colorizer })
    const prettifiedMetadata = prettifyMetadata({ log })
    const prettifiedTime = prettifyTime({ log, translateFormat: opts.translateTime })

    let line = ''
    if (opts.levelFirst && prettifiedLevel) {
      line = `${prettifiedLevel}`
    }

    if (prettifiedTime && line === '') {
      line = `${prettifiedTime}`
    } else if (prettifiedTime) {
      line = `${line} ${prettifiedTime}`
    }

    if (!opts.levelFirst && prettifiedLevel) {
      if (line.length > 0) {
        line = `${line} ${prettifiedLevel}`
      } else {
        line = prettifiedLevel
      }
    }

    if (prettifiedMetadata) {
      line = `${line} ${prettifiedMetadata}:`
    }

    if (line.endsWith(':') === false && line !== '') {
      line += ':'
    }

    if (prettifiedMessage) {
      line = `${line} ${prettifiedMessage}`
    }

    if (line.length > 0) {
      line += EOL
    }

    if (log.type === 'Error' && log.stack) {
      const prettifiedErrorLog = prettifyErrorLog({
        log,
        errorLikeKeys: errorLikeObjectKeys,
        errorProperties: errorProps,
        ident: IDENT,
        eol: EOL
      })
      line += prettifiedErrorLog
    } else {
      const skipKeys = typeof log[messageKey] === 'string' ? [messageKey] : undefined
      const prettifiedObject = prettifyObject({
        input: log,
        skipKeys,
        errorLikeKeys: errorLikeObjectKeys,
        eol: EOL,
        ident: IDENT
      })
      line += prettifiedObject
    }

    return line
  }
}
