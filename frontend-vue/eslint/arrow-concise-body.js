/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: { type: 'suggestion', fixable: 'code', schema: [] },
  create(context) {
    return {
      ArrowFunctionExpression(node) {
        const { body } = node
        if (
          body.type !== 'BlockStatement' ||
          body.body.length !== 1 ||
          body.body[0].type !== 'ExpressionStatement'
        ) return

        const expression = body.body[0].expression
        context.report({
          node,
          message: 'Arrow function with single expression should use concise body.',
          fix(ruleFixer) {
            const expressionText = context.sourceCode.getText(expression)
            const fixedText = expression.type === 'ObjectExpression' ? `(${expressionText})` : expressionText
            return ruleFixer.replaceText(body, fixedText)
          }
        })
      }
    }
  }
}
