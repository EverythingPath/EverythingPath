// #251 §8: parse the admitted language as data, never executable JavaScript.
type FormulaNode =
  | { kind: 'integer'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'unary'; operator: '+' | '-'; operand: FormulaNode }
  | {
      kind: 'binary';
      operator: '+' | '-' | '*' | '/';
      left: FormulaNode;
      right: FormulaNode;
    }
  | {
      kind: 'function';
      name: 'floor' | 'ceil' | 'min' | 'max';
      arguments: FormulaNode[];
    };

export class FormulaError extends Error {}

function tokenizeFormula(expression: string): string[] {
  if (expression.length > 4096) throw new FormulaError('Formula is too long.');
  const tokens: string[] = [];
  let position = 0;
  while (position < expression.length) {
    const rest = expression.slice(position);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }
    const token = /^(?:\d+|@[A-Za-z][A-Za-z0-9_.]*|[A-Za-z]+|[()+*/,-])/.exec(
      rest,
    )?.[0];
    if (!token)
      throw new FormulaError(
        'Use only integers, arithmetic, floor, ceil, min, max and supported variables.',
      );
    tokens.push(token);
    position += token.length;
    if (tokens.length > 512) throw new FormulaError('Formula is too complex.');
  }
  return tokens;
}

type FormulaFunction = Extract<FormulaNode, { kind: 'function' }>['name'];

class FormulaParser {
  private tokens: readonly string[];
  private cursor = 0;
  private depth = 0;

  constructor(tokens: readonly string[]) {
    this.tokens = tokens;
  }

  parse(): FormulaNode {
    const root = this.expression();
    if (this.cursor !== this.tokens.length)
      throw new FormulaError('Unexpected formula input.');
    return root;
  }

  private consume(token: string) {
    if (this.tokens[this.cursor] !== token)
      throw new FormulaError(`Expected ${token}.`);
    this.cursor++;
  }

  private primary(): FormulaNode {
    if (++this.depth > 64)
      throw new FormulaError('Formula is nested too deeply.');
    try {
      return this.primaryNode();
    } finally {
      this.depth--;
    }
  }

  private primaryNode(): FormulaNode {
    const token = this.tokens[this.cursor++];
    if (token === '+' || token === '-')
      return { kind: 'unary', operator: token, operand: this.primary() };
    if (token === '(') {
      const node = this.expression();
      this.consume(')');
      return node;
    }
    if (token && /^\d+$/.test(token)) {
      const value = Number(token);
      if (!Number.isSafeInteger(value))
        throw new FormulaError('Use safe integer literals.');
      return { kind: 'integer', value };
    }
    if (token?.startsWith('@')) return { kind: 'variable', name: token };
    if (
      token === 'floor' ||
      token === 'ceil' ||
      token === 'min' ||
      token === 'max'
    )
      return this.functionNode(token);
    throw new FormulaError(
      'Expected an integer, supported variable or function.',
    );
  }

  private functionNode(name: FormulaFunction): FormulaNode {
    this.consume('(');
    const args = [this.expression()];
    while (this.tokens[this.cursor] === ',') {
      this.cursor++;
      args.push(this.expression());
    }
    this.consume(')');
    if ((name === 'floor' || name === 'ceil') && args.length !== 1)
      throw new FormulaError(`${name} takes one argument.`);
    if ((name === 'min' || name === 'max') && args.length < 2)
      throw new FormulaError(`${name} takes at least two arguments.`);
    return { kind: 'function', name, arguments: args };
  }

  private product(): FormulaNode {
    let node = this.primary();
    while (
      this.tokens[this.cursor] === '*' ||
      this.tokens[this.cursor] === '/'
    ) {
      const operator = this.tokens[this.cursor] === '*' ? '*' : '/';
      this.cursor++;
      node = { kind: 'binary', operator, left: node, right: this.primary() };
    }
    return node;
  }

  private expression(): FormulaNode {
    let node = this.product();
    while (
      this.tokens[this.cursor] === '+' ||
      this.tokens[this.cursor] === '-'
    ) {
      const operator = this.tokens[this.cursor] === '+' ? '+' : '-';
      this.cursor++;
      node = { kind: 'binary', operator, left: node, right: this.product() };
    }
    return node;
  }
}

export function parseFormula(expression: string): FormulaNode {
  return new FormulaParser(tokenizeFormula(expression)).parse();
}

export function evaluateFormula(
  node: FormulaNode,
  variable: (name: string) => number,
): number {
  function evaluate(current: FormulaNode): number {
    switch (current.kind) {
      case 'integer':
        return current.value;
      case 'variable':
        return variable(current.name);
      case 'unary':
        return current.operator === '-'
          ? -evaluate(current.operand)
          : evaluate(current.operand);
      case 'binary': {
        const left = evaluate(current.left);
        const right = evaluate(current.right);
        switch (current.operator) {
          case '+':
            return left + right;
          case '-':
            return left - right;
          case '*':
            return left * right;
          case '/':
            if (right === 0)
              throw new FormulaError('Division by zero is unsupported.');
            return left / right;
        }
      }
      case 'function': {
        const values = current.arguments.map(evaluate);
        switch (current.name) {
          case 'floor':
            return Math.floor(values[0] ?? 0);
          case 'ceil':
            return Math.ceil(values[0] ?? 0);
          case 'min':
            return Math.min(...values);
          case 'max':
            return Math.max(...values);
        }
      }
    }
  }
  const value = evaluate(node);
  if (!Number.isFinite(value))
    throw new FormulaError('Formula must produce a finite number.');
  // CRB p. 11: round fractional contributions down after the full expression.
  return Math.floor(value);
}
