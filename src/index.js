const {createMacro} = require('babel-plugin-macros')

module.exports = createMacro(reanimatedMacro)

const unaryOps = {
  '!': 'not',
}
const binaryOps = {
  '===': 'eq',
  '+': 'add',
  '||': 'or',
  '-': 'sub',
  '**': 'pow',
  '*': 'multiply',
  '/': 'divide',
  '<': 'lessThan',
  '%': 'modulo',
  '>': 'greaterThan',
  '<=': 'lessOrEq',
  '>=': 'greaterOrEq',
  '!==': 'neq',
  '&&': 'and',
}

const reanimatedImports = [
  'Animated',
  'cond',
  'set',
  'defined',
  'not',
  'and',
  'or',
  'sub',
  'pow',
  'multiply',
  'divide',
  'lessThan',
  'modulo',
  'greaterThan',
  'lessOrEq',
  'greaterOrEq',
  'neq',
  'add',
  'eq',
  'block',
]

function reanimatedMacro({
  references: {define = [], exec = []},
  state,
  babel: {types: t},
}) {
  const hubPath = state.file.path
  const importedIdentifiers = Object.assign(
    Object.create(null),
    ...reanimatedImports.map(name => ({
      [name]: hubPath.scope.generateUidIdentifier(name),
    })),
  )

  hubPath.unshiftContainer(
    'body',
    t.importDeclaration(
      Object.keys(importedIdentifiers).map(key =>
        t.importSpecifier(importedIdentifiers[key], t.identifier(key)),
      ),
      t.stringLiteral('react-native-reanimated'),
    ),
  )

  const returnVisitor = {
    ReturnStatement(path, returnVisitorState) {
      returnVisitorState.returnFound = true

      // remove dead code after return statement
      for (const sibling of path.getAllNextSiblings()) {
        sibling.remove()
      }

      path.replaceWith(
        t.assignmentExpression(
          '=',
          returnVisitorState.earlyReturn,
          path.get('argument').node,
        ),
      )
    },
    IfStatement(path) {
      path.skip()
    },
  }

  const ifVisitor = {
    IfStatement(path, {earlyReturn, ifsWithReturns}) {
      const returnVisitorState = {earlyReturn}
      path.get('consequent').traverse(returnVisitor, returnVisitorState)
      path.get('alternate').traverse(returnVisitor, returnVisitorState)

      // eslint-disable-next-line no-use-before-define
      path.get('consequent').traverse(blockVisitor, {earlyReturn})
      // eslint-disable-next-line no-use-before-define
      path.get('alternate').traverse(blockVisitor, {earlyReturn})
      if (returnVisitorState.returnFound) {
        ifsWithReturns.push(path)
      }
    },
    BlockStatement(path) {
      path.skip()
    },
  }

  const blockVisitor = {
    BlockStatement(path, {earlyReturn}) {
      const ifsWithReturns = []
      const ifVisitorState = {earlyReturn, ifsWithReturns, blockParent: path}
      path.traverse(ifVisitor, ifVisitorState)

      for (let count = ifsWithReturns.length - 1; count >= 0; count--) {
        const ifPath = ifsWithReturns[count]

        // collect up trailing statements after this if statement and remove them,
        // so they can be nested in an else clause which runs if there was no
        // early return.
        const tailStatements = []

        const nextSiblings = ifPath.getAllNextSiblings()
        if (nextSiblings.length) {
          // Collect up all statements following the if statement
          // that contains a return
          for (const siblingPath of nextSiblings) {
            tailStatements.push(siblingPath.node)
            siblingPath.remove()
          }

          // Surround IfStatement with a block,
          // and conditionally execute subsequent statements
          // only if the prior IfStatement did not return
          ifPath.replaceWith(
            t.blockStatement([
              ifPath.node,
              t.ifStatement(
                t.callExpression(importedIdentifiers.defined, [earlyReturn]),
                t.returnStatement(earlyReturn),
                t.blockStatement(tailStatements),
              ),
            ]),
          )
        }
      }
    },
    IfStatement(path) {
      path.skip()
    },
  }

  const transformOperatorsVisitor = {
    AssignmentExpression(path) {
      const node = path.node
      if (
        node.left.type === 'ArrayPattern' ||
        node.left.type === 'ObjectPattern'
      )
        throw new Error('Patterns not supported.')

      if (path.parentPath.node.type !== 'ExpressionStatement')
        throw new Error('Assignments must not be used as expressions.')

      // support +=
      const op = /([+\-*/])=/.exec(node.operator)
      if (op) {
        path.replaceWith(
          t.callExpression(importedIdentifiers.set, [
            node.left,
            t.binaryExpression(op[1], node.left, node.right),
          ]),
        )
        return
      }

      path.replaceWith(
        t.callExpression(importedIdentifiers.set, [
          path.node.left,
          path.node.right,
        ]),
      )
    },

    IfStatement(path) {
      path.traverse(transformOperatorsVisitor)
      const args = path.node.alternate
        ? [
            path.node.test,
            path.node.consequent.expression,
            path.node.alternate.expression,
          ]
        : [path.node.test, path.node.consequent.expression]
      path.replaceWith(t.callExpression(importedIdentifiers.cond, args))
    },

    'BinaryExpression|LogicalExpression'(path) {
      const op = path.node.operator
      const opName = binaryOps[op]

      if (!binaryOps[op]) throw new Error(`operator ${op} not supported.`)

      path.replaceWith(
        t.callExpression(importedIdentifiers[opName], [
          path.node.left,
          path.node.right,
        ]),
      )
    },

    UnaryExpression(path) {
      const op = path.node.operator
      if (op === '-') {
        path.skip()
        return
      }

      const opName = unaryOps[op]
      if (!unaryOps[op]) throw new Error(`operator ${op} not supported.`)
      path.replaceWith(
        t.callExpression(importedIdentifiers[opName], [path.node.argument]),
      )
    },

    BlockStatement(path) {
      path.traverse(transformOperatorsVisitor)
      path.replaceWith(
        t.arrayExpression(
          path.node.body.map(
            es => (es.type === 'ExpressionStatement' ? es.expression : es),
          ),
        ),
      )
    },

    ReturnStatement(path) {
      path.replaceWith(path.node.argument)
    },
  }

  exec.forEach(referencePath => {
    const macroCallExpressionPath = referencePath.parentPath
    macroCallExpressionPath.replaceWith(
      macroCallExpressionPath.node.arguments[0],
    )
  })

  define.forEach(referencePath => {
    const macroCallExpressionPath = referencePath.parentPath
    const lambdaPath = macroCallExpressionPath.get('arguments.0')
    const lambdaBodyPath = lambdaPath.get('body')

    if (lambdaBodyPath) {
      // If it's a lambda block then rewrite the code to allow for side exits
      if (lambdaBodyPath.node.type === 'BlockStatement') {
        const earlyReturn = referencePath.scope.generateUidIdentifier(
          'earlyReturn',
        )
        lambdaBodyPath.traverse(returnVisitor, {earlyReturn})

        referencePath.scope.push({
          id: earlyReturn,
          init: t.newExpression(t.identifier('Value'), []),
        })

        macroCallExpressionPath.traverse(blockVisitor, {
          importedIdentifiers,
          earlyReturn,
        })
        lambdaBodyPath.pushContainer('body', t.returnStatement(earlyReturn))
        lambdaPath.traverse(transformOperatorsVisitor, importedIdentifiers)
        macroCallExpressionPath.replaceWith(
          t.callExpression(importedIdentifiers.block, [lambdaBodyPath.node]),
        )
      }
    }
  })
}
