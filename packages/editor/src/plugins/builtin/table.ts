// =============================================================================
// Builtin plugin: table (Story 6.4)
// -----------------------------------------------------------------------------
// Owns FOUR Plate element types: `table`, `tr`, `td`, `th`. The inverse
// dispatch routes all of them here; the plugin disambiguates internally.
// Validates that every row has the same cell count (AC6 carryover).
// =============================================================================

import type { TableBlock, TableCell, TableRow } from '@anydocs/core';
import {
  TablePlugin as PlateTablePlugin,
  TableRowPlugin as PlateTableRowPlugin,
  TableCellPlugin as PlateTableCellPlugin,
  TableCellHeaderPlugin as PlateTableCellHeaderPlugin,
} from '@udecode/plate-table/react';

import type { EditorPlugin } from '../../../contract/public-api.ts';
import {
  PLATE_TABLE,
  PLATE_TABLE_CELL,
  PLATE_TABLE_HEADER_CELL,
  PLATE_TABLE_ROW,
} from '../../converters/element-types.ts';
import {
  inlineChildrenToPlate,
  isPlateElement,
  plateChildrenToInline,
  withId,
  withOptionalId,
  type PlateElementNode,
} from '../../converters/inline-shared.ts';

function tableBlockToPlate(block: TableBlock): PlateElementNode {
  if (block.rows.length > 0) {
    const expectedCellCount = block.rows[0]!.cells.length;
    for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
      const row = block.rows[rowIndex]!;
      if (row.cells.length !== expectedCellCount) {
        throw new Error(
          `table-plugin: row ${rowIndex} has ${row.cells.length} cells; ` +
          `expected ${expectedCellCount} (all rows must have the same number of cells).`,
        );
      }
    }
  }
  return withId(
    {
      type: PLATE_TABLE,
      children: block.rows.map(rowToPlate),
    },
    block.id,
  );
}

function rowToPlate(row: TableRow): PlateElementNode {
  return withId(
    {
      type: PLATE_TABLE_ROW,
      children: row.cells.map(cellToPlate),
    },
    row.id,
  );
}

function cellToPlate(cell: TableCell): PlateElementNode {
  const node: PlateElementNode = {
    type: cell.header === true ? PLATE_TABLE_HEADER_CELL : PLATE_TABLE_CELL,
    children: inlineChildrenToPlate(cell.children),
  };
  if (cell.id !== undefined) node.id = cell.id;
  return node;
}

function tableFromPlate(node: PlateElementNode): TableBlock {
  return withOptionalId(
    {
      type: 'table' as const,
      rows: node.children
        .filter((child): child is PlateElementNode => isPlateElement(child) && child.type === PLATE_TABLE_ROW)
        .map(tableRowFromPlate),
    },
    node,
  );
}

function tableRowFromPlate(node: PlateElementNode): TableRow {
  const row: TableRow = {
    cells: node.children
      .filter((child): child is PlateElementNode =>
        isPlateElement(child) && (child.type === PLATE_TABLE_CELL || child.type === PLATE_TABLE_HEADER_CELL),
      )
      .map(tableCellFromPlate),
  };
  if (typeof node.id === 'string') row.id = node.id;
  return row;
}

function tableCellFromPlate(node: PlateElementNode): TableCell {
  // `@udecode/plate-table`'s normalizer wraps cell content in paragraph
  // blocks (Plate's cell model is block-based) whenever a Slate operation
  // touches the cell — e.g. typing in a cell, or `tf.insertNodes` of a
  // fresh table from the slash menu. DocContentV1 cells hold INLINE children
  // only, so unwrap any paragraph wrappers before converting; cells coming
  // straight from `docContentToPlate` (inline children, never normalized)
  // pass through unchanged.
  const unwrapped = node.children.flatMap((child) =>
    isPlateElement(child) && child.type === 'p' ? child.children : [child],
  );
  const cell: TableCell = {
    children: plateChildrenToInline(unwrapped),
  };
  if (typeof node.id === 'string') cell.id = node.id;
  if (node.type === PLATE_TABLE_HEADER_CELL) cell.header = true;
  return cell;
}

function plateToDocContent(node: PlateElementNode): TableBlock {
  if (node.type === PLATE_TABLE) {
    return tableFromPlate(node);
  }
  throw new Error(
    `table-plugin: unexpected top-level node of type '${node.type}'; ` +
    `table rows / cells must be nested inside a 'table' element.`,
  );
}

export const tablePlugin: EditorPlugin & { platePlugin: unknown; extraPlatePlugins: unknown[] } = {
  blockType: 'table',
  plateElementTypes: [PLATE_TABLE, PLATE_TABLE_ROW, PLATE_TABLE_CELL, PLATE_TABLE_HEADER_CELL],
  schemaFragment: { kind: 'table', allowsHeaderRow: true },
  docContentToPlate: (block: unknown) => tableBlockToPlate(block as TableBlock),
  plateToDocContent: (node: unknown) => plateToDocContent(node as PlateElementNode),
  platePlugin: PlateTablePlugin,
  // Plate's table family requires every nested type (tr / td / th) to be
  // registered alongside the top-level table plugin or rendering breaks.
  // The runtime loader unpacks `extraPlatePlugins` next to `platePlugin`.
  extraPlatePlugins: [PlateTableRowPlugin, PlateTableCellPlugin, PlateTableCellHeaderPlugin],
};
