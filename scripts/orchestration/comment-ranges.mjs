// Comment ranges of JS/TS sources from the TypeScript parser, for the gate's import scan
// (gate_operator.py code_imports): an unresolved import is ignored only inside one of them.
// stdin: {"<path>": "<source text>", ...}. stdout: {"<path>": [[start, end], ...] | null}, in
// UTF-16 offsets. The path's extension picks the script kind (JSX for .tsx, .jsx and .js);
// null means the parser reported a syntax error, so none of that file's text counts as comment.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const isJsDoc = (node) =>
  node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;

function commentRanges(name, text) {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, false);
  if (source.parseDiagnostics.length > 0) return null;
  const ranges = new Map();
  // A truthy return would stop TypeScript's comment iteration, so `add` returns nothing.
  const add = (pos, end) => {
    ranges.set(pos, end);
  };
  const visit = (node) => {
    // A JSDoc node lies inside a comment; the next token's trivia reports that comment whole.
    if (isJsDoc(node)) return;
    const children = node.getChildren(source);
    children.forEach(visit);
    // JSX text is not trivia: `//` inside it is text.
    if (children.length > 0 || node.kind === ts.SyntaxKind.JsxText) return;
    // A token's leading trivia holds every comment since the previous token: those on the
    // previous token's line (the trailing scan) and those after a line break (the leading scan).
    ts.forEachLeadingCommentRange(text, node.pos, add);
    ts.forEachTrailingCommentRange(text, node.pos, add);
  };
  visit(source);
  return [...ranges].sort(([a], [b]) => a - b);
}

const sources = JSON.parse(readFileSync(0, 'utf8'));
const result = Object.fromEntries(
  Object.entries(sources).map(([name, text]) => [name, commentRanges(name, text)]),
);
process.stdout.write(JSON.stringify(result));
