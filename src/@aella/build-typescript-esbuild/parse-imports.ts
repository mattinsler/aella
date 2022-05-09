import { Visitor } from '@swc/core/Visitor.js';
import { transformSync } from '@swc/core';

import type {
  CallExpression,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  Program,
  TsImportEqualsDeclaration,
  TsType,
} from '@swc/core';

class DependencyExtractor extends Visitor {
  public imports: { end: number; start: number; value: string }[] = [];

  private spanStart: number = 0;

  visitProgram(node: Program) {
    this.spanStart = node.span.start;
    return super.visitProgram(node);
  }

  visitImportDeclaration(node: ImportDeclaration) {
    this.imports.push({
      end: node.source.span.end - this.spanStart - 1,
      start: node.source.span.start - this.spanStart + 1,
      value: node.source.value,
    });
    return node;
  }

  visitTsImportEqualsDeclaration(node: TsImportEqualsDeclaration) {
    if (node.moduleRef.type === 'TsExternalModuleReference') {
      if (node.moduleRef.expression.type === 'StringLiteral') {
        this.imports.push({
          end: node.moduleRef.expression.span.end - this.spanStart - 1,
          start: node.moduleRef.expression.span.start - this.spanStart + 1,
          value: node.moduleRef.expression.value,
        });
      }
    }
    return node;
  }

  // visitExportDeclaration(node: ExportDeclaration) {
  //   return node;
  // }

  visitExportAllDeclaration(node: ExportAllDeclaration) {
    this.imports.push({
      end: node.source.span.end - this.spanStart - 1,
      start: node.source.span.start - this.spanStart + 1,
      value: node.source.value,
    });
    return node;
  }

  // visitExportDefaultDeclaration(node: ExportDefaultDeclaration) {
  //   return node;
  // }

  visitExportNamedDeclaration(node: ExportNamedDeclaration) {
    if (node.source) {
      this.imports.push({
        end: node.source.span.end - this.spanStart - 1,
        start: node.source.span.start - this.spanStart + 1,
        value: node.source.value,
      });
    }
    return node;
  }

  visitCallExpression(node: CallExpression) {
    if (node.callee.type === 'Import') {
      if (node.arguments[0].expression.type === 'StringLiteral') {
        this.imports.push({
          end: node.arguments[0].expression.span.end - this.spanStart - 1,
          start: node.arguments[0].expression.span.start - this.spanStart + 1,
          value: node.arguments[0].expression.value,
        });
      }
    }
    return node;
  }

  visitTsType(node: TsType) {
    return node;
  }
}

export function parseImportsWithLocation(content: string, file: string) {
  const extractor = new DependencyExtractor();

  transformSync(content, {
    filename: file,
    isModule: true,
    jsc: {
      loose: true,
      parser: {
        syntax: 'typescript',
        dynamicImport: true,
        tsx: true,
      },
    },
    plugin: (m) => extractor.visitProgram(m),
  });

  return extractor.imports;
}

export function parseImports(content: string, file: string) {
  return Array.from(new Set(parseImportsWithLocation(content, file).map((i) => i.value)));
}
