const path = require('path')
const test = require('tape')
const CLIEngine = require('eslint').CLIEngine
const plugin = require('../dist')

function execute(file, baseConfig) {
  if (!baseConfig) baseConfig = {}

  const cli = new CLIEngine({
    extensions: ['page', 'component'],
    baseConfig: {
      settings: baseConfig.settings,
      rules: Object.assign({}, baseConfig.rules),
    },
    ignore: false,
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    },
    useEslintrc: false,
    fix: baseConfig.fix,
  })

  cli.addPlugin("visualforce", plugin)
  const results = cli.executeOnFiles([ path.join(__dirname, 'fixtures', file) ]).results[0]
  return baseConfig.fix ? results : results && results.messages
}

test('Merge field in JS expression context', assert => {
  assert.plan(2)

  const messages = execute('simple.page', {
    rules: {
      'visualforce/no-atom-expr': 'error'
    }
  })

  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0], { ruleId: 'visualforce/no-atom-expr',
    severity: 2,
    message: 'VisualForce merge fields should only be allowed in strings',
    line: 5,
    column: 19,
    nodeType: 'VFELExpression',
    source: 'var fooz =  {! apexVariable }',
    fix: { range: [ 115, 132 ], text: 'JSON.parse(\'{! apexVariable }\')' }
  })

})

test('Autofixing merge fields in JS expression context', assert => {
  assert.plan(1)

  const result = execute('fix.page', {
    rules: {
      'visualforce/no-atom-expr': 'error'
    },
    fix: true
  })

  assert.equals(result.output, `<apex:page>
<script>
if(JSON.parse('{! apexVariable }')) alert(1)
</script>
</apex:page>
`)

})

test('<apex:*> tags in Javascript', assert => {
  assert.plan(1)

  const messages = execute('apex-tags-in-script.page', {
    rules: {
      'visualforce/no-apex-tags': 'error'
    }
  })

  assert.deepEqual(messages[0], { ruleId: 'visualforce/no-apex-tags',
    severity: 2,
    message: 'VisualForce standard components (<apex:*> tags) are not allowed in Javascript',
    line: 7,
    column: 28,
    nodeType: 'JSXElement',
    source: 'var someVariable = <apex:outputText value="{!someVariable}" escape="false"></apex:outputText>'
  })

})

test('JSENCODE of Apex variables', assert => {
  assert.plan(6)

  const messages = execute('jsencode.page', {
    rules: {
      'visualforce/jsencode': 'error'
    }
  })

  assert.equals(messages.length, 5, 'There are exactly 5 tainted variables')

  assert.deepEqual(messages[0], {
    line: 5,
    column: 22,
    fix: { range: [ 118, 130 ], text: 'JSENCODE(apexVariable)' },
    message: 'JSENCODE() must be applied to all rendered Apex variables',
    nodeType: 'VFELIdentifier',
    ruleId: 'visualforce/jsencode',
    severity: 2,
    source: 'var foo =  \'{! apexVariable }\'',
  })

  assert.deepEqual(messages[1], {
    line: 6,
    column: 57,
    fix: { range: [ 190, 205 ], text: 'JSENCODE(taintedVariable)' },
    message: 'JSENCODE() must be applied to all rendered Apex variables',
    nodeType: 'VFELIdentifier',
    ruleId: 'visualforce/jsencode',
    severity: 2,
    source: 'var bar =  "{! IF(LEN(apexVariable)>5, \'bazinga\', taintedVariable) }"',
  })

  assert.deepEqual(messages[2], {
    line: 7,
    column: 44,
    fix: { range: [ 253, 259 ], text: 'JSENCODE(result)' },
    message: 'JSENCODE() must be applied to all rendered Apex variables',
    nodeType: 'VFELIdentifier',
    ruleId: 'visualforce/jsencode',
    severity: 2,
    source: 'var baz = "{! CASE(condition, value, result) }"',
  })

  assert.deepEqual(messages[3], {
    line: 9,
    column: 33,
    fix: { range: [ 361, 391 ], text: 'JSENCODE($CurrentPage.parameters.retURL)' },
    message: 'JSENCODE() must be applied to all rendered Apex variables',
    nodeType: 'VFELIdentifier',
    ruleId: 'visualforce/jsencode',
    severity: 2,
    source: 'var unsafeSystemVar = \'{! $CurrentPage.parameters.retURL }\'',
  })

  assert.deepEqual(messages[4], {
    line: 10,
    column: 36,
    fix: { range: [ 430, 456 ], text: 'JSENCODE(some.array[another[field]])' },
    message: 'JSENCODE() must be applied to all rendered Apex variables',
    nodeType: 'VFELMemberExpression',
    ruleId: 'visualforce/jsencode',
    severity: 2,
    source: 'var selectorExpression = "{! some.array[another[field]] }"',
  })

})
