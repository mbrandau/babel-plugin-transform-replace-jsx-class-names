import debug from 'debug';
import type { types } from '@babel/core';
import { NodePath } from '@babel/traverse';
import jsx from '@babel/plugin-syntax-jsx';

const log = debug('babel:plugin-transform-jsx-class-names');

export type ReplaceClassNameFn = (className: string) => string;

const defaultReplaceClassNameFn = (className: string) => className;

export type Options = {
  /**
   * Replace class names with the result of `replaceClassName`
   */
  replaceClassName?: ReplaceClassNameFn;
  replacerFunctionName?: string;
  /**
   * Try to replace assignments of variables that are used in a className property
   */
  experimentalReplaceVariables?: boolean;
};

function replaceClassnames(
  classNames: string,
  replaceClassName: ReplaceClassNameFn
): string {
  const newStr = classNames
    .split(/\s+/)
    .map(cls => (cls.trim().length > 0 ? replaceClassName(cls) : cls))
    .join(' ');
  log("replacing '%s' with '%s'", classNames, newStr);
  return newStr;
}

function visit(
  path: NodePath<types.JSXAttribute> | NodePath<types.CallExpression>,
  options: Options,
  t: typeof types
) {
  const identifiers = new Set();
  const replace = (cls: string) =>
    replaceClassnames(
      cls,
      options.replaceClassName ?? defaultReplaceClassNameFn
    );

  const visitors = {
    Identifier(path: NodePath<types.Identifier>) {
      if (!options.experimentalReplaceVariables) return;

      // Don't traverse into function calls
      if (t.isCallExpression(path.parent) && path.key === 'callee') return;

      identifiers.add(path.node.name);
      path.skip();
    },
    StringLiteral(path: NodePath<types.StringLiteral>) {
      path.replaceWith(t.stringLiteral(replace(path.node.value)));
      path.skip();
    },
    TemplateElement(path: NodePath<types.TemplateElement>) {
      path.replaceWith(
        t.templateElement({
          raw: replace(path.node.value.raw),
        })
      );
      path.skip();
    },
  };

  path.traverse(visitors);

  if (options.experimentalReplaceVariables && identifiers.size > 0) {
    path.scope.path.traverse({
      Identifier(path: NodePath<types.Identifier>) {
        if (identifiers.has(path.node.name))
          log('identifier found: %s', path.node.name, path);
      },
      VariableDeclarator(path: NodePath<types.VariableDeclarator>) {
        if (
          t.isIdentifier(path.node.id) &&
          identifiers.has(path.node.id.name)
        ) {
          path.traverse(visitors);
          path.skip();
        }
      },
      AssignmentExpression(path: NodePath<types.AssignmentExpression>) {
        if (
          t.isIdentifier(path.node.left) &&
          identifiers.has(path.node.left.name)
        ) {
          path.traverse(visitors);
          path.skip();
        }
      },
    });
  }
  path.skip();
}

export default function({ types: t }: { types: typeof types }) {
  return {
    name: 'transform-jsx-class-names',
    visitor: {
      CallExpression(
        path: NodePath<types.CallExpression>,
        state: { opts: Options }
      ) {
        if (
          state.opts.replacerFunctionName &&
          t.isIdentifier(path.node.callee) &&
          path.node.callee.name === state.opts.replacerFunctionName
        ) {
          visit(path, state.opts, t);
        }
      },
      JSXAttribute(
        path: NodePath<types.JSXAttribute>,
        state: { opts: Options }
      ) {
        if (!path.node.value) {
          return;
        }
        if (
          t.isJSXIdentifier(path.node.name) &&
          ['class', 'className'].includes(path.node.name.name)
        ) {
          visit(path, state.opts, t);
        }
      },
    },
    inherits: jsx,
  };
}
