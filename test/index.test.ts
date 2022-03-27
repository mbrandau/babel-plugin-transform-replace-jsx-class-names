import { transform } from '@babel/core';
import plugin, { Options } from '../src';

const example = `
function classNames() {
  return args.filter(a=>!!a).join(' ')
}
const cls = cn("text-blue")
function Component(props) {
  let randomClass = ["container"]
  randomClass.push("text-red")
  return <div className="container">
    <span className={classNames("text-red",{"container":false},randomClass,\`container \${randomClass}\`,cn('text-blue'))}>{props.children}</span>
  </div>;
}`;

const replaceClassName = (className: string) => `replaced_${className}`;

function runTest(code: string, pluginConfig?: Options) {
  return expect(
    transform(code, {
      plugins: [[plugin, { replaceClassName, ...(pluginConfig ?? {}) }]],
    })!.code
  ).toMatchSnapshot();
}

it('basic', () => {
  runTest(example);
});

it('experimentalReplaceVariables', () =>
  runTest(example, {
    experimentalReplaceVariables: true,
  }));

it('replacerFunctionName', () =>
  runTest(example, {
    replacerFunctionName: 'cn',
  }));
