import path from 'path'
import pluginTester from 'babel-plugin-tester'
import plugin from 'babel-plugin-macros'

const projectRoot = path.join(__dirname, '../../')

expect.addSnapshotSerializer({
  print(val) {
    return val.split(projectRoot).join('<PROJECT_ROOT>/')
  },
  test(val) {
    return typeof val === 'string'
  },
})

pluginTester({
  plugin,
  snapshot: true,
  babelOptions: {filename: __filename, parserOpts: {plugins: ['jsx']}},
  tests: [
    {
      title: 'handles if statements',
      code: `
        const animate = require('../macro');

        const offsetX = animate(() => {
          if (offsetX === 30) {
            return 22;
          }
          else if (offsetY === 90) {
            offsetY = 55;
          }
          return 88;
        })
      `,
    },
  ],
})
