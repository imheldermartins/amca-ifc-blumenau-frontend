import { Schema } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'

import { moveBlockToDrop } from './blockLayout'

const schema = new Schema({
  nodes: {
    doc: { content: 'blockRow+' },
    text: { group: 'inline' },
    paragraph: { content: 'inline*' },
    editableBlock: {
      content: 'paragraph+',
      attrs: { id: { default: null }, kind: { default: 'richText' } },
    },
    blockColumn: {
      content: '(editableBlock|blockRow)+',
      attrs: { id: { default: null }, span: { default: 4 } },
    },
    blockRow: { content: 'blockColumn{1,4}', attrs: { id: { default: null } } },
  },
})

function block(id: string) {
  return schema.nodes.editableBlock.create(
    { id, kind: 'richText' },
    schema.nodes.paragraph.create(null, schema.text(id)),
  )
}

function column(id: string, span: number, ...blocks: ReturnType<typeof block>[]) {
  return schema.nodes.blockColumn.create({ id, span }, blocks)
}

function row(id: string, ...columns: ReturnType<typeof column>[]) {
  return schema.nodes.blockRow.create({ id }, columns)
}

function document(...rows: ReturnType<typeof row>[]) {
  return schema.nodes.doc.create(null, rows)
}

describe('moveBlockToDrop', () => {
  it.each([
    ['row-a', 'before', ['moving', 'row-a', 'row-b']],
    ['row-b', 'before', ['row-a', 'moving', 'row-b']],
    ['row-b', 'after', ['row-a', 'row-b', 'moving']],
  ] as const)('creates a full row %s/%s while preserving the other columns', (rowId, edge, expected) => {
    const result = moveBlockToDrop(document(
      row('row-a', column('a1', 50, block('a')), column('a2', 50, block('b'))),
      row('row-b', column('b1', 50, block('c')), column('b2', 50, block('d'))),
      row('source', column('source-col', 100, block('moving'))),
    ), 'moving', { type: 'row', rowId, edge })!

    expect(result.map((item) => item.childCount === 1 ? item.firstChild!.firstChild!.attrs.id : item.attrs.id)).toEqual(expected)
    for (const item of result) {
      if (item.attrs.id === 'row-a' || item.attrs.id === 'row-b') {
        expect(item.childCount).toBe(2)
        expect(item.content.content.map((col) => col.attrs.span)).toEqual([50, 50])
      } else {
        expect(item.firstChild!.attrs.span).toBe(100)
      }
    }
    expect(() => schema.nodes.doc.create(null, result).check()).not.toThrow()
  })

  it('moves between nested rows without flattening the sibling columns or losing row ownership', () => {
    const nested = schema.nodes.blockRow.create({ id: 'nested' }, [column('inner-a', 50, block('a')), column('inner-b', 50, block('b'))]);
    const host = schema.nodes.blockColumn.create({ id: 'host', span: 50 }, [nested, block('c')]);
    const input = document(row('outer', host, column('sibling', 50, block('d'))));
    const result = moveBlockToDrop(input, 'd', { type: 'item', blockId: 'b', edge: 'after' });
    expect(result).toHaveLength(1);
    const outer = result![0]!;
    expect(outer.childCount).toBe(1);
    expect(outer.firstChild!.attrs.span).toBe(100);
    const inner = outer.firstChild!.firstChild!;
    expect(inner.attrs.id).toBe('nested');
    expect(inner.childCount).toBe(2);
    expect(inner.child(1).content.content.map((node) => node.attrs.id)).toEqual(['b', 'd']);
    expect(outer.firstChild!.lastChild!.attrs.id).toBe('c');
    expect(() => schema.nodes.doc.create(null, result).check()).not.toThrow();
  });

  it('cria uma coluna dentro da row alvo', () => {
    const result = moveBlockToDrop(
      document(
        row('row-a', column('col-a', 4, block('a'))),
        row('row-b', column('col-b', 4, block('b'))),
      ),
      'b',
      { type: 'column', columnId: 'col-a', edge: 'right' },
    )

    expect(result).toHaveLength(1)
    expect(result?.[0].childCount).toBe(2)
    expect(result?.[0].content.content.map((node) => node.firstChild?.attrs.id)).toEqual(['a', 'b'])
    expect(result?.[0].content.content.map((node) => node.attrs.span)).toEqual([50, 50])
  })

  it('move um item para uma row independente', () => {
    const result = moveBlockToDrop(
      document(
        row('row-a', column('col-a', 2, block('a')), column('col-b', 2, block('b'))),
        row('row-b', column('col-c', 4, block('c'))),
      ),
      'b',
      { type: 'row', rowId: 'row-b', edge: 'after' },
    )

    expect(result).toHaveLength(3)
    expect(result?.map((item) => item.firstChild?.firstChild?.attrs.id)).toEqual(['a', 'c', 'b'])
    expect(result?.every((item) => item.firstChild?.attrs.span === 100)).toBe(true)
  })

  it('empilha um item abaixo de outro na mesma coluna', () => {
    const result = moveBlockToDrop(
      document(
        row('row-a', column('col-a', 4, block('a'))),
        row('row-b', column('col-b', 4, block('b'))),
      ),
      'b',
      { type: 'item', blockId: 'a', edge: 'after' },
    )

    expect(result).toHaveLength(1)
    expect(result?.[0].childCount).toBe(1)
    expect(result?.[0].firstChild?.content.content.map((node) => node.attrs.id)).toEqual(['a', 'b'])
  })

  it('move um item entre pilhas sem remover a coluna de origem', () => {
    const result = moveBlockToDrop(
      document(
        row(
          'row-a',
          column('col-a', 3, block('a'), block('b')),
          column('col-b', 1, block('c')),
        ),
      ),
      'b',
      { type: 'item', blockId: 'c', edge: 'after' },
    )

    expect(result?.[0].child(0).content.content.map((node) => node.attrs.id)).toEqual(['a'])
    expect(result?.[0].child(1).content.content.map((node) => node.attrs.id)).toEqual(['c', 'b'])
    expect(result?.[0].content.content.map((node) => node.attrs.span)).toEqual([75, 25])
  })

  it('limita cada row a quatro colunas', () => {
    const result = moveBlockToDrop(
      document(
        row(
          'row-a',
          column('col-a', 1, block('a')),
          column('col-b', 1, block('b')),
          column('col-c', 1, block('c')),
          column('col-d', 1, block('d')),
        ),
        row('row-b', column('col-e', 4, block('e'))),
      ),
      'e',
      { type: 'column', columnId: 'col-a', edge: 'right' },
    )

    expect(result).toBeNull()
  })
})
