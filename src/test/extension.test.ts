import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { highlightMatch } from '../highlightMatch';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('highlightMatch', () => {
  test('クエリが空ならそのまま返す', () => {
    assert.equal(highlightMatch('abc def', ''), 'abc def');
  });

  test('完全一致部分をハイライト', () => {
    assert.equal(
      highlightMatch('abc def', 'abc'),
      '<span class="highlight-match">abc</span> def'
    );
  });

  test('部分一致をすべてハイライト', () => {
    assert.equal(
      highlightMatch('abc abc', 'abc'),
      '<span class="highlight-match">abc</span> <span class="highlight-match">abc</span>'
    );
  });

  test('大文字小文字を区別しない（小文字クエリ）', () => {
    assert.equal(
      highlightMatch('Abc aBc', 'abc'),
      '<span class="highlight-match">Abc</span> <span class="highlight-match">aBc</span>'
    );
    test('正規表現でハイライトできる', () => {
      assert.equal(
        highlightMatch('updateTimeStamp u.date update', 'u\\.date'),
        'updateTimeStamp <span class="highlight-match">u.date</span> update'
      );
      assert.equal(
        highlightMatch('updateTimeStamp u.date update', 'update.*?date'),
        '<span class="highlight-match">updateTimeStamp u.date</span> update'
      );
    });
  });

  test('大文字クエリならcase sensitive', () => {
    assert.equal(
      highlightMatch('Abc aBc', 'A'),
      '<span class="highlight-match">A</span>bc aBc'
    );
    assert.equal(
      highlightMatch('Abc aBc', 'B'),
      'Abc a<span class="highlight-match">B</span>c'
    );
  });

  test('正規表現記号を含むクエリも安全', () => {
    assert.equal(
      highlightMatch('a.b+c?', 'a.b'),
      '<span class="highlight-match">a.b</span>+c?'
    );
  });
});
